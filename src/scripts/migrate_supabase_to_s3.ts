import 'dotenv/config';
import s3Storage from '../services/s3Storage.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'assets';
const LIST_LIMIT = 200;

interface SupabaseStorageObject {
  name: string;
  id: string;
  metadata?: { size?: number; mimetype?: string; contentType?: string };
}

const listOnce = async (prefix: string): Promise<SupabaseStorageObject[]> => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const headers = {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };

  const items: SupabaseStorageObject[] = [];
  let offset = 0;
  for (;;) {
    const url = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prefix,
        limit: LIST_LIMIT,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to list objects (prefix "${prefix}", offset ${offset}): HTTP ${res.status} ${await res.text()}`);
    }
    const batch = (await res.json()) as SupabaseStorageObject[];
    items.push(...batch);
    if (batch.length < LIST_LIMIT) break;
    offset += LIST_LIMIT;
  }
  return items;
};

interface FullObject {
  key: string;
  metadata: SupabaseStorageObject['metadata'];
}

const listAllObjects = async (prefix: string = ''): Promise<FullObject[]> => {
  const batch = await listOnce(prefix);
  const files: FullObject[] = [];
  for (const entry of batch) {
    const key = prefix + entry.name;
    if (entry.metadata === null || entry.id === null) {
      // Folder marker (or placeholder) — descend
      files.push(...(await listAllObjects(`${key}/`)));
    } else {
      files.push({ key, metadata: entry.metadata });
    }
  }
  return files;
};

const encodePath = (name: string): string => name.split('/').map(encodeURIComponent).join('/');

const main = async (): Promise<void> => {
  console.log(`Listing all objects in Supabase bucket "${BUCKET}"...`);
  const objects = await listAllObjects();
  console.log(`Found ${objects.length} objects.`);

  if (objects.length === 0) {
    console.log('Bucket is empty — nothing to migrate. Exiting.');
    return;
  }

  let uploaded = 0;
  let failed = 0;
  for (const object of objects) {
    try {
      const dlUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodePath(object.key)}`;
      const dl = await fetch(dlUrl);
      if (!dl.ok) throw new Error(`download failed (HTTP ${dl.status})`);

      const body = Buffer.from(await dl.arrayBuffer());
      const mimetype = object.metadata?.mimetype || object.metadata?.contentType;
      await s3Storage.upload({
        key: object.key,
        body,
        ...(mimetype ? { contentType: mimetype } : {}),
      });
      uploaded += 1;
      if (uploaded % 5 === 0) console.log(`  ${uploaded}/${objects.length} uploaded...`);
    } catch (err: any) {
      failed += 1;
      console.error(`  FAILED "${object.key}": ${err?.message || err}`);
    }
  }

  console.log(`\nMigration done. Uploaded: ${uploaded}, Failed: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
};

main().catch((err) => {
  console.error(`Migration aborted: ${err?.message || err}`);
  process.exitCode = 1;
});
