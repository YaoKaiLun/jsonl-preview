const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.service_worker, 'background.js');
assert.deepEqual(manifest.permissions || [], []);
assert.deepEqual(manifest.host_permissions || [], []);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);

const runtimeFiles = [
  'manifest.json', 'background.js', 'viewer.html', 'viewer.css', 'viewer.js',
  'worker.js', 'vendor/fzstd.js', 'vendor/fzstd.LICENSE',
  'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png', 'LICENSE'
];
for (const file of runtimeFiles) assert.ok(fs.statSync(path.join(root, file)).isFile(), `Missing ${file}`);

for (const [size, file] of Object.entries(manifest.icons)) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a', `${file} must be PNG`);
  assert.equal(data.readUInt32BE(16), Number(size), `${file} has wrong width`);
  assert.equal(data.readUInt32BE(20), Number(size), `${file} has wrong height`);
}
for (const file of ['viewer.html', 'viewer.js', 'worker.js', 'background.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!/<script[^>]+src=["']https?:/i.test(source), `${file} loads remote script`);
}
console.log(`Release check passed: v${manifest.version}, ${runtimeFiles.length} runtime files, no declared permissions`);
module.exports = { root, manifest, runtimeFiles };
