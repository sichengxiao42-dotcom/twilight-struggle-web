import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { boardPoint, PeerPointer } from '../src/BoardPresence';

test('board coordinates stay aligned across viewport offsets, zoom and scroll',()=>{
  assert.deepEqual(boardPoint(250,180,{left:50,top:80,width:400,height:200}),{x:.5,y:.5});
  assert.deepEqual(boardPoint(200,150,{left:-200,top:-50,width:800,height:400}),{x:.5,y:.5});
  assert.equal(boardPoint(49,180,{left:50,top:80,width:400,height:200}),null);
  assert.equal(boardPoint(200,281,{left:50,top:80,width:400,height:200}),null);
  assert.equal(boardPoint(0,0,{left:0,top:0,width:0,height:0}),null);
});
test('peer rendering distinguishes mouse and released touch without interactive elements',()=>{
  const base={roomId:'ABC123',side:'USSR' as const,pointer:{x:.25,y:.5,kind:'mouse' as const,phase:'move' as const}};
  const mouse=renderToStaticMarkup(createElement(PeerPointer,{presence:base,width:1000,height:600}));
  assert.ok(mouse.includes('translate(250 300)'));assert.ok(mouse.includes('<path'));assert.ok(mouse.includes('苏联'));
  const touch=renderToStaticMarkup(createElement(PeerPointer,{presence:{...base,pointer:{...base.pointer,kind:'touch',phase:'up'}},width:1000,height:600}));
  assert.ok(touch.includes('peer-released'));assert.ok(touch.includes('peer-ripple'));assert.ok(!touch.includes('<path'));
  assert.equal(renderToStaticMarkup(createElement(PeerPointer,{presence:null,width:1000,height:600})), '');
});
