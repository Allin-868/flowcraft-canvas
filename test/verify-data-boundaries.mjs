#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * P0 数据边界专项：只使用当前构建产物和本地数据，不调用真实 AI。
 * 覆盖：空项目、损坏 ZIP/JSON、缺少 nodes、旧 schema、未知节点、孤儿连线，
 * 以及失败导入不得覆盖 IndexedDB 当前项目。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = join(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const require = createRequire(import.meta.url);
const JSZip = require(join(ROOT, 'node_modules', 'jszip'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]);
  const f = normalize(join(ROOT, p === '/' ? 'index.html' : p.replace(/^\/+/, '')));
  if (!existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});

let pass = 0; let fail = 0; const failed = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; failed.push(name); console.log('  ❌ ' + name + (detail ? ' → ' + detail : '')); }
}

async function makeZip(project, options = {}) {
  const zip = new JSZip();
  if (options.manifest !== false) zip.file('manifest.json', JSON.stringify({ format: 'flowcraft', formatVersion: 1, projectName: '边界测试' }));
  if (options.projectText !== undefined) zip.file('project.json', options.projectText);
  else if (project !== undefined) zip.file('project.json', JSON.stringify(project));
  return zip.generateAsync({ type: 'nodebuffer' });
}
function baseProject() {
  return { version: 4, nodes: [{ id: 'n-boundary', type: 'text', x: 40, y: 50, title: '边界基线', params: {}, inputsData: [], outputsData: [] }], edges: [], order: ['n-boundary'], camera: { x: 0, y: 0, zoom: 1 } };
}

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const runtimeErrors = [];
page.on('pageerror', (e) => runtimeErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/i.test(m.text())) runtimeErrors.push('console:' + m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.storage && typeof window.applyWorkflowData === 'function');
// 清理上一次测试残留，但保留数据库本身以覆盖 v1 -> v2 升级后的实际对象仓库。
await page.evaluate(async () => {
  const db = await new Promise((resolve) => { const r = indexedDB.open('flowcraft-db', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
  if (!db) return;
  const names = [...db.objectStoreNames].filter((n) => ['projects', 'assets', 'snapshots', 'tasks', 'kv'].includes(n));
  if (!names.length) { db.close(); return; }
  await new Promise((resolve) => { const tx = db.transaction(names, 'readwrite'); names.forEach((n) => tx.objectStore(n).clear()); tx.oncomplete = resolve; tx.onerror = resolve; });
  db.close();
});

async function importZip(buffer) {
  return page.evaluate(async (bytes) => {
    try {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
      const project = await window.FlowCraft.storage.importProject(blob);
      return { ok: true, project };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }, [...buffer]);
}
async function getCurrent() {
  return page.evaluate(async () => {
    const p = await window.FlowCraft.storage.loadFromIDB();
    return p ? JSON.stringify(p) : null;
  });
}

const empty = await importZip(await makeZip({ version: 4, nodes: [], edges: [], order: [] }));
check('空项目导入通过', empty.ok, empty.error);

const baseline = await importZip(await makeZip(baseProject()));
check('合法基线项目导入通过', baseline.ok, baseline.error);
// 直接应用基线，准备验证失败导入不覆盖当前项目。
await page.evaluate((p) => { window.applyWorkflowData(p); }, baseProject());
await page.waitForTimeout(350);
const beforeInvalid = await getCurrent();

const cases = [
  ['损坏的 ZIP', Buffer.from('not-a-zip')],
  ['project.json 损坏', await makeZip(undefined, { projectText: '{broken-json' })],
  ['缺少 project.json', await makeZip(undefined, { projectText: undefined })],
  ['缺少 nodes', await makeZip({ version: 4, edges: [] })],
  ['未知节点类型', await makeZip({ version: 4, nodes: [{ id: 'n1', type: 'futureMagic', x: 0, y: 0 }], edges: [] })],
  ['连线引用不存在节点', await makeZip({ version: 4, nodes: [{ id: 'n1', type: 'text', x: 0, y: 0 }], edges: [{ id: 'e1', fromNodeId: 'n1', fromPort: 0, toNodeId: 'missing', toPort: 0 }] })],
];
for (const [name, buf] of cases) {
  const result = await importZip(buf);
  check(name + ' 被拒绝', !result.ok, result.error);
  check(name + ' 不覆盖当前项目', (await getCurrent()) === beforeInvalid, (await getCurrent()) || '当前项目为空');
}

const old = await importZip(await makeZip({ version: 1, nodes: [{ id: 'n-old', type: 'text', x: 10, y: 20, title: '旧版本' }], edges: [] }));
check('旧 schema 项目仍可导入', old.ok, old.error);
if (old.ok) {
  const restored = await page.evaluate(async () => {
    const p = await window.FlowCraft.storage.loadFromIDB();
    window.applyWorkflowData(p);
    return { count: window.FlowCraft.editor.state().nodeCount, title: [...window.FlowCraft._legacy.workflow.nodes.values()][0].title };
  });
  check('旧 schema 导入后可恢复到画布', restored.count === 1 && restored.title === '旧版本', restored);
}
check('边界专项运行期无错误', runtimeErrors.length === 0, runtimeErrors.slice(0, 3).join(' | '));
console.log(`\n结果：${pass}/${pass + fail} 通过` + (failed.length ? '；失败：' + failed.join(' | ') : ''));
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
