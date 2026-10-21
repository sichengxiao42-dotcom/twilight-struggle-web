import assert from 'node:assert/strict';
import test from 'node:test';
import { publicCardSlot } from '../src/publicCardLayout';
import { BOX_HEIGHT, BOX_WIDTH, MAP_HEIGHT, MAP_POSITIONS, MAP_WIDTH, TURN_TRACK, SPACE_TRACK, ACTION_ROUND_TRACK, DEFCON_TRACK, MIL_OPS_TRACK, VP_TRACK } from '../src/mapPositions';

test('both factions and stacked public cards leave every country and game track uncovered',()=>{
  const intersects=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  for(const side of ['USSR','US'] as const)for(const index of [0,1,2,8]){
    const slot=publicCardSlot(side,index);
    assert.ok(slot.x>=0&&slot.y>=0&&slot.x+slot.width<=MAP_WIDTH&&slot.y+slot.height<=MAP_HEIGHT);
    for(const [country,[x,y]] of Object.entries(MAP_POSITIONS))assert.equal(intersects(slot,{x,y,width:BOX_WIDTH,height:BOX_HEIGHT}),false,`${side} display covers ${country}`);
    for(const [x,y] of [...TURN_TRACK,...SPACE_TRACK,...ACTION_ROUND_TRACK,...Object.values(DEFCON_TRACK),...MIL_OPS_TRACK,...Object.values(VP_TRACK)])assert.equal(intersects(slot,{x:x-120,y:y-120,width:240,height:240}),false,`${side} display covers a track`);
  }
});
