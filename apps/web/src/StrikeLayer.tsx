import { useEffect, useState, type CSSProperties } from 'react';
import type { Side } from '@ts/shared';
import type { Strike } from '@ts/game-core';
import { BOX_HEIGHT, BOX_WIDTH, MAP_POSITIONS } from './mapPositions';

/** Where the arrows leave from: the "U.S.S.R." and "U.S.A." titles printed on the map. */
const ORIGIN: Record<Side, [number, number]> = { USSR: [5400, 1180], US: [960, 2010] };
const STAGGER = 0.18, FLIGHT = 0.7, AFTER = 1.4;

/** Highest strike id already shown per game, kept outside the board so undo/remount or a refresh never replays old arrows. */
const shown = new Map<string, number>();

function arc(side: Side, country: string) {
  const [ox, oy] = ORIGIN[side], tx = MAP_POSITIONS[country][0] + BOX_WIDTH / 2, ty = MAP_POSITIONS[country][1] + BOX_HEIGHT / 2;
  const dx = tx - ox, dy = ty - oy, length = Math.hypot(dx, dy) || 1, bend = Math.min(1100, length * 0.28);
  // Bow the flight path upward (towards the top of the map) so arrows read as launched, not slid.
  let cx = (ox + tx) / 2 - dy / length * bend, cy = (oy + ty) / 2 + dx / length * bend;
  if (cy > (oy + ty) / 2) { cx = (ox + tx) - cx; cy = (oy + ty) - cy; }
  return { d: `M${ox},${oy} Q${cx},${cy} ${tx},${ty}`, tx, ty, angle: Math.atan2(ty - cy, tx - cx) * 180 / Math.PI };
}

/** Animates the influence gained in the step that just ended, for whichever player is watching. */
export function StrikeLayer({ strike, scope }: { strike?: Strike; scope: string }) {
  const [active, setActive] = useState<Strike | null>(null);
  const id = strike?.id ?? 0;
  useEffect(() => {
    const seen = shown.get(scope);
    shown.set(scope, id);
    // First sight of a game (fresh mount or page refresh) only records the current strike.
    if (seen !== undefined && strike && id > seen) setActive(strike);
    // Keyed on the id, not the object: the strike is rebuilt from each new snapshot.
  }, [scope, id]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(null), ((active.arrows.length - 1) * STAGGER + FLIGHT + AFTER) * 1000 + 400);
    return () => window.clearTimeout(timer);
  }, [active]);
  if (!active) return null;
  const total = (active.arrows.length - 1) * STAGGER + FLIGHT + AFTER;
  const origins = [...new Set(active.arrows.map(a => a.side))];
  return <g key={active.id} className="strike-layer" aria-hidden="true" style={{ '--strike-total': total + 's' } as CSSProperties}>
    <defs><filter id="strike-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    {origins.map(side => <g key={side} className={'strike-origin strike-' + side} transform={`translate(${ORIGIN[side][0]},${ORIGIN[side][1]})`}><circle r="300"/><circle className="strike-origin-core" r="120"/></g>)}
    {active.arrows.map((a, i) => {
      const { d, tx, ty, angle } = arc(a.side, a.country);
      return <g key={a.side + a.country} className={'strike strike-' + a.side} style={{ '--strike-delay': i * STAGGER + 's', '--strike-hit': i * STAGGER + FLIGHT + 's' } as CSSProperties}>
        <path className="strike-trail" d={d} pathLength={1} filter="url(#strike-glow)"/>
        <path className="strike-core" d={d} pathLength={1}/>
        <path className="strike-comet" d={d} pathLength={1} filter="url(#strike-glow)"/>
        <g transform={`translate(${tx},${ty})`}>
          <circle className="strike-ring" r="300"/>
          <g transform={`rotate(${angle})`}><polygon className="strike-head" points="0,0 -300,-140 -220,0 -300,140"/></g>
          <text className="strike-amount" y="-230" textAnchor="middle">+{a.amount}</text>
        </g>
      </g>;
    })}
  </g>;
}
