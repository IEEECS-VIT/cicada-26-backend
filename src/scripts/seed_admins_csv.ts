import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

dotenv.config();

async function seedAdminsFromCSV() {
  const args = process.argv.slice(2);
  const csvFilePath = args[0] || 'sample_admins.csv';
  const absolutePath = path.isAbsolute(csvFilePath) ? csvFilePath : path.resolve(process.cwd(), csvFilePath);

  console.log('==================================================');
  console.log('🔑 BULK ADMIN PROVISIONING SCRIPT FROM CSV');
  console.log(`📁 Reading CSV File: ${absolutePath}`);
  console.log('==================================================\n');

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: CSV File '${absolutePath}' not found.`);
    console.log('\nUsage: npx tsx src/scripts/seed_admins_csv.ts <path_to_csv>');
    process.exit(1);
  }

  const rawContent = fs.readFileSync(absolutePath, 'utf-8');
  const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    console.error('❌ Error: CSV file is empty.');
    process.exit(1);
  }

  let hasHeader = false;
  let emailIdx = 0;
  let nameIdx = -1;
  let regIdx = -1;

  const firstLineCols = lines[0]!.split(',').map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  if (firstLineCols.some((col) => col === 'email' || col === 'display_name' || col === 'name' || col === 'register_no')) {
    hasHeader = true;
    emailIdx = firstLineCols.findIndex((c) => c === 'email');
    if (emailIdx === -1) emailIdx = 0;
    nameIdx = firstLineCols.findIndex((c) => c === 'display_name' || c === 'name');
    regIdx = firstLineCols.findIndex((c) => c === 'register_no' || c === 'reg_no');
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const line of dataLines) {
    const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const email = cols[emailIdx]?.toLowerCase();

    if (!email || !email.includes('@')) {
      continue;
    }

    const displayName: string | null = (nameIdx !== -1 && cols[nameIdx]) ? (cols[nameIdx] ?? null) : null;
    const registerNo: string | null = (regIdx !== -1 && cols[regIdx]) ? (cols[regIdx] ?? null) : null;

    try {
      const existingUser = await db.users.findByEmail(email);
      if (existingUser) {
        await db.users.updateRole(existingUser.id, 'admin');
        await db.users.approveAdmin(existingUser.id);
        if (displayName && !existingUser.display_name) {
          await db.users.updateDisplayName(existingUser.id, displayName);
        }
        updatedCount++;
        console.log(`✅ UPDATED: '${email}' promoted to Admin.`);
      } else {
        const newId = uuidv4();
        await db.users.seedUser(newId, email, displayName, registerNo, 'admin');
        createdCount++;
        console.log(`✨ CREATED: '${email}' provisioned as Super Admin.`);
      }
    } catch (err: any) {
      failedCount++;
      console.error(`❌ FAILED '${email}': ${err.message}`);
    }
  }

  console.log('\n==================================================');
  console.log('📊 PROVISIONING SUMMARY');
  console.log(`- Total Processed: ${createdCount + updatedCount + failedCount}`);
  console.log(`- Created (New Admins): ${createdCount}`);
  console.log(`- Promoted/Updated: ${updatedCount}`);
  console.log(`- Failed: ${failedCount}`);
  console.log('==================================================\n');
}

seedAdminsFromCSV().catch((err) => {
  console.error('Unhandled error during bulk admin seeding:', err);
  process.exit(1);
});
