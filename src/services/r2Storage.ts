import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface R2UploadParams {
  key: string;
  body: Buffer;
  contentType?: string;
}

export class R2Storage {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string | null;

  constructor() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      console.warn('WARNING: R2 storage is not configured. Missing env vars. Asset uploads will fail, but server will start.');
      this.bucket = bucket || '';
      this.publicUrl = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/+$/, '') : null;
      this.client = null as any;
      return;
    }

    this.bucket = bucket;
    this.publicUrl = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/+$/, '') : null;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /**
   * Uploads a Buffer to R2 and returns the public URL (R2_PUBLIC_URL/key),
   * or just the key if no public URL is configured.
   */
  public async upload(params: R2UploadParams): Promise<string> {
    if (!this.client) throw new Error('R2 storage is not configured.');
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

  /**
   * Best-effort delete of an object from R2. Never throws — failures are
   * logged so that a DB row mutation is never blocked by storage cleanup.
   */
  public async delete(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err: any) {
      console.warn(`[R2] Failed to delete object "${key}":`, err?.message || err);
    }
  }

  public publicUrlFor(key: string): string | null {
    if (!this.publicUrl) return null;
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Extracts the object key from an R2 public URL. Returns null if the URL
   * does not belong to this R2 deployment.
   */
  public extractKeyFromPublicUrl(url: string): string | null {
    if (!this.publicUrl) return null;
    const prefix = `${this.publicUrl}/`;
    if (url.startsWith(prefix)) {
      return decodeURIComponent(url.slice(prefix.length));
    }
    return null;
  }
}

export const r2Storage = new R2Storage();

export default r2Storage;
