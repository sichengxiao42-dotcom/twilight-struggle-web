import type { Side } from '@ts/shared';

/** Keep the Soviet display between the European countries and the printed tracks.
 * Stack only within the reserved decoration area, never toward Iran/Afghanistan. */
export function publicCardSlot(side:Side,stackIndex:number,map=true){
  const offset=Math.min(2,Math.max(0,stackIndex));
  if(!map)return {x:(side==='US'?20:830)+offset*15,y:100+offset*15,width:160,height:265};
  return side==='USSR'
    ? {x:5350+offset*24,y:160+offset*16,width:800,height:1450}
    : {x:140+offset*30,y:680,width:1000,height:1700};
}
