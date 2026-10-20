import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Side } from '@ts/shared';
import { activeSide, apply, CARD_BY_ID, CARDS, COUNTRIES, createGame, createRng, legalTargets, scoreRegion, viewFor, type Action, type GameState } from '../src/index';
import { beginAction, beginHeadline, roundsFor } from '../src/engine';

function ready(side: Side = 'USSR', turn = 5): GameState { const s = createGame(42); s.turn = turn; beginAction(s, side, 1); return s; }
function play(id: number, side: Side = 'USSR', configure?: (s: GameState) => void) {
  const s = ready(side); s.hands[side] = [id]; configure?.(s); return apply(s, side, { type: 'PLAY_EVENT', card: id });
}
const choose = (s: GameState, value: string) => apply(s, activeSide(s)!, { type: 'CHOOSE', value });
/** Resolve every pending decision with the first option, ending OPS and playing Grain Sales cards for OPS. */
function auto(s: GameState): GameState {
  for (let i = 0; i < 120 && ['DECISION', 'OPS', 'SUBPLAY'].includes(s.phase.kind); i++) {
    const side = activeSide(s)!;
    if (s.phase.kind === 'OPS') s = apply(s, side, { type: 'END_OPS' });
    else if (s.phase.kind === 'SUBPLAY') s = apply(s, side, CARD_BY_ID.get(s.phase.card)!.scoring ? { type: 'PLAY_EVENT', card: s.phase.card } : { type: 'PLAY_OPS', card: s.phase.card, mode: 'INFLUENCE' });
    else {
      const d = (s.phase as Extract<GameState['phase'], { kind: 'DECISION' }>).decision;
      s = choose(s, d.kind === 'REVEAL' ? 'confirm' : d.kind === 'OPS_MODE' ? 'skip' : d.kind === 'CHOICE' ? (d.options.find((o) => o.id === 'done' || o.id === 'continue')?.id ?? d.options[0].id) : legalTargets(s)[0] ?? 'done');
    }
  }
  return s;
}

test('every Mid and Late War event resolves to the next action round without a stuck continuation', () => {
  for (const card of CARDS.filter((c) => c.period !== 'EARLY')) {
    const side: Side = card.side === 'US' ? 'US' : 'USSR';
    const s = auto(play(card.id, side, (s) => {
      s.hands[side] = [card.id, 4, 25, 31]; s.hands[side === 'US' ? 'USSR' : 'US'] = [7, 30, 19];
      s.discard = [27, 29]; s.effects.johnPaul = true; s.space = side === 'US' ? { US: 3, USSR: 1 } : { US: 3, USSR: 1 };
      s.defcon = card.id === 100 ? 2 : 4; s.influence.saudi_arabia.US = 3; s.influence.south_korea.US = 3;
    }));
    assert.equal(s.phase.kind, 'ACTION_ROUND', card.nameZh + ' should finish, got ' + s.phase.kind);
    const owned = [...s.removed, ...s.discard, ...s.hands.US, ...s.hands.USSR];
    assert.ok(owned.includes(card.id) || (card.id === 73 && s.effects.shuttle), card.nameZh + ' disposition');
  }
});

test('Mid and Late War card data: 110 unique deluxe cards with the printed periods', () => {
  assert.equal(CARDS.length, 110);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 110);
  assert.equal(CARDS.filter((c) => c.period === 'MID').length, 48);
  assert.equal(CARDS.filter((c) => c.period === 'LATE').length, 23);
  assert.ok(CARD_BY_ID.get(38)!.starred && CARD_BY_ID.get(38)!.scoring);
  assert.equal(CARDS.filter((c) => c.scoring).length, 7);
});

