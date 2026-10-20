import { createHash, randomBytes, randomInt } from 'node:crypto';
import { apply, influencePlacement, CARD_BY_ID, COUNTRY_BY_ID, createGame, viewFor, type Action, type GameState } from '@ts/game-core';
import type { RoomSnapshot, Session, Side } from '@ts/shared';
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const isSide=(value:unknown):value is Side=>value==='US'||value==='USSR';
export function parseAction(value:unknown):Action | {type:'UNDO'} | {type:'UNDO_PLACEMENT';country:string} {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('无效操作');
  const a=value as Record<string,unknown>;
  const keys=(allowed:string[])=>{if(Object.keys(a).some(k=>!['type',...allowed].includes(k)))throw new Error('操作包含不支持的字段');};
  const card=()=>{if(typeof a.card!=='number'||!Number.isInteger(a.card)||!CARD_BY_ID.has(a.card))throw new Error('无效卡号');return a.card;};
  const country=()=>{if(typeof a.country!=='string'||!COUNTRY_BY_ID.has(a.country))throw new Error('无效国家');return a.country;};
  switch(a.type){
    case 'UNDO':keys([]);return {type:'UNDO'};
    case 'UNDO_PLACEMENT':keys(['country']);return {type:'UNDO_PLACEMENT',country:country()};
    case 'RELOCATE_INFLUENCE':
      keys(['from','to']);
      if(typeof a.from!=='string'||!COUNTRY_BY_ID.has(a.from)||typeof a.to!=='string'||!COUNTRY_BY_ID.has(a.to))throw new Error('无效转移国家');
      return {type:a.type,from:a.from,to:a.to};
    case 'PLACE_SETUP':case 'TARGET':case 'CANCEL_CMC':keys(['country']);return {type:a.type,country:country()};
    case 'PLAY_EVENT':case 'SELECT_HEADLINE':case 'SPACE':case 'TRAP_DISCARD':keys(['card']);return {type:a.type,card:card()};
    case 'END_ACTION':case 'END_OPS':case 'PASS_EMPTY':keys([]);return {type:a.type};
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
/** A person in the room. Identity (token) is separate from the side they sit on, so sides are chosen in the lobby. */
interface Member { tokenHash:string; clientId:string|null; requests:Map<string,string> }
interface Room { host:string; state:GameState|null; members:Map<string,Member>; seats:Partial<Record<Side,string>>; started:boolean; revision:number; touched:number; actions:{side:Side;action:Action}[]; history:{side:Side;state:GameState;action:Action}[]; undoVersion:number }
export type SeatChoice = Side | 'RANDOM' | null;
/** In-memory authority. Reconnect survives transport loss and refresh, not a server restart. */
export class RoomStore {
  private rooms=new Map<string,Room>();
  constructor(private readonly seed=()=>randomInt(0,0x100000000),private readonly coin=()=>randomInt(0,2)){}
  create(clientId:string) {
    this.sweep();if(this.rooms.size>=200)throw new Error('房间已满，请稍后重试');
    let roomId:string;do{roomId=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(roomId));
    this.rooms.set(roomId,{host:'',state:null,members:new Map(),seats:{},started:false,revision:0,touched:Date.now(),actions:[],history:[],undoVersion:0});
    const result=this.join(roomId,clientId);this.rooms.get(roomId)!.host=result.key;return result;
  }
  /** Enter a room as a new member, or restore an existing member with its token. Returns the member key used internally. */
  join(roomId:unknown,clientId:string,token?:unknown):{session:Session; key:string; replaced:string|null} {
    if(typeof roomId!=='string')throw new Error('无效房间号');
    const normalized=roomId.trim().toUpperCase(),room=this.rooms.get(normalized);
    if(!room)throw new Error('房间不存在或已失效');
    let secret:string,replaced:string|null=null,member:Member|undefined;
    if(token!==undefined){
      if(typeof token!=='string'||token.length>128||!(member=room.members.get(hash(token))))throw new Error('恢复身份已失效，请重新加入房间');
      secret=token;replaced=member.clientId&&member.clientId!==clientId?member.clientId:null;member.clientId=clientId;
    }else{
      if(room.members.size>=2)throw new Error('房间已满：已有两名玩家');
      secret=randomBytes(32).toString('base64url');room.members.set(hash(secret),{tokenHash:hash(secret),clientId,requests:new Map()});
    }
    room.touched=Date.now();return {session:{roomId:normalized,token:secret},key:hash(secret),replaced};
  }
  private member(roomId:string,key:string,clientId:string) {
    const room=this.rooms.get(roomId),member=room?.members.get(key);
    if(!room||!member||member.clientId!==clientId)throw new Error('房间身份无效，请重新连接');
    return {room,member};
  }
  private sideOf(room:Room,key:string):Side|null {
    return room.seats.USSR===key?'USSR':room.seats.US===key?'US':null;
  }
  /** Lobby seat change: sit on a free side, switch, stand up, or random assignment. Locked once the game starts. */
  seat(roomId:string,key:string,clientId:string,choice:unknown) {
    const {room}=this.member(roomId,key,clientId);
    if(room.started)throw new Error('对局已开始，不能更换阵营');
    if(choice!==null&&choice!=='RANDOM'&&!isSide(choice))throw new Error('请选择美国或苏联');
    const current=this.sideOf(room,key);
    if(choice==='RANDOM'){
      const keys=[...room.members.keys()];
      if(keys.length===2){const first=this.coin()?keys:[keys[1],keys[0]];room.seats={USSR:first[0],US:first[1]};}
      else{const free=(['USSR','US'] as const).filter(side=>!room.seats[side]||room.seats[side]===key);if(current)delete room.seats[current];room.seats[free[free.length>1?this.coin():0]]=key;}
    }else{
      if(choice&&room.seats[choice]&&room.seats[choice]!==key)throw new Error('该阵营已有玩家，请选择另一边');
      if(current)delete room.seats[current];
      if(choice)room.seats[choice]=key;
    }
    room.revision++;room.touched=Date.now();return room.revision;
  }
  start(roomId:string,key:string,clientId:string) {
    const {room}=this.member(roomId,key,clientId);
    if(room.started)return room.revision;
    if(!this.sideOf(room,key))throw new Error('请先选择阵营');
    if(!room.seats.US||!room.seats.USSR)throw new Error('等待另一名玩家选择阵营');
    if(!room.members.get(room.seats.US)?.clientId||!room.members.get(room.seats.USSR)?.clientId)throw new Error('等待双方在线后开始对局');
    room.state=createGame(this.seed());room.state.manualEnd=true;room.state.log=['双方入座，对局开始'];
    room.started=true;room.revision++;room.touched=Date.now();return room.revision;
  }
  restart(roomId:string,key:string,clientId:string,expectedRevision:number) {
    const {room}=this.member(roomId,key,clientId);
    if(room.host!==key)throw new Error('只有房主可以重新开局');
    if(expectedRevision!==room.revision)throw new Error('局面已更新，请重新确认重开');
    room.state=null;
    room.started=false;room.history=[];room.actions=[];room.undoVersion++;room.revision++;room.touched=Date.now();
    return room.revision;
  }
  close(roomId:string,key:string,clientId:string) {
    const {room}=this.member(roomId,key,clientId);
    if(room.host!==key)throw new Error('只有房主可以关闭房间');
    const members=this.members(roomId);this.rooms.delete(roomId);return members;
  }
  disconnect(roomId:string,key:string,clientId:string) {
    const room=this.rooms.get(roomId),member=room?.members.get(key);if(member?.clientId===clientId){member.clientId=null;room!.touched=Date.now();}
  }
  execute(roomId:string,key:string,clientId:string,request:unknown) {
    const {room,member}=this.member(roomId,key,clientId);
    const side=this.sideOf(room,key);
    if(!room.started||!room.state)throw new Error(side?'等待双方入座并开始对局':'请先选择阵营');
    if(!side)throw new Error('你没有入座，不能操作');
    if(!request||typeof request!=='object')throw new Error('无效请求');
    const r=request as Record<string,unknown>;
    if(typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(r.id))throw new Error('无效请求编号');
    const action=parseAction(r.action),fingerprint=JSON.stringify(action);
    const prior=member.requests.get(r.id);
    if(prior!==undefined){if(prior!==fingerprint)throw new Error('请求编号已用于其他操作');return room.revision;}
    if(r.expectedRevision!==room.revision)throw new Error('局面已更新，请按最新局面重试');
    if(action.type==='UNDO'||action.type==='UNDO_PLACEMENT'){
      const previous=room.history.at(-1);
      if(!previous||previous.side!==side)throw new Error('只能撤销自己最近的操作；对方行动后不能撤销');
      if(action.type==='UNDO_PLACEMENT'&&influencePlacement(previous.state,previous.action)?.country!==action.country)throw new Error('只能减去该国最近刚放置的影响力');
      room.history.pop();room.state=previous.state;room.actions.pop();room.undoVersion++;
    }else{
      const next=apply(room.state,side,action);
      // Retain only the current player's consecutive actions, bounded for memory use.
      if(room.history.at(-1)?.side!==side)room.history=[];
      room.history.push({side,state:room.state,action});if(room.history.length>32)room.history.shift();
      room.state=next;room.actions.push({side,action});
      if(action.type==='END_ACTION')room.history=[];
    }
    room.revision++;room.touched=Date.now();
    member.requests.set(r.id,fingerprint);if(member.requests.size>512)member.requests.delete(member.requests.keys().next().value!);
    return room.revision;
  }
  snapshot(roomId:string,key:string):RoomSnapshot {
    const room=this.rooms.get(roomId);if(!room)throw new Error('房间不存在');
    const side=this.sideOf(room,key),last=room.history.at(-1);
    const undoPlacement=side&&last?.side===side?influencePlacement(last.state,last.action)??undefined:undefined;
    const seat=(s:Side)=>{const owner=room.seats[s];return {occupied:Boolean(owner),connected:Boolean(owner&&room.members.get(owner)?.clientId),mine:owner===key};};
    return {isHost:room.host===key,undoPlacement,roomId,side,started:room.started,members:room.members.size,revision:room.revision,canUndo:Boolean(side)&&room.history.at(-1)?.side===side,undoVersion:room.undoVersion,seats:{US:seat('US'),USSR:seat('USSR')},view:room.started&&room.state&&side?viewFor(room.state,side):null};
  }
  members(roomId:string) {
    const room=this.rooms.get(roomId);return room?[...room.members.entries()].flatMap(([key,m])=>m.clientId?[{clientId:m.clientId,key}]:[]):[];
  }
  sweep(now=Date.now()) {
    for(const [id,room] of this.rooms)if(![...room.members.values()].some(m=>m.clientId)&&now-room.touched>24*60*60*1000)this.rooms.delete(id);
  }
}
