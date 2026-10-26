import { useEffect, useState } from 'react';
import { opponent, type Side } from '@ts/shared';
import { COUNTRY_BY_ID, type Clash } from '@ts/game-core';
import { arc, clampX, countryCentre, isNewEffect } from './boardFx';
import { DEFCON_TRACK } from './mapPositions';

const DURATION = 2.6, BANNER_WIDTH = 1900;
const sideName: Record<Side, string> = { USSR: '苏联', US: '美国' };
const short: Record<Side, string> = { USSR: '苏', US: '美' };
/** Directions the shattered enemy counters fly in when a coup succeeds. */
const SHARDS = [[-380, -300], [-120, -460], [200, -420], [420, -160], [380, 240], [80, 420], [-260, 360], [-450, 60]];

function banner(c: Clash): { title: string; detail: string } {
  if (c.kind === 'COUP') {
    const success = c.removed + c.added > 0;
    return { title: success ? sideName[c.side] + '政变成功' : sideName[c.side] + '政变失败', detail: `骰 ${c.roll} → 合计 ${c.total}，需要大于 ${c.need}` };
  }
  const enemy = opponent(c.side), [a, b] = c.rolls, [ma, mb] = c.modifiers;
  return { title: c.winner ? `调整：${sideName[c.winner]}胜` : '调整：平局', detail: `${short[c.side]} ${a}+${ma} 对 ${short[enemy]} ${b}+${mb}` };
}

/** Animates the latest coup (missile strike) or realignment (two beams pushing) for whichever player is watching. */
export function ClashLayer({ clash, scope, defcon }: { clash?: Clash; scope: string; defcon: number }) {
  const [active, setActive] = useState<{ clash: Clash; defcon: number } | null>(null);
  const id = clash?.id ?? 0;
  useEffect(() => {
    // Keyed on the id, not the object: the clash is rebuilt from each new snapshot.
    if (isNewEffect('clash:' + scope, id) && clash) setActive({ clash, defcon });
  }, [scope, id]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(null), DURATION * 1000 + 300);
    return () => window.clearTimeout(timer);
  }, [active]);
  if (!active) return null;
  return <ClashPicture key={active.clash.id} clash={active.clash} defcon={active.defcon}/>;
}

/** One coup or realignment on the board. `still` keeps only the settled parts (no missile, blast or alarm) for log hover. */
export function ClashPicture({ clash: c, defcon = 5, still = false }: { clash: Clash; defcon?: number; still?: boolean }) {
  const [tx, ty] = countryCentre(c.country), enemy = opponent(c.side), text = banner(c), motion = !still;
  // Position with the outer group: a CSS animation's transform would replace an SVG transform attribute on the same element.
  const label = <g transform={`translate(${clampX(tx, BANNER_WIDTH)},${Math.max(330, ty - 600)})`}><g className="clash-banner">
    <rect x={-BANNER_WIDTH / 2} y={-170} width={BANNER_WIDTH} height={300} rx={46}/>
    <text className="clash-banner-title" y={-30} textAnchor="middle">{text.title}</text>
    <text className="clash-banner-detail" y={80} textAnchor="middle">{COUNTRY_BY_ID.get(c.country)!.nameZh} · {text.detail}</text>
  </g></g>;
  if (c.kind === 'COUP') {
    const { d } = arc(c.side, c.country, 0.18), success = c.removed + c.added > 0;
    return <g className={(still ? 'fx-still' : 'clash-layer') + ' clash-coup strike-' + c.side + (success ? ' hit' : ' miss')} aria-hidden="true">
      <g transform={`translate(${tx},${ty})`}><g className="clash-reticle">
        <circle r="270"/><path d="M-420,0H-170M170,0H420M0,-420V-170M0,170V420"/>
      </g></g>
      {motion && <path className="coup-smoke" d={d} pathLength={1}/>}
      <path className="coup-trail" d={d} pathLength={1}/>
      {motion && <path className="coup-missile" d={d} pathLength={1}/>}
      <g transform={`translate(${tx},${ty})`}>
        {motion && <circle className="coup-flash" r="340"/>}
        {motion && <circle className="coup-wave" r="460"/>}
        {motion && (success ? SHARDS.map(([dx, dy], i) => <rect key={i} className={'coup-shard shard-' + enemy} x={-55} y={-55} width={110} height={110} rx={14} style={{ ['--dx' as string]: dx + 'px', ['--dy' as string]: dy + 'px', ['--spin' as string]: (i % 2 ? 1 : -1) * (120 + i * 25) + 'deg' }}/>)
          : <circle className="coup-puff" r="300"/>)}
        {c.removed > 0 && <text className={'clash-num num-' + enemy} x={c.added > 0 ? -230 : 0} y={-300} textAnchor="middle">−{c.removed}</text>}
        {c.added > 0 && <text className={'clash-num num-' + c.side} x={c.removed > 0 ? 230 : 0} y={-300} textAnchor="middle">+{c.added}</text>}
      </g>
      {motion && c.defconDrop && <g className="clash-defcon" transform={`translate(${DEFCON_TRACK[Math.max(1, defcon)][0]},${DEFCON_TRACK[Math.max(1, defcon)][1]})`}>
        <circle r="230"/><text y={-300} textAnchor="middle">DEFCON −1</text>
      </g>}
      {label}
    </g>;
  }
  return <g className={(still ? 'fx-still' : 'clash-layer') + ' clash-realign' + (c.winner ? '' : ' tie')} aria-hidden="true">
    {(['USSR', 'US'] as const).map(side => {
      const { d } = arc(side, c.country, 0.22), role = c.winner === side ? ' winner' : c.winner ? ' loser' : '';
      return <g key={side} className={'realign-beam strike-' + side + role}><path className="beam-glow" d={d} pathLength={1}/><path className="beam-core" d={d} pathLength={1}/></g>;
    })}
    <g transform={`translate(${tx},${ty})`}>
      <circle className={'realign-orb' + (c.winner ? ' strike-' + c.winner : '')} r="240"/>
      {c.winner && c.removed > 0 && <text className={'clash-num num-' + opponent(c.winner)} y={-300} textAnchor="middle">−{c.removed}</text>}
      {(!c.winner || c.removed === 0) && <text className="clash-num num-tie" y={-300} textAnchor="middle">{c.winner ? '无变化' : '平局'}</text>}
    </g>
    {label}
  </g>;
}
