import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertPropertySchema,
  insertSavedPropertySchema,
  insertPropertyDislikeSchema,
  insertUserSchema,
  insertLeadSchema,
  insertSocietySchema,
  insertBlockPlotSchema,
  updateBlockPlotPositionSchema,
} from "../shared/schema";
import {
  validateHttpsMediaForS3,
  validateHttpsMediaPatchForS3,
  validatePublicMediaUrl,
} from "../shared/media-url";
import { s3GetObjectBodyToReadable } from "../shared/s3-stream-body";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

type AuthUser = { userId: string; email: string; role: string };
type AuthRequest = Request & { user?: AuthUser };

function verifyJwt(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

function getAuthUser(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return verifyJwt(authHeader.slice(7));
  }
  return null;
}

/** For &lt;video src&gt; / &lt;img src&gt; which cannot send Authorization headers. */
function getAdminUserForMediaRequest(req: Request): AuthUser | null {
  const fromHeader = getAuthUser(req);
  if (fromHeader) return fromHeader;
  const q = req.query.access_token;
  if (typeof q === "string" && q.length > 0) {
    return verifyJwt(q);
  }
  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as AuthRequest).user = user;
  return next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  (req as AuthRequest).user = user;
  return next();
}

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
const s3Region = process.env.AWS_REGION;
const s3Bucket = process.env.S3_BUCKET_NAME;
const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");

const isS3Enabled = Boolean(
  s3Region &&
  s3Bucket &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY
);

let s3Client: S3Client | null = null;

function getS3Client() {
  if (!isS3Enabled) return null;
  if (!s3Client) {
    s3Client = new S3Client({ region: s3Region });
  }
  return s3Client;
}

function getS3ObjectUrl(key: string) {
  if (s3PublicBaseUrl) {
    return `${s3PublicBaseUrl}/${key}`;
  }
  return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;
}

async function uploadFileToS3(localPath: string, key: string, contentType?: string) {
  const client = getS3Client();
  if (!client || !s3Bucket) {
    throw new Error("S3 is not configured");
  }

  const body = await fs.promises.readFile(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return getS3ObjectUrl(key);
}

async function cleanupFiles(paths: string[]) {
  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // Ignore cleanup errors for missing/locked temp files.
      }
    })
  );
}

function ensureUploadDir() {
  const uploadDir = path.join(process.cwd(), "uploads", "videos");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

function ensureProcessedDirs() {
  const processedDir = path.join(process.cwd(), "uploads", "processed");
  const thumbnailsDir = path.join(process.cwd(), "uploads", "thumbnails");
  if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
  if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
  return { processedDir, thumbnailsDir };
}

async function getVideoMetadata(filePath: string) {
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout || "{}");
  const stream = parsed.streams?.[0] ?? {};
  return {
    width: stream.width ? Number(stream.width) : undefined,
    height: stream.height ? Number(stream.height) : undefined,
    durationSeconds: stream.duration ? Math.round(Number(stream.duration)) : undefined,
  };
}

async function processVideo(filePath: string, filename: string) {
  if (!isS3Enabled) {
    throw new Error("S3 upload is required but not configured");
  }

  const { processedDir, thumbnailsDir } = ensureProcessedDirs();
  const baseName = path.parse(filename).name;
  const processedName = `${baseName}-processed.mp4`;
  const thumbnailName = `${baseName}-thumb.jpg`;
  const processedPath = path.join(processedDir, processedName);
  const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    filePath,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    processedPath,
  ]);

  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    processedPath,
    "-vf",
    "select=eq(n\\,0),scale=720:-1",
    "-frames:v",
    "1",
    thumbnailPath,
  ]);

  const stat = await fs.promises.stat(processedPath);
  const meta = await getVideoMetadata(processedPath);

  try {
    const videoKey = `properties/videos/${processedName}`;
    const thumbnailKey = `properties/thumbnails/${thumbnailName}`;
    const [videoUrl, thumbnailUrl] = await Promise.all([
      uploadFileToS3(processedPath, videoKey, "video/mp4"),
      uploadFileToS3(thumbnailPath, thumbnailKey, "image/jpeg"),
    ]);
    return {
      videoUrl,
      thumbnailUrl,
      videoKey,
      thumbnailKey,
      durationSeconds: meta.durationSeconds,
      width: meta.width,
      height: meta.height,
      filesizeBytes: stat.size,
    };
  } finally {
    await cleanupFiles([processedPath, thumbnailPath]);
  }
}

