import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, legalTargets } from '@ts/game-core';
import { influenceDrop } from '../src/pieceMoves';
import { trackNeedsMove, trackPieces } from '../src/tracks';

test('only the active reserve can deploy to a legal setup country',()=>{
  const s=createGame(1),targets=legalTargets(s);
  assert.deepEqual(influenceDrop(s,{kind:'reserve',side:'USSR'},{kind:'country',id:'poland'},targets),{type:'PLACE_SETUP',country:'poland'});
  assert.equal(influenceDrop(s,{kind:'reserve',side:'US'},{kind:'country',id:'poland'},targets),null);
  assert.equal(influenceDrop(s,{kind:'reserve',side:'USSR'},{kind:'country',id:'uk'},targets),null);
  assert.equal(influenceDrop(s,{kind:'influence',country:'east_germany',side:'USSR'},{kind:'country',id:'poland'},targets),null);
});
test('influence removal drags back to the matching reserve and never removes the wrong side',()=>{
  const s=createGame(1);s.phase={kind:'DECISION',side:'USSR',decision:{kind:'INFLUENCE',affected:'US',operation:'REMOVE',remaining:1,perCountry:1,used:{},targets:['uk'],prompt:'移除影响力'}};
  const piece={kind:'influence',country:'uk',side:'US'} as const;
  assert.deepEqual(influenceDrop(s,piece,{kind:'reserve',side:'US'},['uk']),{type:'CHOOSE',value:'uk'});
  assert.equal(influenceDrop(s,piece,{kind:'reserve',side:'USSR'},['uk']),null);
});
test('stale legal targets cannot bypass the latest phase restrictions',()=>{
  const s=createGame(1);s.phase={kind:'HEADLINE',side:'USSR'};
  assert.equal(influenceDrop(s,{kind:'reserve',side:'USSR'},{kind:'country',id:'poland'},['poland']),null);
});
test('all nine track pieces have stable IDs and only actual results require placement',()=>{
  const s=createGame(1),before=trackPieces(s);
  assert.equal(before.length,9);assert.equal(new Set(before.map(p=>p.id)).size,9);
  assert.ok(before.every(p=>!trackNeedsMove(p,p)));
  s.defcon=4;s.vp=-3;s.turn=2;
  const after=trackPieces(s),changed=after.filter(p=>trackNeedsMove(before.find(q=>q.id===p.id),p)).map(p=>p.id);
  assert.deepEqual(changed,['turn','defcon','vp']);assert.equal(s.defcon,4);
});
test('shared military and space markers stay distinct while preserving the authoritative value',()=>{
  const pieces=trackPieces(createGame(1));
  const a=pieces.find(p=>p.id==='mil-US')!,b=pieces.find(p=>p.id==='mil-USSR')!;
  assert.equal(a.value,b.value);assert.notDeepEqual(a.at,b.at);
});

test('one side advancing never forces the unchanged counter through a cosmetic placement',()=>{
  const state=createGame(1),before=trackPieces(state);state.space.US=1;
  const after=trackPieces(state);
  assert.equal(trackNeedsMove(before.find(p=>p.id==='space-USSR'),after.find(p=>p.id==='space-USSR')!),false);
  assert.equal(trackNeedsMove(before.find(p=>p.id==='space-US'),after.find(p=>p.id==='space-US')!),true);
});
