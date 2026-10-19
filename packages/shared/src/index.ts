export type Side = 'USSR' | 'US';
export type CardSide = Side | 'NEUTRAL';
export type Period = 'EARLY' | 'MID' | 'LATE';
export type Region = 'EUROPE' | 'ASIA' | 'MIDDLE_EAST' | 'AFRICA' | 'CENTRAL_AMERICA' | 'SOUTH_AMERICA';
export type SubRegion = 'EASTERN_EUROPE' | 'WESTERN_EUROPE' | 'SOUTHEAST_ASIA';

export const opponent = (side: Side): Side => (side === 'USSR' ? 'US' : 'USSR');

/** Socket events shared by web and server. */
export interface ServerToClient {
  state: (view: unknown) => void;
  error: (message: string) => void;
}
export interface ClientToServer {
  join: (roomId: string, side: Side) => void;
  action: (action: unknown) => void;
}
