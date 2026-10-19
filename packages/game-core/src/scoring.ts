import { opponent, type Region, type Side } from '@ts/shared';
import { COUNTRIES } from './data/countries';
import { controller } from './rules';
import type { GameState } from './state';
const VALUES: Record<Region, [number, number, number]> = {
  EUROPE: [3,7,0], ASIA: [3,7,9], MIDDLE_EAST: [3,5,7], AFRICA: [1,4,6], CENTRAL_AMERICA: [1,3,5], SOUTH_AMERICA: [2,5,6],
};
export function scoreRegion(state: GameState, region: Region) {
  const countries=COUNTRIES.filter(c=>c.region===region);
  const battleground=(id:string)=>countries.find(c=>c.id===id)!.battleground || (id==='taiwan' && state.effects.formosan && controller(state,id)==='US');
  const total=countries.filter(c=>battleground(c.id)).length;
  const counts=(side:Side)=>{const own=countries.filter(c=>controller(state,c.id)===side);return {countries:own.length,battlegrounds:own.filter(c=>battleground(c.id)).length,normal:own.filter(c=>!battleground(c.id)).length,adjacent:own.filter(c=>c.adjacentTo===opponent(side)).length};};
  const us=counts('US'),ussr=counts('USSR');
  const result=(side:Side)=>{
    const own=side==='US'?us:ussr, enemy=side==='US'?ussr:us;
    const status=own.battlegrounds===total && own.countries>enemy.countries?'CONTROL':own.countries>enemy.countries&&own.battlegrounds>enemy.battlegrounds&&own.normal>0?'DOMINATION':own.countries>0?'PRESENCE':'NONE';
    const base=status==='CONTROL'?VALUES[region][2]:status==='DOMINATION'?VALUES[region][1]:status==='PRESENCE'?VALUES[region][0]:0;
    return {...own,status,points:base+own.battlegrounds+own.adjacent};
  };
  const US=result('US'), USSR=result('USSR');
  return {US,USSR,delta:US.points-USSR.points,winner:(region==='EUROPE'?(US.status==='CONTROL'?'US':USSR.status==='CONTROL'?'USSR':null):null) as Side | null};
}
