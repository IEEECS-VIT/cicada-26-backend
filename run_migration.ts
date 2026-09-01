import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // If rpc doesn't exist, we might have to use raw query somehow. But try rpc first if they have exec_sql.
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE teams ADD COLUMN IF NOT EXISTS assigned_asset_set INTEGER DEFAULT NULL;' });
  console.log('Result:', data, error);
}
main();
