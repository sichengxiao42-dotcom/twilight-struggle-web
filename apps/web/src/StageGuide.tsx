import { CARD_BY_ID, roundsFor, trapped, type GameState } from '@ts/game-core';
import type { Side } from '@ts/shared';

const sides = { US: '美国', USSR: '苏联' };
const modes = { INFLUENCE: '放置影响力', REALIGNMENT: '调整影响力', COUP: '发动政变' };
export interface GuideContext {
  selected: number | null;
  revealed: boolean;
  targetCount: number;
  blocked?: string;
}
export interface Guide {
  step: number;
  title: string;
  detail: string;
  next: string;
  focus: 'map' | 'hand' | 'actions' | 'none';
}

/** Describes the visible phase only; never inspects another player's hand. */
export function phaseGuide(state: GameState, context: GuideContext): Guide {
  const p = state.phase;
  const step = p.kind === 'SETUP_PLACEMENT' ? 0 : p.kind === 'HEADLINE' ? 1 : p.kind === 'ACTION_ROUND' || p.kind === 'OPS' ? 2 : 3;
  if (context.blocked) return { step, title: context.blocked, detail: '局面会自动同步。等待期间可以查看地图和公开日志。', next: '等待对局继续', focus: 'none' };
  if (p.kind === 'SETUP_PLACEMENT') {
    const region = p.subRegion === 'EASTERN_EUROPE' ? '东欧' : '西欧';
    return { step, title: `${sides[p.side]}：在${region}放置影响力`, detail: `还需放置 ${p.remaining} 点。每次点击金色边框的国家，放置 1 点；可以连续点击同一国家。`, next: p.side === 'USSR' ? '布点完成后交给美国' : state.mode === 'PRACTICE' ? '完成后进入行动轮' : '完成后双方选择头条', focus: 'map' };
  }
  if (p.kind === 'HEADLINE') return {
    step, title: `${sides[p.side]}：秘密选择头条`,
    detail: !context.revealed ? '先显示自己的手牌，再选一张作为本回合头条。请让另一位玩家暂时回避。' : context.selected === 32 ? '联合国干预不能作为头条。请在手牌中选择另一张。' : context.selected !== null ? `已选「${CARD_BY_ID.get(context.selected)?.nameZh}」。在操作区确认头条，双方选完后自动结算。` : '点击一张手牌查看事件。头条只执行事件，不获得牌上的行动点。',
    next: '双方选择 → 自动结算头条 → 行动轮', focus: !context.revealed || context.selected === null || context.selected === 32 ? 'hand' : 'actions',
  };
  if (p.kind === 'ACTION_ROUND') {
    if (state.mode === 'STANDARD' && trapped(state, p.side)) return { step, title: `${sides[p.side]}：处理${p.side === 'US' ? '泥潭' : '捕熊陷阱'}`, detail: '先显示手牌，在操作区选择符合条件的牌弃置并掷骰；没有可弃牌时查看计分牌或跳过选项。', next: '完成陷阱处理后继续行动轮', focus: context.revealed ? 'actions' : 'hand' };
    return { step, title: `${sides[p.side]}：第 ${p.round} / ${roundsFor(state,p.side)} 行动轮`, detail: !context.revealed ? '先显示手牌。点击卡牌后，在操作区选择用途。' : context.selected === null ? state.mode === 'PRACTICE' ? '当前为行动点练习。选择一张非计分牌，用于放置影响力、调整或政变。' : '从下方选一张牌。计分牌须在本回合打出，不能留到下回合。' : `已选「${CARD_BY_ID.get(context.selected)?.nameZh}」。查看操作区的用途与说明，再确认出牌。`, next: '选择卡牌 → 确认用途 → 完成结算', focus: !context.revealed || context.selected === null ? 'hand' : 'actions' };
  }
  if (p.kind === 'OPS') return { step, title: `${sides[p.side]}：${modes[p.mode]}`, detail: context.targetCount ? `剩余 ${p.remaining} 行动点。点击地图上的金框国家执行操作。${p.mode === 'INFLUENCE' ? '在对方控制国放置影响力通常需要 2 行动点。' : p.mode === 'COUP' ? '点击目标即发动政变，并消耗本次全部行动点。' : '每次调整消耗 1 行动点。'}` : '当前没有可操作的国家。可在右侧结束操作，放弃剩余行动点。', next: '完成行动后自动推进；也可主动结束操作', focus: context.targetCount ? 'map' : 'actions' };
  if (p.kind === 'DECISION') {
    const d = p.decision;
    if (d.kind === 'INFLUENCE' || d.kind === 'COUNTRY') return { step, title: `${sides[p.side]}：处理事件`, detail: d.prompt + (d.kind === 'INFLUENCE' ? ` · 剩余 ${d.remaining} 点／次。` : '。') + (context.targetCount ? '点击金框国家继续。' : '当前没有可选国家，请查看操作区的完成选项。'), next: '事件选择全部完成后自动继续', focus: context.targetCount ? 'map' : 'actions' };
    if (d.kind === 'REVEAL') return { step, title: `${sides[p.side]}：查看秘密信息`, detail: context.revealed ? '在操作区查看展示的卡牌，然后点击“已查看 · 继续”。' : '请另一位玩家回避，再显示自己的手牌以查看秘密信息。', next: '确认查看后继续结算', focus: context.revealed ? 'actions' : 'hand' };
    return { step, title: `${sides[p.side]}：作出事件选择`, detail: d.prompt + '。请在操作区选择一个选项。', next: '完成选择后继续结算', focus: 'actions' };
  }
  if (p.kind === 'SUBPLAY') return { step, title: '美国：使用抽到的卡牌', detail: '在右侧选择这张牌的用途并确认，完成“向苏联出售谷物”的后续行动。', next: '这张牌结算后恢复正常行动', focus: 'actions' };
  if (p.kind === 'GAME_OVER') return { step, title: p.winner === 'DRAW' ? '本局结束 · 平局' : `本局结束 · ${sides[p.winner]}获胜`, detail: p.reason, next: '可查看日志回顾对局', focus: 'none' };
  return { step, title: '练习回合完成', detail: '你已完成一回合行动点练习。可以在对局设置中重新开局，或切换标准对局。', next: '在对局设置中开始新局', focus: 'none' };
}

export function StageGuide({ guide, side, onFocus }: { guide: Guide; side: Side; onFocus: () => void }) {
  return <section className="stage-guide" aria-label="当前阶段引导">
    <div className="guide-main" role="status" aria-live="polite" aria-atomic="true">
      <span className={`side-seal seal-${side}`}>{side === 'USSR' ? '苏' : '美'}</span>
      <div><div className="eyebrow">当前任务</div><h2>{guide.title}</h2><p>{guide.detail}</p></div>
    </div>
    <div className="guide-next"><span>{guide.next}</span>{guide.focus !== 'none' && <button className="primary" onClick={onFocus}>{guide.focus === 'map' ? '前往地图' : guide.focus === 'hand' ? '前往手牌' : '前往操作区'} <span aria-hidden="true">↗</span></button>}</div>
    <ol className="phase-steps" aria-label="回合流程">{['开局布点', '选择头条', '行动轮', '事件与结算'].map((label, i) => <li key={label} aria-current={guide.step === i ? 'step' : undefined} className={guide.step === i ? 'current' : ''}><span>{String(i + 1).padStart(2, '0')}</span>{label}</li>)}</ol>
  </section>;
}
