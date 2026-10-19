import { createHash, randomBytes, randomInt } from 'node:crypto';
import { apply, CARD_BY_ID, COUNTRY_BY_ID, createGame, viewFor, type Action, type GameState } from '@ts/game-core';
import type { RoomSnapshot, Session, Side } from '@ts/shared';
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const isSide=(value:unknown):value is Side=>value==='US'||value==='USSR';
export function parseAction(value:unknown):Action {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('无效操作');
  const a=value as Record<string,unknown>;
  const keys=(allowed:string[])=>{if(Object.keys(a).some(k=>!['type',...allowed].includes(k)))throw new Error('操作包含不支持的字段');};
  const card=()=>{if(typeof a.card!=='number'||!Number.isInteger(a.card)||!CARD_BY_ID.has(a.card))throw new Error('无效卡号');return a.card;};
  const country=()=>{if(typeof a.country!=='string'||!COUNTRY_BY_ID.has(a.country))throw new Error('无效国家');return a.country;};
  switch(a.type){
    case 'PLACE_SETUP':case 'TARGET':keys(['country']);return {type:a.type,country:country()};
    case 'PLAY_EVENT':case 'SELECT_HEADLINE':case 'SPACE':keys(['card']);return {type:a.type,card:card()};
    case 'END_OPS':case 'PASS_EMPTY':keys([]);return {type:a.type};
    case 'CHOOSE':keys(['value']);if(typeof a.value!=='string'||a.value.length>128)throw new Error('无效选择');return {type:a.type,value:a.value};
    case 'PLAY_OPS':
      keys(['card','mode','order','asiaOnly','seaOnly']);
      if(a.mode!=='INFLUENCE'&&a.mode!=='COUP'&&a.mode!=='REALIGNMENT')throw new Error('无效 OPS 用途');
      if(a.order!==undefined&&a.order!=='BEFORE'&&a.order!=='AFTER')throw new Error('无效事件顺序');
      if((a.asiaOnly!==undefined&&typeof a.asiaOnly!=='boolean')||(a.seaOnly!==undefined&&typeof a.seaOnly!=='boolean'))throw new Error('无效区域参数');
      return {type:a.type,card:card(),mode:a.mode,order:a.order,asiaOnly:a.asiaOnly as boolean|undefined,seaOnly:a.seaOnly as boolean|undefined};
    default:throw new Error('不支持的操作');
  }
}
interface Seat { tokenHash:string; clientId:string|null; requests:Map<string,string> }
interface Room { state:GameState; seats:Partial<Record<Side,Seat>>; revision:number; touched:number; actions:{side:Side;action:Action}[] }
/** In-memory authority. Reconnect survives transport loss and refresh, not a server restart. */
export class RoomStore {
  private rooms=new Map<string,Room>();
  constructor(private readonly seed=()=>randomInt(0,0x100000000)){}
  create(side:unknown,clientId:string) {
    if(!isSide(side))throw new Error('请选择美国或苏联');
    this.sweep();if(this.rooms.size>=200)throw new Error('房间已满，请稍后重试');
    let roomId:string;do{roomId=randomBytes(5).toString('hex').toUpperCase();}while(this.rooms.has(roomId));
    const state=createGame(this.seed());state.log=['对局已创建'];
    this.rooms.set(roomId,{state,seats:{},revision:0,touched:Date.now(),actions:[]});
    return this.join(roomId,side,clientId);
  }
  join(roomId:unknown,side:unknown,clientId:string,token?:unknown):{session:Session; replaced:string|null} {
    if(typeof roomId!=='string'||!isSide(side))throw new Error('无效房间或阵营');
    const normalized=roomId.trim().toUpperCase(),room=this.rooms.get(normalized);
    if(!room)throw new Error('房间不存在或已失效');
    const seat=room.seats[side];let secret:string,replaced:string|null=null;
    if(seat){
      if(typeof token!=='string'||token.length>128||hash(token)!==seat.tokenHash)throw new Error('该阵营已被占用，请使用原设备的恢复身份');
      secret=token;replaced=seat.clientId!==clientId?seat.clientId:null;seat.clientId=clientId;
    }else{
      if(token!==undefined)throw new Error('恢复身份已失效');
      secret=randomBytes(32).toString('base64url');room.seats[side]={tokenHash:hash(secret),clientId,requests:new Map()};
    }
    room.touched=Date.now();return {session:{roomId:normalized,side,token:secret},replaced};
  }
  disconnect(roomId:string,side:Side,clientId:string) {
    const room=this.rooms.get(roomId),seat=room?.seats[side];if(seat?.clientId===clientId){seat.clientId=null;room!.touched=Date.now();}
  }
  execute(roomId:string,side:Side,clientId:string,request:unknown) {
    const room=this.rooms.get(roomId),seat=room?.seats[side];
    if(!room||!seat||seat.clientId!==clientId)throw new Error('房间身份无效，请重新连接');
    if(!room.seats.US||!room.seats.USSR)throw new Error('等待另一名玩家加入');
    if(!request||typeof request!=='object')throw new Error('无效请求');
    const r=request as Record<string,unknown>;
    if(typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(r.id))throw new Error('无效请求编号');
    const action=parseAction(r.action),fingerprint=JSON.stringify(action);
    const prior=seat.requests.get(r.id);
    if(prior!==undefined){if(prior!==fingerprint)throw new Error('请求编号已用于其他操作');return room.revision;}
    if(r.expectedRevision!==room.revision)throw new Error('局面已更新，请按最新局面重试');
    room.state=apply(room.state,side,action);room.revision++;room.touched=Date.now();room.actions.push({side,action});
    seat.requests.set(r.id,fingerprint);if(seat.requests.size>512)seat.requests.delete(seat.requests.keys().next().value!);
    return room.revision;
  }
  snapshot(roomId:string,side:Side):RoomSnapshot {
    const room=this.rooms.get(roomId);if(!room)throw new Error('房间不存在');
    return {roomId,side,revision:room.revision,seats:{US:{occupied:Boolean(room.seats.US),connected:Boolean(room.seats.US?.clientId)},USSR:{occupied:Boolean(room.seats.USSR),connected:Boolean(room.seats.USSR?.clientId)}},view:viewFor(room.state,side)};
  }
  members(roomId:string) {
    const room=this.rooms.get(roomId);return (['USSR','US'] as const).flatMap(side=>{const clientId=room?.seats[side]?.clientId;return clientId?[{clientId,side}]:[];});
  }
  sweep(now=Date.now()) {
    for(const [id,room] of this.rooms)if(!Object.values(room.seats).some(s=>s.clientId)&&now-room.touched>24*60*60*1000)this.rooms.delete(id);
  }
}
