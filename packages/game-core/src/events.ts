import { opponent, type Region, type Side } from '@ts/shared';
import { ADJACENCY } from './data/adjacency';
import { CARD_BY_ID } from './data/cards';
import { COUNTRIES } from './data/countries';
import { controller, vpWinner } from './rules';
import { shuffle } from './rng';
import { scoreRegion, scoreSoutheastAsia } from './scoring';
import type { Decision, GameState, Task } from './state';
import { addVp, advanceSpace, changeDefcon, choice, countryChoice, die, ids, influence, modifiedOps, protectedCountry, random, reveal, war, west } from './engine';

// Mid War and Late War events (#36–102, #107–110). Card text was checked against the Chinese card art.
type EventTask = Extract<Task, { kind: 'EVENT' }>;
type Choice = Extract<Decision, { kind: 'CHOICE' }>;

const cardName = (id: number) => CARD_BY_ID.get(id)!.nameZh;
const LATIN: Region[] = ['CENTRAL_AMERICA', 'SOUTH_AMERICA'];
const inRegions = (regions: Region[]) => ids((c) => regions.includes(c.region));
export const REGION_NAMES: Record<Region, string> = {
  EUROPE: '欧洲', ASIA: '亚洲', MIDDLE_EAST: '中东', AFRICA: '非洲', CENTRAL_AMERICA: '中美洲', SOUTH_AMERICA: '南美洲',
};
const sign = (side: Side) => (side === 'US' ? 1 : -1);
const over = (s: GameState) => s.phase.kind === 'GAME_OVER';
const opsOf = (id: number) => CARD_BY_ID.get(id)!.ops;

/** Draw from the deck, reshuffling the discard pile when the deck runs out (4.3). */
function draw(s: GameState, n: number): number[] {
  const drawn: number[] = [];
  while (drawn.length < n) {
    if (!s.deck.length && s.discard.length) { s.deck = shuffle(s.discard, () => random(s)); s.discard = []; s.log.push('洗入弃牌堆'); }
    if (!s.deck.length) break;
    drawn.push(s.deck.shift()!);
  }
  return drawn;
}
function discardFromHand(s: GameState, side: Side, id: number) {
  s.hands[side] = s.hands[side].filter((c) => c !== id);
  s.discard.push(id);
  s.log.push(side + ' 弃置 ' + cardName(id));
}
/** Remove a pending DISPOSE task, for cards that leave play another way (Missile Envy changes hands, Shuttle Diplomacy waits in front of the US). */
function cancelDisposal(s: GameState, id: number) {
  const index = s.tasks.findIndex((t) => t.kind === 'DISPOSE' && t.card === id);
  if (index >= 0) s.tasks.splice(index, 1);
}
function cardOptions(cards: number[], verb = ''): [string, string][] {
  return cards.map((id) => [String(id), verb + cardName(id) + '（' + (CARD_BY_ID.get(id)!.scoring ? '计分' : opsOf(id) + ' OPS') + '）']);
}
function askNot(s: GameState, discarded: number) {
  choice(s, 'US', 77, 'US', [['done', discarded ? '完成，抽 ' + discarded + ' 张' : '不弃牌'], ...cardOptions(s.hands.US, '弃置 ')],
    '“不要问”：逐张选择要弃的牌，完成后抽同样数量', s.phasingSide, [discarded]);
}
function ourMan(s: GameState, drawn: number[]) {
  choice(s, 'US', 108, 'US', [['done', '完成：其余放回牌堆并洗牌'], ...cardOptions(drawn, '弃置 ')],
    '我们的人在德黑兰：查看牌堆顶的牌，可弃置任意张', s.phasingSide, drawn);
}
function missileEnvySwap(s: GameState, actor: Side, id: number, phasing: Side) {
  const victim = opponent(actor), taken = CARD_BY_ID.get(id)!;
  s.hands[victim] = s.hands[victim].filter((c) => c !== id);
  s.hands[victim].push(49);
  cancelDisposal(s, 49);
  s.effects.missileEnvy = victim;
  s.log.push('导弹嫉妒：' + actor + ' 换走 ' + taken.nameZh);
  // Own or shared event fires immediately; an opponent-only event is used for OPS without firing.
  if (taken.side === victim) s.tasks.unshift({ kind: 'START_OPS', side: actor, base: taken.ops }, { kind: 'DISPOSE', card: id, event: false });
  else s.tasks.unshift({ kind: 'EVENT', card: id, actor, phasing }, { kind: 'DISPOSE', card: id, event: false });
}

