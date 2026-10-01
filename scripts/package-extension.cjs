const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, manifest, runtimeFiles } = require('./check-release.cjs');

const destination = path.join(root, 'dist');
fs.mkdirSync(destination, { recursive: true });
const archive = path.join(destination, `jsonl-preview-v${manifest.version}.zip`);
fs.rmSync(archive, { force: true });
const result = spawnSync('zip', ['-q', '-X', archive, ...runtimeFiles], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Created ${archive}`);
