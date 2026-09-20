// 阶段 E — 数据可靠性压测（浏览器实测，不调用真实 AI）
// 目标：把「刷新不丢数据 / 大图不丢 / 写入失败不撒谎 / 快照与 ZIP 往返保真 / 孤儿清理可回滚」
// 这条最容易翻车的主线用真实运行时行为钉死，补齐此前只做静态源码检查或浅层往返的盲区。
//
// 覆盖盲区（相对既有 verify-storage-faults[静态] / verify-project-panel[浅往返] / verify-refresh-recovery[小节点]）：
//   A 写入失败运行时诚实性：配额/写失败时 autosave 必须 ok:false 且带 errorCode，绝不伪装成功；故障解除后能恢复保存。
//   B 打开失败降级：IndexedDB 不可用时 autosave 如实返回 ok:false（IDB_UNAVAILABLE），不抛到 UI。
//   C 快照往返保真：含大图(>60KB dataURL)的项目 snapshot → 清空画布 → restoreSnapshot 后大图逐字节一致。
//   D ZIP 大图保真 + 资产去重：export→import 后大图 dataURL 逐字节一致；同一内容二次导入资产 store 不膨胀(sha256 去重)。
//   E 批量写入事务：transactionalPut 多条有效记录单事务全部落库（all-or-nothing 的成功侧）。
//   F 大图刷新存活：autosave 含大图项目 → reload → loadFromIDB 大图仍在且非 (stripped)（kv 双 keyPath 历史坑回归护栏）。
//   G 孤儿清理安全：previewOrphans 只回元数据(不含 dataUrl)；cleanupOrphans 先快照后删；restoreSnapshot 能把资产找回。
//   H 快照保留策略：超过 20 个时裁掉最旧；标记 [永久] 的豁免不删。
//
// 注：批量写入「失败侧整体回滚」依赖 IndexedDB 事务中止，从外部无法稳定强制触发一次真实的异步事务错误，
//     其回滚接线（t.oncomplete/onerror/onabort）已由静态用例 verify-storage-faults.mjs 钉住；本脚本只实测成功侧的原子落库。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name + (extra ? ' :: ' + extra : '')); console.log('  ❌ ' + name + (extra ? ' :: ' + extra : '')); }
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(FILE));
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = 'http://localhost:' + port + '/index.html';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  // 全新数据库，避免历史数据干扰
  await page.goto(base);
  await page.evaluate(() => new Promise((res) => { try { indexedDB.deleteDatabase('flowcraft-db'); } catch (e) {} setTimeout(res, 250); }));
  await page.reload();
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.storage && window.FlowCraft.storage.getMode, { timeout: 15000 });
  await page.waitForTimeout(300);

  // 注入原生 indexedDB 交叉校验辅助（独立于应用封装）
  await page.evaluate(() => {
    window.__fcGetAll = (store) => new Promise((resolve) => {
      const r = indexedDB.open('flowcraft-db');
      r.onsuccess = () => {
        const db = r.result;
        try {
          const rq = db.transaction(store, 'readonly').objectStore(store).getAll();
          rq.onsuccess = () => { db.close(); resolve(rq.result || []); };
          rq.onerror = () => { db.close(); resolve([]); };
        } catch (e) { db.close(); resolve([]); }
      };
      r.onerror = () => resolve([]);
    });
    window.__fcCount = async (store) => (await window.__fcGetAll(store)).length;
    window.__fcHas = async (store, id) => (await window.__fcGetAll(store)).some((x) => x && x.id === id);
    window.__fcPutAsset = (rec) => new Promise((resolve) => {
      const r = indexedDB.open('flowcraft-db', 2);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(rec);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
        tx.onabort = () => { db.close(); resolve(false); };
      };
      r.onerror = () => resolve(false);
    });
  });

  // 生成一张真实 PNG 大图（噪声 → base64 合法且 >60KB），用于大图保真/存活/去重各项
  const heavy = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 384; c.height = 384;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(384, 384);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = (Math.random() * 256) | 0; img.data[i + 1] = (Math.random() * 256) | 0;
      img.data[i + 2] = (Math.random() * 256) | 0; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
  ok('前置：生成的大图 dataURL >60KB（够触发 heavy 资产判定）', typeof heavy === 'string' && heavy.startsWith('data:image/png') && heavy.length > 60000, 'len=' + (heavy && heavy.length));

  // 在画布放一个携带大图的节点（thumb + outputsData 双通道，覆盖 ZIP 收集与刷新存活）
  const setHeavyNode = () => page.evaluate((h) => {
    if (typeof workflow === 'undefined' || !workflow.nodes) return false;
    workflow.nodes.clear();
    workflow.nodes.set('hv1', {
      id: 'hv1', type: 'image', title: '大图节点', x: 0, y: 0, width: 280, height: 200,
      prompt: '', params: {}, status: 'idle', thumb: h, uploadedImage: h,
      inputsData: [], outputsData: [{ value: h }], refImages: [],
    });
    return true;
  }, heavy);

  console.log('\n[A] 写入失败运行时诚实性（配额/写失败不撒谎 + 故障解除可恢复）');
  await setHeavyNode();
  const baseline = await page.evaluate(() => window.FlowCraft.storage.autosave());
  ok('A1 正常态 autosave 成功（ok:true / indexeddb）', baseline && baseline.ok === true && baseline.mode === 'indexeddb', JSON.stringify(baseline));
  const writeFail = await page.evaluate(async () => {
    window.__FC_TEST_STORAGE_FAILURE__ = 'write';
    try { return await window.FlowCraft.storage.autosave(); } finally { delete window.__FC_TEST_STORAGE_FAILURE__; }
  });
  ok('A2 写失败时 autosave 如实 ok:false（不伪装成功）', writeFail && writeFail.ok === false, JSON.stringify(writeFail));
  ok('A3 写失败带 QUOTA_EXCEEDED 错误码', writeFail && writeFail.errorCode === 'QUOTA_EXCEEDED', JSON.stringify(writeFail));
  const recovered = await page.evaluate(() => window.FlowCraft.storage.autosave());
  ok('A4 故障解除后 autosave 恢复成功', recovered && recovered.ok === true, JSON.stringify(recovered));

  console.log('\n[B] 打开失败降级（IndexedDB 不可用如实返回，不抛到 UI）');
  const openFail = await page.evaluate(async () => {
    const S = window.FlowCraft.storage;
    S._idbReady = false; window.__FC_TEST_STORAGE_FAILURE__ = 'open';
    let r; try { r = await S.autosave(); } finally { delete window.__FC_TEST_STORAGE_FAILURE__; S._idbReady = false; }
    return r;
  });
  ok('B1 打开失败时 autosave 如实 ok:false', openFail && openFail.ok === false, JSON.stringify(openFail));
  ok('B2 打开失败带 IDB_UNAVAILABLE 错误码', openFail && openFail.errorCode === 'IDB_UNAVAILABLE', JSON.stringify(openFail));
  const openRecovered = await page.evaluate(() => window.FlowCraft.storage.autosave());
  ok('B3 重新可用后 autosave 恢复成功', openRecovered && openRecovered.ok === true, JSON.stringify(openRecovered));

  console.log('\n[C] 快照往返保真（含大图：snapshot → 清空画布 → restore 后逐字节一致）');
  await setHeavyNode();
  const snapId = await page.evaluate(() => window.FlowCraft.storage.snapshot('阶段E-大图里程碑'));
  ok('C1 snapshot 返回 id', typeof snapId === 'string' && snapId.length > 0, String(snapId));
  const restoredC = await page.evaluate(async (id) => {
    if (typeof workflow !== 'undefined' && workflow.nodes) workflow.nodes.clear(); // 人为破坏当前画布
    return await window.FlowCraft.storage.restoreSnapshot(id);
  }, snapId);
  const cNode = restoredC && Array.isArray(restoredC.nodes) ? restoredC.nodes.find((n) => n.id === 'hv1') : null;
  ok('C2 restore 后大图节点回来了', !!cNode, 'nodes=' + (restoredC && restoredC.nodes && restoredC.nodes.length));
  ok('C3 restore 后大图 thumb 逐字节一致', cNode && cNode.thumb === heavy, cNode ? ('len=' + (cNode.thumb || '').length) : 'no-node');
  ok('C4 restore 后大图 outputsData 逐字节一致', cNode && cNode.outputsData && cNode.outputsData[0] && cNode.outputsData[0].value === heavy);

  console.log('\n[D] ZIP 大图保真 + 资产 sha256 去重');
  await setHeavyNode();
  const zipRound = await page.evaluate(async () => {
    const blob = await window.FlowCraft.storage.exportProject({ projectName: '阶段E-往返' });
    const file = new File([blob], 'e-roundtrip.flowcraft', { type: 'application/zip' });
    const proj = await window.FlowCraft.storage.importProject(file);
    const n = proj && Array.isArray(proj.nodes) ? proj.nodes.find((x) => x.id === 'hv1') : null;
    return { name: proj && proj.name, thumb: n && n.thumb, out: n && n.outputsData && n.outputsData[0] && n.outputsData[0].value };
  });
  ok('D1 ZIP 往返后项目名保留', zipRound && zipRound.name === '阶段E-往返', JSON.stringify({ name: zipRound && zipRound.name }));
  ok('D2 ZIP 往返后大图 thumb 逐字节一致（像素级存活）', zipRound && zipRound.thumb === heavy, 'len=' + (zipRound && zipRound.thumb ? zipRound.thumb.length : 0));
  ok('D3 ZIP 往返后大图 outputsData 逐字节一致', zipRound && zipRound.out === heavy);
  const beforeDup = await page.evaluate(() => window.__fcCount('assets'));
  await page.evaluate(async () => {
    const blob = await window.FlowCraft.storage.exportProject({ projectName: '阶段E-往返' });
    const file = new File([blob], 'e-dup.flowcraft', { type: 'application/zip' });
    await window.FlowCraft.storage.importProject(file); // 同内容二次导入
  });
  const afterDup = await page.evaluate(() => window.__fcCount('assets'));
  ok('D4 同一内容二次导入资产 store 不膨胀（sha256 去重）', afterDup === beforeDup, 'before=' + beforeDup + ' after=' + afterDup);

  console.log('\n[E] 批量写入事务：多条有效记录单事务全部落库');
  await page.evaluate(async () => {
    const recs = [{ id: 'bulk-a', dataUrl: 'data:text/plain,AAA', kind: 'test', sha256: 'bulk-a' }, { id: 'bulk-b', dataUrl: 'data:text/plain,BBB', kind: 'test', sha256: 'bulk-b' }];
    await window.FlowCraft.storage.transactionalPut('assets', recs);
  });
  const bulkA = await page.evaluate(() => window.__fcHas('assets', 'bulk-a'));
  const bulkB = await page.evaluate(() => window.__fcHas('assets', 'bulk-b'));
  ok('E1 transactionalPut 两条记录均落库', bulkA && bulkB, 'a=' + bulkA + ' b=' + bulkB);

  console.log('\n[F] 大图刷新存活（autosave → reload → loadFromIDB 大图仍在且非 stripped）');
  await setHeavyNode();
  await page.evaluate(() => window.FlowCraft.storage.autosave());
  await page.reload();
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.storage && window.FlowCraft.storage.loadFromIDB, { timeout: 15000 });
  await page.waitForTimeout(300);
  // reload 后重新注入辅助（window 上的函数随文档重建而丢失）
  await page.evaluate(() => {
    window.__fcGetAll = (store) => new Promise((resolve) => {
      const r = indexedDB.open('flowcraft-db');
      r.onsuccess = () => { const db = r.result; try { const rq = db.transaction(store, 'readonly').objectStore(store).getAll(); rq.onsuccess = () => { db.close(); resolve(rq.result || []); }; rq.onerror = () => { db.close(); resolve([]); }; } catch (e) { db.close(); resolve([]); } };
      r.onerror = () => resolve([]);
    });
    window.__fcHas = async (store, id) => (await window.__fcGetAll(store)).some((x) => x && x.id === id);
    window.__fcPutAsset = (rec) => new Promise((resolve) => {
      const r = indexedDB.open('flowcraft-db', 2);
      r.onsuccess = () => { const db = r.result; const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put(rec); tx.oncomplete = () => { db.close(); resolve(true); }; tx.onerror = () => { db.close(); resolve(false); }; tx.onabort = () => { db.close(); resolve(false); }; };
      r.onerror = () => resolve(false);
    });
  });
  const afterRefresh = await page.evaluate(async () => {
    const proj = await window.FlowCraft.storage.loadFromIDB();
    const n = proj && Array.isArray(proj.nodes) ? proj.nodes.find((x) => x.id === 'hv1') : null;
    return { hasNode: !!n, thumb: n && n.thumb };
  });
  ok('F1 刷新后大图节点仍在 IndexedDB 真源', afterRefresh.hasNode, JSON.stringify({ hasNode: afterRefresh.hasNode }));
  ok('F2 刷新后大图 thumb 逐字节一致（未被剥离/丢失）', afterRefresh.thumb === heavy, 'len=' + (afterRefresh.thumb ? afterRefresh.thumb.length : 0));
  ok('F3 刷新后 thumb 不是 (stripped) 占位', afterRefresh.thumb !== '(stripped)');

  console.log('\n[G] 孤儿清理安全（预览只回元数据 / 清理先快照后删 / 快照可找回）');
  const orphanUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
  await page.evaluate((u) => window.__fcPutAsset({ id: 'orphan-e1', dataUrl: u, kind: 'test-orphan', createdAt: new Date().toISOString(), sha256: 'orphan-e1' }), orphanUrl);
  const preview = await page.evaluate(() => window.FlowCraft.storage.previewOrphans());
  const cand = preview && Array.isArray(preview.candidates) ? preview.candidates.find((c) => c.id === 'orphan-e1') : null;
  ok('G1 previewOrphans 命中孤儿资产', !!cand, JSON.stringify(preview && { total: preview.total }));
  ok('G2 预览候选不含 dataUrl（不把大图带进 UI/日志）', cand && !('dataUrl' in cand), cand ? JSON.stringify(Object.keys(cand)) : 'no-cand');
  const cleaned = await page.evaluate((id) => window.FlowCraft.storage.cleanupOrphans([id]), 'orphan-e1');
  ok('G3 cleanupOrphans 成功删除并返回快照 id', cleaned && cleaned.ok === true && cleaned.removed === 1 && typeof cleaned.snapshotId === 'string', JSON.stringify(cleaned));
  const goneAfterClean = await page.evaluate(() => window.__fcHas('assets', 'orphan-e1'));
  ok('G4 清理后孤儿资产确已移出 store', goneAfterClean === false);
  const restoredG = await page.evaluate(async (sid) => { await window.FlowCraft.storage.restoreSnapshot(sid); return await window.__fcHas('assets', 'orphan-e1'); }, cleaned && cleaned.snapshotId);
  ok('G5 restoreSnapshot 把被清理的资产找回（清理可回滚）', restoredG === true);

  console.log('\n[H] 快照保留策略（超 20 裁旧 / [永久] 豁免）');
  // 换成极小项目，避免 25 次快照都序列化大图拖慢测试
  await page.evaluate(() => { if (typeof workflow !== 'undefined' && workflow.nodes) { workflow.nodes.clear(); workflow.nodes.set('tiny', { id: 'tiny', type: 'text', title: 't', x: 0, y: 0, width: 200, height: 100, prompt: '', params: {}, status: 'idle', inputsData: [], outputsData: [] }); } });
  const permId = await page.evaluate(() => window.FlowCraft.storage.snapshot('[永久] 阶段E锚点'));
  for (let i = 0; i < 25; i++) { await page.evaluate((k) => window.FlowCraft.storage.snapshot('普通' + k), i); await page.waitForTimeout(4); }
  const snapsH = await page.evaluate(() => window.FlowCraft.storage.listSnapshots());
  ok('H1 快照总数被裁剪到上限附近（<=21）', Array.isArray(snapsH) && snapsH.length <= 21, 'len=' + (snapsH && snapsH.length));
  ok('H2 标记 [永久] 的快照豁免未删', Array.isArray(snapsH) && snapsH.some((s) => s.id === permId && (s.label || '').includes('[永久]')), 'permId=' + permId);

  console.log('\n[Z] 控制台错误');
  ok('Z1 全程无页面控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  console.log('\n==== verify-data-reliability: ' + pass + '/' + (pass + fail) + ' 通过 ====');
  if (fail > 0) { console.log('失败项:'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