test('action rounds: 7 from turn 4, optional eighth from Space Station or North Sea Oil, never compelled', () => {
  let s = ready('USSR', 4);
  assert.equal(roundsFor(s, 'USSR'), 7); s.space.US = 8; assert.equal(roundsFor(s, 'US'), 8); s.space.USSR = 8; assert.equal(roundsFor(s, 'US'), 7);
  s = ready('US', 4); beginAction(s, 'US', 7); s.effects.northSeaRound = true; s.hands.US = [25, 27]; s.hands.USSR = [];
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }); s = apply(s, 'US', { type: 'END_OPS' });
  assert.equal(s.phase.kind === 'ACTION_ROUND' && s.phase.round, 8); assert.equal(activeSide(s), 'US');
  s = apply(s, 'US', { type: 'PASS_EMPTY' }); assert.equal(s.turn, 5); assert.equal(s.effects.northSeaRound, undefined);
});

test('turn 8 adds the Late War cards; turn 10 ends with final scoring of all regions plus the China card', () => {
  let s = ready('US', 7); beginAction(s, 'US', 7); s.hands.US = [25]; s.hands.USSR = [];
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }); s = apply(s, 'US', { type: 'END_OPS' });
  assert.equal(s.turn, 8); assert.ok([...s.deck, ...s.hands.US, ...s.hands.USSR].some((id) => CARD_BY_ID.get(id)!.period === 'LATE'));
  s = ready('US', 10); beginAction(s, 'US', 7); s.hands.US = [25]; s.hands.USSR = []; s.milOps = { US: 5, USSR: 5 }; s.vp = 0;
  for (const c of COUNTRIES) s.influence[c.id] = { US: 0, USSR: 0 };
  s.influence.mexico.US = 2; s.chinaCard = { holder: 'USSR', faceUp: true };
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }); s = apply(s, 'US', { type: 'END_OPS' });
  // Central America: US presence 1 + battleground 1 + adjacent to USSR? no → 2; China −1 → +1 US.
  assert.equal(s.phase.kind === 'GAME_OVER' && s.phase.winner, 'US'); assert.equal(s.vp, 1);
});

test('final scoring has no 20 VP auto-win but Europe control still wins', () => {
  let s = ready('US', 10); beginAction(s, 'US', 7); s.hands.US = [25]; s.hands.USSR = []; s.milOps = { US: 5, USSR: 5 };
  for (const c of COUNTRIES) s.influence[c.id] = { US: 0, USSR: 0 };
  for (const c of COUNTRIES.filter((c) => c.region === 'EUROPE' && c.battleground)) s.influence[c.id].USSR = c.stability;
  s.vp = 19; s.chinaCard = { holder: 'US', faceUp: true };
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }); s = apply(s, 'US', { type: 'END_OPS' });
  assert.equal(s.phase.kind === 'GAME_OVER' && s.phase.winner, 'USSR');
});

test('Southeast Asia scoring counts Thailand double and is removed; Shuttle Diplomacy trims one USSR battleground once', () => {
  let s = play(38, 'USSR', (s) => { s.influence.thailand.USSR = 2; s.influence.vietnam.USSR = 1; s.influence.burma.US = 2; });
  assert.equal(s.vp, -2); assert.ok(s.removed.includes(38));
  s = play(73, 'US'); assert.equal(s.effects.shuttle, true); assert.ok(!s.discard.includes(73));
  for (const c of COUNTRIES) s.influence[c.id] = { US: 0, USSR: 0 };
  s.influence.iraq.USSR = 3; s.influence.syria.USSR = 2;
  beginAction(s, 'USSR', 2); s.hands.USSR = [3]; s = apply(s, 'USSR', { type: 'PLAY_EVENT', card: 3 });
  assert.equal(s.vp, -3); assert.equal(s.effects.shuttle, undefined); assert.ok(s.discard.includes(73));
});

