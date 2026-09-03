import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface S3UploadParams {
  key: string;
  body: Buffer;
  contentType?: string;
}

export class S3Storage {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string | null;

  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.S3_BUCKET_NAME;

    if (!accessKeyId || !secretAccessKey || !bucket) {
      console.warn('WARNING: S3 storage is not configured. Missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME env vars.');
      this.bucket = bucket || '';
      this.publicUrl = process.env.S3_PUBLIC_URL ? process.env.S3_PUBLIC_URL.replace(/\/+$/, '') : null;
      this.client = null as any;
      return;
    }

    this.bucket = bucket;
    this.publicUrl = process.env.S3_PUBLIC_URL ? process.env.S3_PUBLIC_URL.replace(/\/+$/, '') : null;

    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  public async upload(params: S3UploadParams): Promise<string> {
    if (!this.client) throw new Error('S3 storage is not configured.');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ...(params.contentType ? { ContentType: params.contentType } : {}),
      })
    );
    return this.publicUrlFor(params.key) ?? params.key;
  }

  public async delete(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err: any) {
      console.warn(`[S3] Failed to delete object "${key}":`, err?.message || err);
    }
  }

  public publicUrlFor(key: string): string | null {
    if (!this.publicUrl) return null;
    return `${this.publicUrl}/${key}`;
  }

  public extractKeyFromPublicUrl(url: string): string | null {
    if (!this.publicUrl) return null;
    const prefix = `${this.publicUrl}/`;
    if (url.startsWith(prefix)) {
      return decodeURIComponent(url.slice(prefix.length));
    }
    return null;
  }
}

export const s3Storage = new S3Storage();

export default s3Storage;
