import { useEffect, useRef, useState } from 'react';
import { CARD_BY_ID, actionRoundsForTurn, forcedMissileEnvy, roundsFor, trapped, type GameState } from '@ts/game-core';
import type { Side } from '@ts/shared';

export interface Announcement {
  /** Changes only when a new step begins, so in-step updates (remaining points) do not flash again. */
  key: string;
  side: Side;
  kicker: string;
  title: string;
  hint: string;
}

const sides = { US: '美国', USSR: '苏联' };
const modes = { INFLUENCE: '放置影响力', REALIGNMENT: '调整影响力', COUP: '发动政变' };

/** The step the active player must act on now, or null for idle/terminal phases. */
export function phaseAnnouncement(state: GameState): Announcement | null {
  const p = state.phase, turn = '第 ' + state.turn + ' 回合';
  switch (p.kind) {
    case 'CONFIRM_END':
      return {key:`confirm|${state.turn}|${p.side}|${p.round}|${p.context}`,side:p.side,kicker:turn,title:'等待结束回合',hint:'可先撤销检查，确认后再交接行动'};
    case 'SETUP_PLACEMENT':
      return { key: `setup|${p.side}|${p.subRegion}`, side: p.side, kicker: '开局', title: '开局部署', hint: `在${p.subRegion === 'EASTERN_EUROPE' ? '东欧' : '西欧'}放置 ${p.remaining} 点影响力` };
    case 'HEADLINE':
      return { key: `headline|${state.turn}|${p.side}`, side: p.side, kicker: turn, title: '头条阶段', hint: '秘密选择一张头条牌' };
    case 'ACTION_ROUND': {
      const base = { key: `action|${state.turn}|${p.round}|${p.side}`, side: p.side, kicker: turn + ' · 行动轮 ' + p.round + ' / ' + roundsFor(state, p.side) };
      if (state.mode === 'STANDARD' && trapped(state, p.side)) return { ...base, title: p.side === 'US' ? '陷入泥潭' : '落入捕熊陷阱', hint: '弃一张至少 2 OPS 的牌并掷骰脱困' };
      if (forcedMissileEnvy(state, p.side)) return { ...base, title: '导弹嫉妒', hint: '本轮必须把“导弹嫉妒”用作 OPS' };
      if (p.round > actionRoundsForTurn(state.turn)) return { ...base, title: '额外行动轮', hint: '可以再打一张牌，也可以放弃' };
      return { ...base, title: '轮到你出牌', hint: '选择一张手牌，再选择用途' };
    }
    case 'OPS':
      return { key: `ops|${state.turn}|${p.round}|${p.side}|${p.mode}|${p.ops}`, side: p.side, kicker: turn, title: modes[p.mode], hint: `${p.ops} 行动点 · 点击地图上的高亮国家` };
    case 'DECISION': {
      const d = p.decision;
      const title = d.kind === 'REVEAL' ? '查看秘密信息' : d.kind === 'OPS_MODE' ? '选择行动用途' : d.kind === 'CHOICE' ? '作出事件选择' : '处理事件';
      return { key: `decision|${state.turn}|${p.side}|${d.kind}|${d.prompt}`, side: p.side, kicker: turn, title, hint: d.prompt };
    }
    case 'SUBPLAY':
      return { key: `subplay|${state.turn}|${p.card}`, side: p.side, kicker: '向苏联出售谷物', title: '打出抽到的牌', hint: '「' + CARD_BY_ID.get(p.card)!.nameZh + '」：选择用途并确认' };
    default:
      return null;
  }
}

const SHOW_MS = 1800;

/** Flashes the new step in the middle of the screen for the player who has to act. Purely visual: the stage guide already announces it to screen readers. */
export function PhaseAnnouncer({ announcement }: { announcement: Announcement | null }) {
  const [shown, setShown] = useState<Announcement | null>(null);
  const lastKey = useRef<string | null>(null);
  const latest = useRef(announcement);
  latest.current = announcement;
  const key = announcement?.key ?? null;
  // Keyed on the step, not the object: the announcement is rebuilt on every render.
  useEffect(() => {
    if (!key || key === lastKey.current) return;
    lastKey.current = key;
    setShown(latest.current);
  }, [key]);
  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);
  if (!shown) return null;
  return <div className="phase-announcer" aria-hidden="true">
    <div key={shown.key} className={'phase-banner seat-' + shown.side}>
      <span className="phase-seal">{shown.side === 'USSR' ? '苏' : '美'}</span>
      <div><small>{sides[shown.side]} · {shown.kicker}</small><strong>{shown.title}</strong><span>{shown.hint}</span></div>
    </div>
  </div>;
}
