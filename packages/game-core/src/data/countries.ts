import type { Region, SubRegion } from '@ts/shared';

export interface Country {
  id: string;
  name: string;
  nameZh: string;
  region: Region;
  subRegions: SubRegion[];
  stability: number;
  battleground: boolean;
  /** 与超级大国相邻（计分时 +1 VP）。 */
  adjacentTo?: 'USSR' | 'US';
}

// 稳定度与战场国按豪华版地图整理，需对照实体规则书复核（见 docs/RULES.md）。
// 国家间连接见 adjacency.ts（棋盘连线，不等同于地理接壤）。
const c = (
  id: string, name: string, nameZh: string, region: Region, stability: number,
  battleground = false, subRegions: SubRegion[] = [], adjacentTo?: 'USSR' | 'US',
): Country => ({ id, name, nameZh, region, subRegions, stability, battleground, adjacentTo });

const W: SubRegion[] = ['WESTERN_EUROPE'];
const E: SubRegion[] = ['EASTERN_EUROPE'];
const WE: SubRegion[] = ['WESTERN_EUROPE', 'EASTERN_EUROPE'];
const SEA: SubRegion[] = ['SOUTHEAST_ASIA'];

export const COUNTRIES: Country[] = [
  // Europe
  c('canada', 'Canada', '加拿大', 'EUROPE', 4, false, W, 'US'),
  c('uk', 'UK', '英国', 'EUROPE', 5, false, W),
  c('norway', 'Norway', '挪威', 'EUROPE', 4, false, W),
  c('sweden', 'Sweden', '瑞典', 'EUROPE', 4, false, W),
  c('denmark', 'Denmark', '丹麦', 'EUROPE', 3, false, W),
  c('benelux', 'Benelux', '比荷卢', 'EUROPE', 3, false, W),
  c('france', 'France', '法国', 'EUROPE', 3, true, W),
  c('spain_portugal', 'Spain/Portugal', '西班牙/葡萄牙', 'EUROPE', 2, false, W),
  c('italy', 'Italy', '意大利', 'EUROPE', 2, true, W),
  c('greece', 'Greece', '希腊', 'EUROPE', 2, false, W),
  c('turkey', 'Turkey', '土耳其', 'EUROPE', 2, false, W),
  c('west_germany', 'West Germany', '西德', 'EUROPE', 4, true, W),
  c('austria', 'Austria', '奥地利', 'EUROPE', 4, false, WE),
  c('finland', 'Finland', '芬兰', 'EUROPE', 4, false, WE, 'USSR'),
  c('east_germany', 'East Germany', '东德', 'EUROPE', 3, true, E),
  c('poland', 'Poland', '波兰', 'EUROPE', 3, true, E, 'USSR'),
  c('czechoslovakia', 'Czechoslovakia', '捷克斯洛伐克', 'EUROPE', 3, false, E),
  c('hungary', 'Hungary', '匈牙利', 'EUROPE', 3, false, E),
  c('yugoslavia', 'Yugoslavia', '南斯拉夫', 'EUROPE', 3, false, E),
  c('romania', 'Romania', '罗马尼亚', 'EUROPE', 3, false, E, 'USSR'),
  c('bulgaria', 'Bulgaria', '保加利亚', 'EUROPE', 3, false, E),
  // Middle East
  c('lebanon', 'Lebanon', '黎巴嫩', 'MIDDLE_EAST', 1),
  c('syria', 'Syria', '叙利亚', 'MIDDLE_EAST', 2),
  c('israel', 'Israel', '以色列', 'MIDDLE_EAST', 4, true),
  c('iraq', 'Iraq', '伊拉克', 'MIDDLE_EAST', 3, true),
  c('iran', 'Iran', '伊朗', 'MIDDLE_EAST', 2, true),
  c('libya', 'Libya', '利比亚', 'MIDDLE_EAST', 2, true),
  c('egypt', 'Egypt', '埃及', 'MIDDLE_EAST', 2, true),
  c('jordan', 'Jordan', '约旦', 'MIDDLE_EAST', 2),
  c('gulf_states', 'Gulf States', '海湾国家', 'MIDDLE_EAST', 3),
  c('saudi_arabia', 'Saudi Arabia', '沙特阿拉伯', 'MIDDLE_EAST', 3, true),
  // Asia
  c('afghanistan', 'Afghanistan', '阿富汗', 'ASIA', 2, false, [], 'USSR'),
  c('pakistan', 'Pakistan', '巴基斯坦', 'ASIA', 2, true),
  c('india', 'India', '印度', 'ASIA', 3, true),
  c('burma', 'Burma', '缅甸', 'ASIA', 2, false, SEA),
  c('laos_cambodia', 'Laos/Cambodia', '老挝/柬埔寨', 'ASIA', 1, false, SEA),
  c('thailand', 'Thailand', '泰国', 'ASIA', 2, true, SEA),
  c('vietnam', 'Vietnam', '越南', 'ASIA', 1, false, SEA),
  c('malaysia', 'Malaysia', '马来西亚', 'ASIA', 2, false, SEA),
  c('indonesia', 'Indonesia', '印度尼西亚', 'ASIA', 1, false, SEA),
  c('philippines', 'Philippines', '菲律宾', 'ASIA', 2, false, SEA),
  c('australia', 'Australia', '澳大利亚', 'ASIA', 4),
  c('japan', 'Japan', '日本', 'ASIA', 4, true, [], 'US'),
  c('taiwan', 'Taiwan', '台湾', 'ASIA', 3),
  c('south_korea', 'South Korea', '韩国', 'ASIA', 3, true),
  c('north_korea', 'North Korea', '朝鲜', 'ASIA', 3, true, [], 'USSR'),
  // Africa
  c('morocco', 'Morocco', '摩洛哥', 'AFRICA', 3),
  c('algeria', 'Algeria', '阿尔及利亚', 'AFRICA', 2, true),
  c('tunisia', 'Tunisia', '突尼斯', 'AFRICA', 2),
  c('west_african_states', 'West African States', '西非国家', 'AFRICA', 2),
  c('ivory_coast', 'Ivory Coast', '科特迪瓦', 'AFRICA', 2),
  c('saharan_states', 'Saharan States', '撒哈拉国家', 'AFRICA', 1),
  c('nigeria', 'Nigeria', '尼日利亚', 'AFRICA', 1, true),
  c('cameroon', 'Cameroon', '喀麦隆', 'AFRICA', 1),
  c('zaire', 'Zaire', '扎伊尔', 'AFRICA', 1, true),
  c('angola', 'Angola', '安哥拉', 'AFRICA', 1, true),
  c('south_africa', 'South Africa', '南非', 'AFRICA', 3, true),
  c('botswana', 'Botswana', '博茨瓦纳', 'AFRICA', 2),
  c('zimbabwe', 'Zimbabwe', '津巴布韦', 'AFRICA', 1),
  c('se_african_states', 'SE African States', '东南非国家', 'AFRICA', 1),
  c('kenya', 'Kenya', '肯尼亚', 'AFRICA', 2),
  c('somalia', 'Somalia', '索马里', 'AFRICA', 2),
  c('ethiopia', 'Ethiopia', '埃塞俄比亚', 'AFRICA', 1),
  c('sudan', 'Sudan', '苏丹', 'AFRICA', 1),
  // Central America
  c('mexico', 'Mexico', '墨西哥', 'CENTRAL_AMERICA', 2, true, [], 'US'),
  c('guatemala', 'Guatemala', '危地马拉', 'CENTRAL_AMERICA', 1),
  c('el_salvador', 'El Salvador', '萨尔瓦多', 'CENTRAL_AMERICA', 1),
  c('honduras', 'Honduras', '洪都拉斯', 'CENTRAL_AMERICA', 2),
  c('costa_rica', 'Costa Rica', '哥斯达黎加', 'CENTRAL_AMERICA', 3),
  c('panama', 'Panama', '巴拿马', 'CENTRAL_AMERICA', 2, true),
  c('nicaragua', 'Nicaragua', '尼加拉瓜', 'CENTRAL_AMERICA', 1),
  c('cuba', 'Cuba', '古巴', 'CENTRAL_AMERICA', 3, true, [], 'US'),
  c('haiti', 'Haiti', '海地', 'CENTRAL_AMERICA', 1),
  c('dominican_rep', 'Dominican Rep', '多米尼加', 'CENTRAL_AMERICA', 1),
  // South America
  c('venezuela', 'Venezuela', '委内瑞拉', 'SOUTH_AMERICA', 2, true),
  c('colombia', 'Colombia', '哥伦比亚', 'SOUTH_AMERICA', 1),
  c('ecuador', 'Ecuador', '厄瓜多尔', 'SOUTH_AMERICA', 2),
  c('peru', 'Peru', '秘鲁', 'SOUTH_AMERICA', 2),
  c('brazil', 'Brazil', '巴西', 'SOUTH_AMERICA', 2, true),
  c('bolivia', 'Bolivia', '玻利维亚', 'SOUTH_AMERICA', 2),
  c('paraguay', 'Paraguay', '巴拉圭', 'SOUTH_AMERICA', 2),
  c('chile', 'Chile', '智利', 'SOUTH_AMERICA', 3, true),
  c('argentina', 'Argentina', '阿根廷', 'SOUTH_AMERICA', 2, true),
  c('uruguay', 'Uruguay', '乌拉圭', 'SOUTH_AMERICA', 2),
];

export const COUNTRY_BY_ID = new Map(COUNTRIES.map((country) => [country.id, country]));
