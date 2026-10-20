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
// 豪华版 #1–110 全部录入；编号、OPS、阵营、星号已对照中文模组卡图核对。
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
  // Mid War (turn 4+), checked against the Chinese card art: number, OPS, side, asterisk.
  card(36, 'Brush War', '局部战争', 'NEUTRAL', 3, false, 'MID'),
  scoring(37, 'Central America Scoring', '中美洲计分', 'MID'),
  { ...scoring(38, 'Southeast Asia Scoring', '东南亚计分', 'MID'), starred: true },
  card(39, 'Arms Race', '军备竞赛', 'NEUTRAL', 3, false, 'MID'),
  card(40, 'Cuban Missile Crisis', '古巴导弹危机', 'NEUTRAL', 3, true, 'MID'),
  card(41, 'Nuclear Subs', '核潜艇', 'US', 2, true, 'MID'),
  card(42, 'Quagmire', '泥潭', 'USSR', 3, true, 'MID'),
  card(43, 'SALT Negotiations', '战略武器限制谈判', 'NEUTRAL', 3, true, 'MID'),
  card(44, 'Bear Trap', '捕熊陷阱', 'US', 3, true, 'MID'),
  card(45, 'Summit', '首脑峰会', 'NEUTRAL', 1, false, 'MID'),
  card(46, 'How I Learned to Stop Worrying', '我如何学会不再担忧', 'NEUTRAL', 2, true, 'MID'),
  card(47, 'Junta', '军政府', 'NEUTRAL', 2, false, 'MID'),
  card(48, 'Kitchen Debates', '厨房辩论', 'US', 1, true, 'MID'),
  card(49, 'Missile Envy', '导弹嫉妒', 'NEUTRAL', 2, false, 'MID'),
  card(50, '"We Will Bury You"', '“我们会埋葬你们”', 'USSR', 4, true, 'MID'),
  card(51, 'Brezhnev Doctrine', '勃列日涅夫主义', 'USSR', 3, true, 'MID'),
  card(52, 'Portuguese Empire Crumbles', '葡萄牙帝国崩溃', 'USSR', 2, true, 'MID'),
  card(53, 'South African Unrest', '南非动荡', 'USSR', 2, false, 'MID'),
  card(54, 'Allende', '阿连德', 'USSR', 1, true, 'MID'),
  card(55, 'Willy Brandt', '维利·勃兰特', 'USSR', 2, true, 'MID'),
  card(56, 'Muslim Revolution', '穆斯林革命', 'USSR', 4, false, 'MID'),
  card(57, 'ABM Treaty', '反弹道导弹条约', 'NEUTRAL', 4, false, 'MID'),
  card(58, 'Cultural Revolution', '文化大革命', 'USSR', 3, true, 'MID'),
  card(59, 'Flower Power', '花朵力量', 'USSR', 4, true, 'MID'),
  card(60, 'U2 Incident', 'U-2 击坠事件', 'USSR', 3, true, 'MID'),
  card(61, 'OPEC', '石油输出国组织', 'USSR', 3, false, 'MID'),
  card(62, '"Lone Gunman"', '“孤胆枪手”', 'USSR', 1, true, 'MID'),
  card(63, 'Colonial Rear Guards', '殖民地殿后部队', 'US', 2, false, 'MID'),
  card(64, 'Panama Canal Returned', '归还巴拿马运河', 'US', 1, true, 'MID'),
  card(65, 'Camp David Accords', '戴维营协议', 'US', 2, true, 'MID'),
  card(66, 'Puppet Governments', '傀儡政府', 'US', 2, true, 'MID'),
  card(67, 'Grain Sales to Soviets', '向苏联出售谷物', 'US', 2, false, 'MID'),
  card(68, 'John Paul II Elected Pope', '约翰·保罗二世当选教皇', 'US', 2, true, 'MID'),
  card(69, 'Latin American Death Squads', '拉丁美洲敢死队', 'NEUTRAL', 2, false, 'MID'),
  card(70, 'OAS Founded', '美洲国家组织成立', 'US', 1, true, 'MID'),
  card(71, 'Nixon Plays the China Card', '尼克松打出中国牌', 'US', 2, true, 'MID'),
  card(72, 'Sadat Expels Soviets', '萨达特驱逐苏联', 'US', 1, true, 'MID'),
  card(73, 'Shuttle Diplomacy', '穿梭外交', 'US', 3, false, 'MID'),
  card(74, 'The Voice of America', '美国之音', 'US', 2, false, 'MID'),
  card(75, 'Liberation Theology', '解放神学', 'USSR', 2, false, 'MID'),
  card(76, 'Ussuri River Skirmish', '乌苏里江冲突', 'US', 3, true, 'MID'),
  card(77, 'Ask Not What Your Country Can Do For You', '“不要问你的国家能为你做什么”', 'US', 3, true, 'MID'),
  card(78, 'Alliance for Progress', '美洲进步同盟', 'US', 3, true, 'MID'),
  scoring(79, 'Africa Scoring', '非洲计分', 'MID'),
  card(80, '"One Small Step..."', '“一小步…”', 'NEUTRAL', 2, false, 'MID'),
  scoring(81, 'South America Scoring', '南美洲计分', 'MID'),
  card(107, 'Che', '切·格瓦拉', 'USSR', 3, false, 'MID'),
  card(108, 'Our Man in Tehran', '我们的人在德黑兰', 'US', 2, true, 'MID'),
  // Late War (turn 8+).
  card(82, 'Iranian Hostage Crisis', '伊朗人质危机', 'USSR', 3, true, 'LATE'),
  card(83, 'The Iron Lady', '铁娘子', 'US', 3, true, 'LATE'),
  card(84, 'Reagan Bombs Libya', '里根轰炸利比亚', 'US', 2, true, 'LATE'),
  card(85, 'Star Wars', '星球大战', 'US', 2, true, 'LATE'),
  card(86, 'North Sea Oil', '北海油田', 'US', 3, true, 'LATE'),
  card(87, 'The Reformer', '改革家', 'USSR', 3, true, 'LATE'),
  card(88, 'Marine Barracks Bombing', '贝鲁特军营炸弹袭击', 'USSR', 2, true, 'LATE'),
  card(89, 'Soviets Shoot Down KAL-007', '苏联击落大韩航空007号班机', 'US', 4, true, 'LATE'),
  card(90, 'Glasnost', '开放政策', 'USSR', 4, true, 'LATE'),
  card(91, 'Ortega Elected in Nicaragua', '奥尔特加当选尼加拉瓜总统', 'USSR', 2, true, 'LATE'),
  card(92, 'Terrorism', '恐怖主义', 'NEUTRAL', 2, true, 'LATE'),
  card(93, 'Iran-Contra Scandal', '伊朗门丑闻', 'USSR', 2, true, 'LATE'),
  card(94, 'Chernobyl', '切尔诺贝利', 'US', 3, true, 'LATE'),
  card(95, 'Latin American Debt Crisis', '拉丁美洲债务危机', 'USSR', 2, true, 'LATE'),
  card(96, 'Tear Down This Wall', '推倒这堵墙', 'US', 3, true, 'LATE'),
  card(97, '"An Evil Empire"', '“邪恶帝国”', 'US', 3, true, 'LATE'),
  card(98, 'Aldrich Ames Remix', '奥德里奇·艾姆斯', 'USSR', 3, true, 'LATE'),
  card(99, 'Pershing II Deployed', '部署潘兴 II 型导弹', 'USSR', 3, true, 'LATE'),
  card(100, 'Wargames', '战争游戏', 'NEUTRAL', 4, true, 'LATE'),
  card(101, 'Solidarity', '团结工会', 'US', 2, true, 'LATE'),
  card(102, 'Iran-Iraq War', '伊朗-伊拉克战争', 'NEUTRAL', 2, true, 'LATE'),
  card(109, 'Yuri and Samantha', '尤里和萨曼莎', 'USSR', 2, true, 'LATE'),
  card(110, 'AWACS Sale to Saudis', '向沙特出售预警机', 'US', 3, true, 'LATE'),
];

export const WAR_CARDS = [11, 13, 24, 36, 102];

export const CARD_BY_ID = new Map(CARDS.map((def) => [def.id, def]));
