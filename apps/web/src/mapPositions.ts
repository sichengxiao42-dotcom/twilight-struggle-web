/** 中文地图原图（assets/tts-manifest.json 的 board，9182×5940）的像素坐标系；网页缩小图按同一 viewBox 拉伸。 */
export const MAP_WIDTH = 9182;
export const MAP_HEIGHT = 5940;
/** 国家格（含顶部国名栏）的尺寸；国名栏下方左半格放美国影响力，右半格放苏联。 */
export const BOX_WIDTH = 357;
export const BOX_HEIGHT = 235;
export const BOX_HEADER = 60;

/** 每个国家格左上角的原图像素坐标，按地图截图逐个对位。 */
export const MAP_POSITIONS: Record<string, [number, number]> = {
  canada: [1515, 1291],
  uk: [3040, 969],
  norway: [3479, 439],
  sweden: [4020, 673],
  denmark: [3561, 714],
  finland: [4540, 454],
  benelux: [3341, 1245],
  west_germany: [3744, 1245],
  east_germany: [3887, 979],
  poland: [4295, 979],
  czechoslovakia: [4214, 1245],
  france: [3275, 1566],
  austria: [3907, 1520],
  hungary: [4295, 1520],
  romania: [4703, 1520],
  spain_portugal: [2989, 1949],
  italy: [3805, 1796],
  yugoslavia: [4214, 1796],
  bulgaria: [4622, 1796],
  greece: [4295, 2091],
  turkey: [4999, 1836],
  lebanon: [4775, 2107],
  syria: [5183, 2107],
  israel: [4713, 2377],
  iraq: [5173, 2377],
  iran: [5560, 2377],
  libya: [4122, 2617],
  egypt: [4530, 2653],
  jordan: [4979, 2653],
  gulf_states: [5453, 2642],
  saudi_arabia: [5315, 2913],
  afghanistan: [6030, 2199],
  pakistan: [6030, 2545],
  india: [6468, 2734],
  burma: [6948, 2785],
  laos_cambodia: [7335, 2826],
  thailand: [7172, 3107],
  vietnam: [7570, 3107],
  malaysia: [7356, 3525],
  indonesia: [8019, 3856],
  philippines: [8141, 3096],
  australia: [8019, 4331],
  japan: [8468, 2362],
  taiwan: [7988, 2683],
  south_korea: [8141, 2102],
  north_korea: [8080, 1831],
  morocco: [3091, 2459],
  algeria: [3499, 2336],
  tunisia: [3907, 2301],
  west_african_states: [3050, 2811],
  ivory_coast: [3306, 3331],
  saharan_states: [3663, 2908],
  nigeria: [3816, 3290],
  cameroon: [3989, 3601],
  zaire: [4458, 3734],
  angola: [4111, 4060],
  south_africa: [4275, 4780],
  botswana: [4458, 4479],
  zimbabwe: [4581, 4198],
  se_african_states: [4989, 3989],
  kenya: [4907, 3622],
  somalia: [5326, 3382],
  ethiopia: [4887, 3260],
  sudan: [4601, 2979],
  mexico: [316, 2403],
  guatemala: [663, 2688],
  el_salvador: [531, 2979],
  honduras: [928, 2959],
  costa_rica: [898, 3234],
  panama: [1336, 3224],
  nicaragua: [1336, 2959],
  cuba: [1357, 2607],
  haiti: [1745, 2852],
  dominican_rep: [2132, 2852],
  venezuela: [1816, 3265],
  colombia: [1581, 3561],
  ecuador: [1173, 3678],
  peru: [1408, 3979],
  brazil: [2500, 3958],
  bolivia: [1816, 4234],
  paraguay: [2040, 4530],
  chile: [1592, 4560],
  argentina: [1724, 5086],
  uruguay: [2163, 4872],
};

type Point = [number, number];
/** 轨道标记的半径（原图像素），比最小的行动轮格（约 188 宽）略小。 */
export const TRACK_MARKER_RADIUS = 72;
/** 以下为各轨道格中心点的原图像素坐标，按格子边框的像素扫描量出。下标 0 对应轨道上的第一格。 */
/** 回合记录条：第 1–10 回合。 */
export const TURN_TRACK: Point[] = [6373, 6650, 6930, 7208, 7487, 7766, 8045, 8325, 8603, 8882].map(x => [x, 399]);
/** 行动轮：第 1–8 轮。 */
export const ACTION_ROUND_TRACK: Point[] = [1753, 1964, 2175, 2386, 2597, 2808, 3019, 3231].map(x => [x, 465]);
/** 太空竞赛：0（起点）–8（空间站）。 */
export const SPACE_TRACK: Point[] = [6372, 6685, 6991, 7296, 7603, 7907, 8214, 8519, 8825].map(x => [x, 1055]);
/** 核威胁戒备状态：从左到右为 DEFCON 5–1。 */
export const DEFCON_TRACK: Record<number, Point> = { 5: [2856, 4776], 4: [3137, 4776], 3: [3418, 4776], 2: [3700, 4776], 1: [3980, 4776] };
/** 军事需求：0–5。 */
export const MIL_OPS_TRACK: Point[] = [2857, 3138, 3419, 3700, 3981, 4265].map(x => [x, 5415]);
/** 胜利分轨道：照地图印刷排成 5 行 9 列，负数为苏联、正数为美国；跨格的 0 与 ±20 取所占格的中点。 */
const VP_COLUMNS = [5569, 5810, 6051, 6292, 6533, 6775, 7015, 7257, 7498];
const VP_ROWS = [4541, 4793, 5047, 5301, 5554];
const VP_GRID = [
  [-20, -20, -19, -18, -17, -16, -15, -14, -13],
  [-12, -11, -10, -9, -8, -7, -6, -5, -4],
  [-3, -2, -1, 0, 0, 0, 1, 2, 3],
  [4, 5, 6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19, 20, 20],
];
export const VP_TRACK: Record<number, Point> = Object.fromEntries([...new Set(VP_GRID.flat())].map(vp => {
  const cells = VP_GRID.flatMap((row, r) => row.flatMap((v, c) => v === vp ? [[VP_COLUMNS[c], VP_ROWS[r]]] : []));
  return [vp, [cells.reduce((s, p) => s + p[0], 0) / cells.length, cells.reduce((s, p) => s + p[1], 0) / cells.length]];
}));
