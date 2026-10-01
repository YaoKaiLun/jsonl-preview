const $ = (id) => document.getElementById(id);
const { t, number, locale } = window.appI18n;
document.documentElement.lang = locale.replace('_', '-');
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
document.querySelectorAll('[data-i18n-aria-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)); });
const ROW_HEIGHT = 42;
const OVERSCAN = 8;
const FIRST_COLUMN_WIDTH = 70;
const DATA_COLUMN_MIN_WIDTH = 190;
let worker;
let columns = [];
let count = 0;
let selected = -1;
let currentDetail = null;
let viewMode = 'records';
let requestId = 0;
let rowRequestId = 0;
let detailRequestId = 0;
let searchTimer;
let preferredSearchScope = 'keys';
let renderedStart = -1;
let renderedCount = 0;

function setStatus(message, kind = '') {
  $('status').textContent = message;
  $('status').className = `status ${kind}`;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const decimal = value => new Intl.NumberFormat(locale.replace('_', '-'), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  if (bytes < 1024 ** 2) return `${decimal(bytes / 1024)} KiB`;
  return `${decimal(bytes / 1024 ** 2)} MiB`;
}
function createLocalParser() {
  let stopped = false;
  const parser = { onmessage: null, onerror: null, terminate() { stopped = true; } };
  const engine = window.createJsonlEngine(
    data => { if (!stopped) queueMicrotask(() => { if (!stopped) parser.onmessage?.({ data }); }); },
    () => { if (!window.fzstd) throw new Error(t('parserMissingZstd')); },
    () => stopped
  );
  parser.postMessage = data => {
    setTimeout(() => { if (!stopped) engine.handleMessage(data); }, 0);
  };
  return parser;
}
function activateWorker() {
  worker?.terminate();
  try { worker = location.protocol === 'file:' ? createLocalParser() : new Worker('worker.js'); }
  catch (error) {
    setStatus(t('parserUnavailable', { error: error.message }), 'error');
    return false;
  }
  worker.onerror = () => setStatus(t('parserStartFail'), 'error');
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') setStatus(t('progress', { read: formatBytes(data.readBytes), total: formatBytes(data.fileBytes), records: number(data.records) }));
    if (data.type === 'failure') setStatus(data.message, 'error');
    if (data.type === 'ready') onReady(data);
    if (data.type === 'query' && data.requestId === requestId) onQuery(data);
    if (data.type === 'rows' && data.requestId === rowRequestId) renderRows(data.rows, data.start);
    if (data.type === 'detail' && data.requestId === detailRequestId) renderDetail(data);
  };
  return true;
}
function loadPaste() {
  const value = $('pasteInput').value;
  if (!value.trim()) return setStatus(t('pasteFirst'), 'error');
  resetView(t('pastedContent'));
  if (!activateWorker()) return;
  worker.postMessage({ type: 'paste', value });
}
function loadFile(file) {
  if (!file) return;
  if (!/\.(jsonl|ndjson|jsonl\.zstd|jsonl\.zst|zstd|zst)$/i.test(file.name)) return setStatus(t('chooseFileError'), 'error');
  resetView(file.name);
  if (!activateWorker()) return;
  worker.postMessage({ type: 'file', file });
}
function resetView(name) {
  $('workspace').hidden = true;
  $('sourceBadge').textContent = name;
  setStatus(t('parsing'));
  $('searchInput').value = '';
  $('searchScope').value = 'keys';
  $('searchScope').disabled = false;
  preferredSearchScope = 'keys';
  $('matchCount').textContent = '';
  selected = -1;
  currentDetail = null;
  viewMode = 'records';
  renderedStart = -1;
  requestId++; rowRequestId++; detailRequestId++;
}
function onReady(data) {
  columns = data.fields;
  if (!columns.length) columns = ['$value'];
  $('workspace').hidden = false;
  $('recordCount').textContent = number(data.records);
  $('errorCount').textContent = number(data.errors);
  $('errorTabCount').textContent = number(data.errors);
  $('fieldCount').textContent = number(data.fieldCount);
  $('sourceName').textContent = data.sourceName;
  setStatus(t('complete', { size: formatBytes(data.decodedBytes), records: number(data.records), errors: data.errors ? t('errorCountSuffix', { count: number(data.errors) }) : '' }), data.errors ? 'warning' : 'success');
  setMode('records');
}
function setMode(mode) {
  if (mode === 'errors' && viewMode !== 'errors') {
    preferredSearchScope = $('searchScope').value;
    $('searchScope').value = 'raw';
    $('searchScope').disabled = true;
  } else if (mode !== 'errors' && viewMode === 'errors') {
    $('searchScope').value = preferredSearchScope;
    $('searchScope').disabled = false;
  }
  viewMode = mode;
  updateSearchPlaceholder();
  rowRequestId++;
  detailRequestId++;
  $('tableRows').replaceChildren();
  $('recordsTab').classList.toggle('active', mode === 'records');
  $('tableTab').classList.toggle('active', mode === 'table');
  $('errorsTab').classList.toggle('active', mode === 'errors');
  $('tableHeader').replaceChildren();
  const labels = mode === 'records' ? [t('columnLine'), t('columnOverview'), t('columnSummary')] : mode === 'errors' ? [t('columnLine'), t('columnError'), t('columnRaw')] : [t('columnLine'), ...columns];
  $('tableHeader').style.setProperty('--cols', `${labels.length - 1}`);
  $('tableHeader').classList.toggle('record-layout', mode === 'records');
  $('tableHeader').classList.toggle('error-layout', mode === 'errors');
  for (const label of labels) {
    const cell = document.createElement('span');
    cell.textContent = label;
    $('tableHeader').append(cell);
  }
  $('tableScroll').scrollTop = 0;
  $('tableScroll').scrollLeft = 0;
  $('tableHeader').style.transform = '';
  syncTableWidth();
  selected = -1;
  clearDetail();
  query();
}
function query() {
  if (!worker) return;
  renderedStart = -1;
  rowRequestId++;
  detailRequestId++;
  selected = -1;
  clearDetail();
  $('matchCount').textContent = $('searchInput').value.trim() ? t('statusSearching') : '';
  worker.postMessage({ type: 'query', errors: viewMode === 'errors', scope: $('searchScope').value, search: $('searchInput').value, requestId: ++requestId });
}
function onQuery(data) {
  count = data.count;
  $('matchCount').textContent = $('searchInput').value.trim() ? t('resultCount', { count: number(count) }) : '';
  $('tableSpacer').style.height = `${count * ROW_HEIGHT}px`;
  $('tableRows').replaceChildren();
  $('emptyState').hidden = count !== 0;
  $('tableScroll').scrollTop = 0;
  syncTableWidth();
  requestRows(true);
}
function updateSearchPlaceholder() {
  $('searchInput').placeholder = t(viewMode === 'errors' ? 'searchErrorRaw' : {
    keys: 'searchKeys', values: 'searchValues', raw: 'searchRaw'
  }[$('searchScope').value]);
}
function syncTableWidth() {
  const minWidth = viewMode === 'records' ? 720 : viewMode === 'errors' ? 690 : FIRST_COLUMN_WIDTH + columns.length * DATA_COLUMN_MIN_WIDTH;
  const width = Math.max($('tableScroll').clientWidth, minWidth);
  $('tableHeader').style.width = `${width}px`;
  $('tableSpacer').style.width = `${width}px`;
}
function requestRows(force = false) {
  if (!worker || !count) return;
  const scroller = $('tableScroll');
  const start = Math.max(0, Math.floor(scroller.scrollTop / ROW_HEIGHT) - OVERSCAN);
  const wanted = Math.min(count - start, Math.ceil(scroller.clientHeight / ROW_HEIGHT) + OVERSCAN * 2);
  if (!force && start === renderedStart && wanted === renderedCount) return;
  renderedStart = start; renderedCount = wanted;
  worker.postMessage({ type: 'rows', start, count: wanted, columns, mode: viewMode, requestId: ++rowRequestId });
}
function renderRows(rows, start) {
  const frag = document.createDocumentFragment();
  for (const row of rows) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `data-row${row.index === selected ? ' selected' : ''}`;
    el.style.setProperty('--cols', viewMode === 'table' ? columns.length : 2);
    el.classList.toggle('record-layout', viewMode === 'records');
    el.classList.toggle('error-layout', viewMode === 'errors');
    el.dataset.index = row.index;
    const values = viewMode === 'errors' ? [row.line, row.error, row.cells[0]] : [row.line, ...row.cells];
    for (const value of values) {
      const span = document.createElement('span');
      span.textContent = value ?? '—';
      span.title = String(value ?? '');
      el.append(span);
    }
    el.addEventListener('click', () => selectRow(row.index));
    frag.append(el);
  }
  $('tableRows').style.transform = `translateY(${start * ROW_HEIGHT}px)`;
  $('tableRows').replaceChildren(frag);
}
function selectRow(index) {
  selected = index;
  document.querySelectorAll('.data-row').forEach(el => el.classList.toggle('selected', Number(el.dataset.index) === index));
  worker.postMessage({ type: 'detail', index, requestId: ++detailRequestId });
}
function clearDetail() {
  currentDetail = null;
  $('detailTitle').textContent = t('selectRowTitle');
  $('detailMeta').textContent = t('selectRowHelp');
  $('detailBody').replaceChildren();
  $('copyRow').disabled = true;
}
function renderDetail(data) {
  currentDetail = data;
  $('detailTitle').textContent = t('detailLine', { line: number(data.line) });
  $('detailMeta').textContent = data.error ? t('parseFailed', { error: data.error }) : t('validJson', { size: formatBytes(new TextEncoder().encode(data.raw).length) });
  $('copyRow').disabled = false;
  $('detailBody').replaceChildren();
  if (data.error) {
    const raw = document.createElement('pre'); raw.textContent = data.raw; $('detailBody').append(raw); return;
  }
  const tree = document.createElement('div'); tree.className = 'tree';
  tree.append(renderNode(data.value, '$', '$', 0));
  $('detailBody').append(tree);
}
function renderNode(value, name, path, depth) {
  const isObject = value !== null && typeof value === 'object';
  const entries = isObject ? Object.entries(value) : [];
  const root = document.createElement('div'); root.className = 'tree-node';
  const row = document.createElement('div'); row.className = 'tree-line';
  const key = document.createElement('span'); key.className = 'tree-key'; key.textContent = name;
  row.append(key);
  if (isObject) {
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'tree-toggle';
    toggle.textContent = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`;
    const children = document.createElement('div'); children.className = 'tree-children';
    if (depth >= 2) children.hidden = true;
    toggle.setAttribute('aria-expanded', String(!children.hidden));
    toggle.addEventListener('click', () => {
      children.hidden = !children.hidden;
      toggle.setAttribute('aria-expanded', String(!children.hidden));
      if (!children.hidden && !children.childElementCount) {
        const frag = document.createDocumentFragment();
        for (const [childKey, childValue] of entries) frag.append(renderNode(childValue, childKey, childPath(path, childKey, Array.isArray(value)), depth + 1));
        children.append(frag);
      }
    });
    row.append(toggle);
    root.append(row, children);
    if (!children.hidden) {
      const frag = document.createDocumentFragment();
      for (const [childKey, childValue] of entries) frag.append(renderNode(childValue, childKey, childPath(path, childKey, Array.isArray(value)), depth + 1));
      children.append(frag);
    }
  } else {
    const val = document.createElement('span'); val.className = `tree-value ${value === null ? 'null' : typeof value}`;
    const longText = typeof value === 'string' && (value.length > 180 || value.includes('\n'));
    val.textContent = longText ? `${JSON.stringify(value.replace(/\s+/g, ' ').slice(0, 110))}…` : JSON.stringify(value);
    row.append(val);
    if (longText) {
      const readButton = document.createElement('button');
      readButton.className = 'read-text-button'; readButton.type = 'button'; readButton.textContent = t('readFullText');
      readButton.addEventListener('click', () => openTextReader(value, path));
      row.append(readButton);
    }
    root.append(row);
  }
  const pathButton = document.createElement('button'); pathButton.className = 'path-button'; pathButton.type = 'button'; pathButton.title = `${t('copyPath')} ${path}`; pathButton.textContent = t('copyPath');
  pathButton.addEventListener('click', () => copyText(path, t('pathCopied')));
  row.append(pathButton);
  return root;
}
function childPath(path, key, array) {
  return array ? `${path}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}
function openTextReader(value, path) {
  $('readerTitle').textContent = `${t('detailLine', { line: number(currentDetail.line) })} · ${t('longText')}`;
  $('readerPath').textContent = `${path} · ${t('chars', { count: number(value.length) })}`;
  $('readerContent').textContent = value;
  $('textReader').showModal();
}
async function copyText(value, message) {
  try { await navigator.clipboard.writeText(value); setStatus(message, 'success'); return true; }
  catch { setStatus(t('copyFailed'), 'error'); return false; }
}

$('openBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', event => {
  loadFile(event.target.files?.[0]);
  event.target.value = '';
});
$('parseBtn').addEventListener('click', loadPaste);
$('pasteInput').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); loadPaste(); } });
$('demoBtn').addEventListener('click', () => {
  $('pasteInput').value = [
    { id: 1001, event: 'session.start', user: 'alice', latency_ms: 18, payload: { browser: 'Chrome', features: ['tree', 'search'] } },
    { id: 1002, event: 'tool.call', user: 'bob', latency_ms: 246, payload: { tool: 'search', query: 'JSONL viewer' } },
    { id: 1003, event: 'session.end', user: 'alice', latency_ms: 31, payload: { ok: true, tokens: 1280 } }
  ].map(JSON.stringify).join('\n') + '\n{ broken json';
  loadPaste();
});
$('recordsTab').addEventListener('click', () => setMode('records'));
$('tableTab').addEventListener('click', () => setMode('table'));
$('errorsTab').addEventListener('click', () => setMode('errors'));
$('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(query, 200); });
$('searchScope').addEventListener('change', () => { updateSearchPlaceholder(); query(); });
$('clearSearch').addEventListener('click', () => { $('searchInput').value = ''; query(); });
$('tableScroll').addEventListener('scroll', () => {
  $('tableHeader').style.transform = `translateX(-${$('tableScroll').scrollLeft}px)`;
  requestRows();
});
new ResizeObserver(syncTableWidth).observe($('tableScroll'));
$('copyRow').addEventListener('click', () => currentDetail && copyText(currentDetail.raw, t('jsonCopied')));
$('readerCopy').addEventListener('click', async () => {
  if (await copyText($('readerContent').textContent, t('fullCopied'))) {
    $('readerCopy').textContent = t('copied');
    setTimeout(() => { $('readerCopy').textContent = t('copyFullText'); }, 1600);
  }
});
$('readerClose').addEventListener('click', () => $('textReader').close());
$('textReader').addEventListener('click', event => { if (event.target === $('textReader')) $('textReader').close(); });
const dropZone = $('dropZone');
const dropOverlay = $('fileDropOverlay');
let dragDepth = 0;
function hasDraggedFiles(event) { return Array.from(event.dataTransfer?.types || []).includes('Files'); }
function hideDropOverlay() {
  dragDepth = 0;
  dropOverlay.hidden = true;
  dropZone.classList.remove('dragging');
}
document.addEventListener('dragenter', event => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  dropOverlay.hidden = false;
  dropZone.classList.add('dragging');
});
document.addEventListener('dragover', event => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', event => {
  if (!hasDraggedFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) hideDropOverlay();
});
document.addEventListener('drop', event => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  hideDropOverlay();
  const files = event.dataTransfer.files;
  if (files.length > 1) return setStatus(t('chooseOneFile'), 'error');
  loadFile(files[0]);
});
window.addEventListener('blur', hideDropOverlay);
window.addEventListener('keydown', event => { if (event.key === 'Escape') hideDropOverlay(); });
