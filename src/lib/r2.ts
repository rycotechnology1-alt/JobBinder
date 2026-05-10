import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let r2Client: S3Client | null = null;

function getR2Client() {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    });
  }

  return r2Client;
}

function getR2BucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured");
  return bucket;
}

export function getSafeFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || extension === filename.toLowerCase()) return "bin";
  if (!/^[a-z0-9]{1,10}$/.test(extension)) return "bin";

  return extension;
}

export function createR2ObjectKey(companyId: string, fileId: string, filename: string) {
  return `${companyId}/${fileId}.${getSafeFileExtension(filename)}`;
}

export function isCompanyScopedObjectKey(objectKey: string, companyId: string) {
  if (objectKey.includes("..")) return false;
  return objectKey.startsWith(`${companyId}/`);
}

export async function createSignedUploadUrl(input: {
  objectKey: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: input.objectKey,
    ContentType: input.contentType,
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: input.expiresIn ?? 900 });
}

export async function createSignedAccessUrl(input: {
  objectKey: string;
  filename?: string | null;
  expiresIn?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: input.objectKey,
    ...(input.filename
      ? {
          ResponseContentDisposition: `inline; filename="${input.filename.replaceAll('"', "")}"`,
        }
      : {}),
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: input.expiresIn ?? 300 });
}
