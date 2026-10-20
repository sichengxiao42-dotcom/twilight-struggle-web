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
  title: string;
  detail: string;
  focus: 'map' | 'hand' | 'actions' | 'none';
}

/** Describes the visible phase only; never inspects another player's hand. */
export function phaseGuide(state: GameState, context: GuideContext): Guide {
  const p = state.phase;
  if (context.blocked) return { title: context.blocked, detail: '对方完成后会自动继续。', focus: 'none' };
  if (p.kind === 'SETUP_PLACEMENT') {
    const region = p.subRegion === 'EASTERN_EUROPE' ? '东欧' : '西欧';
    return { title: `${sides[p.side]}：在${region}放置影响力`, detail: `还需放置 ${p.remaining} 点。先选金框国家，再用棋盘上方的 ＋／− 调整；也可从备用区拖入同色棋子。`, focus: 'map' };
  }
  if (p.kind === 'HEADLINE') return {
    title: `${sides[p.side]}：秘密选择头条`,
    detail: !context.revealed ? '请让另一位玩家回避，然后显示自己的手牌。' : context.selected === 32 ? '联合国干预不能作为头条。请在手牌中选择另一张。' : context.selected !== null ? `已选「${CARD_BY_ID.get(context.selected)?.nameZh}」。在牌面弹窗确认头条。` : '点击一张手牌，在牌面弹窗中打出头条。',
    focus: !context.revealed || context.selected === null || context.selected === 32 ? 'hand' : 'actions',
  };
  if (p.kind === 'ACTION_ROUND') {
    if (state.mode === 'STANDARD' && trapped(state, p.side)) return { title: `${sides[p.side]}：处理${p.side === 'US' ? '泥潭' : '捕熊陷阱'}`, detail: '先显示手牌，在操作区选择符合条件的牌弃置并掷骰；没有可弃牌时查看计分牌或跳过选项。', focus: context.revealed ? 'actions' : 'hand' };
    return { title: `${sides[p.side]}：第 ${p.round} / ${roundsFor(state,p.side)} 行动轮`, detail: !context.revealed ? '显示自己的手牌，开始本轮行动。' : context.selected === null ? state.mode === 'PRACTICE' ? '当前为行动点练习。选择一张非计分牌，用于放置影响力、调整或政变。' : '请选择一张手牌。计分牌须在本回合打出。' : `已选「${CARD_BY_ID.get(context.selected)?.nameZh}」。在操作区选择用途并确认。`, focus: !context.revealed || context.selected === null ? 'hand' : 'actions' };
  }
  if (p.kind === 'OPS') return { title: `${sides[p.side]}：${modes[p.mode]}`, detail: context.targetCount ? `剩余 ${p.remaining} 行动点。${p.mode === 'INFLUENCE' ? '先选金框国家，再用 ＋／− 调整。' : '点击地图上的金框国家执行操作。'}${p.mode === 'INFLUENCE' ? '在对方控制国放置影响力通常需要 2 行动点。' : p.mode === 'COUP' ? '点击目标即发动政变，并消耗本次全部行动点。' : '每次调整消耗 1 行动点。'}` : '当前没有可操作的国家。可在操作区结束操作，放弃剩余行动点。', focus: context.targetCount ? 'map' : 'actions' };
  if (p.kind === 'DECISION') {
    const d = p.decision;
    if (d.kind === 'INFLUENCE' || d.kind === 'COUNTRY') return { title: `${sides[p.side]}：处理事件`, detail: d.prompt + (d.kind === 'INFLUENCE' ? ` · 剩余 ${d.remaining} 点／次。` : '。') + (context.targetCount ? d.kind==='INFLUENCE'&&d.operation==='ADD'?'先选金框国家，再点击 ＋ 增加影响力。':'点击金框国家继续。' : '当前没有可选国家，请查看操作区的完成选项。'), focus: context.targetCount ? 'map' : 'actions' };
    if (d.kind === 'REVEAL') return { title: `${sides[p.side]}：查看秘密信息`, detail: context.revealed ? '在操作区查看展示的卡牌，然后点击“已查看 · 继续”。' : '请另一位玩家回避，再显示自己的手牌以查看秘密信息。', focus: context.revealed ? 'actions' : 'hand' };
    return { title: `${sides[p.side]}：作出事件选择`, detail: d.prompt + '。请在操作区选择一个选项。', focus: 'actions' };
  }
  if (p.kind === 'SUBPLAY') return { title: '美国：使用抽到的卡牌', detail: '在右侧选择这张牌的用途并确认，完成“向苏联出售谷物”的后续行动。', focus: 'actions' };
  if (p.kind === 'GAME_OVER') return { title: p.winner === 'DRAW' ? '本局结束 · 平局' : `本局结束 · ${sides[p.winner]}获胜`, detail: p.reason, focus: 'none' };
  return { title: '练习回合完成', detail: '你已完成一回合行动点练习。可以在对局设置中重新开局，或切换标准对局。', focus: 'none' };
}

export function StageGuide({ guide, side, onFocus, actionLabel }: { guide: Guide; side: Side; onFocus: () => void; actionLabel?: string }) {
  return <section className="stage-guide" aria-label="当前阶段引导">
    <div className="guide-main" role="status" aria-live="polite" aria-atomic="true">
      <span className={`side-seal seal-${side}`}>{side === 'USSR' ? '苏' : '美'}</span>
      <div><h2>{guide.title}</h2><p>{guide.detail}</p></div>
    </div>
    {guide.focus !== 'none' && <div className="guide-next"><button className="primary" onClick={onFocus}>{actionLabel ?? (guide.focus === 'map' ? '前往地图' : guide.focus === 'hand' ? '选择手牌' : '前往操作区')} <span aria-hidden="true">↗</span></button></div>}
  </section>;
}
