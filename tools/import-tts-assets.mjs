#!/usr/bin/env node
// 从你本机已订阅的 Tabletop Simulator 模组存档中提取卡图索引，生成 assets/tts-manifest.json。
//
// 用法：
//   node tools/import-tts-assets.mjs <模组 JSON 路径> [--download]
//
// 模组 JSON 通常位于：
//   Windows: %USERPROFILE%\Documents\My Games\Tabletop Simulator\Mods\Workshop\<创意工坊ID>.json
//
// 默认只记录卡图雪碧图的远程地址；加 --download 会把雪碧图下载到 apps/web/public/tts/（已 gitignore）。
// 卡图版权属于 GMT Games，生成的文件仅供本地开发使用，不要提交或公开部署。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [modPath, ...flags] = process.argv.slice(2);
const download = flags.includes('--download');

if (!modPath) {
  console.error('Usage: node tools/import-tts-assets.mjs <path-to-tts-mod.json> [--download]');
  process.exit(1);
}

const save = JSON.parse(await readFile(modPath, 'utf8'));

/** TTS 存档里卡牌可能嵌套在牌堆、袋子里，递归收集所有对象。 */
function* walk(objects) {
  for (const obj of objects ?? []) {
    yield obj;
    yield* walk(obj.ContainedObjects);
    for (const state of Object.values(obj.States ?? {})) yield* walk([state]);
  }
}

const sheets = {};
const cards = {};
const unmatched = [];

for (const obj of walk(save.ObjectStates)) {
  for (const [deckId, deck] of Object.entries(obj.CustomDeck ?? {})) {
    sheets[deckId] ??= { url: deck.FaceURL, columns: deck.NumWidth, rows: deck.NumHeight };
  }
  if (obj.Name !== 'Card' && obj.Name !== 'CardCustom') continue;
  // CardID = 牌堆ID × 100 + 在雪碧图中的序号
  const sheet = String(Math.floor(obj.CardID / 100));
  const index = obj.CardID % 100;
  // 卡牌昵称里通常带编号，例如 "#21 NATO" 或 "021 - NATO"；匹配不上的列入 unmatched，人工补全。
  const match = /(\d{1,3})/.exec(obj.Nickname ?? '');
  if (match) cards[String(Number(match[1]))] ??= { sheet, index };
  else unmatched.push({ nickname: obj.Nickname, sheet, index });
}

if (download) {
  const outDir = join(root, 'apps/web/public/tts');
  await mkdir(outDir, { recursive: true });
  for (const [deckId, sheet] of Object.entries(sheets)) {
    const res = await fetch(sheet.url);
    if (!res.ok) { console.warn(`skip sheet ${deckId}: HTTP ${res.status}`); continue; }
    const file = `sheet-${deckId}.jpg`;
    await writeFile(join(outDir, file), Buffer.from(await res.arrayBuffer()));
    sheet.url = `/tts/${file}`;
  }
}

await mkdir(join(root, 'assets'), { recursive: true });
await writeFile(join(root, 'assets/tts-manifest.json'), JSON.stringify({ sheets, cards, unmatched }, null, 2));
console.log(`sheets: ${Object.keys(sheets).length}, cards matched: ${Object.keys(cards).length}, unmatched: ${unmatched.length}`);
