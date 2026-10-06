const {spawnSync} = require('node:child_process');
const path = require('node:path');
const tests = ['verify-gear-progress.cjs', 'verify-supra-audio.cjs', 'verify-supra-flutter.cjs', 'verify-rims.cjs', 'verify-road-progress.cjs', 'verify-studio-progress.cjs'];
for (const name of tests) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, name), ...process.argv.slice(2)], {stdio: 'inherit', timeout: 180000});
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nAll offline browser suites passed.');
