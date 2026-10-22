import { CARD_BY_ID, EVENT_SUMMARIES, REGION_NAMES, type Effects } from '@ts/game-core';
import type { Region } from '@ts/shared';

// Each public flag points to the same event explanation used by the card chooser.
export const EFFECT_CARDS = {
  containment:25, vietnam:9, cia:26, nato:21, warsaw:16, marshall:23,
  deGaulle:17, japan:27, formosan:35, norad:106, cmc:40, nuclearSubs:41,
  salt:43, brezhnev:51, u2:60, iranContra:93, yuri:109, aldrich:98,
  deathSquads:69, chernobyl:94, northSeaRound:86, quagmire:42, bearTrap:44,
  missileEnvy:49, buryYou:50, shuttle:73, flowerPower:59, evilEmpire:97,
  iranianHostage:82, ironLady:83, northSeaOil:86, reformer:87, campDavid:65,
  johnPaul:68, awacs:110, tearDown:96, willyBrandt:55,
} satisfies Record<Exclude<keyof Effects, 'purge'>, number>;

export interface OngoingEffect { id:string; label:string; description:string }
export function ongoingEffects(effects:Effects):OngoingEffect[] {
  const sides = {US:'美国', USSR:'苏联'};
  const list:OngoingEffect[] = [];
  for (const side of ['USSR','US'] as const) if(effects.purge[side]) {
    list.push({id:'purge-'+side,label:'大清洗/红色恐慌（'+sides[side]+' OPS −1）',description:EVENT_SUMMARIES[31]});
  }
  for (const [key,cardId] of Object.entries(EFFECT_CARDS) as [Exclude<keyof Effects,'purge'>,number][]) {
    const value=effects[key];
    if(!value) continue;
    const context=key==='chernobyl'?'（'+REGION_NAMES[value as Region]+'）':value==='US'||value==='USSR'?'（'+sides[value]+'）':'';
    const name=key==='northSeaRound'?'北海油田第 8 轮':CARD_BY_ID.get(cardId)!.nameZh;
    list.push({id:key,label:name+context,description:EVENT_SUMMARIES[cardId]});
  }
  return list;
}
