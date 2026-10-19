import { opponent, type Side } from '@ts/shared';
import { ADJACENCY } from './data/adjacency';
import { CARD_BY_ID } from './data/cards';
import { COUNTRIES, COUNTRY_BY_ID } from './data/countries';
import { actionRoundsForTurn, controller, coupResult, isRegionRestrictedByDefcon, placementCost, vpWinner } from './rules';
import { createRng, rollDie } from './rng';
import type { GameState, Task } from './state';
import { advanceSpace, beginHeadline, changeDefcon, chooseDecision, die, drain, influenceTargets, modifiedOps, protectedCountry } from './engine';

export type OpsMode = 'INFLUENCE' | 'REALIGNMENT' | 'COUP';
export type Action =
  | { type: 'PLACE_SETUP'; country: string }
  | { type: 'PLAY_OPS'; card: number; mode: OpsMode; order?: 'BEFORE' | 'AFTER'; asiaOnly?: boolean; seaOnly?: boolean }
  | { type: 'PLAY_EVENT'; card: number }
  | { type: 'SELECT_HEADLINE'; card: number }
  | { type: 'CHOOSE'; value: string }
  | { type: 'SPACE'; card: number }
  | { type: 'TARGET'; country: string }
  | { type: 'END_OPS' }
  | { type: 'PASS_PRACTICE' }
  | { type: 'PASS_EMPTY' };