test('Quagmire forces discards until a 1–4 roll and allows only scoring cards when nothing qualifies', () => {
  let s = play(42, 'USSR'); assert.equal(s.effects.quagmire, true);
  s.hands.US = [32, 1, 25];
  assert.throws(() => apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }));
  assert.throws(() => apply(s, 'US', { type: 'TRAP_DISCARD', card: 32 }));
  s = apply(s, 'US', { type: 'TRAP_DISCARD', card: 25 }); assert.ok(s.discard.includes(25)); assert.equal(activeSide(s), 'USSR');
  s = ready('US'); s.effects.quagmire = true; s.hands.US = [32, 1];
  assert.throws(() => apply(s, 'US', { type: 'PASS_EMPTY' }));
  s = apply(s, 'US', { type: 'PLAY_EVENT', card: 1 }); assert.equal(activeSide(s), 'USSR');
  s = ready('US'); s.effects.quagmire = true; s.hands.US = [32]; s = apply(s, 'US', { type: 'PASS_EMPTY' }); assert.equal(activeSide(s), 'USSR');
});

test('Cuban Missile Crisis: coup loses unless cancelled by removing 2 influence; Nuclear Subs spares DEFCON', () => {
  let s = play(40, 'USSR'); assert.equal(s.defcon, 2); assert.equal(s.effects.cmc, 'US');
  s.hands.US = [25]; s.influence.angola.USSR = 1;
  let t = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'COUP' }); t = apply(t, 'US', { type: 'TARGET', country: 'angola' });
  assert.equal(t.phase.kind === 'GAME_OVER' && t.phase.winner, 'USSR');
  s.influence.turkey.US = 2; s = apply(s, 'US', { type: 'CANCEL_CMC', country: 'turkey' }); assert.equal(s.effects.cmc, undefined); assert.equal(s.influence.turkey.US, 0);
  s = ready('US'); s.effects.nuclearSubs = true; s.hands.US = [25]; s.influence.angola.USSR = 1; s.defcon = 3;
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'COUP' }); s = apply(s, 'US', { type: 'TARGET', country: 'angola' }); assert.equal(s.defcon, 3);
});

test('Missile Envy takes the highest card, fires own events, and forces the card back as OPS', () => {
  let s = play(49, 'US', (s) => { s.hands.USSR = [19, 7]; });
  // Socialist Governments (3, USSR) is the opponent's event: the US uses it for OPS without the event.
  assert.equal(s.phase.kind, 'DECISION'); assert.ok(s.hands.USSR.includes(49)); assert.equal(s.effects.missileEnvy, 'USSR');
  s = auto(s); assert.equal(activeSide(s), 'USSR');
  s.hands.USSR.push(25);
  assert.throws(() => apply(s, 'USSR', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }));
  s = apply(s, 'USSR', { type: 'PLAY_OPS', card: 49, mode: 'INFLUENCE' }); assert.equal(s.effects.missileEnvy, undefined);
  // US/Japan Pact is the victim's own event: the USSR uses it for OPS and the event does not fire.
  s = play(49, 'USSR', (s) => { s.hands.US = [27]; }); assert.equal(s.effects.japan, undefined); assert.equal(s.phase.kind, 'DECISION');
});

test('Grain Sales lets the US play the stolen card or return it for 2 OPS', () => {
  const s = play(67, 'US', (s) => { s.hands.USSR = [25]; });
  assert.equal(s.phase.kind === 'DECISION' && s.phase.decision.kind === 'CHOICE' && s.phase.decision.memo?.[0], 25);
  let played = choose(s, 'play'); assert.equal(played.phase.kind, 'SUBPLAY');
  played = apply(played, 'US', { type: 'PLAY_EVENT', card: 25 }); assert.equal(played.effects.containment, true); assert.ok(played.removed.includes(25));
  const returned = choose(s, 'return'); assert.ok(returned.hands.USSR.includes(25)); assert.equal(returned.phase.kind, 'DECISION');
});