const uploadStorage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: { originalname: string }, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const uploadVideo = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req: Request, file: { mimetype: string }, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed."), false);
    }
  },
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: Request, file: { mimetype: string }, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."), false);
    }
  },
});

function slugifySocietyName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

function normalizePropertyInput(body: Record<string, any>) {
  const next = { ...body };
  if (typeof next.price === "number") next.price = String(next.price);
  if (typeof next.bathrooms === "number") next.bathrooms = String(next.bathrooms);
  if (typeof next.bedrooms === "string") next.bedrooms = Number(next.bedrooms);
  if (typeof next.squareFeet === "string") next.squareFeet = Number(next.squareFeet);
  if (typeof next.latitude === "string") {
    const t = next.latitude.trim();
    next.latitude = t === "" ? undefined : t;
  }
  if (typeof next.longitude === "string") {
    const t = next.longitude.trim();
    next.longitude = t === "" ? undefined : t;
  }
  return next;
}

function validateBathroomsRange(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const bathrooms = Number(value);
  if (!Number.isFinite(bathrooms)) {
    return "Bathrooms must be a valid number.";
  }
  if (bathrooms < 0 || bathrooms > 99.9) {
    return "Bathrooms must be between 0 and 99.9.";
  }
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseBbox(value: string | undefined) {
  if (!value) return null;
  const parts = value.split(",").map((v) => parseNumber(v));
  if (parts.length !== 4 || parts.some((v) => v === undefined)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as number[];
  return { minLng, minLat, maxLng, maxLat };
}

function computeScore(viewCount: number, saveCount: number, createdAt?: string | Date) {
  const base = viewCount * 0.2 + saveCount * 1.0;
  const created = createdAt ? new Date(createdAt).getTime() : Date.now();
  const daysOld = Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24));
  const recencyBoost = Math.max(0, 30 - daysOld) / 30;
  return base + recencyBoost;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }

      // Create user
      const user = await storage.createUser({
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role: "user",
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, (user as any).passwordHash || "");
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/uploads/video", requireAdmin, (req, res) => {
    uploadVideo.single("video")(req, res, (err: unknown) => {
      if (err) {
        const uploadError = err as { code?: string; message?: string };
        const message =
          err instanceof multer.MulterError
            ? uploadError.code === "LIMIT_FILE_SIZE"
              ? "Video exceeds 200MB limit"
              : uploadError.message ?? "Upload failed"
            : uploadError.message || "Upload failed";
        return res.status(400).json({ error: message });
      }

      const file = (req as Request & { file?: { filename: string; path: string } }).file;
      if (!file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }

      (async () => {
        try {
          if (!isS3Enabled) {
            return res.status(500).json({
              error: "S3 is required for video uploads. Configure AWS credentials and bucket.",
            });
          }
          const processed = await processVideo(file.path, file.filename);
          return res.status(201).json({
            ...processed,
            videoStatus: "ready",
          });
        } catch (processError) {
          console.warn("[Video] Processing failed; upload rejected", processError);
          const errno = processError as NodeJS.ErrnoException;
          const error =
            errno?.code === "ENOENT"
              ? "Video processing needs FFmpeg on PATH, or set FFMPEG_PATH and FFPROBE_PATH."
              : "Video processing failed. Upload was not stored.";
          return res.status(422).json({ error });
        } finally {
          await cleanupFiles([file.path]);
        }
      })();
    });
  });

  /**
   * Stream S3 object to the browser for admin preview (auth via Bearer or ?access_token=).
   * Use when the bucket object is not yet public or CORS blocks direct &lt;video src&gt;.
   */
  app.get("/api/admin/s3-media", async (req, res) => {
    const user = getAdminUserForMediaRequest(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const key = String(req.query.key ?? "").trim();
    const allowed =
      key.startsWith("properties/videos/") || key.startsWith("properties/thumbnails/");
    if (!key || !allowed) {
      return res.status(400).json({ error: "Invalid key" });
    }
    const client = getS3Client();
    if (!client || !s3Bucket) {
      return res.status(503).json({ error: "S3 not configured" });
    }
    const range = req.headers.range;
    try {
      const out = await client.send(
        new GetObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          ...(range ? { Range: range } : {}),
        })
      );
      if (!out.Body) {
        return res.status(404).end();
      }
      const statusCode = out.ContentRange ? 206 : 200;
      res.status(statusCode);
      res.setHeader("Accept-Ranges", "bytes");
      if (out.ContentType) res.setHeader("Content-Type", out.ContentType);
      if (out.ContentLength != null) res.setHeader("Content-Length", String(out.ContentLength));
      if (out.ContentRange) res.setHeader("Content-Range", out.ContentRange);
      if (out.ETag) res.setHeader("ETag", out.ETag);
      res.setHeader("Cache-Control", "private, no-store");

      let readable: ReturnType<typeof s3GetObjectBodyToReadable>;
      try {
        readable = s3GetObjectBodyToReadable(out.Body);
      } catch (normalizeErr) {
        console.warn("[S3 media] body normalize failed", normalizeErr);
        return res.status(500).json({ error: "Invalid S3 stream" });
      }
      readable.on("error", (streamErr) => {
        console.warn("[S3 media] readable error", streamErr);
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.destroy(streamErr);
        }
      });
      await pipeline(readable, res);
    } catch (e: unknown) {
      const err = e as {
        name?: string;
        Code?: string;
        message?: string;
        $metadata?: { httpStatusCode?: number };
      };
      const code = err.name || err.Code;
      const http = err.$metadata?.httpStatusCode;
      if (code === "NoSuchKey" || http === 404) {
        return res.status(404).end();
      }
      if (code === "AccessDenied" || http === 403) {
        console.warn(
          `[S3 media] AccessDenied — add IAM permission s3:GetObject on arn:aws:s3:::${s3Bucket}/properties/* for the credentials in .env (PutObject alone is not enough).`,
          err.message
        );
        if (!res.headersSent) {
          return res.status(403).json({
            error:
              "S3 denied GetObject. Your IAM user needs s3:GetObject on this bucket’s properties/* prefix (same user as upload).",
          });
        }
      }
      console.warn("[S3 media] stream failed", e);
      if (!res.headersSent) {
        res.status(502).json({ error: "Failed to load object" });
      }
    }
  });

  /** Admin-only: verify S3 credentials + PutObject on bucket (same prefix as video uploads). */
  app.get("/api/admin/s3-check", requireAdmin, async (_req, res) => {
    if (!isS3Enabled) {
      return res.status(503).json({
        ok: false,
        error:
          "S3 not configured. Set AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.",
      });
    }
    const client = getS3Client();
    if (!client || !s3Bucket) {
      return res.status(503).json({ ok: false, error: "S3 client unavailable" });
    }
    const key = `properties/.s3-health-${Date.now()}.txt`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          Body: Buffer.from("ok", "utf8"),
          ContentType: "text/plain",
        })
      );
      const objectUrl = getS3ObjectUrl(key);
      let anonymousHeadStatus: number | undefined;
      try {
        const headRes = await fetch(objectUrl, { method: "HEAD" });
        anonymousHeadStatus = headRes.status;
      } catch {
        anonymousHeadStatus = undefined;
      }
      const anonymousGetObjectOk = anonymousHeadStatus === 200;
      let deleteOk = false;
      try {
        await client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
        deleteOk = true;
      } catch {
        // Policy may omit DeleteObject; PutObject still confirms connectivity.
      }
      const suggestedBucketPolicy = anonymousGetObjectOk
        ? undefined
        : JSON.stringify(
            {
              Version: "2012-10-17",
              Statement: [
                {
                  Sid: "PublicReadPropertiesMedia",
                  Effect: "Allow",
                  Principal: "*",
                  Action: "s3:GetObject",
                  Resource: `arn:aws:s3:::${s3Bucket}/properties/*`,
                },
              ],
            },
            null,
            2
          );
      return res.json({
        ok: true,
        bucket: s3Bucket,
        region: s3Region,
        putObjectKey: key,
        deleteOk,
        objectUrl,
        anonymousGetObjectOk,
        anonymousHeadStatus,
        suggestedBucketPolicy,
      });
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      return res.status(502).json({
        ok: false,
        error: err?.name || err?.message || "S3 request failed",
        detail: err?.message,
      });
    }
  });

  // Property routes
  app.get("/api/properties", async (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const search = String(req.query.search ?? "").trim().toLowerCase();
      const city = String(req.query.city ?? "").trim().toLowerCase();
      const state = String(req.query.state ?? "").trim().toLowerCase();
      const status = String(req.query.status ?? "").trim();
      const minPrice = parseNumber(req.query.minPrice);
      const maxPrice = parseNumber(req.query.maxPrice);
      const minBedrooms = parseNumber(req.query.minBedrooms);
      const minBathrooms = parseNumber(req.query.minBathrooms);
      const minLat = parseNumber(req.query.minLat);
      const maxLat = parseNumber(req.query.maxLat);
      const minLng = parseNumber(req.query.minLng);
      const maxLng = parseNumber(req.query.maxLng);
      const bbox = parseBbox(typeof req.query.bbox === "string" ? req.query.bbox : undefined);
      const sort = String(req.query.sort ?? "recommended");

      let properties = await storage.getAllProperties();

      if (!authUser || authUser.role !== "admin") {
        properties = properties.filter((p) => p.status === "active");
      } else if (status) {
        properties = properties.filter((p) => p.status === status);
      }

      if (search) {
        properties = properties.filter((p) =>
          [p.title, p.city, p.state, p.address, p.neighborhood]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search))
        );
      }
      if (city) {
        properties = properties.filter((p) => (p.city ?? "").toLowerCase().includes(city));
      }
      if (state) {
        properties = properties.filter((p) => (p.state ?? "").toLowerCase().includes(state));
      }
      if (minPrice !== undefined || maxPrice !== undefined) {
        properties = properties.filter((p) => {
          const priceNum = parseFloat(String(p.price ?? 0)) || 0;
          if (minPrice !== undefined && priceNum < minPrice) return false;
          if (maxPrice !== undefined && priceNum > maxPrice) return false;
          return true;
        });
      }
      if (minBedrooms !== undefined) {
        properties = properties.filter((p) => (p.bedrooms ?? 0) >= minBedrooms);
      }
      if (minBathrooms !== undefined) {
        properties = properties.filter((p) => (parseFloat(String(p.bathrooms ?? 0)) || 0) >= minBathrooms);
      }

      const bounds = bbox ?? (minLat !== undefined && maxLat !== undefined && minLng !== undefined && maxLng !== undefined
        ? { minLat, maxLat, minLng, maxLng }
        : null);
      if (bounds) {
        properties = properties.filter((p) => {
          if (p.latitude == null || p.longitude == null) return false;
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
        });
      }

      if (authUser && authUser.role !== "admin") {
        const dislikedIds = await storage.getDislikedPropertyIds(authUser.userId);
        if (dislikedIds.length) {
          const dislikedSet = new Set(dislikedIds);
          properties = properties.filter((p) => !dislikedSet.has(p.id));
        }
        const dismissed = await storage.getDismissedAreasByUser(authUser.userId);
        if (dismissed.length) {
          const dismissedSet = new Set(dismissed.map((d) => `${d.city}|${d.state}`));
          properties = properties.filter((p) => !dismissedSet.has(`${p.city}|${p.state}`));
        }
      }

      if (sort === "newest") {
        properties = properties.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sort === "oldest") {
        properties = properties.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else if (sort === "price-high") {
        properties = properties.sort((a, b) => (parseFloat(String(b.price ?? 0)) || 0) - (parseFloat(String(a.price ?? 0)) || 0));
      } else if (sort === "price-low") {
        properties = properties.sort((a, b) => (parseFloat(String(a.price ?? 0)) || 0) - (parseFloat(String(b.price ?? 0)) || 0));
      } else if (sort === "views-high") {
        properties = properties.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      } else if (sort === "views-low") {
        properties = properties.sort((a, b) => (a.views ?? 0) - (b.views ?? 0));
      } else {
        const saved = await storage.getAllSavedProperties();
        const saveCounts = new Map<string, number>();
        for (const s of saved) {
          saveCounts.set(s.propertyId, (saveCounts.get(s.propertyId) ?? 0) + 1);
        }
        properties = properties.sort((a, b) => {
          const scoreA = computeScore(a.views ?? 0, saveCounts.get(a.id) ?? 0, a.createdAt);
          const scoreB = computeScore(b.views ?? 0, saveCounts.get(b.id) ?? 0, b.createdAt);
          return scoreB - scoreA;
        });
      }

      res.json(properties);
    } catch (error) {
      console.error("Properties fetch error:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPropertySchema.parse(normalizePropertyInput(req.body));
      const bathroomsErr = validateBathroomsRange(validatedData.bathrooms);
      if (bathroomsErr) {
        return res.status(400).json({ error: bathroomsErr });
      }
      if (validatedData.videoUrl) {
        const publicVideoErr = validatePublicMediaUrl("videoUrl", validatedData.videoUrl);
        if (publicVideoErr) {
          return res.status(400).json({ error: publicVideoErr });
        }
        const publicThumbErr = validatePublicMediaUrl("thumbnailUrl", validatedData.thumbnailUrl ?? "");
        if (publicThumbErr) {
          return res.status(400).json({ error: publicThumbErr });
        }
        const mediaErr = validateHttpsMediaForS3(
          isS3Enabled,
          validatedData.videoUrl,
          validatedData.thumbnailUrl
        );
        if (mediaErr) {
          return res.status(400).json({ error: mediaErr });
        }
      }
      const property = await storage.createProperty(validatedData);
      const actor = (req as AuthRequest).user;
      await storage.createPropertyAuditLog({
        propertyId: property.id,
        actorId: actor?.userId,
        action: "create",
        metaJson: JSON.stringify({ title: property.title }),
      });
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create property" });
    }
  });

  app.patch("/api/properties/:id", requireAdmin, async (req, res) => {
    try {
      const current = await storage.getProperty(req.params.id);
      const updates = insertPropertySchema
        .partial()
        .parse(normalizePropertyInput(req.body));
      if (updates.bathrooms !== undefined) {
        const bathroomsErr = validateBathroomsRange(updates.bathrooms);
        if (bathroomsErr) return res.status(400).json({ error: bathroomsErr });
      }
      if (updates.videoUrl !== undefined) {
        const vErr = validatePublicMediaUrl("videoUrl", String(updates.videoUrl));
        if (vErr) return res.status(400).json({ error: vErr });
      }
      if (updates.thumbnailUrl !== undefined && updates.thumbnailUrl !== null) {
        const tErr = validatePublicMediaUrl("thumbnailUrl", String(updates.thumbnailUrl));
        if (tErr) return res.status(400).json({ error: tErr });
      }
      const patchMediaErr = validateHttpsMediaPatchForS3(isS3Enabled, updates);
      if (patchMediaErr) {
        return res.status(400).json({ error: patchMediaErr });
      }
      const property = await storage.updateProperty(req.params.id, updates);
      const actor = (req as AuthRequest).user;
      if (current && updates.status && updates.status !== current.status) {
        await storage.createPropertyAuditLog({
          propertyId: property.id,
          actorId: actor?.userId,
          action: "status_change",
          metaJson: JSON.stringify({ from: current.status, to: updates.status }),
        });
      }
      res.json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  // Plot finder routes (image coordinates)
  app.get("/api/plot-finder/societies", requireAuth, async (req, res) => {
    try {
      const search = String(req.query.search ?? "");
      const items = await storage.getSocieties(search);
      res.json(items);
    } catch (error) {
      console.error("Plot finder societies error:", error);
      res.status(500).json({ error: "Failed to fetch societies" });
    }
  });

  app.post("/api/plot-finder/societies", requireAdmin, async (req, res) => {
    try {
      const payload = insertSocietySchema.parse(req.body);
      const society = await storage.createSociety(payload);
      res.status(201).json(society);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Create society error:", error);
      res.status(500).json({ error: "Failed to create society" });
    }
  });

  app.get("/api/plot-finder/societies/:societyId/blocks", requireAuth, async (req, res) => {
    try {
      const items = await storage.getSocietyBlocks(req.params.societyId);
      res.json(items);
    } catch (error) {
      console.error("Plot finder blocks error:", error);
      res.status(500).json({ error: "Failed to fetch society blocks" });
    }
  });

  app.post("/api/plot-finder/societies/:societyId/blocks", requireAdmin, (req, res) => {
    uploadImage.single("image")(req, res, async (err: unknown) => {
      if (err) {
        const uploadError = err as { message?: string };
        return res.status(400).json({ error: uploadError.message || "Image upload failed" });
      }

      try {
        const societyId = req.params.societyId;
        const details = await storage.getSocieties();
        const society = details.find((s) => s.id === societyId);
        if (!society) {
          return res.status(404).json({ error: "Society not found" });
        }

        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) {
          return res.status(400).json({ error: "Block image is required" });
        }

        const blockName = String(req.body?.name ?? "").trim();
        const widthPx = Number(req.body?.widthPx ?? 0);
        const heightPx = Number(req.body?.heightPx ?? 0);
        if (!blockName) {
          return res.status(400).json({ error: "Block name is required" });
        }
        if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) {
          return res.status(400).json({ error: "Valid widthPx and heightPx are required" });
        }

        const extByType: Record<string, string> = {
          "image/png": ".png",
          "image/jpeg": ".jpg",
          "image/webp": ".webp",
          "image/gif": ".gif",
        };
        const ext = extByType[file.mimetype] || path.extname(file.originalname) || ".png";
        const safeFileName =
          `${blockName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-block${ext}`;
        const existingBlocks = await storage.getSocietyBlocks(societyId);
        const existingFolder = existingBlocks
          .map((block) => {
            const match = String(block.imagePath ?? "")
              .replace(/\\/g, "/")
              .match(/^assets\/socities\/([^/]+)\/blocks\//i);
            return match?.[1] ?? "";
          })
          .find((folder) => folder.length > 0);
        const societyFolder = existingFolder || slugifySocietyName(society.name) || "society";
        const relativeDir = path.join("assets", "socities", societyFolder, "blocks");
        const absoluteDir = path.join(process.cwd(), "client", "src", relativeDir);
        await fs.promises.mkdir(absoluteDir, { recursive: true });
        const absoluteFilePath = path.join(absoluteDir, safeFileName);
        await fs.promises.writeFile(absoluteFilePath, file.buffer);

        const imagePath = path.join(relativeDir, safeFileName).replace(/\\/g, "/");
        const created = await storage.createSocietyBlock({
          societyId,
          name: blockName,
          imagePath,
          widthPx,
          heightPx,
        });
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Create block error:", error);
        res.status(500).json({ error: "Failed to create block" });
      }
    });
  });

  app.get("/api/plot-finder/blocks/:blockId", requireAuth, async (req, res) => {
    try {
      const details = await storage.getBlockDetails(req.params.blockId);
      if (!details) return res.status(404).json({ error: "Block not found" });
      const plots = details.plots.map((plot) => ({
        ...plot,
        x: Number(plot.x),
        y: Number(plot.y),
      }));
      res.json({ block: details.block, plots });
    } catch (error) {
      console.error("Plot finder block details error:", error);
      res.status(500).json({ error: "Failed to fetch block map" });
    }
  });

  app.get("/api/plot-finder/plots/search", requireAuth, async (req, res) => {
    try {
      const query = String(req.query.query ?? "").trim();
      const societyId = typeof req.query.societyId === "string" ? req.query.societyId : undefined;
      if (!query) return res.status(400).json({ error: "query is required" });
      const rows = await storage.searchPlots(query, societyId);
      res.json(
        rows.map((row) => ({
          society: row.society,
          block: row.block,
          plot: {
            ...row.plot,
            x: Number(row.plot.x),
            y: Number(row.plot.y),
          },
        }))
      );
    } catch (error) {
      console.error("Plot finder search error:", error);
      res.status(500).json({ error: "Failed to search plots" });
    }
  });

  app.post("/api/plot-finder/blocks/:blockId/plots", requireAdmin, async (req, res) => {
    try {
      const blockId = req.params.blockId;
      const details = await storage.getBlockDetails(blockId);
      if (!details) return res.status(404).json({ error: "Block not found" });
      const validated = insertBlockPlotSchema.parse({ ...req.body, blockId });
      const plot = await storage.createBlockPlot(validated);
      res.status(201).json({ ...plot, x: Number(plot.x), y: Number(plot.y) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Create plot error:", error);
      res.status(500).json({ error: "Failed to create plot" });
    }
  });

  app.patch("/api/plot-finder/plots/:plotId", requireAdmin, async (req, res) => {
    try {
      const plotId = req.params.plotId;
      const validated = updateBlockPlotPositionSchema.parse(req.body);
      const plot = await storage.updateBlockPlot(plotId, validated);
      res.json({ ...plot, x: Number(plot.x), y: Number(plot.y) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Update plot error:", error);
      res.status(500).json({ error: "Failed to update plot" });
    }
  });

  app.get("/api/plot-finder/plots/:plotId", requireAuth, async (req, res) => {
    try {
      const result = await storage.getPlotById(req.params.plotId);
      if (!result) return res.status(404).json({ error: "Plot not found" });
      res.json({
        society: result.society,
        block: result.block,
        plot: { ...result.plot, x: Number(result.plot.x), y: Number(result.plot.y) },
      });
    } catch (error) {
      console.error("Get plot error:", error);
      res.status(500).json({ error: "Failed to fetch plot" });
    }
  });

  // If a plot already has a listing attached ("video linked with plot"),
  // return that property so Plot Finder can be read-only for admins and
  // allow public users to view the video.
  app.get("/api/plot-finder/plots/:plotId/property", requireAuth, async (req, res) => {
    try {
      const property = await storage.getPropertyByPlotId(req.params.plotId);
      res.json(property ?? null);
    } catch (error) {
      console.error("Get plot property error:", error);
      res.status(500).json({ error: "Failed to fetch plot property" });
    }
  });

  // Saved properties routes
  app.get("/api/saved-properties", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const userId = req.query.userId as string | undefined;
      console.log('API: Fetching saved properties for userId:', userId);
      
      if (userId) {
        if (userId !== authUser.userId && authUser.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }
        const savedProperties = await storage.getSavedPropertiesByUser(userId);
        console.log('API: Found saved properties:', savedProperties.length);
        return res.json(savedProperties);
      }
      if (authUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const allSaved = await storage.getAllSavedProperties();
      console.log('API: No userId provided, returning all saved properties:', allSaved.length);
      res.json(allSaved);
    } catch (error) {
      console.error('API: Error fetching saved properties:', error);
      res.status(500).json({ error: "Failed to fetch saved properties" });
    }
  });

  app.get("/api/public-saved-properties/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const savedProperties = await storage.getSavedPropertiesByUser(userId);
      res.json(savedProperties);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shared saved properties" });
    }
  });

  app.post("/api/saved-properties", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const validatedData = insertSavedPropertySchema.parse({
        ...req.body,
        userId: authUser.userId,
      });
      const savedProperty = await storage.saveProperty(validatedData);
      res.status(201).json(savedProperty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to save property" });
    }
  });

  app.delete("/api/saved-properties/:propertyId", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      await storage.unsaveProperty(authUser.userId, req.params.propertyId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to unsave property" });
    }
  });

  // Saved filters routes
  app.get("/api/saved-filters", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const savedFilters = await storage.getSavedFiltersByUser(authUser.userId);
      res.json(savedFilters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved filters" });
    }
  });

  app.post("/api/saved-filters", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const name = String(req.body?.name ?? "").trim();
      const filters = req.body?.filters ?? {};
      if (!name) {
        return res.status(400).json({ error: "Filter name is required" });
      }
      const saved = await storage.createSavedFilter({
        userId: authUser.userId,
        name,
        filtersJson: JSON.stringify(filters),
      });
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: "Failed to save filter" });
    }
  });

  app.delete("/api/saved-filters/:id", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      await storage.deleteSavedFilter(req.params.id, authUser.userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete saved filter" });
    }
  });

  // Dismissed areas routes
  app.get("/api/dismissed-areas", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const dismissed = await storage.getDismissedAreasByUser(authUser.userId);
      res.json(dismissed);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dismissed areas" });
    }
  });

  app.post("/api/dismissed-areas", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const city = String(req.body?.city ?? "").trim();
      const state = String(req.body?.state ?? "").trim();
      if (!city || !state) {
        return res.status(400).json({ error: "City and state are required" });
      }
      const created = await storage.addDismissedArea({
        userId: authUser.userId,
        city,
        state,
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to dismiss area" });
    }
  });

  // Property report routes
  app.post("/api/property-reports", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const propertyId = String(req.body?.propertyId ?? "");
      const reason = String(req.body?.reason ?? "").trim();
      const details = req.body?.details ? String(req.body.details) : undefined;
      if (!propertyId || !reason) {
        return res.status(400).json({ error: "propertyId and reason are required" });
      }
      const report = await storage.createPropertyReport({
        propertyId,
        userId: authUser.userId,
        reason,
        details,
      });
      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit report" });
    }
  });

  app.get("/api/property-reports", requireAdmin, async (_req, res) => {
    try {
      const reports = await storage.getPropertyReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/properties/:id/audit-logs", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getPropertyAuditLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Property dislikes routes
  app.post("/api/property-dislikes", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;
      const validatedData = insertPropertyDislikeSchema.parse({
        ...req.body,
        userId: authUser.userId,
      });
      const dislike = await storage.dislikeProperty(validatedData);
      res.status(201).json(dislike);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to record dislike" });
    }
  });

  // Property view tracking
  app.post("/api/properties/:id/view", requireAuth, async (req, res) => {
    try {
      const authUser = (req as AuthRequest).user!;

      // Check if user already viewed this property
      const existingView = await storage.getPropertyView(authUser.userId, req.params.id);
      if (!existingView) {
        // Only increment view count if this is the first time this user views this property
        await storage.incrementPropertyViews(req.params.id);
        await storage.recordPropertyView({ userId: authUser.userId, propertyId: req.params.id });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  // Watch time analytics
  app.post("/api/analytics/watch", async (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const propertyId = String(req.body?.propertyId ?? "").trim();
      const watchedSeconds = Number(req.body?.watchedSeconds ?? 0);
      const durationSeconds = req.body?.durationSeconds ? Number(req.body.durationSeconds) : undefined;
      if (!propertyId || !Number.isFinite(watchedSeconds) || watchedSeconds <= 0) {
        return res.status(400).json({ error: "Invalid watch payload" });
      }
      const event = await storage.recordPropertyWatchEvent({
        propertyId,
        userId: authUser?.userId,
        watchedSeconds,
        durationSeconds,
      });
      res.status(201).json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to record watch event" });
    }
  });

  app.get("/api/analytics/summary", requireAdmin, async (_req, res) => {
    try {
      const properties = await storage.getAllProperties();
      const saved = await storage.getAllSavedProperties();
      const leads = await storage.getAllLeads();
      const totalViews = properties.reduce((sum, p) => sum + (p.views ?? 0), 0);
      let totalWatchSeconds = 0;
      let totalEvents = 0;
      let completedViews = 0;
      for (const p of properties) {
        const events = await storage.getPropertyWatchEvents(p.id);
        for (const e of events) {
          totalWatchSeconds += e.watchedSeconds;
          totalEvents += 1;
          if (e.durationSeconds && e.watchedSeconds >= e.durationSeconds * 0.9) {
            completedViews += 1;
          }
        }
      }
      res.json({
        totalViews,
        totalSaves: saved.length,
        totalLeads: leads.length,
        leadConversionRate: totalViews ? Number((leads.length / totalViews).toFixed(3)) : 0,
        totalEvents,
        totalWatchSeconds,
        averageWatchSeconds: totalEvents ? Math.round(totalWatchSeconds / totalEvents) : 0,
        completionRate: totalEvents ? Number((completedViews / totalEvents).toFixed(3)) : 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  // Leads routes
  app.get("/api/leads", requireAdmin, async (_req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/export", requireAdmin, async (_req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const header = [
        "id",
        "propertyId",
        "userId",
        "name",
        "email",
        "phone",
        "message",
        "preferredDate",
        "preferredTime",
        "contactMethod",
        "status",
        "createdAt",
      ];
      const rows = leads.map((lead) =>
        [
          lead.id,
          lead.propertyId,
          lead.userId ?? "",
          lead.name ?? "",
          lead.email ?? "",
          lead.phone ?? "",
          (lead.message ?? "").replace(/\n/g, " "),
          lead.preferredDate ?? "",
          lead.preferredTime ?? "",
          lead.contactMethod ?? "",
          lead.status ?? "",
          lead.createdAt?.toISOString?.() ?? "",
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"leads.csv\"");
      res.send([header.join(","), ...rows].join("\n"));
    } catch (error) {
      res.status(500).json({ error: "Failed to export leads" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        userId: authUser?.userId,
      });
      const lead = await storage.createLead(validatedData);
      console.log(`[Lead] New lead ${lead.id} for property ${lead.propertyId} via ${lead.contactMethod ?? "email"}`);
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id/status", requireAdmin, async (req, res) => {
    try {
      const status = z.enum(["new", "contacted", "closed"]).parse(req.body?.status);
      const lead = await storage.updateLeadStatus(req.params.id, status);
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update lead status" });
    }
  });

  // Shareable preview page with OG tags
  app.get("/share/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).send("Property not found");
      }
      const host = req.get("host");
      const protocol = req.protocol;
      const baseUrl = host ? `${protocol}://${host}` : "";
      const videoUrl = property.videoUrl?.startsWith("http")
        ? property.videoUrl
        : `${baseUrl}${property.videoUrl}`;
      const imageUrl = property.thumbnailUrl
        ? property.thumbnailUrl.startsWith("http")
          ? property.thumbnailUrl
          : `${baseUrl}${property.thumbnailUrl}`
        : videoUrl;
      const title = property.title ?? "Property Preview";
      const description = `${property.city ?? ""} ${property.state ?? ""}`.trim();
      const appUrl = `${baseUrl}/property/${property.id}`;

      res.setHeader("Content-Type", "text/html");
      res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:video" content="${videoUrl}" />
  <meta property="og:video:secure_url" content="${videoUrl}" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:url" content="${appUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <p>Redirecting…</p>
  <script>window.location.href=${JSON.stringify(appUrl)};</script>
</body>
</html>`);
    } catch (error) {
      res.status(500).send("Failed to generate share page");
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
