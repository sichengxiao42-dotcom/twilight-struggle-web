import type { CSSProperties } from 'react';

/** tools/import-tts-assets.mjs 生成的清单格式。 */
export interface TtsManifest {
  /** webUrl：tools/make-web-sheets.mjs 生成的缩小图集，优先使用。 */
  sheets: Record<string, { url: string; webUrl?: string; columns: number; rows: number }>;
  cards: Record<string, { sheet: string; index: number }>;
  /** 地图原图；boardWeb 为 tools/make-web-sheets.mjs 生成的缩小图，优先使用。 */
  board?: string;
  boardWeb?: string;
}

// 中文清单随仓库提交；不存在时 glob 为空，前端自动回退为文字卡。
const found = import.meta.glob<TtsManifest>('../../../assets/tts-manifest.json', { eager: true, import: 'default' });
const manifest: TtsManifest | undefined = Object.values(found)[0];

/** Percentage-based sprite so the card can be drawn at any size; the element's CSS sets width and height. */
export function cardSprite(cardId: number): CSSProperties | null {
  const entry = manifest?.cards[String(cardId)];
  if (!entry) return null;
  const sheet = manifest!.sheets[entry.sheet];
  const col = entry.index % sheet.columns;
  const row = Math.floor(entry.index / sheet.columns);
  return {
    backgroundImage: `url(${sheet.webUrl ?? sheet.url})`,
    backgroundSize: `${sheet.columns * 100}% ${sheet.rows * 100}%`,
    backgroundPosition: `${(col / (sheet.columns - 1)) * 100}% ${(row / (sheet.rows - 1)) * 100}%`,
  };
}

/** 地图图片地址；清单里没有地图时返回 null，棋盘回退为示意图。 */
export function boardImage(): string | null {
  return manifest?.boardWeb ?? manifest?.board ?? null;
}