test('We Will Bury You scores before the US action unless UN Intervention answers it; U2 adds a point for UN', () => {
  let s = play(50, 'USSR'); assert.equal(s.effects.buryYou, true); assert.equal(s.defcon, 4);
  s.hands.US = [25]; let t = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'INFLUENCE' }); assert.equal(t.vp, -3);
  s.hands.US = [32]; t = apply(s, 'US', { type: 'PLAY_EVENT', card: 32 }); assert.equal(t.vp, 0); assert.equal(t.effects.buryYou, undefined);
  s = play(60, 'USSR'); assert.equal(s.vp, -1); s.hands.US = [32]; s = apply(s, 'US', { type: 'PLAY_EVENT', card: 32 }); assert.equal(s.vp, -2);
});

test('Flower Power punishes US war plays but not space, and An Evil Empire cancels it', () => {
  let s = ready('US'); s.effects.flowerPower = true; s.hands.US = [36, 13];
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 13, mode: 'INFLUENCE' }); assert.ok(s.vp <= -2);
  s = ready('US'); s.effects.flowerPower = true; s.hands.US = [36]; s = apply(s, 'US', { type: 'SPACE', card: 36 }); assert.ok(s.vp >= 0);
  s = play(97, 'US', (s) => { s.effects.flowerPower = true; }); assert.equal(s.effects.flowerPower, undefined); assert.equal(s.effects.evilEmpire, true);
});

test('coup and realignment modifiers: SALT, Death Squads, Iran-Contra, Reformer, Yuri and Samantha', () => {
  let s = ready('US'); s.effects.salt = true; s.effects.yuri = true; s.hands.US = [25]; s.influence.angola.USSR = 1; s.seed = 3; s.rngCalls = 0;
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'COUP' }); s = apply(s, 'US', { type: 'TARGET', country: 'angola' });
  assert.ok(s.log.some((l) => /骰 \d -1/.test(l))); assert.equal(s.vp, -1);
  s = ready('USSR'); s.effects.reformer = true; s.defcon = 5; s.hands.USSR = [7]; s.influence.italy.US = 1; s.influence.angola.US = 1;
  s = apply(s, 'USSR', { type: 'PLAY_OPS', card: 7, mode: 'COUP' }); assert.ok(!legalTargets(s).includes('italy')); assert.ok(legalTargets(s).includes('angola'));
  s = ready('USSR'); s.effects.deathSquads = 'USSR'; s.hands.USSR = [7]; s.influence.colombia.US = 1;
  s = apply(s, 'USSR', { type: 'PLAY_OPS', card: 7, mode: 'COUP' }); s = apply(s, 'USSR', { type: 'TARGET', country: 'colombia' }); assert.ok(s.log.some((l) => /骰 \d \+1/.test(l)));
  s = ready('US'); s.effects.iranContra = true; s.hands.US = [25]; s.influence.angola.USSR = 1;
  s = apply(s, 'US', { type: 'PLAY_OPS', card: 25, mode: 'REALIGNMENT' }); s = apply(s, 'US', { type: 'TARGET', country: 'angola' });
  assert.ok(s.log.some((l) => /调整：US \d\+-1/.test(l)));
});

test('free coups ignore DEFCON regions and military ops; Che gets a second coup only after removing US influence', () => {
  let s = play(96, 'US', (s) => { s.defcon = 3; s.influence.poland.USSR = 1; });
  assert.equal(s.influence.east_germany.US, 3); s = choose(s, 'COUP'); assert.ok(legalTargets(s).includes('poland'));
  s = apply(s, 'US', { type: 'TARGET', country: 'poland' }); assert.equal(s.milOps.US, 0);
  s = play(107, 'USSR', (s) => { for (const c of COUNTRIES) s.influence[c.id] = { US: 0, USSR: 0 }; s.influence.zimbabwe.US = 1; s.influence.bolivia.US = 1; s.seed = 5; s.rngCalls = 0; });
  assert.ok(legalTargets(s).every((id) => !COUNTRIES.find((c) => c.id === id)!.battleground));
  s = apply(s, 'USSR', { type: 'TARGET', country: 'zimbabwe' });
  if (s.influence.zimbabwe.US === 0) { assert.equal(s.phase.kind, 'OPS'); assert.deepEqual(legalTargets(s), ['bolivia']); }
});

