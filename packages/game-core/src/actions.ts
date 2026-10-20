import { opponent, type Side } from '@ts/shared';
import { ADJACENCY } from './data/adjacency';
import { CARD_BY_ID, WAR_CARDS } from './data/cards';
import { COUNTRIES, COUNTRY_BY_ID } from './data/countries';
import { actionRoundsForTurn, controller, coupResult, isRegionRestrictedByDefcon, placementCost, vpWinner } from './rules';
import { createRng, rollDie } from './rng';
import type { GameState, Task } from './state';
import { addVp, beginHeadline, canEvent, changeDefcon, chooseDecision, drain, influenceTargets, modifiedOps, protectedCountry, roundsFor } from './engine';

export type OpsMode = 'INFLUENCE' | 'REALIGNMENT' | 'COUP';
export type Action =
  | { type: 'PLACE_SETUP'; country: string }
  | { type: 'RELOCATE_INFLUENCE'; from: string; to: string }
  | { type: 'PLAY_OPS'; card: number; mode: OpsMode; order?: 'BEFORE' | 'AFTER'; asiaOnly?: boolean; seaOnly?: boolean }
  | { type: 'PLAY_EVENT'; card: number }
  | { type: 'SELECT_HEADLINE'; card: number }
  | { type: 'CHOOSE'; value: string }
  | { type: 'SPACE'; card: number }
  | { type: 'TARGET'; country: string }
  | { type: 'END_OPS' }
  | { type: 'PASS_PRACTICE' }
  | { type: 'PASS_EMPTY' }
  /** Quagmire / Bear Trap: discard a card worth 2+ OPS and roll 1–4 to escape. */
  | { type: 'TRAP_DISCARD'; card: number }
  /** Cuban Missile Crisis: remove 2 own influence (USSR: Cuba; US: West Germany or Turkey) to cancel it. */
  | { type: 'CANCEL_CMC'; country: string };
