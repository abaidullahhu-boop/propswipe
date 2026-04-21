/**
 * Standalone seed script. Run with: npm run seed
 * Requires DATABASE_URL in .env for database storage; otherwise seeds in-memory (lost on exit).
 * Demo listings are only inserted when SEED_SAMPLE_PROPERTIES=true (admin user is still created).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { storage } from "../server/storage.js";
import type { InsertProperty } from "../shared/schema.js";
import { randomUUID } from "crypto";

const adminEmail = process.env.ADMIN_EMAIL || "admin@propswipe.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin12345";
const adminName = process.env.ADMIN_NAME || "Admin";
const seedDemoListings = process.env.SEED_SAMPLE_PROPERTIES === "true";

const sampleProperties: InsertProperty[] = [
  {
    title: "Modern Downtown Loft",
    address: "123 Main Street",
    city: "San Francisco",
    state: "CA",
    price: "1250000",
    bedrooms: 2,
    bathrooms: "2.0",
    squareFeet: 1500,
    description: "Stunning modern loft in the heart of downtown with panoramic city views",
    videoUrl: "https://www.pexels.com/download/video/3773486",
    thumbnailUrl: "",
    neighborhood: "",
    videoStatus: "ready",
    status: "active",
  },
  {
    title: "Beachfront Villa",
    address: "456 Ocean Avenue",
    city: "Santa Monica",
    state: "CA",
    price: "3500000",
    bedrooms: 4,
    bathrooms: "3.5",
    squareFeet: 3200,
    description: "Luxurious beachfront property with direct ocean access",
    videoUrl: "https://www.pexels.com/download/video/34451032/",
    thumbnailUrl: "",
    neighborhood: "",
    videoStatus: "ready",
    status: "active",
  },
  {
    title: "Mountain Retreat",
    address: "789 Pine Ridge Road",
    city: "Lake Tahoe",
    state: "CA",
    price: "975000",
    bedrooms: 3,
    bathrooms: "2.5",
    squareFeet: 2400,
    description: "Peaceful mountain home with stunning lake views",
    videoUrl: "https://www.pexels.com/download/video/34453815/",
    thumbnailUrl: "",
    neighborhood: "",
    videoStatus: "ready",
    status: "active",
  },
  {
    title: "Urban Penthouse",
    address: "321 Skyline Drive",
    city: "Los Angeles",
    state: "CA",
    price: "2100000",
    bedrooms: 3,
    bathrooms: "3.0",
    squareFeet: 2800,
    description: "Sophisticated penthouse with floor-to-ceiling windows",
    videoUrl: "https://www.pexels.com/download/video/4301615",
    thumbnailUrl: "",
    neighborhood: "",
    videoStatus: "ready",
    status: "active",
  },
  {
    title: "Family Home",
    address: "555 Maple Street",
    city: "Palo Alto",
    state: "CA",
    price: "2450000",
    bedrooms: 5,
    bathrooms: "4.0",
    squareFeet: 3500,
    description: "Spacious family home in excellent school district",
    videoUrl: "https://www.pexels.com/download/video/5743706/",
    thumbnailUrl: "",
    neighborhood: "",
    videoStatus: "ready",
    status: "active",
  },
  {
    title: "Historic Brownstone",
    address: "888 Heritage Lane",
    city: "San Francisco",
    state: "CA",
    price: "1850000",
    bedrooms: 3,
    bathrooms: "2.5",
    squareFeet: 2200,
    description: "Beautifully restored Victorian-era brownstone",
    videoUrl: "https://www.pexels.com/download/video/6007440/",
    thumbnailUrl: "",
    neighborhood: "",
    videoStatus: "ready",
    status: "active",
  },
];

async function seedPlotFinderData() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.log("[seed] DATABASE_URL not set; skipping plot finder DB seed.");
    return;
  }

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl:
      DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
  });
  const sqlExec = (queryText: string, params: unknown[] = []) => pool.query(queryText, params);

  await sqlExec(`
    CREATE TABLE IF NOT EXISTS societies (
      id varchar PRIMARY KEY,
      name text NOT NULL,
      city text NOT NULL,
      state text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS society_blocks (
      id varchar PRIMARY KEY,
      society_id varchar NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      name text NOT NULL,
      image_path text NOT NULL,
      width_px integer NOT NULL,
      height_px integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS block_plots (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      block_id varchar NOT NULL REFERENCES society_blocks(id) ON DELETE CASCADE,
      plot_number text NOT NULL,
      x numeric(10,2) NOT NULL,
      y numeric(10,2) NOT NULL,
      size text,
      status text NOT NULL DEFAULT 'available',
      meta_json text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await sqlExec(`ALTER TABLE block_plots ALTER COLUMN id SET DEFAULT gen_random_uuid()`);

  const existingSociety = await sqlExec(
    `SELECT id FROM societies WHERE lower(name)=lower($1) LIMIT 1`,
    ["Bismillah Housing Scheme"]
  );
  let societyId: string;
  if (existingSociety.rows.length > 0) {
    societyId = existingSociety.rows[0].id as string;
  } else {
    societyId = randomUUID();
    await sqlExec(`INSERT INTO societies (id, name, city, state) VALUES ($1, $2, $3, $4)`, [
      societyId,
      "Bismillah Housing Scheme",
      "Lahore",
      "Punjab",
    ]);
  }

  const blockRows = [
    {
      name: "Bismillah Full",
      imagePath: "assets/socities/bismilah/Bismillah Full.png",
      widthPx: 672,
      heightPx: 1024,
      plots: [
        { plotNumber: "A-101", x: 336, y: 640, size: "5 Marla", status: "available" },
        { plotNumber: "A-102", x: 362, y: 640, size: "5 Marla", status: "reserved" },
        { plotNumber: "B-01", x: 286, y: 900, size: "10 Marla", status: "available" },
      ],
    },
    {
      name: "Abu Bakar Block",
      imagePath: "assets/socities/bismilah/blocks/abubakar-block.png",
      widthPx: 1024,
      heightPx: 768,
      plots: [
        { plotNumber: "54", x: 186, y: 615, size: "10 Marla", status: "available" },
        { plotNumber: "67", x: 615, y: 615, size: "10 Marla", status: "sold" },
        { plotNumber: "102", x: 580, y: 470, size: "10 Marla", status: "reserved" },
      ],
    },
    {
      name: "Usman Block",
      imagePath: "assets/socities/bismilah/blocks/usman-block.png",
      widthPx: 1024,
      heightPx: 768,
      plots: [
        { plotNumber: "140", x: 737, y: 452, size: "10 Marla", status: "available" },
        { plotNumber: "176", x: 148, y: 768, size: "10 Marla", status: "available" },
        { plotNumber: "211", x: 590, y: 94, size: "10 Marla", status: "reserved" },
      ],
    },
    {
      name: "A Block",
      imagePath: "assets/socities/bismilah/blocks/a-block.png",
      widthPx: 9446,
      heightPx: 11384,
      plots: [
        { plotNumber: "A-25", x: 5600, y: 1500, size: "5 Marla", status: "available" },
        { plotNumber: "A-78", x: 3250, y: 4700, size: "5 Marla", status: "reserved" },
        { plotNumber: "A-145", x: 6900, y: 7150, size: "8 Marla", status: "available" },
      ],
    },
    {
      name: "B Block",
      imagePath: "assets/socities/bismilah/blocks/b-block.png",
      widthPx: 9446,
      heightPx: 11384,
      plots: [
        { plotNumber: "B-25", x: 5600, y: 1500, size: "5 Marla", status: "available" },
      ],
    },
    {
      name: "C Block",
      imagePath: "assets/socities/bismilah/blocks/c-block.png",
      widthPx: 9446,
      heightPx: 11384,
      plots: [
        { plotNumber: "C-25", x: 5600, y: 1500, size: "5 Marla", status: "available" },
      ],
    },
    {
      name: "Abu Bakar Block",
      imagePath: "assets/socities/bismilah/blocks/abubakar-block.png",
      widthPx: 9446,
      heightPx: 11384,
      plots: [
        { plotNumber: "Ha-25", x: 5600, y: 1500, size: "5 Marla", status: "available" },
      ],
    },
    {
      name: "Haider Block",
      imagePath: "assets/socities/bismilah/blocks/haider-block.png",
      widthPx: 9446,
      heightPx: 11384,
      plots: [
        { plotNumber: "H-25", x: 5600, y: 1500, size: "5 Marla", status: "available" },
      ],
    },
  ];

  for (const block of blockRows) {
    const existingBlock = await sqlExec(
      `SELECT id FROM society_blocks WHERE society_id=$1 AND lower(name)=lower($2) LIMIT 1`,
      [societyId, block.name]
    );
    let blockId: string;
    if (existingBlock.rows.length > 0) {
      blockId = existingBlock.rows[0].id as string;
      await sqlExec(
        `UPDATE society_blocks SET image_path=$1, width_px=$2, height_px=$3 WHERE id=$4`,
        [block.imagePath, block.widthPx, block.heightPx, blockId]
      );
    } else {
      blockId = randomUUID();
      await sqlExec(
        `INSERT INTO society_blocks (id, society_id, name, image_path, width_px, height_px) VALUES ($1, $2, $3, $4, $5, $6)`,
        [blockId, societyId, block.name, block.imagePath, block.widthPx, block.heightPx]
      );
    }

    for (const plot of block.plots) {
      const existingPlot = await sqlExec(
        `SELECT id FROM block_plots WHERE block_id=$1 AND plot_number=$2 LIMIT 1`,
        [blockId, plot.plotNumber]
      );
      if (existingPlot.rows.length > 0) continue;
      await sqlExec(
        `INSERT INTO block_plots (id, block_id, plot_number, x, y, size, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), blockId, plot.plotNumber, plot.x, plot.y, plot.size, plot.status]
      );
    }
  }

  await pool.end();
  console.log("[seed] Plot finder data verified/inserted.");
}

async function seed() {
  console.log("[seed] Starting seed...");

  try {
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    if (!existingAdmin) {
      const adminHash = await bcrypt.hash(adminPassword, 10);
      await storage.createUser({
        email: adminEmail,
        name: adminName,
        role: "admin",
        passwordHash: adminHash,
      });
      console.log(`[seed] Admin user created: ${adminEmail} (password: ${adminPassword})`);
    } else {
      console.log(`[seed] Admin user already exists: ${adminEmail}`);
    }

    const allProperties = await storage.getAllProperties();
    if (allProperties.length === 0 && seedDemoListings) {
      for (const data of sampleProperties) {
        await storage.createProperty(data);
      }
      console.log(`[seed] Created ${sampleProperties.length} sample properties`);
    } else if (allProperties.length === 0) {
      console.log(
        "[seed] No properties in DB; skipping demo listings. Set SEED_SAMPLE_PROPERTIES=true to insert samples, or add listings in Admin."
      );
    } else {
      console.log(`[seed] Properties already exist (${allProperties.length}), skipping property seed`);
    }
    await seedPlotFinderData();
  } catch (e) {
    console.error("[seed] Error:", (e as Error).message);
    process.exit(1);
  }

  console.log("[seed] Done.");
  process.exit(0);
}

seed();
