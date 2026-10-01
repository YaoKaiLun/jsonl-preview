const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');

function makeWorker(locale = 'zh-CN') {
  const messages = [];
  const scope = { postMessage: message => messages.push(message), TextDecoder, TextEncoder, Uint8Array, setTimeout, navigator: { language: locale } };
  scope.self = scope;
  vm.createContext(scope);
  scope.importScripts = file => {
    if (file === 'i18n.js') vm.runInContext(fs.readFileSync('i18n.js', 'utf8'), scope);
    else if (file === 'vendor/fzstd.js') scope.fzstd = require('fzstd');
    else throw new Error(`Unexpected import: ${file}`);
  };
  vm.runInContext(fs.readFileSync('worker.js', 'utf8'), scope);
  return { send: async data => { await scope.self.onmessage({ data }); return messages.at(-1); }, messages };
}
function fixtureFile(name, bytes, chunkSize = 5) {
  return { name, size: bytes.length, stream() {
    let offset = 0;
    return new ReadableStream({ pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(new Uint8Array(bytes.slice(offset, offset + chunkSize)));
      offset += chunkSize;
    } });
  } };
}

test('parses streaming UTF-8, blank lines, CRLF, and invalid records', async () => {
  const worker = makeWorker();
  const data = Buffer.from('{"id":1,"name":"测试"}\r\n\n{broken}\n{"id":2,"name":"ok"}', 'utf8');
  const ready = await worker.send({ type: 'file', file: fixtureFile('example.jsonl', data, 3) });
  assert.equal(ready.type, 'ready');
  assert.equal(ready.records, 2);
  assert.equal(ready.errors, 1);
  assert.equal(ready.fieldCount, 2);
  await worker.send({ type: 'query', scope: 'values', search: '测试', errors: false, requestId: 1 });
  const rows = await worker.send({ type: 'rows', start: 0, count: 10, columns: ['id', 'name'], requestId: 1 });
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].cells[1], '测试');
  await worker.send({ type: 'query', search: '', errors: true, requestId: 2 });
  const detail = await worker.send({ type: 'detail', index: 0, requestId: 2 });
  assert.equal(detail.line, 3);
  assert.ok(detail.error);
});

test('decompresses a zstd JSONL stream before parsing', async () => {
  const worker = makeWorker();
  const raw = Buffer.from('{"id":1}\n{"id":2}\n');
  const compressed = zlib.zstdCompressSync(raw);
  const ready = await worker.send({ type: 'file', file: fixtureFile('sample.jsonl.zstd', compressed, 7) });
  assert.equal(ready.type, 'ready');
  assert.equal(ready.records, 2);
  assert.equal(ready.decodedBytes, raw.byteLength);
  await worker.send({ type: 'query', search: '', errors: false, requestId: 1 });
  const detail = await worker.send({ type: 'detail', index: 1, requestId: 1 });
  assert.equal(detail.value.id, 2);
});

test('runs the same zstd parser when opened as a local HTML file', async () => {
  const messages = [];
  const scope = { document: {}, fzstd: require('fzstd'), TextDecoder, TextEncoder, Uint8Array, setTimeout, navigator: { language: 'zh-CN' } };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync('i18n.js', 'utf8'), scope);
  vm.runInContext(fs.readFileSync('worker.js', 'utf8'), scope);
  const engine = scope.createJsonlEngine(message => messages.push(message), () => {});
  const raw = Buffer.from('{"source":"local","ok":true}\n');
  const compressed = zlib.zstdCompressSync(raw);
  await engine.handleMessage({ type: 'file', file: fixtureFile('session.jsonl.zstd', compressed, 6) });
  assert.equal(messages.at(-1).type, 'ready');
  assert.equal(messages.at(-1).records, 1);
  await engine.handleMessage({ type: 'detail', index: 0, requestId: 1 });
  assert.equal(messages.at(-1).value.source, 'local');
});

