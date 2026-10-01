const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const locales = ['en', 'zh_CN', 'zh_TW', 'ja', 'ko', 'es', 'fr', 'de', 'pt_BR'];
const source = fs.readFileSync('i18n.js', 'utf8');

function load(locale) {
  const scope = { navigator: { language: locale }, Intl };
  vm.createContext(scope);
  vm.runInContext(source, scope);
  return scope.appI18n;
}

test('all supported locales translate every runtime key with matching placeholders', () => {
  const messages = load('en').messages;
  const keys = Object.keys(messages.en).sort();
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',');
  for (const locale of locales) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), keys, `${locale} has missing messages`);
    for (const key of keys) {
      assert.equal(placeholders(messages[locale][key]), placeholders(messages.en[key]), `${locale}.${key} has incorrect placeholders`);
    }
    const manifestMessages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
    assert.equal(manifestMessages.extName.message, 'JSONL Viewer');
  }
});

test('locale selection falls back to a supported language', () => {
  assert.equal(load('en-US').locale, 'en');
  assert.equal(load('zh-CN').locale, 'zh_CN');
  assert.equal(load('zh-HK').locale, 'zh_TW');
  assert.equal(load('zh-Hant-TW').locale, 'zh_TW');
  assert.equal(load('es-MX').locale, 'es');
  assert.equal(load('pt-BR').locale, 'pt_BR');
  assert.equal(load('it-IT').locale, 'en');
});

test('HTML and JavaScript message references exist', () => {
  const html = fs.readFileSync('viewer.html', 'utf8');
  const js = fs.readFileSync('viewer.js', 'utf8') + fs.readFileSync('worker.js', 'utf8');
  const keys = new Set(Object.keys(load('en').messages.en));
  for (const match of html.matchAll(/data-i18n(?:-title|-placeholder|-aria-label)?="([^"]+)"/g)) {
    assert.ok(keys.has(match[1]), `Missing HTML message ${match[1]}`);
  }
  for (const match of js.matchAll(/\bt\('([^']+)'/g)) {
    assert.ok(keys.has(match[1]), `Missing JS message ${match[1]}`);
  }
});
