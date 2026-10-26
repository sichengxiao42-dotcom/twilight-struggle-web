import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CARDS, type CardDef, type LogEntry, type LogFx } from '@ts/game-core';
import { CardView } from './CardView';
import { countryCentre } from './boardFx';
import { MAP_WIDTH } from './mapPositions';

// Longest name first, and each match is cut out, so 中国牌 inside a longer card name is not counted twice.
const BY_NAME = [...CARDS].sort((a, b) => b.nameZh.length - a.nameZh.length);
function cardsIn(text: string): CardDef[] {
  let rest = text;
  return BY_NAME.flatMap(card => rest.includes(card.nameZh) ? (rest = rest.replace(card.nameZh, ''), [card]) : []).slice(0, 2);
}

const POPUP_CARD = 210, POPUP_GAP = 12;
type Popup = { cards: CardDef[]; top: number; left: number };

/** Screen x of every country the line's board picture points at. */
function targetXs(fx: LogFx | undefined): number[] {
  const board = document.querySelector('.map-board')?.getBoundingClientRect();
  if (!fx || !board) return [];
  const ids = 'clash' in fx ? [fx.clash.country] : fx.arrows.map(a => a.country);
  return ids.map(id => board.left + countryCentre(id)[0] / MAP_WIDTH * board.width);
}

/**
 * Match log, newest first. Hovering (or focusing) a line redraws its board picture still on the map
 * through onFx, and a line that names cards shows them in a popup beside the panel.
 */
export function LogPanel({ entries, onFx }: { entries: LogEntry[]; onFx: (fx: LogFx | null) => void }) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const show = (index: number, entry: LogEntry, item: HTMLElement) => {
    setActive(index); onFx(entry.fx ?? null);
    const cards = cardsIn(entry.text);
    if (!cards.length) { setPopup(null); return; }
    const rect = item.getBoundingClientRect(), height = POPUP_CARD * 10 / 7 + 2 * POPUP_GAP;
    const width = cards.length * (POPUP_CARD + 8) + 2 * POPUP_GAP, beside = rect.left - POPUP_GAP - width;
    // Beside the panel by default; at the map's left edge when that would cover a country the picture points at.
    const covers = targetXs(entry.fx).some(x => x > beside - 40);
    const mapLeft = document.querySelector('.map-panel')?.getBoundingClientRect().left ?? 8;
    setPopup({ cards, top: Math.max(8, Math.min(rect.top - 20, innerHeight - height - 8)), left: covers ? mapLeft + POPUP_GAP : beside });
  };
  const hide = () => { setActive(null); setPopup(null); onFx(null); };
  // Leaving the panel (switching tabs) must not leave a picture on the map.
  useEffect(() => () => onFx(null), [onFx]);
  return <section className="info-panel" aria-label="对局日志详情" onMouseLeave={hide}>
    <p className="panel-intro">最新记录在上 · 共 {entries.length} 条 · 悬停查看地图标记与卡牌</p>
    {entries.length ? <ol className="match-log" reversed>{[...entries].reverse().map((entry, i) => {
      const index = entries.length - 1 - i, rich = Boolean(entry.fx) || cardsIn(entry.text).length > 0;
      return <li key={index} className={(rich ? 'log-rich' : '') + (active === index ? ' log-active' : '')} tabIndex={rich ? 0 : undefined}
        onMouseEnter={e => show(index, entry, e.currentTarget)} onFocus={e => show(index, entry, e.currentTarget)} onBlur={hide}>{entry.text}</li>;
    })}</ol> : <p className="panel-empty">对局开始后，布点、出牌与结算会记录在这里。</p>}
    {/* Portal: the side column is a size container, which would trap a fixed-position popup inside it. */}
    {popup && createPortal(<div className="log-card-popup" style={{ top: popup.top, left: popup.left }} aria-hidden="true">
      {popup.cards.map(card => <CardView key={card.id} card={card}/>)}
    </div>, document.body)}
  </section>;
}