export function resolveLateEvent(s: GameState, t: EventTask, id: number, side: Side): boolean {
  const enemy = opponent(side);
  switch (id) {
    case 36: countryChoice(s, side, 36, ids((c) => c.stability <= 2 && !protectedCountry(s, c.id, side)), '局部战争：选择稳定度 1–2 的目标国家'); return true;
    case 38: {
      const delta = scoreSoutheastAsia(s);
      s.vp += delta; s.log.push('东南亚计分：净 ' + (delta >= 0 ? '美 +' + delta : '苏 +' + -delta) + '（总计 ' + s.vp + '）');
      const winner = vpWinner(s.vp); if (winner) s.phase = { kind: 'GAME_OVER', winner, reason: 'VP 达到 20' };
      return true;
    }
    case 39: if (s.milOps[side] > s.milOps[enemy]) addVp(s, side, s.milOps[side] >= s.defcon ? 3 : 1); return true;
    case 40: changeDefcon(s, 2 - s.defcon); s.effects.cmc = enemy; return true;
    case 41: s.effects.nuclearSubs = true; return true;
    case 42: s.effects.quagmire = true; return true;
    case 43: {
      changeDefcon(s, 2); s.effects.salt = true;
      const cards = s.discard.filter((c) => !CARD_BY_ID.get(c)!.scoring);
      if (cards.length) choice(s, side, 43, side, [['skip', '不取牌'], ...cardOptions(cards, '取回 ')], '战略武器限制谈判：可从弃牌堆取回一张非计分牌');
      return true;
    }
    case 44: s.effects.bearTrap = true; return true;
    case 45: {
      const regions = (who: Side) => (Object.keys(REGION_NAMES) as Region[]).filter((r) => ['DOMINATION', 'CONTROL'].includes(scoreRegion(s, r)[who].status)).length;
      const rolls = { USSR: die(s) + regions('USSR'), US: die(s) + regions('US') };
      s.log.push('首脑峰会：苏 ' + rolls.USSR + ' / 美 ' + rolls.US);
      if (rolls.USSR === rolls.US) return true;
      const winner: Side = rolls.US > rolls.USSR ? 'US' : 'USSR';
      addVp(s, winner, 2);
      if (!over(s)) choice(s, winner, 45, winner, [['none', '不调整核威胁'], ['up', '缓和 1 级'], ['down', '加剧 1 级']], '首脑峰会：可将 DEFCON 调整 1 级');
      return true;
    }
    case 46:
      s.milOps[side] = 5;
      choice(s, side, 46, side, ['5', '4', '3', '2', '1'].map((v) => [v, 'DEFCON ' + v + (v === '1' ? '（当前阶段玩家输掉游戏）' : '')]), '我如何学会不再担忧：设置 DEFCON');
      return true;
    case 47:
      s.tasks.unshift({ kind: 'START_OPS', side, base: 2, modes: ['COUP', 'REALIGNMENT'], only: inRegions(LATIN), free: true });
      influence(s, side, inRegions(LATIN), 2, 2, 'ADD', side, '军政府：在一个中美洲或南美洲国家 +2', false, false, true);
      return true;
    case 48: addVp(s, 'US', 2); return true;
    case 49: {
      const hand = s.hands[enemy];
      if (!hand.length) { s.log.push('导弹嫉妒：对方没有手牌'); return true; }
      const best = Math.max(...hand.map(opsOf)), tied = hand.filter((c) => opsOf(c) === best);
      if (tied.length > 1) choice(s, enemy, 49, side, cardOptions(tied, '交出 '), '导弹嫉妒：选择交给对方的牌', t.phasing);
      else missileEnvySwap(s, side, tied[0], t.phasing);
      return true;
    }
    case 50: changeDefcon(s, -1); if (!over(s)) s.effects.buryYou = true; return true;
    case 51: s.effects.brezhnev = true; return true;
    case 52: s.influence.se_african_states.USSR += 2; s.influence.angola.USSR += 2; return true;
    case 53: choice(s, 'USSR', 53, 'USSR', [['south_africa', '南非 +2'], ['split', '南非 +1，南非邻国共 +2']], '南非动荡：选择放置方式'); return true;
    case 54: s.influence.chile.USSR += 2; return true;
    case 55: addVp(s, 'USSR', 1); s.influence.west_germany.USSR++; s.effects.willyBrandt = true; return true;
    case 56: influence(s, 'USSR', ['sudan', 'iran', 'iraq', 'egypt', 'libya', 'saudi_arabia', 'syria', 'jordan'], 2, 1, 'CLEAR', 'US', '穆斯林革命：清除 2 国全部美国影响力'); return true;
    case 57: changeDefcon(s, 1); s.tasks.unshift({ kind: 'START_OPS', side, base: 4 }); return true;
    case 58:
      if (s.chinaCard.holder === 'US') { s.chinaCard = { holder: 'USSR', faceUp: true }; s.log.push('文化大革命：苏联取得中国牌（正面）'); }
      else addVp(s, 'USSR', 1);
      return true;
    case 59: s.effects.flowerPower = true; return true;
    case 60: addVp(s, 'USSR', 1); s.effects.u2 = true; return true;
    case 61: addVp(s, 'USSR', ['egypt', 'iran', 'libya', 'saudi_arabia', 'iraq', 'gulf_states', 'venezuela'].filter((c) => controller(s, c) === 'USSR').length); return true;
    case 62: s.tasks.unshift({ kind: 'START_OPS', side: 'USSR', base: 1 }); reveal(s, 'USSR', s.hands.US, '孤胆枪手：查看美国手牌；确认后执行 1 OPS'); return true;
    case 63: influence(s, 'US', ids((c) => c.region === 'AFRICA' || c.subRegions.includes('SOUTHEAST_ASIA')), 4, 1, 'ADD', 'US', '殖民地殿后部队：4 个非洲或东南亚国家各 +1'); return true;
    case 64: for (const c of ['panama', 'costa_rica', 'venezuela']) s.influence[c].US++; return true;
    case 65: addVp(s, 'US', 1); for (const c of ['israel', 'jordan', 'egypt']) s.influence[c].US++; s.effects.campDavid = true; return true;
    case 66: influence(s, 'US', ids((c) => !s.influence[c.id].US && !s.influence[c.id].USSR), 3, 1, 'ADD', 'US', '傀儡政府：3 个双方均无影响力的国家各 +1'); return true;
    case 67: {
      if (!s.hands.USSR.length) { s.tasks.unshift({ kind: 'START_OPS', side: 'US', base: 2 }); return true; }
      const taken = s.hands.USSR.splice(Math.floor(random(s) * s.hands.USSR.length), 1)[0];
      s.log.push('向苏联出售谷物：美国随机抽到 ' + cardName(taken));
      choice(s, 'US', 67, 'US', [['play', '打出 ' + cardName(taken)], ['return', '交还，改用本牌 2 OPS']], '向苏联出售谷物：打出抽到的牌，或交还', t.phasing, [taken]);
      return true;
    }
    case 68: s.influence.poland.USSR = Math.max(0, s.influence.poland.USSR - 2); s.influence.poland.US++; s.effects.johnPaul = true; return true;
    case 69: s.effects.deathSquads = side; return true;
    case 70: influence(s, 'US', inRegions(LATIN), 2, 2, 'ADD', 'US', '美洲国家组织：中南美洲共 +2'); return true;
    case 71:
      if (s.chinaCard.holder === 'USSR') { s.chinaCard = { holder: 'US', faceUp: false }; s.log.push('尼克松打出中国牌：美国取得中国牌，本回合不能使用'); }
      else addVp(s, 'US', 2);
      return true;
    case 72: s.influence.egypt.USSR = 0; s.influence.egypt.US++; return true;
    case 73: s.effects.shuttle = true; cancelDisposal(s, 73); return true;
    case 74: influence(s, 'US', ids((c) => c.region !== 'EUROPE'), 4, 2, 'REMOVE', 'USSR', '美国之音：欧洲以外移除 4 点苏联影响力，每国最多 2'); return true;
    case 75: influence(s, 'USSR', inRegions(['CENTRAL_AMERICA']), 3, 2, 'ADD', 'USSR', '解放神学：中美洲 +3，每国最多 2'); return true;
    case 76:
      if (s.chinaCard.holder === 'USSR') { s.chinaCard = { holder: 'US', faceUp: true }; s.log.push('乌苏里江冲突：美国取得中国牌（正面）'); }
      else influence(s, 'US', inRegions(['ASIA']), 4, 2, 'ADD', 'US', '乌苏里江冲突：亚洲 +4，每国最多 2');
      return true;
    case 77: askNot(s, 0); return true;
    case 78: addVp(s, 'US', COUNTRIES.filter((c) => LATIN.includes(c.region) && c.battleground && controller(s, c.id) === 'US').length); return true;
    case 80: advanceSpace(s, side, false); if (!over(s)) advanceSpace(s, side); return true;
    case 82: s.influence.iran.US = 0; s.influence.iran.USSR += 2; s.effects.iranianHostage = true; return true;
    case 83: addVp(s, 'US', 1); s.influence.argentina.USSR++; s.influence.uk.USSR = 0; s.effects.ironLady = true; return true;
    case 84: addVp(s, 'US', Math.floor(s.influence.libya.USSR / 2)); return true;
    case 85: {
      const cards = s.discard.filter((c) => !CARD_BY_ID.get(c)!.scoring);
      if (cards.length) choice(s, 'US', 85, 'US', cardOptions(cards, '执行 '), '星球大战：从弃牌堆选一张非计分牌，立即执行其事件', t.phasing);
      return true;
    }
    case 86: s.effects.northSeaOil = true; s.effects.northSeaRound = true; return true;
    case 87: influence(s, 'USSR', inRegions(['EUROPE']), s.vp < 0 ? 6 : 4, 2, 'ADD', 'USSR', '改革家：欧洲 +' + (s.vp < 0 ? 6 : 4) + '，每国最多 2'); s.effects.reformer = true; return true;
    case 88: s.influence.lebanon.US = 0; influence(s, 'USSR', inRegions(['MIDDLE_EAST']), 2, 2, 'REMOVE', 'US', '贝鲁特军营炸弹袭击：中东再移除 2 点美国影响力'); return true;
    case 89:
      changeDefcon(s, -1); if (over(s)) return true;
      addVp(s, 'US', 2); if (over(s)) return true;
      if (controller(s, 'south_korea') === 'US') s.tasks.unshift({ kind: 'START_OPS', side: 'US', base: 4, modes: ['INFLUENCE', 'REALIGNMENT'] });
      return true;
    case 90:
      addVp(s, 'USSR', 2); if (over(s)) return true;
      changeDefcon(s, 1);
      if (s.effects.reformer) s.tasks.unshift({ kind: 'START_OPS', side: 'USSR', base: 4, modes: ['INFLUENCE', 'REALIGNMENT'] });
      return true;
    case 91: s.influence.nicaragua.US = 0; s.tasks.unshift({ kind: 'START_OPS', side: 'USSR', base: 2, mode: 'COUP', only: ADJACENCY.nicaragua, free: true }); return true;
    case 92: {
      const count = side === 'USSR' && s.effects.iranianHostage ? 2 : 1;
      for (let i = 0; i < count && s.hands[enemy].length; i++) {
        const lost = s.hands[enemy].splice(Math.floor(random(s) * s.hands[enemy].length), 1)[0];
        s.discard.push(lost); s.log.push('恐怖主义：' + enemy + ' 随机弃置 ' + cardName(lost));
      }
      return true;
    }
    case 93: s.effects.iranContra = true; return true;
    case 94: choice(s, 'US', 94, 'US', (Object.keys(REGION_NAMES) as Region[]).map((r) => [r, REGION_NAMES[r]]), '切尔诺贝利：指定一个地区，本回合苏联不能用 OPS 在该地区放置影响力'); return true;
    case 95: {
      const cards = s.hands.US.filter((c) => !CARD_BY_ID.get(c)!.scoring && modifiedOps(s, 'US', opsOf(c)) >= 3);
      choice(s, 'US', 95, 'USSR', [...cardOptions(cards, '弃置 '), ['refuse', '不弃牌：苏联加倍 2 个南美国家的影响力']], '拉丁美洲债务危机：弃一张至少 3 OPS 的牌，否则苏联加倍影响力');
      return true;
    }
    case 96:
      delete s.effects.willyBrandt; s.effects.tearDown = true; s.influence.east_germany.US += 3;
      s.tasks.unshift({ kind: 'START_OPS', side: 'US', base: 3, modes: ['COUP', 'REALIGNMENT'], only: inRegions(['EUROPE']), free: true });
      return true;
    case 97: delete s.effects.flowerPower; s.effects.evilEmpire = true; addVp(s, 'US', 1); return true;
    case 98:
      s.effects.aldrich = true;
      if (s.hands.US.length) choice(s, 'USSR', 98, 'USSR', cardOptions(s.hands.US, '弃置 '), '奥德里奇·艾姆斯：美国手牌公开，选择其中一张弃置');
      return true;
    case 99: addVp(s, 'USSR', 1); if (!over(s)) influence(s, 'USSR', west(), 3, 1, 'REMOVE', 'US', '潘兴 II：至多 3 个西欧国家各移除 1 点美国影响力', true); return true;
    case 100: choice(s, side, 100, side, [['continue', '继续游戏'], ['end', '给对方 6 VP，立即结束游戏']], '战争游戏：是否立即结束游戏？'); return true;
    case 101: s.influence.poland.US += 3; return true;
    case 102: countryChoice(s, side, 102, ['iran', 'iraq'], '伊朗-伊拉克战争：选择被入侵的国家'); return true;
    case 107:
      s.tasks.unshift({ kind: 'START_OPS', side: 'USSR', base: 3, mode: 'COUP', only: ids((c) => !c.battleground && ['CENTRAL_AMERICA', 'SOUTH_AMERICA', 'AFRICA'].includes(c.region)), free: true, che: true });
      return true;
    case 108: ourMan(s, draw(s, 5)); return true;
    case 109: s.effects.yuri = true; return true;
    case 110: s.influence.saudi_arabia.US += 2; s.effects.awacs = true; return true;
    default: return false;
  }
}

