const $ = (id) => document.getElementById(id);
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
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
function createLocalParser() {
  let stopped = false;
  const parser = { onmessage: null, onerror: null, terminate() { stopped = true; } };
  const engine = window.createJsonlEngine(
    data => { if (!stopped) queueMicrotask(() => { if (!stopped) parser.onmessage?.({ data }); }); },
    () => { if (!window.fzstd) throw new Error('本地 zstd 解压器未加载'); },
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
    setStatus(`无法启动解析器：${error.message}`, 'error');
    return false;
  }
  worker.onerror = () => setStatus('解析器启动失败，请刷新页面重试', 'error');
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') setStatus(`读取 ${formatBytes(data.readBytes)} / ${formatBytes(data.fileBytes)} · 已解析 ${data.records.toLocaleString()} 行`);
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
  if (!value.trim()) return setStatus('请先粘贴 JSONL 内容', 'error');
  resetView('粘贴内容');
  if (!activateWorker()) return;
  worker.postMessage({ type: 'paste', value });
}
function loadFile(file) {
  if (!file) return;
  if (!/\.(jsonl|ndjson|jsonl\.zstd|jsonl\.zst|zstd|zst)$/i.test(file.name)) return setStatus('请选择 .jsonl、.ndjson 或 .jsonl.zstd 文件', 'error');
  resetView(file.name);
  if (!activateWorker()) return;
  worker.postMessage({ type: 'file', file });
}
function resetView(name) {
  $('workspace').hidden = true;
  $('sourceBadge').textContent = name;
  setStatus('正在解析…');
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
  $('recordCount').textContent = data.records.toLocaleString();
  $('errorCount').textContent = data.errors.toLocaleString();
  $('errorTabCount').textContent = data.errors.toLocaleString();
  $('fieldCount').textContent = data.fieldCount.toLocaleString();
  $('sourceName').textContent = data.sourceName;
  setStatus(`完成 · ${formatBytes(data.decodedBytes)} · ${data.records.toLocaleString()} 条有效记录${data.errors ? ` · ${data.errors} 条异常` : ''}`, data.errors ? 'warning' : 'success');
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
  const labels = mode === 'records' ? ['行号', '概览', '本行字段摘要'] : mode === 'errors' ? ['行号', '错误', '原始行'] : ['行号', ...columns];
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
  $('matchCount').textContent = $('searchInput').value.trim() ? '搜索中…' : '';
  worker.postMessage({ type: 'query', errors: viewMode === 'errors', scope: $('searchScope').value, search: $('searchInput').value, requestId: ++requestId });
}
function onQuery(data) {
  count = data.count;
  $('matchCount').textContent = $('searchInput').value.trim() ? `${count.toLocaleString()} 条` : '';
  $('tableSpacer').style.height = `${count * ROW_HEIGHT}px`;
  $('tableRows').replaceChildren();
  $('emptyState').hidden = count !== 0;
  $('tableScroll').scrollTop = 0;
  syncTableWidth();
  requestRows(true);
}
function updateSearchPlaceholder() {
  $('searchInput').placeholder = viewMode === 'errors' ? '搜索异常行原文…' : {
    keys: '搜索字段名（含嵌套字段）…', values: '搜索字段值…', raw: '搜索原始行内容…'
  }[$('searchScope').value];
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
  $('detailTitle').textContent = '选择一行查看结构';
  $('detailMeta').textContent = '点击左侧记录，查看折叠树、原始文本与路径。';
  $('detailBody').replaceChildren();
  $('copyRow').disabled = true;
}
function renderDetail(data) {
  currentDetail = data;
  $('detailTitle').textContent = `第 ${data.line} 行`;
  $('detailMeta').textContent = data.error ? `解析失败 · ${data.error}` : `有效 JSON · ${formatBytes(new TextEncoder().encode(data.raw).length)}`;
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
      readButton.className = 'read-text-button'; readButton.type = 'button'; readButton.textContent = '阅读全文';
      readButton.addEventListener('click', () => openTextReader(value, path));
      row.append(readButton);
    }
    root.append(row);
  }
  const pathButton = document.createElement('button'); pathButton.className = 'path-button'; pathButton.type = 'button'; pathButton.title = `复制路径 ${path}`; pathButton.textContent = '复制路径';
  pathButton.addEventListener('click', () => copyText(path, '路径已复制'));
  row.append(pathButton);
  return root;
}
function childPath(path, key, array) {
  return array ? `${path}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}
function openTextReader(value, path) {
  $('readerTitle').textContent = `第 ${currentDetail.line} 行 · 长文本`;
  $('readerPath').textContent = `${path} · ${value.length.toLocaleString()} 字符`;
  $('readerContent').textContent = value;
  $('textReader').showModal();
}
async function copyText(value, message) {
  try { await navigator.clipboard.writeText(value); setStatus(message, 'success'); return true; }
  catch { setStatus('复制失败，请检查剪贴板权限', 'error'); return false; }
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
$('copyRow').addEventListener('click', () => currentDetail && copyText(currentDetail.raw, 'JSON 已复制'));
$('readerCopy').addEventListener('click', async () => {
  if (await copyText($('readerContent').textContent, '全文已复制')) {
    $('readerCopy').textContent = '已复制';
    setTimeout(() => { $('readerCopy').textContent = '复制全文'; }, 1600);
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
  if (files.length > 1) return setStatus('请一次拖入一个文件', 'error');
  loadFile(files[0]);
});
window.addEventListener('blur', hideDropOverlay);
window.addEventListener('keydown', event => { if (event.key === 'Escape') hideDropOverlay(); });
