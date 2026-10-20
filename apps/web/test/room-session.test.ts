import assert from 'node:assert/strict';
import test from 'node:test';
import { readSession, writeSession, forgetSession } from '../src/roomSession';
const storage=():Storage=>{
  const values=new Map<string,string>();
  return {get length(){return values.size;},clear:()=>values.clear(),getItem:key=>values.get(key)??null,key:i=>[...values.keys()][i]??null,removeItem:key=>{values.delete(key);},setItem:(key,value)=>{values.set(key,value);}};
};
test('a reopened tab and room-code entry recover the original identity',()=>{
  const tab=storage(),persistent=storage(),session={roomId:'ABC123',token:'private-original'};
  writeSession(tab,persistent,session);
  assert.deepEqual(readSession(storage(),persistent),session);
  assert.deepEqual(readSession(storage(),persistent,'ABC123'),session);
  assert.equal(readSession(tab,persistent,'OTHER1'),null);
});
test('room identities remain separate and closing only forgets the closed room',()=>{
  const tab=storage(),persistent=storage(),first={roomId:'ABC123',token:'first'},second={roomId:'DEF456',token:'second'};
  writeSession(tab,persistent,first);writeSession(tab,persistent,second);
  assert.deepEqual(readSession(tab,persistent,'ABC123'),first);
  forgetSession(tab,persistent,'ABC123');
  assert.equal(readSession(tab,persistent,'ABC123'),null);
  assert.deepEqual(readSession(tab,persistent),second);
});
