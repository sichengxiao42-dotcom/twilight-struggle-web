export type Side = 'USSR' | 'US';
export type CardSide = Side | 'NEUTRAL';
export type Period = 'EARLY' | 'MID' | 'LATE';
export type Region = 'EUROPE' | 'ASIA' | 'MIDDLE_EAST' | 'AFRICA' | 'CENTRAL_AMERICA' | 'SOUTH_AMERICA';
export type SubRegion = 'EASTERN_EUROPE' | 'WESTERN_EUROPE' | 'SOUTHEAST_ASIA';

export const opponent = (side: Side): Side => (side === 'USSR' ? 'US' : 'USSR');

export interface SeatStatus { occupied: boolean; connected: boolean }
export interface RoomSnapshot {
  roomId: string; side: Side; revision: number;
  canUndo?: boolean; undoVersion?: number;
  undoPlacement?: {country:string;side:Side};
  seats: Record<Side,SeatStatus>;
  // The concrete PlayerView is defined by game-core, which depends on this package.
  view: unknown;
}
export type Reply<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export interface Session { roomId: string; side: Side; token: string }
export interface ServerToClient {
  state: (snapshot: RoomSnapshot) => void;
  error: (message: string) => void;
}
export interface ClientToServer {
  create: (request: { side: Side }, ack: (reply: Reply<Session>) => void) => void;
  join: (request: { roomId: string; side: Side; token?: string }, ack: (reply: Reply<Session>) => void) => void;
  action: (request: { id: string; expectedRevision: number; action: unknown }, ack: (reply: Reply<{ revision: number }>) => void) => void;
}