test('record previews use each row’s own fields when schemas differ', async () => {
  const worker = makeWorker();
  await worker.send({ type: 'paste', value: [
    JSON.stringify({ type: 'session', version: 4, id: 'abc' }),
    JSON.stringify({ type: 'tool.call', tool: 'search', input: { query: 'hello' } }),
    JSON.stringify({ event: 'done', result: true })
  ].join('\n') });
  await worker.send({ type: 'query', search: '', errors: false, requestId: 1 });
  const response = await worker.send({ type: 'rows', start: 0, count: 3, mode: 'records', requestId: 1 });
  assert.deepEqual(Array.from(response.rows, row => row.cells[0]), ['type: session', 'type: tool.call', 'event: done']);
  assert.match(response.rows[0].cells[1], /version: 4/);
  assert.match(response.rows[1].cells[1], /tool: search/);
  assert.match(response.rows[2].cells[1], /result: true/);
});

test('record preview works without a type field and with non-object JSON values', async () => {
  const worker = makeWorker();
  await worker.send({ type: 'paste', value: [
    JSON.stringify({ name: 'Ada', score: 3 }),
    JSON.stringify([1, 2, 3]),
    JSON.stringify('hello'),
    'null'
  ].join('\n') });
  await worker.send({ type: 'query', search: '', requestId: 1 });
  const response = await worker.send({ type: 'rows', start: 0, count: 4, mode: 'records', requestId: 1 });
  assert.deepEqual(Array.from(response.rows, row => row.cells[0]), ['对象 · 2 字段', '数组 · 3 项', '字符串', 'null 值']);
  assert.match(response.rows[0].cells[1], /name: Ada/);
});

test('worker previews and parser errors follow the browser locale', async () => {
  const worker = makeWorker('en-US');
  await worker.send({ type: 'paste', value: '{"name":"Ada"}\n[1,2]\n' });
  await worker.send({ type: 'query', search: '', requestId: 1 });
  const rows = await worker.send({ type: 'rows', start: 0, count: 2, mode: 'records', requestId: 1 });
  assert.equal(rows.rows[0].cells[0], 'Object · 1 fields');
  assert.equal(rows.rows[1].cells[0], 'Array · 2 items');
  const oversized = await worker.send({ type: 'paste', value: 'x'.repeat(4 * 1024 * 1024 + 1) });
  assert.equal(oversized.type, 'ready');
  await worker.send({ type: 'query', search: '', errors: true, requestId: 2 });
  const detail = await worker.send({ type: 'detail', index: 0, requestId: 2 });
  assert.match(detail.error, /4 million character/);
});

test('search distinguishes nested field names, values, and raw JSON', async () => {
  const worker = makeWorker();
  await worker.send({ type: 'paste', value: [
    JSON.stringify({ type: 'user/message', data: { text: 'please inspect summary' } }),
    JSON.stringify({ type: 'compaction/summary', data: { summary: ['done'] } }),
    JSON.stringify({ type: 'tool/result', data: { output: 'unrelated' } })
  ].join('\n') });
  const keys = await worker.send({ type: 'query', scope: 'keys', search: 'summary', requestId: 1 });
  assert.equal(keys.count, 1);
  const keyMatch = await worker.send({ type: 'rows', start: 0, count: 1, mode: 'records', requestId: 1 });
  assert.equal(keyMatch.rows[0].line, 2);
  const values = await worker.send({ type: 'query', scope: 'values', search: 'summary', requestId: 2 });
  assert.equal(values.count, 2);
  const raw = await worker.send({ type: 'query', scope: 'raw', search: 'summary', requestId: 3 });
  assert.equal(raw.count, 2);
});

test('keeps parsing after an oversized line crosses stream chunks', async () => {
  const worker = makeWorker();
  const oversized = 'x'.repeat(4 * 1024 * 1024 + 1);
  const input = Buffer.from(`{"id":1}\n${oversized}\n{"id":2}\n`);
  const ready = await worker.send({ type: 'file', file: fixtureFile('large.jsonl', input, 64 * 1024) });
  assert.equal(ready.type, 'ready');
  assert.equal(ready.records, 2);
  assert.equal(ready.errors, 1);
  await worker.send({ type: 'query', search: '', errors: true, requestId: 1 });
  const detail = await worker.send({ type: 'detail', index: 0, requestId: 1 });
  assert.equal(detail.line, 2);
  assert.equal(detail.raw.length, 500);
});
