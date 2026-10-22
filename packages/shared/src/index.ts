export type Side = 'USSR' | 'US';
/** Ephemeral public-board coordinates; never part of the game state or action log. */
export interface BoardPointer { x:number; y:number; kind:'mouse'|'touch'; phase:'move'|'down'|'up' }
export interface BoardPresence { roomId:string; side:Side; pointer:BoardPointer|null }
export type CardSide = Side | 'NEUTRAL';
export type Period = 'EARLY' | 'MID' | 'LATE';
export type Region = 'EUROPE' | 'ASIA' | 'MIDDLE_EAST' | 'AFRICA' | 'CENTRAL_AMERICA' | 'SOUTH_AMERICA';
export type SubRegion = 'EASTERN_EUROPE' | 'WESTERN_EUROPE' | 'SOUTHEAST_ASIA';

export const opponent = (side: Side): Side => (side === 'USSR' ? 'US' : 'USSR');

export interface SeatStatus { occupied: boolean; connected: boolean; mine: boolean; bot?: boolean }
export interface RoomSnapshot {
  /** side is null until this member sits down in the lobby; view is null throughout the lobby, including after choosing a side. */
  roomId: string; side: Side | null; started: boolean; members: number; revision: number;
  isHost?: boolean;
  botError?: string;
  canUndo?: boolean; undoVersion?: number;
  undoPlacement?: {country:string;side:Side};
  seats: Record<Side,SeatStatus>;
  // The concrete PlayerView is defined by game-core, which depends on this package.
  view: unknown | null;
}
export type Reply<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
/** Room membership; the side is chosen separately in the lobby. */
export interface Session { roomId: string; token: string }
export type SeatChoice = Side | 'RANDOM' | null;
export interface ServerToClient {
  pointer: (presence:BoardPresence) => void;
  closed: (message: {roomId:string;reason:string}) => void;
  state: (snapshot: RoomSnapshot) => void;
  error: (message: string) => void;
}
export interface ClientToServer {
  pointer: (pointer:BoardPointer|null) => void;
  bot: (request: {enabled:boolean}, ack: (reply: Reply<{revision:number}>) => void) => void;
  botRetry: (request: Record<string,never>, ack: (reply: Reply<{revision:number}>) => void) => void;
  restart: (request: {expectedRevision:number}, ack: (reply: Reply<{revision:number}>) => void) => void;
  close: (request: Record<string,never>, ack: (reply: Reply) => void) => void;
  create: (request: Record<string, never>, ack: (reply: Reply<Session>) => void) => void;
  join: (request: { roomId: string; token?: string }, ack: (reply: Reply<Session>) => void) => void;
  seat: (request: { side: SeatChoice }, ack: (reply: Reply<{ revision: number }>) => void) => void;
  start: (request: Record<string, never>, ack: (reply: Reply<{ revision: number }>) => void) => void;
  action: (request: { id: string; expectedRevision: number; action: unknown }, ack: (reply: Reply<{ revision: number }>) => void) => void;
}
