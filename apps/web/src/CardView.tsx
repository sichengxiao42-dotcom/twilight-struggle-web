import type { CardDef } from '@ts/game-core';
import { cardSprite } from './assets';

const SIDE_LABEL = { USSR: '苏', US: '美', NEUTRAL: '中' } as const;

/** 有本地 TTS 素材时显示原版卡图（雪碧图切片），否则回退到文字卡。 */
export function CardView({ card }: { card: CardDef }) {
  const sprite = cardSprite(card.id);
  if (sprite) return <div className="card image" style={sprite} title={card.nameZh} />;
  return (
    <div className={`card side-${card.side}`}>
      <b>{card.scoring ? '计分' : card.ops}</b>
      <span>{card.nameZh}{card.starred ? ' *' : ''}</span>
      <small>{SIDE_LABEL[card.side]} · #{card.id}</small>
    </div>
  );
}
