import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { parseDrop, type Drop, type Piece } from './pieceMoves';

interface Drag { piece: Piece; x: number; y: number; startX: number; startY: number; pointer: number; moved: boolean }
export function usePieceDrag(revision: unknown, onDrop: (piece: Piece, drop: Drop | null, point: {x:number;y:number}) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const current = useRef<Drag | null>(null);
  const suppress = useRef(0);
  const invalidatedPointer = useRef<number | null>(null);
  useEffect(() => {
    if (current.current) { invalidatedPointer.current=current.current.pointer; suppress.current=Infinity; }
    current.current = null; setDrag(null);
  }, [revision]);
  const bindings = (piece: Piece) => ({
    'data-dragging': drag && JSON.stringify(drag.piece) === JSON.stringify(piece) ? 'true' : undefined,
    onPointerDown: (e: ReactPointerEvent<SVGElement | HTMLElement>) => {
      if (e.button !== 0) return;
      invalidatedPointer.current=null;
      if (suppress.current===Infinity) suppress.current=Date.now()+350;
      e.preventDefault(); e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current = {piece, x:e.clientX, y:e.clientY, startX:e.clientX, startY:e.clientY, pointer:e.pointerId, moved:false};
    },
    onPointerMove: (e: ReactPointerEvent<SVGElement | HTMLElement>) => {
      const active = current.current;
      if (!active || active.pointer !== e.pointerId) return;
      const next = {...active, x:e.clientX, y:e.clientY, moved:active.moved || Math.hypot(e.clientX-active.startX,e.clientY-active.startY)>5};
      current.current = next;
      if (next.moved) { e.preventDefault(); setDrag(next); }
    },
    onPointerUp: (e: ReactPointerEvent<SVGElement | HTMLElement>) => {
      if (invalidatedPointer.current===e.pointerId) {
        invalidatedPointer.current=null; suppress.current=Date.now()+350;
        e.preventDefault(); e.stopPropagation(); return;
      }
      const active = current.current;
      if (!active || active.pointer !== e.pointerId) return;
      current.current=null; setDrag(null);
      if (active.moved) {
        suppress.current=Date.now()+350;
        e.preventDefault(); e.stopPropagation();
        onDrop(active.piece,parseDrop(document.elementFromPoint(e.clientX,e.clientY)),{x:e.clientX,y:e.clientY});
      }
    },
    onPointerCancel: () => { current.current=null; invalidatedPointer.current=null; setDrag(null); suppress.current=Date.now()+350; },
  });
  return { drag, bindings, suppressClick:()=>Date.now()<suppress.current };
}
