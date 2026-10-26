import type { Side } from '@ts/shared';
import { BOX_HEIGHT, BOX_WIDTH, MAP_POSITIONS, MAP_WIDTH } from './mapPositions';

/** Where board effects leave from: the "U.S.S.R." and "U.S.A." titles printed on the map. */
export const ORIGIN: Record<Side, [number, number]> = { USSR: [5400, 1180], US: [960, 2010] };

export const countryCentre = (country: string): [number, number] => [MAP_POSITIONS[country][0] + BOX_WIDTH / 2, MAP_POSITIONS[country][1] + BOX_HEIGHT / 2];

/** Upward-bowed quadratic flight path from a superpower to a country, with the arrival heading in degrees. */
export function arc(side: Side, country: string, bendRatio = 0.28) {
  const [ox, oy] = ORIGIN[side], [tx, ty] = countryCentre(country);
  const dx = tx - ox, dy = ty - oy, length = Math.hypot(dx, dy) || 1, bend = Math.min(1100, length * bendRatio);
  let cx = (ox + tx) / 2 - dy / length * bend, cy = (oy + ty) / 2 + dx / length * bend;
  if (cy > (oy + ty) / 2) { cx = (ox + tx) - cx; cy = (oy + ty) - cy; }
  return { d: `M${ox},${oy} Q${cx},${cy} ${tx},${ty}`, tx, ty, angle: Math.atan2(ty - cy, tx - cx) * 180 / Math.PI };
}

/** Keep a label of the given width inside the map horizontally. */
export const clampX = (x: number, width: number) => Math.min(MAP_WIDTH - width / 2 - 40, Math.max(width / 2 + 40, x));

/**
 * Highest effect id already shown per game and effect kind. Lives outside the board so an undo
 * remount or a page refresh never replays an old effect: the first sighting only records the id.
 */
const shown = new Map<string, number>();
export function isNewEffect(scope: string, id: number) {
  const seen = shown.get(scope);
  shown.set(scope, id);
  return seen !== undefined && id > seen;
}
