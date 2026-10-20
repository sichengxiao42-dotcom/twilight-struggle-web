import { useState, type ReactNode } from 'react';
import type { Region } from '@ts/shared';
import { ADJACENCY, COUNTRIES, controller, type Country, type GameState } from '@ts/game-core';
import { boardImage } from './assets';
import { BOX_HEADER, BOX_HEIGHT, BOX_WIDTH, MAP_HEIGHT, MAP_POSITIONS, MAP_WIDTH } from './mapPositions';
const labels: Record<Region, string> = { EUROPE: '欧洲', ASIA: '亚洲', MIDDLE_EAST: '中东', AFRICA: '非洲', CENTRAL_AMERICA: '中美洲', SOUTH_AMERICA: '南美洲' };
// Fallback when the manifest has no map: region panels form an original schematic board; connections are board links, not geographic borders.
const origins: Record<Region, [number, number]> = { CENTRAL_AMERICA: [12, 12], SOUTH_AMERICA: [12, 330], EUROPE: [410, 12], AFRICA: [410, 430], MIDDLE_EAST: [808, 12], ASIA: [808, 330] };
const positions = Object.fromEntries(COUNTRIES.map(c => {
  const group = COUNTRIES.filter(x => x.region === c.region), i = group.indexOf(c), [x, y] = origins[c.region];
  return [c.id, [x + (i % 3) * 128, y + 42 + Math.floor(i / 3) * 48]];
}));
const nameOf = (id: string) => COUNTRIES.find(n => n.id === id)!.nameZh;
const map = boardImage();

/** Influence marker on the map: filled when that side controls the country, like the physical counters. */
function Marker({ x, value, side, filled }: { x: number; value: number; side: 'us' | 'ussr'; filled: boolean }) {
  if (!value) return null;
  const y = BOX_HEADER + 20, size = BOX_HEIGHT - BOX_HEADER - 40;
  return <g className={'marker marker-' + side + (filled ? ' filled' : '')}><rect x={x} y={y} width={size} height={size} rx="16"/><text x={x + size / 2} y={y + size / 2} dominantBaseline="central" textAnchor="middle">{value}</text></g>;
}

export function Board({ state, targets, onCountry }: { state: GameState; targets: string[]; onCountry: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const country = (c: Country, [x, y]: number[], body: ReactNode) => {
    const inf = state.influence[c.id], ctrl = controller(state, c.id), legal = targets.includes(c.id);
    return <g key={c.id} transform={'translate(' + x + ',' + y + ')'} className={'country ' + (legal ? 'legal ' : '') + (ctrl ? 'controlled-' + ctrl : '')} role="button" aria-disabled={!legal} aria-label={c.nameZh + ' 稳定度' + c.stability + ' 美国' + inf.US + ' 苏联' + inf.USSR} tabIndex={0} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c.id)} onBlur={() => setHover(null)} onClick={() => { if (legal) onCountry(c.id); }} onKeyDown={e => { if (legal && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onCountry(c.id); } }}>
      <title>{c.nameZh + ' · 稳定度 ' + c.stability + ' · 相邻：' + ADJACENCY[c.id].map(nameOf).join('、')}</title>
      {body}
    </g>;
  };
  if (map) {
    const centre = (id: string) => [MAP_POSITIONS[id][0] + BOX_WIDTH / 2, MAP_POSITIONS[id][1] + BOX_HEIGHT / 2];
    return <><p>金色边框为可操作国家；国名栏为深色的是战场国。蓝色标记为美国（左半格），红色标记为苏联（右半格），实心表示控制。悬停或聚焦查看相邻连线。</p>
      <div className="board-scroll"><svg viewBox={'0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT} className="board map-board" aria-label="世界局势地图">
        <image href={map} width={MAP_WIDTH} height={MAP_HEIGHT}/>
        {hover && ADJACENCY[hover].map(id => { const a = centre(hover), b = centre(id); return <line key={id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="connection"/>; })}
        {COUNTRIES.map(c => {
          const inf = state.influence[c.id], ctrl = controller(state, c.id), half = BOX_WIDTH / 2, size = BOX_HEIGHT - BOX_HEADER - 40;
          return country(c, MAP_POSITIONS[c.id], <>
            <rect className="hit" width={BOX_WIDTH} height={BOX_HEIGHT} rx="10"/>
            <rect className="tint" y={BOX_HEADER} width={BOX_WIDTH} height={BOX_HEIGHT - BOX_HEADER}/>
            <Marker x={(half - size) / 2} value={inf.US} side="us" filled={ctrl === 'US'}/>
            <Marker x={half + (half - size) / 2} value={inf.USSR} side="ussr" filled={ctrl === 'USSR'}/>
          </>);
        })}
      </svg></div></>;
  }
  return <><p>金色边框为可操作国家；★ 为战场国。蓝色数字为美国，红色数字为苏联。悬停或聚焦查看相邻连线。</p>
    <div className="board-scroll"><svg viewBox="0 0 1208 810" className="board" aria-label="世界局势示意地图">
      {(Object.keys(labels) as Region[]).map(r => { const [x, y] = origins[r]; return <text key={r} x={x + 8} y={y + 25} className="region-title">{labels[r]}</text>; })}
      {hover && ADJACENCY[hover].map(id => { const a = positions[hover], b = positions[id]; return <line key={id} x1={a[0] + 60} y1={a[1] + 20} x2={b[0] + 60} y2={b[1] + 20} className="connection"/>; })}
      {COUNTRIES.map(c => {
        const inf = state.influence[c.id];
        return country(c, positions[c.id], <><rect width="120" height="40" rx="5"/><text x="6" y="15">{c.battleground ? '★ ' : ''}{c.nameZh}</text><text x="6" y="32" className="stability">稳 {c.stability}</text><text x="72" y="32" className="us-value">{inf.US}</text><text x="99" y="32" className="ussr-value">{inf.USSR}</text></>);
      })}
    </svg></div></>;
}
