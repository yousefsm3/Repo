import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./CoreProviders";

const client = new S3Client({
  region: process.env.STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY as string,
    secretAccessKey: process.env.STORAGE_SECRET_KEY as string,
  },
});

const BUCKET = process.env.STORAGE_BUCKET as string;

export class S3StorageProvider implements StorageProvider {
  readonly providerName = "aws_s3";

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }
}

export const storageProvider = new S3StorageProvider();
