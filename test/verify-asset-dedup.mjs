// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
// 冒烟：资产素材库同图去重——同节点 thumb+产出 / 存资产全局+当前 / 重复保存 均只 1 条，且命名令牌保留
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const INDEX = decodeURIComponent(new URL('../index.html', import.meta.url).pathname);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

const res = await page.evaluate(async () => {
  const { editor } = window.FlowCraft;
  editor.clear();
  localStorage.removeItem('flowcraft:assetImages:v1');
  localStorage.removeItem('flowcraft:assetMeta:v1');
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const cx = cv.getContext('2d'); cx.fillStyle = '#ff0000'; cx.fillRect(0, 0, 64, 64);
  const X = cv.toDataURL('image/png');

  const node = editor.addNode('aiImage', 300, 260);
  node.thumb = X;
  node.outputsData = [{ type: 'image', value: X }];   // 同图：thumb 与产出一致

  // 1) 同节点 thumb+产出 同图 → 应只 1 条
  let all = window.collectAssets();
  const countX = all.filter(a => a.src === X).length;

  // 2) 存资产 → 全局条目 + 当前条目 同图 → 应仍 1 条
  await window.saveNodeImageAsAsset(node); // 存资产已改异步（IndexedDB 真源），不等就会出现读到 0 条的假失败
  all = window.collectAssets();
  const countX2 = all.filter(a => a.src === X).length;

  // 3) 给全局资产命名 → 应仍 1 条，且显示名=自定义名（<<<令牌>>> 保留）
  const gEntries = window.globalAssetEntries();
  const gKey = gEntries.length ? window.assetKey(gEntries[0]) : '';
  window.setAssetMeta(gKey, { name: '我的角色' });
  all = window.collectAssets();
  const countX3 = all.filter(a => a.src === X).length;
  const entryX = all.find(a => a.src === X);
  const nameMap = window.assetNameMap(all);
  const displayName = entryX ? nameMap[window.assetKey(entryX)] : null;

  // 4) 再存一次同图（重复保存）→ 全局库内同图只取一条 → 仍 1 条
  await window.saveNodeImageAsAsset(node); // 存资产已改异步（IndexedDB 真源），不等就会出现读到 0 条的假失败
  all = window.collectAssets();
  const countX4 = all.filter(a => a.src === X).length;

  // 5) 整体无重复 src
  const srcs = all.map(a => a.src);
  const dup = srcs.some((s, i) => srcs.indexOf(s) !== i);

  return { countX, countX2, countX3, countX4, displayName, dup, gKey };
});

ok('同节点 thumb+产出 同图只 1 条', res.countX === 1, res);
ok('存资产后仍只 1 条（全局+当前去重）', res.countX2 === 1, res);
ok('命名后仍只 1 条', res.countX3 === 1, res);
ok('命名令牌保留（显示名=我的角色）', res.displayName === '我的角色', res);
ok('重复保存同图仍只 1 条', res.countX4 === 1, res);
ok('资产列表无重复 src', res.dup === false, res);
ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log('\n==== 资产同图去重冒烟：PASS=' + pass + ' FAIL=' + fail + ' ====');
process.exit(fail === 0 ? 0 : 1);
