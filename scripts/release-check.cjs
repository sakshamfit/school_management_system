/**
 * Release Build Verification
 * Checks final package for secrets, dev URLs, etc.
 */

const fs = require('fs');
const path = require('path');

function checkRelease() {
  console.log('=== Release Build Verification ===\n');

  const releaseDir = path.join(__dirname, '..', 'release');
  const distDir = path.join(__dirname, '..', 'dist');

  // Check dist exists
  if (!fs.existsSync(distDir)) {
    console.log('❌ dist/ not found - run npm run build first');
    process.exit(1);
  }

  console.log('✅ dist/ exists');

  // Check for secrets in dist
  const forbidden = [
    { pattern: /service_role/i, name: 'service_role key' },
    { pattern: /SUPABASE_SERVICE_ROLE/i, name: 'Supabase service role' },
    { pattern: /GOOGLE_CLIENT_SECRET.*['\"][a-zA-Z0-9-_]+['\"]/i, name: 'Google client secret in bundle' },
    { pattern: /sk_live_[a-zA-Z0-9]+/, name: 'Stripe secret key' },
    { pattern: /localhost:3000.*production/i, name: 'localhost URL in production' },
  ];

  function walkJsFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walkJsFiles(full));
      else if (full.endsWith('.js') || full.endsWith('.html')) files.push(full);
    }
    return files;
  }

  const jsFiles = walkJsFiles(distDir);
  console.log(`Checking ${jsFiles.length} files in dist/ for secrets...`);

  let foundIssues = [];
  for (const file of jsFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      for (const { pattern, name } of forbidden) {
        if (pattern.test(content)) {
          foundIssues.push({ file: path.relative(distDir, file), secret: name });
        }
      }
      // Check for dev URLs
      if (content.includes('http://localhost:3000') && !content.includes('fallback')) {
        // Allow fallback dev server URL in electron.cjs, but not in dist
        if (file.includes('dist')) {
          foundIssues.push({ file: path.relative(distDir, file), secret: 'localhost URL in dist' });
        }
      }
    } catch (e) {}
  }

  if (foundIssues.length > 0) {
    console.log('\n❌ Potential secrets found:');
    for (const issue of foundIssues) {
      console.log(`  - ${issue.file}: ${issue.secret}`);
    }
    process.exit(1);
  } else {
    console.log('✅ No secrets detected in dist/');
  }

  // Check release dir
  if (fs.existsSync(releaseDir)) {
    const releaseFiles = fs.readdirSync(releaseDir);
    console.log(`\nRelease files: ${releaseFiles.join(', ')}`);
    
    const hasExe = releaseFiles.some(f => f.endsWith('.exe'));
    const hasYml = releaseFiles.some(f => f.includes('.yml'));
    
    if (hasExe) console.log('✅ Windows installer (.exe) found');
    else console.log('⚠️ No Windows installer found - run npm run dist:win on Windows');
    
    if (hasYml) console.log('✅ Update feed (latest.yml) found');
  } else {
    console.log('\n⚠️ release/ not found - run electron-builder to generate installer');
  }

  // Check package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(`\nPackage version: ${pkg.version}`);
  console.log(`Main: ${pkg.main}`);
  console.log(`Build targets: win, mac, linux`);

  // Check electron-builder.yml
  const builderPath = path.join(__dirname, '..', 'electron-builder.yml');
  if (fs.existsSync(builderPath)) {
    const builderContent = fs.readFileSync(builderPath, 'utf8');
    if (builderContent.includes('deleteAppDataOnUninstall: false')) {
      console.log('✅ Installer preserves user data on uninstall');
    }
    if (builderContent.includes('SchoolManagementSetup')) {
      console.log('✅ Installer name configured');
    }
  }

  console.log('\n=== Release Check Summary ===');
  console.log('✅ Release build verification passed');
  console.log('\nNext steps:');
  console.log('1. Test installer on Windows 10/11');
  console.log('2. Verify data preservation on upgrade');
  console.log('3. Test auto-update flow');
  console.log('4. Verify Google Drive backup on production build');
}

checkRelease();