test('China card events: Cultural Revolution, Nixon (face down), Ussuri (face up)', () => {
  let s = play(58, 'USSR', (s) => { s.chinaCard = { holder: 'US', faceUp: true }; }); assert.deepEqual(s.chinaCard, { holder: 'USSR', faceUp: true });
  s = play(58, 'USSR'); assert.equal(s.vp, -1);
  s = play(71, 'US'); assert.deepEqual(s.chinaCard, { holder: 'US', faceUp: false });
  s = play(76, 'US'); assert.deepEqual(s.chinaCard, { holder: 'US', faceUp: true });
  s = play(76, 'US', (s) => { s.chinaCard = { holder: 'US', faceUp: true }; }); assert.equal(s.phase.kind, 'DECISION');
});

test('prerequisites and cancellations: Solidarity, Camp David, Iron Lady, AWACS, North Sea Oil, Tear Down This Wall', () => {
  let s = play(101, 'US', (s) => { delete s.effects.johnPaul; }); assert.equal(s.influence.poland.US, 0); assert.ok(s.discard.includes(101));
  s = play(68, 'US'); s.hands.US = [101]; beginAction(s, 'US', 2); s = apply(s, 'US', { type: 'PLAY_EVENT', card: 101 }); assert.equal(s.influence.poland.US, 4);
  for (const [blocker, blocked] of [[65, 13], [83, 7], [110, 56], [86, 61], [96, 55]] as const) {
    let t = play(blocker, 'US'); t = auto(t); beginAction(t, 'USSR', 2); t.hands.USSR = [blocked];
    t = auto(apply(t, 'USSR', { type: 'PLAY_EVENT', card: blocked }));
    assert.ok(t.discard.includes(blocked), CARD_BY_ID.get(blocked)!.nameZh + ' blocked by ' + CARD_BY_ID.get(blocker)!.nameZh);
  }
  s = play(55, 'USSR', (s) => { s.effects.nato = true; s.influence.west_germany.US = 5; s.defcon = 5; });
  s.hands.US = []; beginAction(s, 'USSR', 2); s.hands.USSR = [7]; s = apply(s, 'USSR', { type: 'PLAY_OPS', card: 7, mode: 'COUP' });
  assert.ok(legalTargets(s).includes('west_germany'));
});

test('Wargames ends the game after the 6 VP gift; Star Wars and SALT pull from the discard pile', () => {
  let s = play(100, 'USSR', (s) => { s.defcon = 2; s.vp = -8; }); s = choose(s, 'end');
  assert.equal(s.phase.kind === 'GAME_OVER' && s.phase.winner, 'USSR'); assert.equal(s.vp, -2);
  s = play(85, 'US', (s) => { s.space = { US: 2, USSR: 1 }; s.discard = [25]; }); s = choose(s, '25'); assert.equal(s.effects.containment, true); assert.ok(s.removed.includes(25));
  s = play(43, 'USSR', (s) => { s.defcon = 2; s.discard = [27]; }); assert.equal(s.defcon, 4); s = choose(s, '27'); assert.ok(s.hands.USSR.includes(27)); assert.equal(s.effects.salt, true);
});

test('Ask Not and Our Man in Tehran keep the card count; Terrorism doubles after the Hostage Crisis', () => {
  let s = play(77, 'US', (s) => { s.hands.US = [77, 25, 27]; });
  s = choose(s, '25'); s = choose(s, '27'); s = choose(s, 'done'); assert.equal(s.hands.US.length, 2); assert.ok(s.discard.includes(25));
  s = play(108, 'US', (s) => { s.influence.israel.US = 4; });
  const drawn = s.phase.kind === 'DECISION' && s.phase.decision.kind === 'CHOICE' ? s.phase.decision.memo! : [];
  assert.equal(drawn.length, 5); const deckBefore = s.deck.length;
  s = choose(s, String(drawn[0])); s = choose(s, 'done'); assert.equal(s.deck.length, deckBefore + 4); assert.ok(s.discard.includes(drawn[0]));
  s = play(92, 'USSR', (s) => { s.effects.iranianHostage = true; s.hands.US = [25, 27, 29]; }); assert.equal(s.hands.US.length, 1);
});

