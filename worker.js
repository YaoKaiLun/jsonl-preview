/* Shared parser: a Worker in the extension, or a local fallback for file:// previews. */
((root) => {
function createJsonlEngine(emit, ensureZstd, isCancelled = () => false) {
const t = root.appI18n.t;
const MAX_DECODED_BYTES = 256 * 1024 * 1024;
const MAX_RECORDS = 1_000_000;
const MAX_LINE_CHARS = 4 * 1024 * 1024;
const records = [];
const errors = [];
const fields = new Map();
let visible = null;
let errorView = false;
let carry = '';
let oversizedLine = false;
let oversizedPreview = '';
let lineNumber = 0;
let decodedBytes = 0;
let sourceName = '';

function send(type, data = {}) { emit({ type, ...data }); }
function reset(name) {
  records.length = 0; errors.length = 0; fields.clear();
  visible = null; errorView = false; carry = ''; oversizedLine = false; oversizedPreview = ''; lineNumber = 0;
  decodedBytes = 0; sourceName = name;
}
function summarize(value) {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (Array.isArray(value)) return t('labelArray', { count: value.length });
  if (typeof value === 'object') return t('objectFields', { count: Object.keys(value).length });
  if (typeof value === 'string') return value;
  return String(value);
}
function recordPreview(value) {
  if (Array.isArray(value)) {
    const preview = value.slice(0, 3).map(summarize).join(' · ');
    return [t('labelArray', { count: value.length }), `${preview || t('emptyArray')}${value.length > 3 ? t('moreItems', { count: value.length - 3 }) : ''}`];
  }
  if (value === null || typeof value !== 'object') {
    const label = value === null ? t('labelNull') : { string: t('labelString'), number: t('labelNumber'), boolean: t('labelBoolean') }[typeof value];
    return [label, summarize(value)];
  }
  const entries = Object.entries(value);
  const kindKey = ['type', 'event', 'kind', 'role'].find(key => typeof value[key] === 'string' || typeof value[key] === 'number');
  const kind = kindKey ? `${kindKey}: ${value[kindKey]}` : t('objectFields', { count: entries.length });
  const others = entries.filter(([key]) => key !== kindKey);
  const summary = others.slice(0, 4).map(([key, item]) => {
    const text = summarize(item);
    return `${key}: ${text.length > 60 ? `${text.slice(0, 59)}…` : text}`;
  }).join(' · ');
  return [kind, `${summary || t('noOtherFields')}${others.length > 4 ? t('moreFields', { count: others.length - 4 }) : ''}`];
}
function consumeLine(raw) {
  lineNumber++;
  if (raw.endsWith('\r')) raw = raw.slice(0, -1);
  if (!raw.trim()) return;
  if (raw.length > MAX_LINE_CHARS) {
    errors.push({ line: lineNumber, raw: raw.slice(0, 500), error: t('limitLine') });
    return;
  }
  try {
    const value = JSON.parse(raw);
    if (records.length >= MAX_RECORDS) throw new Error(t('limitRecords'));
    records.push({ line: lineNumber, raw });
    if (records.length <= 1000) {
      const keys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : ['$value'];
      for (const key of keys) fields.set(key, (fields.get(key) || 0) + 1);
    }
  } catch (error) {
    if (error.message === t('limitRecords')) throw error;
    errors.push({ line: lineNumber, raw: raw.slice(0, 500), error: error.message });
  }
}
function consumeText(text) {
  let start = 0;
  while (start < text.length) {
    const end = text.indexOf('\n', start);
    const segment = text.slice(start, end === -1 ? text.length : end);
    if (oversizedLine) {
      if (oversizedPreview.length < 500) oversizedPreview += segment.slice(0, 500 - oversizedPreview.length);
    } else if (carry.length + segment.length > MAX_LINE_CHARS) {
      oversizedLine = true;
      oversizedPreview = (carry + segment.slice(0, 500)).slice(0, 500);
      carry = '';
    } else carry += segment;
    if (end === -1) break;
    if (oversizedLine) {
      lineNumber++;
      errors.push({ line: lineNumber, raw: oversizedPreview, error: t('limitLine') });
      oversizedLine = false;
      oversizedPreview = '';
    } else consumeLine(carry);
    carry = '';
    start = end + 1;
  }
}
function finish() {
  if (oversizedLine) {
    lineNumber++;
    errors.push({ line: lineNumber, raw: oversizedPreview, error: t('limitLine') });
  } else if (carry) consumeLine(carry);
  carry = '';
  oversizedLine = false;
  oversizedPreview = '';
  const rankedFields = [...fields.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  send('ready', { records: records.length, errors: errors.length, fieldCount: fields.size, fields: rankedFields.slice(0, 6), sourceName, decodedBytes });
}
async function loadFile(file) {
  reset(file.name);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const isZstd = /\.(zstd|zst)$/i.test(file.name);
  let decompressor;
  if (isZstd) {
    ensureZstd();
    decompressor = new root.fzstd.Decompress((chunk) => {
      decodedBytes += chunk.byteLength;
      if (decodedBytes > MAX_DECODED_BYTES) throw new Error(t('limitDecompress'));
      consumeText(decoder.decode(chunk, { stream: true }));
    });
  }
  const reader = file.stream().getReader();
  let readBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (isCancelled()) return;
      readBytes += value.byteLength;
      if (isZstd) decompressor.push(value);
      else {
        decodedBytes += value.byteLength;
        if (decodedBytes > MAX_DECODED_BYTES) throw new Error(t('limitFile'));
        consumeText(decoder.decode(value, { stream: true }));
      }
      if (readBytes === value.byteLength || readBytes % (4 * 1024 * 1024) < value.byteLength) {
        send('progress', { readBytes, fileBytes: file.size, records: records.length, errors: errors.length });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (isZstd) decompressor.push(new Uint8Array(0), true);
    consumeText(decoder.decode());
    finish();
  } finally { reader.releaseLock(); }
}
function loadPaste(value) {
  reset(t('pastedContent'));
  decodedBytes = new TextEncoder().encode(value).byteLength;
  if (decodedBytes > MAX_DECODED_BYTES) throw new Error(t('limitPaste'));
  consumeText(value);
  finish();
}
function currentList() { return errorView ? errors : records; }
function currentCount() { return visible ? visible.length : currentList().length; }
function at(index) { return currentList()[visible ? visible[index] : index]; }
function matchesStructured(value, term, scope) {
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item !== null && typeof item === 'object') {
      if (Array.isArray(item)) for (const child of item) pending.push(child);
      else for (const [key, child] of Object.entries(item)) {
        if (scope === 'keys' && key.toLowerCase().includes(term)) return true;
        pending.push(child);
      }
    } else if (scope === 'values' && String(item).toLowerCase().includes(term)) return true;
  }
  return false;
}
function query(message) {
  errorView = !!message.errors;
  const term = (message.search || '').trim().toLowerCase();
  const scope = ['keys', 'values', 'raw'].includes(message.scope) ? message.scope : 'keys';
  visible = term ? [] : null;
  if (term) {
    const list = currentList();
    for (let i = 0; i < list.length; i++) {
      const found = errorView || scope === 'raw'
        ? list[i].raw.toLowerCase().includes(term)
        : matchesStructured(JSON.parse(list[i].raw), term, scope);
      if (found) visible.push(i);
    }
  }
  send('query', { count: currentCount(), requestId: message.requestId });
}
function rows(message) {
  const result = [];
  const columns = message.columns || [];
  for (let i = message.start; i < Math.min(currentCount(), message.start + message.count); i++) {
    const item = at(i);
    if (errorView) result.push({ index: i, line: item.line, error: item.error, cells: [item.raw] });
    else {
      const value = JSON.parse(item.raw);
      result.push({ index: i, line: item.line, cells: message.mode === 'records' ? recordPreview(value) : columns.map(key => summarize(key === '$value' ? value : value?.[key])) });
    }
  }
  send('rows', { rows: result, start: message.start, requestId: message.requestId });
}
function detail(message) {
  const item = at(message.index);
  if (!item) return;
  send('detail', { line: item.line, raw: item.raw, error: item.error || null, value: item.error ? null : JSON.parse(item.raw), requestId: message.requestId });
}
async function handleMessage(data) {
  try {
    if (data.type === 'file') await loadFile(data.file);
    if (data.type === 'paste') loadPaste(data.value);
    if (data.type === 'query') query(data);
    if (data.type === 'rows') rows(data);
    if (data.type === 'detail') detail(data);
  } catch (error) { send('failure', { message: error.message || String(error) }); }
}
return { handleMessage };
}
if (typeof document === 'undefined') {
  root.importScripts('i18n.js');
  const engine = createJsonlEngine(message => root.postMessage(message), () => root.importScripts('vendor/fzstd.js'));
  root.onmessage = ({ data }) => engine.handleMessage(data);
} else {
  root.createJsonlEngine = createJsonlEngine;
}
})(globalThis);
