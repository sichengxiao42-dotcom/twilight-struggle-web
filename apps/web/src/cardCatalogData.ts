import { CARDS } from '@ts/game-core';
import type { Period } from '@ts/shared';

export const CATALOG_PERIODS:{id:Period;title:string}[]=[
  {id:'EARLY',title:'冷战早期'}, {id:'MID',title:'冷战中期'}, {id:'LATE',title:'冷战晚期'},
];
export const CATALOG_GROUPS=CATALOG_PERIODS.map(period=>({
  ...period,cards:CARDS.filter(card=>card.period===period.id).sort((a,b)=>a.id-b.id),
}));
