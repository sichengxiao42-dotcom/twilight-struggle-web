import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { BoardPointer, BoardPresence } from '@ts/shared';

/** Coordinates follow the SVG, including its scroll/zoom, never the enclosing panel. */
export function boardPoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number}) {
  if(rect.width<=0||rect.height<=0)return null;
  const point={x:(x-rect.left)/rect.width,y:(y-rect.top)/rect.height};
  return point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1?point:null;
}

export function useBoardPresence(send:((pointer:BoardPointer|null)=>void)|undefined) {
  const boardRef=useRef<SVGSVGElement|null>(null);
  const sendRef=useRef(send);sendRef.current=send;
  const latest=useRef<BoardPointer|null>(null);
  const pending=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const lastSent=useRef(0);
  const activeTouch=useRef<number|null>(null);
  const clear=()=>{
    clearTimeout(pending.current);pending.current=undefined;
    if(latest.current)sendRef.current?.(null);
    latest.current=null;activeTouch.current=null;
  };
  useEffect(()=>{
    const hide=()=>{if(document.hidden)clear();};
    const heartbeat=setInterval(()=>{if(latest.current&&!(latest.current.kind==='touch'&&latest.current.phase==='up'))sendRef.current?.(latest.current);},2500);
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',hide);
    return ()=>{clear();clearInterval(heartbeat);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hide);};
    // Event listeners use refs so re-rendering a game action never resets a pointer.
  },[]);
  const enabled=Boolean(send);
  useEffect(()=>{if(!enabled)clear();},[enabled]);
  const pointer=(event:ReactPointerEvent<SVGSVGElement|HTMLElement>,phase:BoardPointer['phase'],fromReserve=false)=>{
    if(!sendRef.current)return;
    if(!event.isPrimary){if(phase==='down')clear();return;}
    const touch=event.pointerType!=='mouse';
    // Captured drags from the toolbar keep targeting the reserve even over the map.
    if(fromReserve&&touch&&phase==='move'&&event.buttons)activeTouch.current=event.pointerId;
    if(touch&&phase!=='down'&&activeTouch.current!==event.pointerId)return;
    if(touch&&phase==='down')activeTouch.current=event.pointerId;
    const element=fromReserve?boardRef.current:event.currentTarget;
    if(!element)return;
    const point=boardPoint(event.clientX,event.clientY,element.getBoundingClientRect());
    if(!point){clear();return;}
    const next:BoardPointer={...point,kind:touch?'touch':'mouse',phase};
    latest.current=next;
    const flush=()=>{pending.current=undefined;lastSent.current=Date.now();sendRef.current?.(latest.current);};
    clearTimeout(pending.current);
    if(phase!=='move'||Date.now()-lastSent.current>=40)flush();
    else pending.current=setTimeout(flush,40-(Date.now()-lastSent.current));
    if(touch&&phase==='up')activeTouch.current=null;
  };
  const reserveEvents={
    onPointerMoveCapture:(e:ReactPointerEvent<HTMLElement>)=>pointer(e,'move',true),
    onPointerUpCapture:(e:ReactPointerEvent<HTMLElement>)=>pointer(e,'up',true),
    onPointerCancelCapture:clear,
  };
  const boardEvents={
    ref:boardRef,
    onPointerMoveCapture:(e:ReactPointerEvent<SVGSVGElement>)=>pointer(e,'move'),
    onPointerDownCapture:(e:ReactPointerEvent<SVGSVGElement>)=>pointer(e,'down'),
    onPointerUpCapture:(e:ReactPointerEvent<SVGSVGElement>)=>pointer(e,'up'),
    onPointerCancel:clear,
    // Touch implicitly leaves the element after pointerup; keep that final dot for its fade.
    onPointerLeave:()=>{if(latest.current?.kind==='touch'&&latest.current.phase==='up')return;clear();},
  };
  return {boardEvents,reserveEvents};
}

export function PeerPointer({presence,width,height}:{presence?:BoardPresence|null;width:number;height:number}) {
  if(!presence?.pointer)return null;
  const {side,pointer:p}=presence,size=width*.014;
  return <g className={'peer-pointer peer-'+side+(p.kind==='touch'&&p.phase==='up'?' peer-released':'')} transform={`translate(${p.x*width} ${p.y*height})`} aria-hidden="true" data-peer-side={side}>
    <g style={{fontSize:size}}>
      {p.kind==='mouse'?<path d={`M0 0 L${size*.18} ${size} L${size*.44} ${size*.66} L${size*.9} ${size*.58} Z`}/>:<circle r={size*.4}/>}
      {p.phase!=='move'&&<circle key={p.phase+'-'+p.x+'-'+p.y} className="peer-ripple" r={size*.65}/>}
      <text x={size} y={size*.9}>{side==='US'?'美国':'苏联'}</text>
    </g>
  </g>;
}
