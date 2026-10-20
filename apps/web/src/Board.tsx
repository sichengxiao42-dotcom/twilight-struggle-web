import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Region, Side } from '@ts/shared';
import { ADJACENCY, COUNTRIES, controller, placementCost, type Action, type Country, type GameState } from '@ts/game-core';
import { boardImage } from './assets';
import { usePieceDrag } from './usePieceDrag';
import { influenceDrop } from './pieceMoves';
import { trackNeedsMove, trackPieces, type TrackPiece } from './tracks';
import { BOX_HEADER, BOX_HEIGHT, BOX_WIDTH, MAP_HEIGHT, MAP_POSITIONS, MAP_WIDTH, TRACK_MARKER_RADIUS } from './mapPositions';
const labels: Record<Region, string> = { EUROPE: '欧洲', ASIA: '亚洲', MIDDLE_EAST: '中东', AFRICA: '非洲', CENTRAL_AMERICA: '中美洲', SOUTH_AMERICA: '南美洲' };
// Fallback when the manifest has no map: region panels form an original schematic board; connections are board links, not geographic borders.
const origins: Record<Region, [number, number]> = { CENTRAL_AMERICA: [12, 12], SOUTH_AMERICA: [12, 330], EUROPE: [410, 12], AFRICA: [410, 430], MIDDLE_EAST: [808, 12], ASIA: [808, 330] };
const positions = Object.fromEntries(COUNTRIES.map(c => {
  const group = COUNTRIES.filter(x => x.region === c.region), i = group.indexOf(c), [x, y] = origins[c.region];
  return [c.id, [x + (i % 3) * 128, y + 42 + Math.floor(i / 3) * 48]];
}));
const nameOf = (id: string) => COUNTRIES.find(n => n.id === id)!.nameZh;
const map = boardImage();

/** Influence marker on the map: filled when that side controls the country, like the physical counters. */
function Marker({ x, value, side, filled }: { x: number; value: number; side: 'us' | 'ussr'; filled: boolean }) {
  if (!value) return null;
  const y = BOX_HEADER + 20, size = BOX_HEIGHT - BOX_HEADER - 40;
  return <g className={'marker marker-' + side + (filled ? ' filled' : '')}><rect x={x} y={y} width={size} height={size} rx="16"/><text x={x + size / 2} y={y + size / 2} dominantBaseline="central" textAnchor="middle">{value}</text></g>;
}

const trackColours = { US: ['#2f5d9e', '#fff'], USSR: ['#b3261e', '#fff'], neutral: ['#f4e9c8', '#1b1b1b'] } as const;

export interface PlacementFeedback { country: string; side: Side; before: number }

