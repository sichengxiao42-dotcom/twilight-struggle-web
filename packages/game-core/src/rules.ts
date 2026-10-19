import type { Region, Side } from '@ts/shared';
import { opponent } from '@ts/shared';
import { COUNTRY_BY_ID } from './data/countries';
import type { GameState } from './state';

/** 控制：己方影响力 ≥ 稳定度，且领先对手至少稳定度的点数。 */
export function controller(state: GameState, countryId: string): Side | null {
  const country = COUNTRY_BY_ID.get(countryId);
  if (!country) throw new Error(`Unknown country ${countryId}`);
  const inf = state.influence[countryId];
  for (const side of ['USSR', 'US'] as const) {
    if (inf[side] >= country.stability && inf[side] - inf[opponent(side)] >= country.stability) return side;
  }
  return null;
}

/** 放置影响力的单价：对手控制的国家每点 2 OPS，否则 1 OPS。 */
export function placementCost(state: GameState, countryId: string, side: Side): number {
  return controller(state, countryId) === opponent(side) ? 2 : 1;
}

/** DEFCON 对政变/调整的地区限制：5 无限制，4 禁欧洲，3 再禁亚洲，2 再禁中东。 */
export function isRegionRestrictedByDefcon(defcon: number, region: Region): boolean {
  if (region === 'EUROPE') return defcon <= 4;
  if (region === 'ASIA') return defcon <= 3;
  if (region === 'MIDDLE_EAST') return defcon <= 2;
  return false;
}

/** 政变：骰点 + OPS − 2×稳定度，>0 时先移除对手影响力，余数加己方影响力。 */
export function coupResult(roll: number, ops: number, stability: number): number {
  return Math.max(0, roll + ops - 2 * stability);
}

export function actionRoundsForTurn(turn: number): number {
  return turn <= 3 ? 6 : 7;
}

export function handSizeForTurn(turn: number): number {
  return turn <= 3 ? 8 : 9;
}

/** VP 达到 ±20 立即获胜（正数美国，负数苏联）。 */
export function vpWinner(vp: number): Side | null {
  if (vp >= 20) return 'US';
  if (vp <= -20) return 'USSR';
  return null;
}
