import type { Session } from '@ts/shared';
export const SESSION_KEY='twilight-room-session';
const ROOMS_KEY='twilight-room-identities';
const valid=(value:unknown):value is Session=>Boolean(value&&typeof value==='object'&&'roomId' in value&&typeof value.roomId==='string'&&'token' in value&&typeof value.token==='string');
export function readSession(tab:Storage,persistent:Storage,roomId?:string):Session|null {
  try {
    const current=JSON.parse(tab.getItem(SESSION_KEY)??'null');
    if(valid(current)&&(!roomId||current.roomId===roomId))return current;
    if(roomId){const rooms=JSON.parse(persistent.getItem(ROOMS_KEY)??'{}');const entry=rooms[roomId];return valid(entry)?entry:null;}
    const last=JSON.parse(persistent.getItem(SESSION_KEY)??'null');return valid(last)?last:null;
  }catch{return null;}
}
export function writeSession(tab:Storage,persistent:Storage,session:Session) {
  tab.setItem(SESSION_KEY,JSON.stringify(session));
  const rooms=JSON.parse(persistent.getItem(ROOMS_KEY)??'{}');rooms[session.roomId]=session;
  persistent.setItem(ROOMS_KEY,JSON.stringify(rooms));persistent.setItem(SESSION_KEY,JSON.stringify(session));
}
export function forgetSession(tab:Storage,persistent:Storage,roomId:string) {
  for(const storage of [tab,persistent]){
    const value=JSON.parse(storage.getItem(SESSION_KEY)??'null');
    if(valid(value)&&value.roomId===roomId)storage.removeItem(SESSION_KEY);
  }
  const rooms=JSON.parse(persistent.getItem(ROOMS_KEY)??'{}');delete rooms[roomId];persistent.setItem(ROOMS_KEY,JSON.stringify(rooms));
}
