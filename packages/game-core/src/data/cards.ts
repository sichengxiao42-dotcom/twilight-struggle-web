import type { CardSide, Period } from '@ts/shared';

export interface CardDef {
  /** 豪华版卡牌编号，同时作为 TTS 素材映射的键。 */
  id: number;
  name: string;
  nameZh: string;
  side: CardSide;
  /** 计分牌为 0。 */
  ops: number;
  period: Period;
  /** 带星号：作为事件打出后移出游戏。 */
  starred: boolean;
  scoring?: boolean;
}

// 仅录入元数据（名称/OPS/阵营/时期），不收录卡面文字；事件效果以代码实现。
// 当前只录入早期战争牌，数值需对照实体卡复核。TODO(M4): 中期、后期战争牌。
const card = (
  id: number, name: string, nameZh: string, side: CardSide, ops: number, starred: boolean,
  period: Period = 'EARLY',
): CardDef => ({ id, name, nameZh, side, ops, starred, period });
const scoring = (id: number, name: string, nameZh: string, period: Period = 'EARLY'): CardDef =>
  ({ id, name, nameZh, side: 'NEUTRAL', ops: 0, starred: false, period, scoring: true });

export const CHINA_CARD_ID = 6;

export const CARDS: CardDef[] = [
  scoring(1, 'Asia Scoring', '亚洲计分'),
  scoring(2, 'Europe Scoring', '欧洲计分'),
  scoring(3, 'Middle East Scoring', '中东计分'),
  card(4, 'Duck and Cover', '卧倒掩护', 'US', 3, false),
  card(5, 'Five Year Plan', '五年计划', 'US', 3, false),
  card(CHINA_CARD_ID, 'The China Card', '中国牌', 'NEUTRAL', 4, false),
  card(7, 'Socialist Governments', '社会主义政府', 'USSR', 3, false),
  card(8, 'Fidel', '卡斯特罗', 'USSR', 2, true),
  card(9, 'Vietnam Revolts', '越南起义', 'USSR', 2, true),
  card(10, 'Blockade', '封锁', 'USSR', 1, true),
  card(11, 'Korean War', '朝鲜战争', 'USSR', 2, true),
  card(12, 'Romanian Abdication', '罗马尼亚国王退位', 'USSR', 1, true),
  card(13, 'Arab-Israeli War', '阿以战争', 'USSR', 2, false),
  card(14, 'COMECON', '经互会', 'USSR', 3, true),
  card(15, 'Nasser', '纳赛尔', 'USSR', 1, true),
  card(16, 'Warsaw Pact Formed', '华沙条约组织成立', 'USSR', 3, true),
  card(17, 'De Gaulle Leads France', '戴高乐领导法国', 'USSR', 3, true),
  card(18, 'Captured Nazi Scientist', '俘获纳粹科学家', 'NEUTRAL', 1, true),
  card(19, 'Truman Doctrine', '杜鲁门主义', 'US', 1, true),
  card(20, 'Olympic Games', '奥运会', 'NEUTRAL', 2, false),
  card(21, 'NATO', '北约', 'US', 4, true),
  card(22, 'Independent Reds', '独立的共产党人', 'US', 2, true),
  card(23, 'Marshall Plan', '马歇尔计划', 'US', 4, true),
  card(24, 'Indo-Pakistani War', '印巴战争', 'NEUTRAL', 2, false),
  card(25, 'Containment', '遏制政策', 'US', 3, true),
  card(26, 'CIA Created', '中央情报局成立', 'US', 1, true),
  card(27, 'US/Japan Mutual Defense Pact', '美日安保条约', 'US', 4, true),
  card(28, 'Suez Crisis', '苏伊士运河危机', 'USSR', 3, true),
  card(29, 'East European Unrest', '东欧动乱', 'US', 3, false),
  card(30, 'Decolonization', '去殖民化', 'USSR', 2, false),
  card(31, 'Red Scare/Purge', '红色恐慌/大清洗', 'NEUTRAL', 4, false),
  card(32, 'UN Intervention', '联合国干预', 'NEUTRAL', 1, false),
  card(33, 'De-Stalinization', '去斯大林化', 'USSR', 3, true),
  card(34, 'Nuclear Test Ban', '禁止核试验', 'NEUTRAL', 4, false),
  card(35, 'Formosan Resolution', '台湾决议案', 'US', 2, true),
  card(103, 'Defectors', '叛逃者', 'US', 2, false),
  card(104, 'The Cambridge Five', '剑桥五杰', 'USSR', 2, false),
  card(105, 'Special Relationship', '特殊关系', 'US', 2, false),
  card(106, 'NORAD', '北美防空司令部', 'US', 3, true),
];

export const CARD_BY_ID = new Map(CARDS.map((def) => [def.id, def]));