export function Board({selectedCountry,state,targets,onCountry,onAction,canInteract,scale=1,lastPlacement,onTrackTask}:{selectedCountry?:string;state:GameState;targets:string[];onCountry:(id:string)=>void;onAction:(action:Action)=>void;canInteract:boolean;scale?:number;lastPlacement?:PlacementFeedback|null;onTrackTask:(task:string|null)=>void}) {
  const [hover, setHover] = useState<string | null>(null);
  const svgRef=useRef<SVGSVGElement>(null);
  const tracks=trackPieces(state);
  const [placed,setPlaced]=useState<Record<string,TrackPiece>>(()=>Object.fromEntries(trackPieces(state).map(t=>[t.id,t])));
  const pending=tracks.filter(t=>trackNeedsMove(placed[t.id],t));
  const task=map?(pending[0]?.title??null):null;
  useEffect(()=>{onTrackTask(task);},[task,onTrackTask]);
  const [dragMessage,setDragMessage]=useState('');
  useEffect(()=>{setDragMessage('');},[state]);
  const confirmTrack=(id:string)=>{const target=tracks.find(t=>t.id===id);if(target&&trackNeedsMove(placed[id],target)){setPlaced(previous=>({...previous,[id]:target}));setDragMessage('标记已摆放');}};
  const gesture=usePieceDrag(state,(piece,drop,point)=>{
    if(piece.kind==='track'){
      const t=tracks.find(t=>t.id===piece.id),matrix=svgRef.current?.getScreenCTM();
      if(t&&matrix&&trackNeedsMove(placed[piece.id],t)){
        const position=new DOMPoint(point.x,point.y).matrixTransform(matrix.inverse());
        if(Math.hypot(position.x-t.at[0],position.y-t.at[1])<TRACK_MARKER_RADIUS*1.6){confirmTrack(t.id);return;}
      }
      setDragMessage('此处不是规则允许的轨道落点，标记已返回原位');return;
    }
    const action=canInteract&&drop?influenceDrop(state,piece,drop,targets):null;
    if(!action){setDragMessage('落点不合法，棋子已返回原位');return;}
    setDragMessage('');
    onAction(action);
  });
  const draggedPiece=gesture.drag?.piece;
  const draggedTrackId=draggedPiece?.kind==='track'?draggedPiece.id:null;
  const ghostLabel=draggedPiece?.kind==='track'?(tracks.find(t=>t.id===draggedTrackId)?.label??'标记'):draggedPiece?(draggedPiece.side==='USSR'?'苏':'美')+' 1':'';
  const gestureLayer=gesture.drag&&<div className={'piece-ghost '+(draggedPiece?.kind==='track'?'piece-neutral':'piece-'+(draggedPiece&&draggedPiece.side))} style={{left:gesture.drag.x,top:gesture.drag.y}} aria-hidden="true">{ghostLabel}</div>;
  const reserves=<div className="piece-tray"><span>备用棋子</span>{(['USSR','US'] as const).map(side=><button key={side} className={'reserve-counter piece-'+side} data-reserve-side={side} aria-label={'拖动'+(side==='USSR'?'苏联':'美国')+'影响力棋子'} {...gesture.bindings({kind:'reserve',side})} onClick={()=>{if(!gesture.suppressClick())setDragMessage('按住棋子拖到金框国家；移除影响力时拖回同色备用区');}}>{side==='USSR'?'苏':'美'} <b>1</b></button>)}<small>拖入国家部署 · 拖回备用区移除</small></div>;
  const renderedTracks=<g className="track-markers">{tracks.map(t=>{
    const at=placed[t.id]?.at??t.at,moving=trackNeedsMove(placed[t.id],t),[fill,ink]=trackColours[t.owner],r=TRACK_MARKER_RADIUS;
    return <g key={t.id}>{moving&&<g data-track-drop={t.id} className="track-destination" transform={`translate(${t.at[0]},${t.at[1]})`}><title>{t.title}，合法落点</title><circle r={r*1.45}/><text textAnchor="middle" dominantBaseline="central" fontSize={r*0.7}>{t.value}</text></g>}
      <g data-track-id={t.id} className={'track-marker '+(moving?'pending':'')} transform={`translate(${at[0]},${at[1]})`} role="button" tabIndex={0} aria-disabled={!moving} aria-label={t.title+(moving?'，拖到高亮位置':'，暂无待移动位置')} {...gesture.bindings({kind:'track',id:t.id})} onKeyDown={e=>{if(moving&&(e.key==='Enter'||e.key===' ')){e.preventDefault();confirmTrack(t.id);}}}>
      <title>{t.title}{moving?' · 拖到高亮圈；也可按 Enter 摆放':' · 暂无待移动位置'}</title><circle className="track-grip" r={r*1.45} fill="transparent"/><circle r={r} fill={fill} stroke={moving?'#9b6c20':'#fff'} strokeWidth="10"/><text dominantBaseline="central" textAnchor="middle" fontSize={t.label.length>1?r*.75:r} fontWeight="800" fill={ink}>{t.label}</text></g></g>;
  })}</g>;
  const p = state.phase;
  const placing = p.kind === 'SETUP_PLACEMENT' || (p.kind === 'OPS' && p.mode === 'INFLUENCE');
  const hint = (id: string) => {
    if (!targets.includes(id)) return '当前不可操作';
    if (p.kind === 'SETUP_PLACEMENT') return `选择国家，用 ＋／− 调整${p.side === 'USSR' ? '苏联' : '美国'}影响力`;
    if (p.kind === 'OPS' && p.mode === 'INFLUENCE') return `选择国家，用 ＋／− 调整 · 每点消耗 ${placementCost(state, id, p.side)} 行动点`;
    return '点击选择这个国家';
  };
  const delta = lastPlacement ? state.influence[lastPlacement.country][lastPlacement.side] - lastPlacement.before : 0;
  const receipt = lastPlacement && delta > 0 ? `已在${nameOf(lastPlacement.country)}部署 ${delta} 点${lastPlacement.side === 'USSR' ? '苏联' : '美国'}影响力` : '';
  const feedback = <div className="map-interaction"><span>{hover ? nameOf(hover) + ' · ' + hint(hover) : placing ? '先选国家，再用 ＋／− 调整；也可拖动备用棋子' : '金框国家可直接点击选择'}</span><span className="map-feedback" role="status" aria-live="polite">{dragMessage||receipt}</span></div>;
  const country = (c: Country, [x, y]: number[], body: ReactNode) => {
    const inf = state.influence[c.id], ctrl = controller(state, c.id), legal = targets.includes(c.id);
    const dropReady=gesture.drag&&draggedPiece&&draggedPiece.kind!=='track'&&canInteract?Boolean(influenceDrop(state,draggedPiece,{kind:'country',id:c.id},targets)):false;
    const pieceSide=p.kind==='DECISION'&&p.decision.kind==='INFLUENCE'?p.decision.affected:('side' in p?p.side:'USSR');
    return <g key={c.id} data-country-id={c.id} transform={'translate(' + x + ',' + y + ')'} className={'country '+(selectedCountry===c.id?'selected-country ':'')+(dropReady?'drop-ready ':'') + (legal ? 'legal ' : '') + (ctrl ? 'controlled-' + ctrl : '')} role="button" {...(inf[pieceSide]>0?gesture.bindings({kind:'influence',side:pieceSide,country:c.id}):{})} aria-disabled={!legal} aria-label={c.nameZh + ' 稳定度' + c.stability + ' 美国' + inf.US + ' 苏联' + inf.USSR} tabIndex={0} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c.id)} onBlur={() => setHover(null)} onClick={() => { if (legal&&!gesture.suppressClick()) onCountry(c.id); }} onKeyDown={e => { if (legal && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onCountry(c.id); } }}>
      <title>{c.nameZh + ' · ' + hint(c.id) + ' · 稳定度 ' + c.stability + ' · 相邻：' + ADJACENCY[c.id].map(nameOf).join('、')}</title>
      {body}
    </g>;
  };
  if (map) {
    const centre = (id: string) => [MAP_POSITIONS[id][0] + BOX_WIDTH / 2, MAP_POSITIONS[id][1] + BOX_HEIGHT / 2];
    return <>
      {reserves}{gestureLayer}<div className="board-scroll"><svg ref={svgRef} viewBox={'0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT} className="board map-board" style={{width: `${scale * 100}%`}} aria-label="世界局势地图">
        <image href={map} width={MAP_WIDTH} height={MAP_HEIGHT} pointerEvents="none"/>
        {hover && ADJACENCY[hover].map(id => { const a = centre(hover), b = centre(id); return <line key={id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="connection"/>; })}
        {COUNTRIES.map(c => {
          const inf = state.influence[c.id], ctrl = controller(state, c.id), half = BOX_WIDTH / 2, size = BOX_HEIGHT - BOX_HEADER - 40;
          return country(c, MAP_POSITIONS[c.id], <>
            <rect className="tint" y={BOX_HEADER} width={BOX_WIDTH} height={BOX_HEIGHT - BOX_HEADER}/>
            <rect className="hit" width={BOX_WIDTH} height={BOX_HEIGHT} rx="10" pointerEvents="all" aria-hidden="true"/>
            {(['US','USSR'] as const).map(side=><g key={side} className="influence-piece" data-influence-country={c.id} data-influence-side={side} {...gesture.bindings({kind:'influence',side,country:c.id})}>
              <Marker x={(side==='US'?0:half)+(half-size)/2} value={inf[side]} side={side==='US'?'us':'ussr'} filled={ctrl===side}/>
            </g>)}
          </>);
        })}
        {renderedTracks}
      </svg></div>{feedback}<p className="map-caption"><span>● 美国</span><span>● 苏联</span><span>金框：当前可选 · 实心：控制</span><span>放大后可横向滚动</span></p></>;
  }
  return <>
    {reserves}{gestureLayer}<div className="board-scroll"><svg ref={svgRef} viewBox="0 0 1208 810" className="board" style={{width: `${scale * 100}%`}} aria-label="世界局势示意地图">
      {(Object.keys(labels) as Region[]).map(r => { const [x, y] = origins[r]; return <text key={r} x={x + 8} y={y + 25} className="region-title">{labels[r]}</text>; })}
      {hover && ADJACENCY[hover].map(id => { const a = positions[hover], b = positions[id]; return <line key={id} x1={a[0] + 60} y1={a[1] + 20} x2={b[0] + 60} y2={b[1] + 20} className="connection"/>; })}
      {COUNTRIES.map(c => {
        const inf = state.influence[c.id];
        return country(c, positions[c.id], <><rect width="120" height="40" rx="5"/><text x="6" y="15">{c.battleground ? '★ ' : ''}{c.nameZh}</text><text x="6" y="32" className="stability">稳 {c.stability}</text><text x="72" y="32" className="us-value">{inf.US}</text><text x="99" y="32" className="ussr-value">{inf.USSR}</text></>);
      })}
    </svg></div>{feedback}<p className="map-caption"><span>● 美国</span><span>● 苏联</span><span>金框：当前可选 · 实心：控制</span><span>放大后可横向滚动</span></p></>;
}