export function activeSide(state: GameState): Side | null {
  return 'side' in state.phase ? state.phase.side : null;
}
export function legalTargets(state: GameState): string[] {
  const p = state.phase;
  if (p.kind === 'SETUP_PLACEMENT') return COUNTRIES.filter(c => c.subRegions.includes(p.subRegion)).map(c => c.id);
  if (p.kind === 'DECISION' && p.decision.kind === 'INFLUENCE') return influenceTargets(p.decision,state);
  if (p.kind !== 'OPS') return [];
  return COUNTRIES.filter(c => (!p.asiaOnly || c.region === 'ASIA') && (!p.seaOnly || c.subRegions.includes('SOUTHEAST_ASIA')) && (p.mode === 'INFLUENCE'
    ? p.eligible.includes(c.id) && placementCost(state, c.id, p.side) <= p.remaining
    : state.influence[c.id][opponent(p.side)] > 0 && !isRegionRestrictedByDefcon(state.defcon, c.region) && !protectedCountry(state,c.id,p.side))).map(c => c.id);
}
function finish(state: GameState, side: Side, round: number) {
  if(state.mode === 'EARLY_WAR'){drain(state);return;}
  if (side === 'USSR') state.phase = { kind: 'ACTION_ROUND', side: 'US', round };
  else if (round < actionRoundsForTurn(state.turn)) state.phase = { kind: 'ACTION_ROUND', side: 'USSR', round: round + 1 };
  else {
    for (const s of ['US', 'USSR'] as const) {
      const penalty = Math.max(0, state.defcon - state.milOps[s]);
      state.vp += s === 'US' ? -penalty : penalty;
      state.log.push(s + ' 军事行动不足，失去 ' + penalty + ' VP');
    }
    const winner = vpWinner(state.vp);
    state.phase = winner ? { kind: 'GAME_OVER', winner, reason: '胜利点达到 20' } : { kind: 'M1_COMPLETE' };
    state.log.push('M1 OPS 练习回合结束');
  }
}
export function apply(state: GameState, side: Side, action: Action): GameState {
  if (activeSide(state) !== side) throw new Error('尚未轮到该阵营');
  const next = structuredClone(state), p = next.phase;
  if(action.type === 'CHOOSE') {
    chooseDecision(next,action.value);return next;
  }
  if(action.type === 'PASS_EMPTY') {
    if(next.mode!=='EARLY_WAR'||p.kind!=='ACTION_ROUND'||next.hands[side].length)throw new Error('只有手牌用尽才能跳过行动');
    next.log.push(side+' 手牌用尽，跳过行动');next.tasks=[{kind:'FINISH_ACTION',side,round:p.round}];drain(next);return next;
  }
  if(action.type === 'SELECT_HEADLINE') {
    if(p.kind !== 'HEADLINE' || next.mode !== 'EARLY_WAR')throw new Error('当前不是头条选择阶段');
    if(action.card === 32 || !next.hands[side].includes(action.card))throw new Error('该卡不能作为头条');
    next.headlines[side]=action.card;next.hands[side]=next.hands[side].filter(id=>id!==action.card);
    const other=opponent(side);
    if(next.headlines[other] === undefined){next.phase={kind:'HEADLINE',side:other};return next;}
    next.log.push('头条揭示：苏 '+CARD_BY_ID.get(next.headlines.USSR!)!.nameZh+' / 美 '+CARD_BY_ID.get(next.headlines.US!)!.nameZh);
    if(next.headlines.US===103){next.log.push('叛逃者取消苏联头条');next.tasks=[{kind:'DISPOSE',card:next.headlines.USSR!,event:false},{kind:'DISPOSE',card:103,event:false}];}
    else {
      const order=(['US','USSR'] as Side[]).sort((a,b)=>CARD_BY_ID.get(next.headlines[b]!)!.ops-CARD_BY_ID.get(next.headlines[a]!)!.ops);
      next.tasks=order.flatMap(s=>[{kind:'EVENT',card:next.headlines[s]!,actor:s,phasing:s,headline:true},{kind:'DISPOSE',card:next.headlines[s]!,event:false}] as Task[]);
    }
    next.tasks.push({kind:'FINISH_HEADLINES'});drain(next);return next;
  }
  if(action.type === 'PLAY_EVENT' || action.type === 'SPACE') {
    if(p.kind !== 'ACTION_ROUND' || next.mode !== 'EARLY_WAR')throw new Error('当前不能出牌');
    const card=CARD_BY_ID.get(action.card);
    if(!card || !next.hands[side].includes(card.id))throw new Error('该卡不在手牌中');
    next.hands[side]=next.hands[side].filter(id=>id!==card.id);
    next.tasks=[{kind:'FINISH_ACTION',side,round:p.round}];
    if(action.type==='SPACE'){
      const pos=next.space[side],limit=pos>=2&&next.space[opponent(side)]<2?2:1;
      if(card.scoring||pos>=8||next.spaceAttempts[side]>=limit||modifiedOps(next,side,card.ops)<(pos<4?2:pos<7?3:4))throw new Error('太空竞赛：OPS 不足、已达上限或次数已用完');
      next.discard.push(card.id);next.spaceAttempts[side]++;
      const roll=die(next),threshold=[3,4,3,4,3,4,3,2][pos];next.log.push(side+' 太空尝试：骰 '+roll+'，需要 ≤'+threshold);
      if(roll<=threshold)advanceSpace(next,side);
      if(next.phase.kind!=='GAME_OVER')drain(next);
    } else {
      next.tasks.unshift({kind:'EVENT',card:card.id,actor:side,phasing:side},{kind:'DISPOSE',card:card.id,event:false});drain(next);
    }
    return next;
  }
  if (action.type === 'PLACE_SETUP') {
    if (p.kind !== 'SETUP_PLACEMENT' || !legalTargets(next).includes(action.country)) throw new Error('请选择对应欧洲分区的国家');
    next.influence[action.country][side]++;
    next.log.push(side + ' 开局布点：' + COUNTRY_BY_ID.get(action.country)!.nameZh + ' +1');
    p.remaining--;
    if (!p.remaining) next.phase = side === 'USSR'
      ? { kind: 'SETUP_PLACEMENT', side: 'US', remaining: 7, subRegion: 'WESTERN_EUROPE' }
      : { kind: 'ACTION_ROUND', side: 'USSR', round: 1 };
    if(!p.remaining && side==='US' && next.mode==='EARLY_WAR')beginHeadline(next);
  } else if (action.type === 'PASS_PRACTICE') {
    if (next.mode !== 'PRACTICE' || p.kind !== 'ACTION_ROUND' || next.hands[side].some(id => !CARD_BY_ID.get(id)!.scoring)) throw new Error('仍有可用 OPS 卡牌');
    next.log.push(side + ' 无可用 OPS 卡牌，练习模式跳过行动');
    finish(next, side, p.round);
  } else if (action.type === 'PLAY_OPS') {
    if (p.kind !== 'ACTION_ROUND') throw new Error('当前不能出牌');
    const card = CARD_BY_ID.get(action.card);
    if(next.mode==='EARLY_WAR'){
      const china=action.card===6;
      if(!card||card.scoring|| (china?next.chinaCard.holder!==side||!next.chinaCard.faceUp:!next.hands[side].includes(card.id)))throw new Error('请选择可用的非计分牌');
      if(!['INFLUENCE','REALIGNMENT','COUP'].includes(action.mode))throw new Error('无效 OPS 用途');
      if(action.asiaOnly&&!china)throw new Error('仅中国牌可选亚洲奖励');
      if(action.seaOnly&&!(side==='USSR'&&next.effects.vietnam))throw new Error('越南奖励未生效');
      if(china){
        const scoringCount=next.hands[side].filter(id=>CARD_BY_ID.get(id)!.scoring).length;
        if(scoringCount>6-p.round)throw new Error('使用中国牌会妨碍本回合打完计分牌');
        next.chinaCard={holder:opponent(side),faceUp:false};if(side==='US')delete next.effects.formosan;
      }else next.hands[side]=next.hands[side].filter(id=>id!==card.id);
      const ops:Task={kind:'START_OPS',side,base:card.ops,mode:action.mode,china,asiaOnly:action.asiaOnly,seaOnly:action.seaOnly};
      const event:Task={kind:'EVENT',card:card.id,actor:side,phasing:side};
      const triggered=!china&&card.side===opponent(side);
      next.tasks=triggered?(action.order==='AFTER'?[ops,event]:[event,ops]):[ops];
      if(!china)next.tasks.push({kind:'DISPOSE',card:card.id,event:false});
      next.tasks.push({kind:'FINISH_ACTION',side,round:p.round});
      next.log.push(side+' 打出 '+card.nameZh+' 用于 '+action.mode+(triggered?'，对手事件 '+(action.order??'BEFORE'):'') );
      drain(next);return next;
    }
    if (!card || card.scoring || !next.hands[side].includes(action.card)) throw new Error('请选择手中的非计分牌');
    if (!['INFLUENCE', 'REALIGNMENT', 'COUP'].includes(action.mode)) throw new Error('无效 OPS 类型');
    const eligible = COUNTRIES.filter(c => c.adjacentTo === side || next.influence[c.id][side] > 0 || ADJACENCY[c.id].some(id => next.influence[id][side] > 0)).map(c => c.id);
    next.phase = { kind: 'OPS', side, round: p.round, mode: action.mode, remaining: card.ops, ops: card.ops, eligible };
    if (!legalTargets(next).length) throw new Error('此操作没有合法目标');
    next.hands[side] = next.hands[side].filter(id => id !== card.id);
    next.discard.push(card.id);
    next.log.push(side + '：' + card.nameZh + ' / ' + action.mode + ' / ' + card.ops + ' OPS（M1 不触发事件）');
  } else if (action.type === 'END_OPS') {
    if (p.kind !== 'OPS') throw new Error('当前没有待完成的 OPS');
    next.log.push(side + ' 放弃剩余 ' + p.remaining + ' OPS');
    finish(next, side, p.round);
  } else {
    if (p.kind !== 'OPS' || !legalTargets(next).includes(action.country)) throw new Error('该国家不是合法目标');
    const country = COUNTRY_BY_ID.get(action.country)!, inf = next.influence[country.id], enemy = opponent(side);
    const rng = createRng(next.seed);
    for (let i = 0; i < next.rngCalls; i++) rng();
    const die = () => { next.rngCalls++; return rollDie(rng); };
    if (p.mode === 'INFLUENCE') {
      const cost = placementCost(next, country.id, side);
      inf[side]++; p.remaining -= cost;
      next.log.push(side + ' 在' + country.nameZh + '放置 1 影响力，花费 ' + cost + ' OPS');
    } else if (p.mode === 'COUP') {
      const roll = die(), result = coupResult(roll, p.ops, country.stability), removed = Math.min(result, inf[enemy]);
      inf[enemy] -= removed; inf[side] += result - removed;
      next.milOps[side] = Math.min(5, next.milOps[side] + (p.militaryOps ?? p.ops));
      if (country.battleground) {if(next.mode==='EARLY_WAR')changeDefcon(next,-1);else next.defcon--;}
      p.remaining = 0;
      next.log.push(side + ' 政变 ' + country.nameZh + '：骰 ' + roll + ' + OPS ' + p.ops + ' − 稳定度×2 → ' + result + '；移除 ' + removed + '，增加 ' + (result - removed));
      if (next.defcon === 1) {
        next.phase = { kind: 'GAME_OVER', winner: opponent(next.mode==='EARLY_WAR'?next.phasingSide:side), reason: (next.mode==='EARLY_WAR'?next.phasingSide:side) + ' 引发核战争' };
        return next;
      }
    } else {
      const modifier = (s: Side) => ADJACENCY[country.id].filter(id => controller(next, id) === s).length + Number(inf[s] > inf[opponent(s)]) + Number(country.adjacentTo === s);
      const a = die(), b = die(), ma = modifier(side), mb = modifier(enemy), difference = a + ma - b - mb;
      const loser = difference > 0 ? enemy : side, removed = Math.min(inf[loser], Math.abs(difference));
      inf[loser] -= removed; p.remaining--;
      next.log.push(country.nameZh + ' 调整：' + side + ' ' + a + '+' + ma + ' 对 ' + enemy + ' ' + b + '+' + mb + '；' + loser + ' 移除 ' + removed);
    }
    if (!p.remaining || !legalTargets(next).length) finish(next, side, p.round);
  }
  return next;
}
