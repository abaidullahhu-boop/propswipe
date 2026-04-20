import { Readable } from "node:stream";

/** Normalize @aws-sdk/client-s3 GetObject Body to a Node.js Readable for pipe/pipeline. */
export function s3GetObjectBodyToReadable(body: unknown): Readable {
  if (body == null) {
    throw new Error("Empty S3 body");
  }
  if (body instanceof Readable) {
    return body;
  }
  const maybePipe = body as { pipe?: (dest: unknown) => unknown };
  if (typeof maybePipe.pipe === "function") {
    return body as Readable;
  }
  if (typeof Readable.fromWeb === "function") {
    return Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  }
  throw new Error("S3 GetObject body is not a readable stream");
}
