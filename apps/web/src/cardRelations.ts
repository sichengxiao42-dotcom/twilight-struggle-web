/** Explicit rule relationships, independent of hands and the secret draw pile. */
export const CARD_RELATIONS = [
  { from:16, to:21, text:'华沙条约或马歇尔计划任一生效后，即可触发北约事件。' },
  { from:23, to:21, text:'马歇尔计划或华沙条约任一生效后，即可触发北约事件。' },
  { from:17, to:21, text:'戴高乐生效后，法国不再受到北约保护。' },
  { from:55, to:21, text:'维利·勃兰特生效后，西德不再受到北约保护。' },
  { from:21, to:105, text:'北约生效后，特殊关系的影响力与得分效果增强。' },
  { from:68, to:101, text:'约翰·保罗二世生效后，才可触发团结工会事件。' },
  { from:65, to:13, text:'戴维营协议生效后，阿以战争事件不能生效。' },
  { from:83, to:7, text:'铁娘子生效后，社会主义政府事件不能生效。' },
  { from:86, to:61, text:'北海油田生效后，OPEC 事件不能生效。' },
  { from:110, to:56, text:'向沙特出售预警机生效后，穆斯林革命事件不能生效。' },
  { from:96, to:55, text:'推倒这堵墙取消维利·勃兰特，并禁止其事件再次生效。' },
  { from:97, to:59, text:'邪恶帝国取消花朵力量，并禁止其事件再次生效。' },
  { from:87, to:90, text:'改革家生效后，开放政策额外提供 4 OPS 的放置或调整行动。' },
  { from:82, to:92, text:'伊朗人质危机生效后，苏联触发恐怖主义时，美国弃两张牌。' },
  { from:6, to:35, text:'美国使用中国牌后，取消台湾决议案的效果。' },
] as const;

export function relatedCards(id:number) {
  return CARD_RELATIONS.filter(r=>r.from===id||r.to===id).map(r=>({id:r.from===id?r.to:r.from,text:r.text}));
}