/** Identify a one-point placement so the UI can offer a precise undo. */
export function influencePlacement(state: GameState, action: Action): {country:string;side:Side}|null {
  const p=state.phase;
  if(p.kind==='SETUP_PLACEMENT'&&action.type==='PLACE_SETUP')return {country:action.country,side:p.side};
  if(p.kind==='OPS'&&p.mode==='INFLUENCE'&&action.type==='TARGET')return {country:action.country,side:p.side};
  if(p.kind==='DECISION'&&p.decision.kind==='INFLUENCE'&&p.decision.operation==='ADD'&&action.type==='CHOOSE'&&COUNTRY_BY_ID.has(action.value))return {country:action.value,side:p.decision.affected};
  return null;
}
export function activeSide(state: GameState): Side | null {
  return 'side' in state.phase ? state.phase.side : null;
}
export function legalTargets(state: GameState): string[] {
  const p = state.phase;
  if (p.kind === 'SETUP_PLACEMENT') return COUNTRIES.filter(c => c.subRegions.includes(p.subRegion)).map(c => c.id);
  if (p.kind === 'DECISION' && p.decision.kind === 'INFLUENCE') return influenceTargets(p.decision,state);
  if (p.kind === 'DECISION' && p.decision.kind === 'COUNTRY') return p.decision.targets;
  if (p.kind !== 'OPS') return [];
  return COUNTRIES.filter(c => (!p.asiaOnly || c.region === 'ASIA') && (!p.seaOnly || c.subRegions.includes('SOUTHEAST_ASIA')) && (!p.only || p.only.includes(c.id)) && (p.mode === 'INFLUENCE'
    ? p.eligible.includes(c.id) && placementCost(state, c.id, p.side) <= p.remaining && !(p.side === 'USSR' && state.effects.chernobyl === c.region)
    : state.influence[c.id][opponent(p.side)] > 0 && (p.free || !isRegionRestrictedByDefcon(state.defcon, c.region)) && !protectedCountry(state,c.id,p.side)
      && !(p.mode === 'COUP' && p.side === 'USSR' && state.effects.reformer && c.region === 'EUROPE'))).map(c => c.id);
}
/** Quagmire traps the US, Bear Trap the USSR. */
export const trapped = (state: GameState, side: Side) => Boolean(side === 'US' ? state.effects.quagmire : state.effects.bearTrap);
/** Cards that satisfy a Quagmire / Bear Trap discard (5.3: modified OPS of 2 or more, never scoring cards or the China card). */
export function trapDiscards(state: GameState, side: Side) {
  return state.hands[side].filter(id => !CARD_BY_ID.get(id)!.scoring && modifiedOps(state, side, CARD_BY_ID.get(id)!.ops) >= 2);
}
/** True when the active player may skip this action round: empty hand, an optional eighth round, or trapped with nothing playable. */
export function canPass(state: GameState, side: Side) {
  const p = state.phase;
  if (state.mode !== 'STANDARD' || p.kind !== 'ACTION_ROUND' || p.side !== side) return false;
  if (!state.hands[side].length || p.round > actionRoundsForTurn(state.turn)) return true;
  return trapped(state, side) && !trapDiscards(state, side).length && !state.hands[side].some(id => CARD_BY_ID.get(id)!.scoring);
}
/** Missile Envy: the receiving side must play card 49 for OPS on its next action round. */
export const forcedMissileEnvy = (state: GameState, side: Side) => state.effects.missileEnvy === side && state.hands[side].includes(49);
function finish(state: GameState, side: Side, round: number) {
  if(state.mode === 'STANDARD'){drain(state);return;}
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
/** Flower Power: each US play of a war card (event or OPS, not space) gives the USSR 2 VP. */
function flowerPower(state: GameState, side: Side, card: number) {
  if (side === 'US' && state.effects.flowerPower && WAR_CARDS.includes(card)) { state.log.push('花朵力量：美国打出战争牌'); addVp(state, 'USSR', 2); }
}
/** Tasks for playing one card as an event, for OPS, or to the space race. Throws when the play is not allowed. */
function playTasks(next: GameState, side: Side, action: Extract<Action, { type: 'PLAY_EVENT' | 'PLAY_OPS' | 'SPACE' }>, fromHand: boolean): Task[] {
  const card = CARD_BY_ID.get(action.card)!;
  const remove = () => { if (fromHand) next.hands[side] = next.hands[side].filter(id => id !== card.id); };
  if (action.type === 'SPACE') {
    const pos = next.space[side], limit = pos >= 2 && next.space[opponent(side)] < 2 ? 2 : 1;
    if (card.scoring || pos >= 8 || next.spaceAttempts[side] >= limit || modifiedOps(next, side, card.ops) < (pos < 4 ? 2 : pos < 7 ? 3 : 4)) throw new Error('太空竞赛：OPS 不足、已达上限或次数已用完');
    remove(); next.discard.push(card.id); next.spaceAttempts[side]++;
    return [{ kind: 'SPACE_ROLL', side }];
  }
  if (action.type === 'PLAY_EVENT') {
    // 7.1: only an own or shared event may be played as an event.
    if (card.side === opponent(side)) throw new Error('对手阵营的牌只能用作 OPS（事件会照常发生）');
    remove(); flowerPower(next, side, card.id);
    return [{ kind: 'EVENT', card: card.id, actor: side, phasing: next.phasingSide }, { kind: 'DISPOSE', card: card.id, event: false }];
  }
  if (card.scoring) throw new Error('计分牌只能作为事件打出');
  if (!['INFLUENCE', 'REALIGNMENT', 'COUP'].includes(action.mode)) throw new Error('无效 OPS 用途');
  if (action.asiaOnly) throw new Error('仅中国牌可选亚洲奖励');
  if (action.seaOnly && !(side === 'USSR' && next.effects.vietnam)) throw new Error('越南奖励未生效');
  remove(); flowerPower(next, side, card.id);
  const ops: Task = { kind: 'START_OPS', side, base: card.ops, mode: action.mode, seaOnly: action.seaOnly };
  const triggered = card.side === opponent(side);
  next.log.push(side + ' 打出 ' + card.nameZh + ' 用于 ' + action.mode + (triggered ? '，对手事件 ' + (action.order ?? 'BEFORE') : ''));
  const event: Task = { kind: 'EVENT', card: card.id, actor: side, phasing: next.phasingSide };
  return [...(triggered ? (action.order === 'AFTER' ? [ops, event] : [event, ops]) : [ops]), { kind: 'DISPOSE', card: card.id, event: false }];
}
export function apply(state: GameState, side: Side, action: Action): GameState {
  if (activeSide(state) !== side) throw new Error('尚未轮到该阵营');
  const next = structuredClone(state), p = next.phase;
  if (action.type === 'RELOCATE_INFLUENCE') {
    if (p.kind !== 'DECISION' || p.decision.kind !== 'INFLUENCE' || !p.decision.relocation || p.decision.operation !== 'REMOVE') throw new Error('当前事件不允许转移影响力');
    const d = p.decision;
    if (!COUNTRY_BY_ID.has(action.from) || !COUNTRY_BY_ID.has(action.to) || action.from === action.to || d.remaining < 1 || !legalTargets(next).includes(action.from) || controller(next, action.to) === 'US' || (d.relocationPlaced?.[action.to] ?? 0) >= 2) throw new Error('无效的影响力转移落点');
    d.relocationOriginal ??= Object.fromEntries(d.targets.map(id => [id, next.influence[id][d.affected] + (d.used[id] ?? 0)]));
    if ((d.used[action.from] ?? 0) >= d.relocationOriginal[action.from]) throw new Error('不能再次转移已重新放置的影响力');
    d.relocationPlaced ??= {};
    next.influence[action.from][d.affected]--;
    next.influence[action.to][d.affected]++;
    d.used[action.from] = (d.used[action.from] ?? 0) + 1;
    d.relocationPlaced[action.to] = (d.relocationPlaced[action.to] ?? 0) + 1;
    d.remaining--;
    next.log.push(d.prompt + '：' + COUNTRY_BY_ID.get(action.from)!.nameZh + ' → ' + COUNTRY_BY_ID.get(action.to)!.nameZh + ' 1 点');
    if (!d.remaining || !legalTargets(next).length) chooseDecision(next, 'done');
    return next;
  }
  if(action.type === 'CHOOSE') {
    chooseDecision(next,action.value);return next;
  }
  if(action.type === 'CANCEL_CMC') {
    const allowed = side === 'USSR' ? ['cuba'] : ['west_germany', 'turkey'];
    if(next.effects.cmc !== side || p.kind !== 'ACTION_ROUND' || !allowed.includes(action.country) || next.influence[action.country][side] < 2) throw new Error('无法取消古巴导弹危机');
    next.influence[action.country][side] -= 2; delete next.effects.cmc;
    next.log.push(side + ' 在' + COUNTRY_BY_ID.get(action.country)!.nameZh + '移除 2 点影响力，取消古巴导弹危机');
    return next;
  }
  if(action.type === 'SELECT_HEADLINE') {
    if(p.kind !== 'HEADLINE' || next.mode !== 'STANDARD')throw new Error('当前不是头条选择阶段');
    if(action.card === 32 || !next.hands[side].includes(action.card))throw new Error('该卡不能作为头条');
    next.headlines[side]=action.card;next.hands[side]=next.hands[side].filter(id=>id!==action.card);
    const other=opponent(side);
    if(next.headlines[other] === undefined){next.phase={kind:'HEADLINE',side:other};return next;}
    next.log.push('头条揭示：苏 '+CARD_BY_ID.get(next.headlines.USSR!)!.nameZh+' / 美 '+CARD_BY_ID.get(next.headlines.US!)!.nameZh);
    flowerPower(next,'US',next.headlines.US!);
    if(next.phase.kind==='GAME_OVER')return next;
    if(next.headlines.US===103){next.log.push('叛逃者取消苏联头条');next.tasks=[{kind:'DISPOSE',card:next.headlines.USSR!,event:false},{kind:'DISPOSE',card:103,event:false}];}
    else {
      const order=(['US','USSR'] as Side[]).sort((a,b)=>CARD_BY_ID.get(next.headlines[b]!)!.ops-CARD_BY_ID.get(next.headlines[a]!)!.ops);
      next.tasks=order.flatMap(s=>[{kind:'EVENT',card:next.headlines[s]!,actor:s,phasing:s,headline:true},{kind:'DISPOSE',card:next.headlines[s]!,event:false}] as Task[]);
    }
    next.tasks.push({kind:'FINISH_HEADLINES'});drain(next);return next;
  }
  if(p.kind === 'SUBPLAY') {
    // Grain Sales: the taken card is played as if from the US hand; the current action continues afterwards.
    if(action.type !== 'PLAY_EVENT' && action.type !== 'PLAY_OPS' && action.type !== 'SPACE' || action.card !== p.card) throw new Error('请打出抽到的牌');
    if(action.type === 'PLAY_EVENT' && !canEvent(next, p.card, side)) throw new Error('该事件当前不能生效');
    next.tasks.unshift(...playTasks(next, side, action, false));
    drain(next); return next;
  }
  if(next.mode === 'STANDARD' && p.kind === 'ACTION_ROUND' && ['PLAY_EVENT','PLAY_OPS','SPACE','TRAP_DISCARD','PASS_EMPTY'].includes(action.type)) {
    // We Will Bury You resolves before the US action unless the US answers with UN Intervention as an event.
    if(side === 'US' && next.effects.buryYou) {
      delete next.effects.buryYou;
      if(action.type === 'PLAY_EVENT' && action.card === 32) next.log.push('联合国干预：取消“我们会埋葬你们”');
      else { next.log.push('“我们会埋葬你们”：苏联获得 3 VP'); addVp(next, 'USSR', 3); if(next.phase.kind === 'GAME_OVER') return next; }
    }
    if(next.effects.missileEnvy === side && !next.hands[side].includes(49)) delete next.effects.missileEnvy;
  }
  if(action.type === 'PASS_EMPTY') {
    if(!canPass(next, side) || p.kind !== 'ACTION_ROUND')throw new Error('现在不能跳过行动');
    next.log.push(side+' 跳过本行动轮');next.tasks=[{kind:'FINISH_ACTION',side,round:p.round}];drain(next);return next;
  }
  if(action.type === 'TRAP_DISCARD') {
    if(p.kind !== 'ACTION_ROUND' || !trapped(next, side) || !trapDiscards(next, side).includes(action.card)) throw new Error('请弃置一张至少 2 OPS 的非计分牌');
    const name = side === 'US' ? '泥潭' : '捕熊陷阱';
    next.hands[side] = next.hands[side].filter(id => id !== action.card); next.discard.push(action.card);
    const rng = createRng(next.seed); for (let i = 0; i < next.rngCalls; i++) rng(); next.rngCalls++;
    const roll = rollDie(rng);
    next.log.push(name + '：' + side + ' 弃置 ' + CARD_BY_ID.get(action.card)!.nameZh + '，骰 ' + roll + (roll <= 4 ? '，脱困' : '，未能脱困'));
    if (roll <= 4) { if (side === 'US') delete next.effects.quagmire; else delete next.effects.bearTrap; }
    next.tasks = [{ kind: 'FINISH_ACTION', side, round: p.round }]; drain(next); return next;
  }
  if(action.type === 'PLAY_EVENT' || action.type === 'SPACE' || (action.type === 'PLAY_OPS' && next.mode === 'STANDARD')) {
    if(p.kind !== 'ACTION_ROUND' || next.mode !== 'STANDARD')throw new Error('当前不能出牌');
    const card=CARD_BY_ID.get(action.card);
    const china = action.card === 6;
    if(!card || (china ? action.type !== 'PLAY_OPS' || next.chinaCard.holder !== side || !next.chinaCard.faceUp : !next.hands[side].includes(card.id)))throw new Error('该卡不在手牌中');
    if(trapped(next, side) && !(action.type === 'PLAY_EVENT' && card.scoring && !trapDiscards(next, side).length)) throw new Error((side==='US'?'泥潭':'捕熊陷阱')+'：必须先弃牌掷骰；没有可弃的牌时只能打出计分牌');
    if(forcedMissileEnvy(next, side) && !(action.type === 'PLAY_OPS' && action.card === 49)) throw new Error('导弹嫉妒：本行动轮必须把导弹嫉妒用作 OPS');
    if(action.type === 'PLAY_OPS' && action.card === 49 && next.effects.missileEnvy === side) delete next.effects.missileEnvy;
    if(china && action.type === 'PLAY_OPS') {
      if(!['INFLUENCE','REALIGNMENT','COUP'].includes(action.mode))throw new Error('无效 OPS 用途');
      if(action.seaOnly&&!(side==='USSR'&&next.effects.vietnam))throw new Error('越南奖励未生效');
      const scoringCount=next.hands[side].filter(id=>CARD_BY_ID.get(id)!.scoring).length;
      if(scoringCount>roundsFor(next,side)-p.round)throw new Error('使用中国牌会妨碍本回合打完计分牌');
      next.chinaCard={holder:opponent(side),faceUp:false};if(side==='US')delete next.effects.formosan;
      next.log.push(side+' 打出 中国牌 用于 '+action.mode);
      next.tasks=[{kind:'START_OPS',side,base:card.ops,mode:action.mode,china:true,asiaOnly:action.asiaOnly,seaOnly:action.seaOnly},{kind:'FINISH_ACTION',side,round:p.round}];
    } else {
      next.tasks=[...playTasks(next, side, action, true),{kind:'FINISH_ACTION',side,round:p.round}];
    }
    if(next.phase.kind==='GAME_OVER')return next;
    drain(next);return next;
  }
  if (action.type === 'PLACE_SETUP') {
    if (p.kind !== 'SETUP_PLACEMENT' || !legalTargets(next).includes(action.country)) throw new Error('请选择对应欧洲分区的国家');
    next.influence[action.country][side]++;
    next.log.push(side + ' 开局布点：' + COUNTRY_BY_ID.get(action.country)!.nameZh + ' +1');
    p.remaining--;
    if (!p.remaining) next.phase = side === 'USSR'
      ? { kind: 'SETUP_PLACEMENT', side: 'US', remaining: 7, subRegion: 'WESTERN_EUROPE' }
      : { kind: 'ACTION_ROUND', side: 'USSR', round: 1 };
    if(!p.remaining && side==='US' && next.mode==='STANDARD')beginHeadline(next);
  } else if (action.type === 'PASS_PRACTICE') {
    if (next.mode !== 'PRACTICE' || p.kind !== 'ACTION_ROUND' || next.hands[side].some(id => !CARD_BY_ID.get(id)!.scoring)) throw new Error('仍有可用 OPS 卡牌');
    next.log.push(side + ' 无可用 OPS 卡牌，练习模式跳过行动');
    finish(next, side, p.round);
  } else if (action.type === 'PLAY_OPS') {
    if (p.kind !== 'ACTION_ROUND') throw new Error('当前不能出牌');
    const card = CARD_BY_ID.get(action.card);
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
  } else if (action.type === 'TARGET') {
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
      if (next.effects.cmc === side) {
        next.log.push(side + ' 在古巴导弹危机期间发动政变，引发核战争');
        next.phase = { kind: 'GAME_OVER', winner: enemy, reason: side + ' 在古巴导弹危机期间发动政变' };
        return next;
      }
      // Coup die modifiers: SALT −1 for everyone; Latin American Death Squads ±1 in Central/South America.
      const latin = country.region === 'CENTRAL_AMERICA' || country.region === 'SOUTH_AMERICA';
      const modifier = -Number(Boolean(next.effects.salt)) + (latin && next.effects.deathSquads ? (next.effects.deathSquads === side ? 1 : -1) : 0);
      const roll = die(), result = coupResult(roll + modifier, p.ops, country.stability), removed = Math.min(result, inf[enemy]);
      inf[enemy] -= removed; inf[side] += result - removed;
      next.milOps[side] = Math.min(5, next.milOps[side] + (p.militaryOps ?? p.ops));
      next.log.push(side + ' 政变 ' + country.nameZh + '：骰 ' + roll + (modifier ? (modifier > 0 ? ' +' : ' ') + modifier : '') + ' + OPS ' + p.ops + ' − 稳定度×2 → ' + result + '；移除 ' + removed + '，增加 ' + (result - removed));
      if (side === 'US' && next.effects.yuri) { next.log.push('尤里和萨曼莎：美国政变'); addVp(next, 'USSR', 1); if (next.phase.kind === 'GAME_OVER') return next; }
      if (country.battleground && !(side === 'US' && next.effects.nuclearSubs)) {if(next.mode==='STANDARD')changeDefcon(next,-1);else next.defcon--;}
      p.remaining = 0;
      if (next.defcon === 1) {
        if (next.phase.kind !== 'GAME_OVER') next.phase = { kind: 'GAME_OVER', winner: opponent(next.mode==='STANDARD'?next.phasingSide:side), reason: (next.mode==='STANDARD'?next.phasingSide:side) + ' 引发核战争' };
        return next;
      }
      // Che: a coup that removed US influence allows a second coup against another eligible target.
      if (p.che && removed > 0) next.tasks.unshift({ kind: 'START_OPS', side, base: 3, mode: 'COUP', only: p.only!.filter(id => id !== country.id), free: true });
    } else {
      const modifier = (s: Side) => ADJACENCY[country.id].filter(id => controller(next, id) === s).length + Number(inf[s] > inf[opponent(s)]) + Number(country.adjacentTo === s) - Number(s === 'US' && Boolean(next.effects.iranContra));
      const a = die(), b = die(), ma = modifier(side), mb = modifier(enemy), difference = a + ma - b - mb;
      const loser = difference > 0 ? enemy : side, removed = Math.min(inf[loser], Math.abs(difference));
      inf[loser] -= removed; p.remaining--;
      next.log.push(country.nameZh + ' 调整：' + side + ' ' + a + '+' + ma + ' 对 ' + enemy + ' ' + b + '+' + mb + '；' + loser + ' 移除 ' + removed);
    }
    if (!p.remaining || !legalTargets(next).length) finish(next, side, p.round);
  }
  return next;
}