test('Aldrich Ames reveals the US hand only to the USSR for the turn', () => {
  const s = play(98, 'USSR', (s) => { s.hands.US = [25, 27]; });
  assert.deepEqual(viewFor(s, 'USSR').hands.US, [25, 27]); assert.deepEqual(viewFor(s, 'US').hands.USSR, []);
});

test('scoring adds Central America, Africa and South America; Kitchen Debates needs more US battlegrounds', () => {
  const s = ready(); for (const c of COUNTRIES) s.influence[c.id] = { US: 0, USSR: 0 };
  s.influence.cuba.USSR = 3; s.influence.haiti.USSR = 1;
  assert.equal(scoreRegion(s, 'CENTRAL_AMERICA').USSR.points, 3 + 1 + 1);
  let t = play(48, 'US'); assert.equal(t.vp, 0); assert.ok(t.discard.includes(48));
  // The USSR starts with North Korea and East Germany; the US needs three battlegrounds.
  t = play(48, 'US', (s) => { s.influence.mexico.US = 2; s.influence.panama.US = 2; s.influence.cuba.US = 3; }); assert.equal(t.vp, 2);
});

/** Seeded random player: tries plausible actions until one is accepted. */
function randomStep(s: GameState, rand: () => number): GameState {
  const side = activeSide(s)!, pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const attempts: Action[] = [];
  const p = s.phase;
  if (p.kind === 'SETUP_PLACEMENT') attempts.push({ type: 'PLACE_SETUP', country: pick(legalTargets(s)) });
  else if (p.kind === 'HEADLINE') attempts.push(...s.hands[side].filter((id) => id !== 32).map((card) => ({ type: 'SELECT_HEADLINE', card }) as Action));
  else if (p.kind === 'OPS') { const targets = legalTargets(s); attempts.push(targets.length && rand() < 0.9 ? { type: 'TARGET', country: pick(targets) } : { type: 'END_OPS' }); }
  else if (p.kind === 'SUBPLAY') attempts.push({ type: 'PLAY_EVENT', card: p.card }, { type: 'PLAY_OPS', card: p.card, mode: 'INFLUENCE' }, { type: 'SPACE', card: p.card });
  else if (p.kind === 'DECISION') {
    const d = p.decision;
    if (d.kind === 'REVEAL') attempts.push({ type: 'CHOOSE', value: 'confirm' });
    else if (d.kind === 'OPS_MODE') attempts.push(...(d.modes ?? ['INFLUENCE', 'REALIGNMENT', 'COUP']).map((m) => ({ type: 'CHOOSE', value: m }) as Action), { type: 'CHOOSE', value: 'skip' });
    else if (d.kind === 'CHOICE') attempts.push(...d.options.filter((o) => o.id !== 'end').map((o) => ({ type: 'CHOOSE', value: o.id }) as Action));
    else attempts.push(...legalTargets(s).map((value) => ({ type: 'CHOOSE', value }) as Action), { type: 'CHOOSE', value: 'done' });
  } else if (p.kind === 'ACTION_ROUND') {
    const hand = [...s.hands[side], ...(s.chinaCard.holder === side && s.chinaCard.faceUp ? [6] : [])];
    const scoring = s.hands[side].filter((id) => CARD_BY_ID.get(id)!.scoring);
    // Play scoring cards in time, like a sensible player.
    if (scoring.length && rand() < 0.6) attempts.push({ type: 'PLAY_EVENT', card: scoring[0] });
    for (const card of hand) attempts.push({ type: 'TRAP_DISCARD', card });
    for (let i = 0; i < 6; i++) {
      const card = pick(hand); if (card === undefined) break;
      const r = rand();
      attempts.push(r < 0.45 ? { type: 'PLAY_OPS', card, mode: pick(['INFLUENCE', 'INFLUENCE', 'REALIGNMENT', 'COUP'] as const), order: rand() < 0.5 ? 'BEFORE' : 'AFTER' } : r < 0.9 ? { type: 'PLAY_EVENT', card } : { type: 'SPACE', card });
    }
    attempts.push(...hand.map((card) => ({ type: 'PLAY_EVENT', card }) as Action), ...hand.map((card) => ({ type: 'PLAY_OPS', card, mode: 'INFLUENCE' }) as Action), { type: 'PASS_EMPTY' });
  }
  for (const action of attempts) {
    try { return apply(s, side, action); } catch { /* try the next candidate */ }
  }
  throw new Error('no legal action in phase ' + JSON.stringify(p).slice(0, 300));
}
/** Every card in play must be somewhere exactly once. */
function cardLocations(s: GameState): number[] {
  const all = [...s.deck, ...s.discard, ...s.removed, ...s.hands.US, ...s.hands.USSR, ...s.tasks.filter((t) => t.kind === 'DISPOSE').map((t) => (t as { card: number }).card)];
  if (s.phase.kind === 'HEADLINE' && s.headlines) all.push(...Object.values(s.headlines).filter((id) => !all.includes(id)));
  if (s.phase.kind === 'SUBPLAY') all.push(s.phase.card);
  if (s.phase.kind === 'DECISION' && s.phase.decision.kind === 'CHOICE' && (s.phase.decision.event === 67 || s.phase.decision.event === 108)) all.push(...s.phase.decision.memo!);
  if (s.effects.shuttle) all.push(73);
  return all;
}

