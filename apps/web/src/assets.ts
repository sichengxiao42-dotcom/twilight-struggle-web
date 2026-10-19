import type { CSSProperties } from 'react';

/** tools/import-tts-assets.mjs 生成的清单格式。 */
export interface TtsManifest {
  sheets: Record<string, { url: string; columns: number; rows: number }>;
  cards: Record<string, { sheet: string; index: number }>;
}

// 清单在 assets/ 下（被 gitignore），不存在时 glob 为空，前端自动回退为文字卡。
const found = import.meta.glob<TtsManifest>('../../../assets/tts-manifest.json', { eager: true, import: 'default' });
const manifest: TtsManifest | undefined = Object.values(found)[0];

const CARD_WIDTH = 140;
const CARD_HEIGHT = 200;

export function cardSprite(cardId: number): CSSProperties | null {
  const entry = manifest?.cards[String(cardId)];
  if (!entry) return null;
  const sheet = manifest!.sheets[entry.sheet];
  const col = entry.index % sheet.columns;
  const row = Math.floor(entry.index / sheet.columns);
  return {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundImage: `url(${sheet.url})`,
    backgroundSize: `${sheet.columns * CARD_WIDTH}px ${sheet.rows * CARD_HEIGHT}px`,
    backgroundPosition: `-${col * CARD_WIDTH}px -${row * CARD_HEIGHT}px`,
  };
}
