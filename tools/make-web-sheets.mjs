#!/usr/bin/env node
// 把 assets/tts-manifest.json 里的原始卡牌图集（约 9300×9100、单张最大 17 MB）缩成网页用的 WebP，
// 并在清单中写入 webUrl。原图保留不动。用法：node tools/make-web-sheets.mjs
// 每格缩到 280 px 宽（卡牌显示宽度 140 px 的 2 倍），整张图远低于移动端 Safari 约 16.7 MP 的解码上限。
// 地图（board，9182×5940）同样缩到 BOARD_WIDTH 宽，写入 boardWeb。

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CELL_WIDTH = 280;
const BOARD_WIDTH = 4096;
const manifestPath = join(root, 'assets/tts-manifest.json');
const publicDir = join(root, 'apps/web/public');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

await mkdir(join(publicDir, 'tts/web'), { recursive: true });
for (const [id, sheet] of Object.entries(manifest.sheets)) {
  const source = join(publicDir, sheet.url);
  const webUrl = `/tts/web/sheet-${id}.webp`;
  const target = join(publicDir, webUrl);
  await sharp(source, { limitInputPixels: false })
    .resize({ width: sheet.columns * CELL_WIDTH })
    .webp({ quality: 82 })
    .toFile(target);
  const { width, height } = await sharp(target).metadata();
  sheet.webUrl = webUrl;
  console.log(`sheet ${id}: ${width}×${height}, ${((await stat(target)).size / 1024).toFixed(0)} KiB`);
}
if (manifest.board) {
  const boardWeb = '/tts/web/board.webp';
  const target = join(publicDir, boardWeb);
  await sharp(join(publicDir, manifest.board), { limitInputPixels: false })
    .resize({ width: BOARD_WIDTH })
    .webp({ quality: 80 })
    .toFile(target);
  const { width, height } = await sharp(target).metadata();
  manifest.boardWeb = boardWeb;
  console.log(`board: ${width}×${height}, ${((await stat(target)).size / 1024).toFixed(0)} KiB`);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
