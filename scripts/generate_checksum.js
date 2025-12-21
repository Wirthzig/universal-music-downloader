import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist_app');

console.log('🔍 Scanning for DMG file...');

if (!fs.existsSync(distDir)) {
    console.error('❌ dist_app directory not found. Run "npm run build" first.');
    process.exit(1);
}

const files = fs.readdirSync(distDir);
const dmgFile = files.find(f => f.endsWith('.dmg'));

if (!dmgFile) {
    console.error('❌ No .dmg file found in dist_app.');
    console.error('   Please run "npm run build" to generate the installer.');
    process.exit(1);
}

const filePath = path.join(distDir, dmgFile);
console.log(`📦 Found: ${dmgFile}`);
console.log('🔒 Calculating SHA-256...');

const fileBuffer = fs.readFileSync(filePath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);

const hex = hashSum.digest('hex');

console.log('\n✅ SHA-256 Checksum (Copy this to GitHub Release):');
console.log('================================================');
console.log(hex);
console.log('================================================');
console.log('\nUse this code block in your markdown:');
console.log('```');
console.log(hex);
console.log('```');
