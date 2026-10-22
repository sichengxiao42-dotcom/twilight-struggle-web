import type { BoardPointer } from '@ts/shared';

export function validPointer(value:unknown):value is BoardPointer|null {
  if(value===null)return true;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const p=value as Record<string,unknown>;
  return Object.keys(p).length===4&&Object.keys(p).every(k=>['x','y','kind','phase'].includes(k))&&
    typeof p.x==='number'&&Number.isFinite(p.x)&&p.x>=0&&p.x<=1&&
    typeof p.y==='number'&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1&&
    (p.kind==='mouse'||p.kind==='touch')&&['move','down','up'].includes(p.phase as string);
}
