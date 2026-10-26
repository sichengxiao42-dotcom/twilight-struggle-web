import { useEffect, useState, type CSSProperties } from 'react';
import type { Strike, StrikeArrow } from '@ts/game-core';
import { ORIGIN, arc, isNewEffect } from './boardFx';

const STAGGER = 0.18, FLIGHT = 0.7, AFTER = 1.4;

/** Animates the influence gained in the step that just ended, for whichever player is watching. */
export function StrikeLayer({ strike, scope }: { strike?: Strike; scope: string }) {
  const [active, setActive] = useState<Strike | null>(null);
  const id = strike?.id ?? 0;
  useEffect(() => {
    if (isNewEffect('strike:' + scope, id) && strike) setActive(strike);
    // Keyed on the id, not the object: the strike is rebuilt from each new snapshot.
  }, [scope, id]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(null), ((active.arrows.length - 1) * STAGGER + FLIGHT + AFTER) * 1000 + 400);
    return () => window.clearTimeout(timer);
  }, [active]);
  if (!active) return null;
  const total = (active.arrows.length - 1) * STAGGER + FLIGHT + AFTER;
  return <StrikePicture key={active.id} arrows={active.arrows} style={{ '--strike-total': total + 's' } as CSSProperties}/>;
}

/**
 * Arrows from each superpower to the countries it gained in. `still` draws the settled picture with no motion,
 * for hovering an old log line; otherwise the arrows fly in one after another.
 */
export function StrikePicture({ arrows, still = false, style }: { arrows: StrikeArrow[]; still?: boolean; style?: CSSProperties }) {
  const origins = [...new Set(arrows.map(a => a.side))];
  return <g className={still ? 'fx-still' : 'strike-layer'} aria-hidden="true" style={style}>
    {!still && <defs><filter id="strike-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>}
    {origins.map(side => <g key={side} className={'strike-origin strike-' + side} transform={`translate(${ORIGIN[side][0]},${ORIGIN[side][1]})`}><circle r="300"/><circle className="strike-origin-core" r="120"/></g>)}
    {arrows.map((a, i) => {
      const { d, tx, ty, angle } = arc(a.side, a.country);
      return <g key={a.side + a.country} className={'strike strike-' + a.side} style={{ '--strike-delay': i * STAGGER + 's', '--strike-hit': i * STAGGER + FLIGHT + 's' } as CSSProperties}>
        <path className="strike-trail" d={d} pathLength={1} filter={still ? undefined : 'url(#strike-glow)'}/>
        <path className="strike-core" d={d} pathLength={1}/>
        {!still && <path className="strike-comet" d={d} pathLength={1} filter="url(#strike-glow)"/>}
        <g transform={`translate(${tx},${ty})`}>
          {!still && <circle className="strike-ring" r="300"/>}
          <g transform={`rotate(${angle})`}><polygon className="strike-head" points="0,0 -300,-140 -220,0 -300,140"/></g>
          <text className="strike-amount" y="-230" textAnchor="middle">+{a.amount}</text>
        </g>
      </g>;
    })}
  </g>;
}
