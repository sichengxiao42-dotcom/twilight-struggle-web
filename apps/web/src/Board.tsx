import { useState, type ReactNode } from 'react';
import type { Region, Side } from '@ts/shared';
import { ADJACENCY, COUNTRIES, controller, type Country, type GameState } from '@ts/game-core';
import { boardImage } from './assets';
import { ACTION_ROUND_TRACK, BOX_HEADER, BOX_HEIGHT, BOX_WIDTH, DEFCON_TRACK, MAP_HEIGHT, MAP_POSITIONS, MAP_WIDTH, MIL_OPS_TRACK, SPACE_TRACK, TRACK_MARKER_RADIUS, TURN_TRACK, VP_TRACK } from './mapPositions';
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sideZh: Record<Side, string> = { US: '美', USSR: '苏' };
const trackColours = { US: ['#2f5d9e', '#fff'], USSR: ['#b3261e', '#fff'], neutral: ['#f4e9c8', '#1b1b1b'] } as const;

/** The round being played and by whom: the phase while choosing a card, else the queued FINISH_ACTION while its card resolves. */
function currentActionRound(state: GameState): { side: Side; round: number } | null {
  const p = state.phase;
  if (p.kind === 'ACTION_ROUND' || (p.kind === 'OPS' && p.round)) return { side: p.side, round: p.round };
  const finish = state.tasks.find(t => t.kind === 'FINISH_ACTION');
  return finish?.kind === 'FINISH_ACTION' ? { side: finish.side, round: finish.round } : null;
}

/** One counter on a printed track; two side counters sharing a box are pushed apart (USSR left, US right). */
function TrackMarker({ at: [x, y], owner, label, title, shared }: { at: [number, number]; owner: Side | 'neutral'; label: string; title: string; shared?: boolean }) {
  const r = TRACK_MARKER_RADIUS, dx = shared ? (owner === 'USSR' ? -0.8 : 0.8) * r : 0, [fill, ink] = trackColours[owner];
  return <g className={'track-marker track-' + owner} transform={'translate(' + (x + dx) + ',' + y + ')'} pointerEvents="none">
    <title>{title}</title>
    <circle r={r} fill={fill} stroke={owner === 'neutral' ? '#1b1b1b' : '#fff'} strokeWidth="10"/>
    <text dominantBaseline="central" textAnchor="middle" fontSize={label.length > 1 ? r * 0.75 : r} fontWeight="800" fill={ink}>{label}</text>
  </g>;
}

/** Turn, action round, DEFCON, VP, space race and military ops counters on the tracks printed on the map. */
function TrackMarkers({ state }: { state: GameState }) {
  const ar = currentActionRound(state), sides: Side[] = ['USSR', 'US'];
  // The phasing side sits on the current round; the other side shows the last round it played (none before the US's first).
  const arRound = (side: Side) => !ar ? 0 : side === ar.side || side === 'USSR' ? ar.round : ar.round - 1;
  const vp = clamp(state.vp, -20, 20), space = (s: Side) => clamp(state.space[s], 0, 8), mil = (s: Side) => clamp(state.milOps[s], 0, 5);
  return <g className="track-markers">
    <TrackMarker at={TURN_TRACK[clamp(state.turn, 1, 10) - 1]} owner="neutral" label="回合" title={'第 ' + state.turn + ' 回合'}/>
    <TrackMarker at={DEFCON_TRACK[clamp(state.defcon, 1, 5)]} owner="neutral" label="核" title={'DEFCON ' + state.defcon}/>
    <TrackMarker at={VP_TRACK[vp]} owner="neutral" label="VP" title={'胜利分 ' + (state.vp > 0 ? '美国 +' + state.vp : state.vp < 0 ? '苏联 +' + -state.vp : '0')}/>
    {sides.map(s => <TrackMarker key={'space-' + s} at={SPACE_TRACK[space(s)]} owner={s} label={sideZh[s]} title={sideZh[s] + '太空竞赛 ' + state.space[s]} shared={space('US') === space('USSR')}/>)}
    {sides.map(s => <TrackMarker key={'mil-' + s} at={MIL_OPS_TRACK[mil(s)]} owner={s} label={sideZh[s]} title={sideZh[s] + '军事行动 ' + state.milOps[s]} shared={mil('US') === mil('USSR')}/>)}
    {sides.map(s => arRound(s) > 0 && <TrackMarker key={'ar-' + s} at={ACTION_ROUND_TRACK[clamp(arRound(s), 1, 8) - 1]} owner={s} label={sideZh[s]} title={sideZh[s] + '行动轮 ' + arRound(s)} shared={arRound('US') === arRound('USSR')}/>)}
  </g>;
}

export function Board({ state, targets, onCountry, scale = 1 }: { state: GameState; targets: string[]; onCountry: (id: string) => void; scale?: number }) {
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
    return <>
      <div className="board-scroll"><svg viewBox={'0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT} className="board map-board" style={{width: `${scale * 100}%`}} aria-label="世界局势地图">
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
        <TrackMarkers state={state}/>
      </svg></div><p className="map-caption"><span>● 美国</span><span>● 苏联</span><span>金框：当前可选 · 实心：控制</span><span>悬停或聚焦查看相邻连线 · 放大后可横向滚动</span></p></>;
  }
  return <>
    <div className="board-scroll"><svg viewBox="0 0 1208 810" className="board" style={{width: `${scale * 100}%`}} aria-label="世界局势示意地图">
      {(Object.keys(labels) as Region[]).map(r => { const [x, y] = origins[r]; return <text key={r} x={x + 8} y={y + 25} className="region-title">{labels[r]}</text>; })}
      {hover && ADJACENCY[hover].map(id => { const a = positions[hover], b = positions[id]; return <line key={id} x1={a[0] + 60} y1={a[1] + 20} x2={b[0] + 60} y2={b[1] + 20} className="connection"/>; })}
      {COUNTRIES.map(c => {
        const inf = state.influence[c.id];
        return country(c, positions[c.id], <><rect width="120" height="40" rx="5"/><text x="6" y="15">{c.battleground ? '★ ' : ''}{c.nameZh}</text><text x="6" y="32" className="stability">稳 {c.stability}</text><text x="72" y="32" className="us-value">{inf.US}</text><text x="99" y="32" className="ussr-value">{inf.USSR}</text></>);
      })}
    </svg></div><p className="map-caption"><span>● 美国</span><span>● 苏联</span><span>金框：当前可选 · 实心：控制</span><span>悬停或聚焦查看相邻连线 · 放大后可横向滚动</span></p></>;
}