export function resolveCountryChoice(s: GameState, d: Extract<Decision, { kind: 'COUNTRY' }>, value: string) {
  if (d.event === 36) war(s, d.actor, value, { win: 3, vp: 1, military: 3 });
  if (d.event === 102) war(s, d.actor, value);
}

export function resolveLateChoice(s: GameState, d: Choice, value: string) {
  switch (d.event) {
    case 43: if (value !== 'skip') { const id = Number(value); s.discard = s.discard.filter((c) => c !== id); s.hands[d.actor].push(id); s.log.push('战略武器限制谈判：取回 ' + cardName(id)); } break;
    case 45: if (value !== 'none') changeDefcon(s, value === 'up' ? 1 : -1); break;
    case 46: changeDefcon(s, Number(value) - s.defcon); break;
    case 49: missileEnvySwap(s, d.actor, Number(value), d.phasing); break;
    case 53:
      if (value === 'south_africa') s.influence.south_africa.USSR += 2;
      else { s.influence.south_africa.USSR++; influence(s, 'USSR', ADJACENCY.south_africa, 2, 2, 'ADD', 'USSR', '南非动荡：南非邻国共 +2'); }
      break;
    case 67: {
      const taken = d.memo![0];
      if (value === 'play') s.phase = { kind: 'SUBPLAY', side: 'US', card: taken };
      else { s.hands.USSR.push(taken); s.tasks.unshift({ kind: 'START_OPS', side: 'US', base: 2 }); }
      break;
    }
    case 77:
      if (value === 'done') { const drawn = draw(s, d.memo![0]); s.hands.US.push(...drawn); s.log.push('“不要问”：美国抽 ' + drawn.length + ' 张'); }
      else { discardFromHand(s, 'US', Number(value)); askNot(s, d.memo![0] + 1); }
      break;
    case 85: {
      const id = Number(value);
      s.discard = s.discard.filter((c) => c !== id);
      s.log.push('星球大战：执行 ' + cardName(id));
      s.tasks.unshift({ kind: 'EVENT', card: id, actor: 'US', phasing: d.phasing }, { kind: 'DISPOSE', card: id, event: false });
      break;
    }
    case 94: s.effects.chernobyl = value as Region; s.log.push('切尔诺贝利：苏联本回合不能用 OPS 在' + REGION_NAMES[value as Region] + '放置影响力'); break;
    case 95:
      if (value === 'refuse') influence(s, 'USSR', ids((c) => c.region === 'SOUTH_AMERICA' && s.influence[c.id].USSR > 0), 2, 1, 'DOUBLE', 'USSR', '拉丁美洲债务危机：加倍 2 个南美国家的苏联影响力');
      else discardFromHand(s, 'US', Number(value));
      break;
    case 98: discardFromHand(s, 'US', Number(value)); break;
    case 100:
      if (value === 'end') {
        const receiver = opponent(d.actor);
        s.vp += sign(receiver) * 6;
        s.log.push('战争游戏：' + receiver + ' 获得 6 VP，游戏结束（总计 ' + s.vp + '）');
        s.phase = { kind: 'GAME_OVER', winner: s.vp > 0 ? 'US' : s.vp < 0 ? 'USSR' : 'DRAW', reason: '战争游戏提前结束 · VP ' + s.vp };
      }
      break;
    case 108: {
      const drawn = d.memo!;
      if (value === 'done') { s.deck = shuffle([...s.deck, ...drawn], () => random(s)); s.log.push('我们的人在德黑兰：其余 ' + drawn.length + ' 张放回牌堆并洗牌'); }
      else { const id = Number(value); s.discard.push(id); s.log.push('我们的人在德黑兰：弃置 ' + cardName(id)); ourMan(s, drawn.filter((c) => c !== id)); }
      break;
    }
    default: throw new Error('未知事件选择：' + d.event);
  }
}