test('seeded random games play through all ten turns without stalls, losing cards or breaking state', () => {
  let finished = 0, reachedLate = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let s = createGame(seed); const rand = createRng(seed * 7919);
    for (let step = 0; step < 6000 && s.phase.kind !== 'GAME_OVER'; step++) {
      s = randomStep(s, rand);
      assert.ok(Number.isFinite(s.vp) && s.defcon >= 1 && s.defcon <= 5, 'state seed ' + seed);
      for (const inf of Object.values(s.influence)) for (const n of Object.values(inf)) assert.ok(Number.isInteger(n) && n >= 0, 'influence seed ' + seed);
      if (s.phase.kind === 'GAME_OVER') break;
      const periods = ['EARLY', ...(s.turn >= 4 ? ['MID'] : []), ...(s.turn >= 8 ? ['LATE'] : [])];
      const expected = CARDS.filter((c) => c.id !== 6 && periods.includes(c.period)).length;
      const all = cardLocations(s);
      assert.equal(new Set(all).size, all.length, 'duplicate card seed ' + seed + ' turn ' + s.turn + ' ' + s.phase.kind);
      assert.equal(all.length, expected, 'card count seed ' + seed + ' turn ' + s.turn + ' ' + s.phase.kind + ' ' + JSON.stringify(s.log.slice(-4)));
    }
    assert.equal(s.phase.kind, 'GAME_OVER', 'stalled seed ' + seed + ' at turn ' + s.turn);
    if (s.turn >= 8) reachedLate++;
    if (s.phase.kind === 'GAME_OVER' && s.phase.reason.startsWith('终局计分')) finished++;
  }
  assert.ok(reachedLate > 0, 'some games reach the Late War');
  assert.ok(finished > 0, 'some games reach final scoring');
});

test('headline privilege and late headline still follow Man in Earth Orbit after the new deck', () => {
  const s = ready('USSR', 6); s.space.US = 4; beginHeadline(s); assert.equal(activeSide(s), 'USSR');
});
