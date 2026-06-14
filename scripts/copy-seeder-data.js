/**
 * Post-build script: copies JSON seed data from src/ to dist/ so the compiled
 * seeder services can import them at runtime.
 *
 * Run after `tsc` completes, e.g.:
 *     npm run build  →  tsc && node scripts/copy-seeder-data.js
 */
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../src/database/seeder/data');
const TARGET_DIR = path.join(__dirname, '../dist/database/seeder/data');

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`⚠️  Source directory not found: ${src}`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else if (entry.name.endsWith('.json')) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`✓ Copied ${path.relative(process.cwd(), srcPath)} → ${path.relative(process.cwd(), destPath)}`);
        }
    }
}

console.log('📦 Copying seeder JSON data to dist/...');
copyRecursive(SOURCE_DIR, TARGET_DIR);
console.log('✓ Seeder data copy complete');
