import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface UploadFileOptions {
  dossierId: number;
  fileName: string;
  fileBuffer: Buffer | Uint8Array;
  mimeType: string;
}

interface StorageUploadResult {
  fileUrl: string;
  storageProvider: "supabase" | "s3" | "local_resilient";
  fileKey: string;
}

// Configuration Supabase Storage S3-compatible ou AWS S3
const BUCKET_NAME = process.env.STORAGE_BUCKET || "dossier-documents";
const S3_ENDPOINT = process.env.STORAGE_ENDPOINT || process.env.SUPABASE_STORAGE_URL;
const S3_REGION = process.env.STORAGE_REGION || "eu-west-3";

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (_s3Client) return _s3Client;

  if (process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY) {
    _s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Requis pour Supabase / MinIO
    });
    return _s3Client;
  }
  return null;
}

export async function uploadDossierCloudFile(options: UploadFileOptions): Promise<StorageUploadResult> {
  const timestamp = Date.now();
  const sanitizedName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileKey = `dossiers/${options.dossierId}/${timestamp}_${sanitizedName}`;

  const client = getS3Client();
  if (client) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: options.fileBuffer,
        ContentType: options.mimeType,
      });
      await client.send(command);

      // Générer une URL signée de 7 jours ou URL publique
      const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
      const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 });

      return {
        fileUrl: signedUrl,
        storageProvider: S3_ENDPOINT?.includes("supabase") ? "supabase" : "s3",
        fileKey,
      };
    } catch (err) {
      console.warn("[Storage] Cloud S3 upload error, fallback to resilient local storage:", err);
    }
  }

  // Fallback résilient : Data URL sécurisée pour prévisualisation et téléchargement instantané
  const base64Data = Buffer.from(options.fileBuffer).toString("base64");
  const dataUrl = `data:${options.mimeType};base64,${base64Data}`;

  return {
    fileUrl: dataUrl,
    storageProvider: "local_resilient",
    fileKey,
  };
}
