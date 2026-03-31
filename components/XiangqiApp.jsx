import { useState, useCallback, useEffect } from "react";

const BOARD_THEMES = [
  { id:"wood", name:"经典木纹", bg:"#D4A256", lineColor:"#8B4513", labelColor:"#5D2E0C" },
  { id:"green", name:"竞技绿", bg:"#4A7C59", lineColor:"#2D5A3D", labelColor:"#1A3D2B" },
  { id:"dark", name:"暗黑", bg:"#1C1C2E", lineColor:"#C9A84C", labelColor:"#C9A84C" },
  { id:"jade", name:"碧玉", bg:"#A8C5A0", lineColor:"#3D6B47", labelColor:"#2A4F32" },
  { id:"parchment", name:"羊皮纸", bg:"#F5E6C8", lineColor:"#8B6914", labelColor:"#5C4A0A" },
  { id:"midnight", name:"午夜蓝", bg:"#0D1B2A", lineColor:"#4A9ECA", labelColor:"#4A9ECA" },
];
const PIECE_THEMES = [
  { id:"classic", name:"经典", bg:"#F5DEB3", border:"#8B4513", red:"#C0392B", black:"#1A1A1A" },
  { id:"modern", name:"现代", bg:"#FFFFFF", border:"#333", red:"#E53935", black:"#212121" },
  { id:"dark2", name:"暗夜", bg:"#2D2D2D", border:"#C9A84C", red:"#FF6B6B", black:"#87CEEA" },
  { id:"jade2", name:"翡翠", bg:"#E8F5E9", border:"#2E7D32", red:"#B71C1C", black:"#1B5E20" },
  { id:"gold", name:"黄金", bg:"#FFF8DC", border:"#B8860B", red:"#8B0000", black:"#2F4F4F" },
  { id:"neon", name:"霓虹", bg:"#0D0D1A", border:"#00FFFF", red:"#FF4081", black:"#00E5FF" },
];

function makeBoard() {
  const b = Array(10).fill(null).map(()=>Array(9).fill(null));
  const bp=c=>({char:c,isRed:false}), rp=c=>({char:c,isRed:true});
  ["車","馬","象","仕","將","仕","象","馬","車"].forEach((c,i)=>b[0][i]=bp(c));
  b[2][1]=bp("炮");b[2][7]=bp("炮");
  [0,2,4,6,8].forEach(i=>b[3][i]=bp("卒"));
  ["車","馬","相","士","帥","士","相","馬","車"].forEach((c,i)=>b[9][i]=rp(c));
  b[7][1]=rp("炮");b[7][7]=rp("炮");
  [0,2,4,6,8].forEach(i=>b[6][i]=rp("兵"));
  return b;
}

function between(r1,c1,r2,c2,board){
  let n=0;
  if(r1===r2){const a=Math.min(c1,c2),z=Math.max(c1,c2);for(let c=a+1;c<z;c++)if(board[r1][c])n++;}
  else if(c1===c2){const a=Math.min(r1,r2),z=Math.max(r1,r2);for(let r=a+1;r<z;r++)if(board[r][c1])n++;}
  return n;
}

function isValid(board,fr,fc,tr,tc){
  const p=board[fr][fc]; if(!p)return false;
  const t=board[tr][tc]; if(t&&t.isRed===p.isRed)return false;
  const dr=tr-fr,dc=tc-fc,ar=Math.abs(dr),ac=Math.abs(dc);
  const ch=p.char;
  if(ch==="車"||ch==="车")return(fr===tr||fc===tc)&&between(fr,fc,tr,tc,board)===0;
  if(ch==="馬"||ch==="马"){
    if(ar===2&&ac===1){return!board[fr+(dr>0?1:-1)][fc];}
    if(ar===1&&ac===2){return!board[fr][fc+(dc>0?1:-1)];}
    return false;
  }
  if(ch==="炮"||ch==="砲"){
    if(fr!==tr&&fc!==tc)return false;
    const m=between(fr,fc,tr,tc,board);
    return t?m===1:m===0;
  }
  if(ch==="相"||ch==="象"){
    if(ar!==2||ac!==2)return false;
    if(p.isRed&&tr<5)return false;
    if(!p.isRed&&tr>4)return false;
    return!board[fr+dr/2][fc+dc/2];
  }
  if(ch==="士"||ch==="仕"){
    if(ar!==1||ac!==1)return false;
    return p.isRed?(tr>=7&&tr<=9&&tc>=3&&tc<=5):(tr>=0&&tr<=2&&tc>=3&&tc<=5);
  }
  if(ch==="帥"||ch==="將"){
    if(ar+ac!==1)return false;
    return p.isRed?(tr>=7&&tr<=9&&tc>=3&&tc<=5):(tr>=0&&tr<=2&&tc>=3&&tc<=5);
  }
  if(ch==="兵"||ch==="卒"){
    if(p.isRed){
      if(dr===0&&fr>4&&ac===1)return true;
      return dr===-1&&dc===0;
    }else{
      if(dr===0&&fr<5&&ac===1)return true;
      return dr===1&&dc===0;
    }
  }
  return false;
}

function applyMove(board,fr,fc,tr,tc){
  const nb=board.map(r=>r.map(p=>p?{...p}:null));
  nb[tr][tc]=nb[fr][fc]; nb[fr][fc]=null;
  return nb;
}

function findKing(board,isRed){
  for(let r=0;r<10;r++)for(let c=0;c<9;c++){
    const p=board[r][c];
    if(p&&p.isRed===isRed&&(p.char==="帥"||p.char==="將"))return[r,c];
  }
  return[-1,-1];
}

function isInCheck(board,isRed){
  const[kr,kc]=findKing(board,isRed);
  if(kr<0)return true;
  for(let r=0;r<10;r++)for(let c=0;c<9;c++){
    const p=board[r][c];
    if(p&&p.isRed!==isRed&&isValid(board,r,c,kr,kc))return true;
  }
  // 将帅照面
  const opp=isRed?0:9;
  for(let r=0;r<10;r++){
    const p=board[r][kc];
    if(p&&p.isRed!==isRed&&(p.char==="帥"||p.char==="將")){
      if(between(kr,kc,r,kc,board)===0)return true;
    }
  }
  return false;
}

function getLegalSafe(board,fr,fc){
  const p=board[fr][fc]; if(!p)return[];
  const moves=[];
  for(let r=0;r<10;r++)for(let c=0;c<9;c++){
    if(isValid(board,fr,fc,r,c)){
      const nb=applyMove(board,fr,fc,r,c);
      if(!isInCheck(nb,p.isRed))moves.push([r,c]);
    }
  }
  return moves;
}

function hasAnyMove(board,isRed){
  for(let r=0;r<10;r++)for(let c=0;c<9;c++){
    const p=board[r][c];
    if(p&&p.isRed===isRed&&getLegalSafe(board,r,c).length>0)return true;
  }
  return false;
}

function toChineseNotation(board,fr,fc,tr,tc){
  const p=board[fr][fc]; if(!p)return"";
  const cols=p.isRed?[9,8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8,9];
  const f=cols[fc],t2=cols[tc],dr=tr-fr,dc=tc-fc;
  const dir=p.isRed?(dr<0?"进":"退"):(dr>0?"进":"退");
  const step=Math.abs(dr)||Math.abs(dc);
  const ch=p.char;
  if(ch==="車"||ch==="车"||ch==="炮"||ch==="砲"||ch==="帥"||ch==="將"||ch==="士"||ch==="仕")
    return ch+""+f+(dr===0?"平":dir)+(dr===0?cols[tc]:step);
  return ch+""+f+dir+cols[tc];
}

// AI
const PV={"帥":10000,"將":10000,"車":900,"车":900,"炮":450,"砲":450,"馬":400,"马":400,"相":200,"象":200,"士":200,"仕":200,"兵":100,"卒":100};
function evalBoard(b){let s=0;for(let r=0;r<10;r++)for(let c=0;c<9;c++){const p=b[r][c];if(p)s+=p.isRed?(PV[p.char]||0):-(PV[p.char]||0);}return s;}
function getAllMoves(board,isRed){
  const m=[];
  for(let fr=0;fr<10;fr++)for(let fc=0;fc<9;fc++){
    const p=board[fr][fc];
    if(p&&p.isRed===isRed)for(const[tr,tc]of getLegalSafe(board,fr,fc))m.push([fr,fc,tr,tc]);
  }
  return m;
}
function minimax(board,depth,alpha,beta,isRed){
  if(depth===0)return{score:evalBoard(board)};
  const moves=getAllMoves(board,isRed);
  if(!moves.length)return{score:isRed?-9999:9999};
  let best=null;
  for(const[fr,fc,tr,tc]of moves){
    const nb=applyMove(board,fr,fc,tr,tc);
    const{score}=minimax(nb,depth-1,alpha,beta,!isRed);
    if(isRed){if(!best||score>best.score){best={score,move:[fr,fc,tr,tc]};alpha=Math.max(alpha,score);}}
    else{if(!best||score<best.score){best={score,move:[fr,fc,tr,tc]};beta=Math.min(beta,score);}}
    if(alpha>=beta)break;
  }
  return best||{score:evalBoard(board)};
}
function getAIMove(board,isRed,level){
  const d=level==="easy"?1:level==="hard"?3:2;
  return (minimax(board,d,-Infinity,Infinity,isRed).move)||null;
}

async function getClaudeMove(board,isRed,onComment){
  const moves=getAllMoves(board,isRed);
  if(!moves.length)return null;
  const list=moves.slice(0,25).map((m,i)=>i+"."+toChineseNotation(board,m[0],m[1],m[2],m[3])).join(",");
  const prompt="你是象棋棋手，执"+(isRed?"红":"黑")+"方。可选走法:"+list+". 选最优，只回复JSON:{\"i\":数字,\"c\":\"一句评语\"}";
  try{
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:100,messages:[{role:"user",content:prompt}]})});
    const d=await r.json();
    const txt=d.content?.[0]?.text||"";
    const s=txt.indexOf("{"),e=txt.lastIndexOf("}");
    if(s>=0&&e>s){const o=JSON.parse(txt.slice(s,e+1));if(o.c&&onComment)onComment(o.c);const idx=parseInt(o.i)||0;if(idx>=0&&idx<moves.length)return moves[idx];}
  }catch(e){console.warn(e);}
  return getAIMove(board,isRed,"hard");
}

// Board SVG
function ChessBoard({board,bt,pt,selected,legal,lastMove,inCheck,flipped,onCellClick}){
  const W=520,H=576,PAD=34;
  const cw=(W-PAD*2)/8,rh=(H-PAD*2)/9;
  const cx=c=>flipped?W-PAD-c*cw:PAD+c*cw;
  const cy=r=>flipped?H-PAD-r*rh:PAD+r*rh;
  const legalSet=new Set(legal.map(([r,c])=>r+","+c));

  const handleClick=e=>{
    const rect=e.currentTarget.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    let br=-1,bc=-1,bd=999;
    for(let r=0;r<10;r++)for(let c=0;c<9;c++){
      const d=Math.hypot(mx-cx(c),my-cy(r));
      if(d<bd){bd=d;br=r;bc=c;}
    }
    if(bd<28)onCellClick(br,bc);
  };

  return(
    <svg width={W} height={H} style={{borderRadius:8,cursor:"pointer",flexShrink:0}} onClick={handleClick}>
      <rect width={W} height={H} fill={bt.bg} rx="8"/>
      {Array.from({length:10},(_,r)=><line key={r} x1={PAD} y1={cy(r)} x2={W-PAD} y2={cy(r)} stroke={bt.lineColor} strokeWidth="0.8" opacity="0.7"/>)}
      {Array.from({length:9},(_,c)=>c===0||c===8?(
        <line key={c} x1={cx(c)} y1={PAD} x2={cx(c)} y2={H-PAD} stroke={bt.lineColor} strokeWidth="0.8" opacity="0.7"/>
      ):[
        <line key={c+"t"} x1={cx(c)} y1={PAD} x2={cx(c)} y2={cy(4)} stroke={bt.lineColor} strokeWidth="0.8" opacity="0.7"/>,
        <line key={c+"b"} x1={cx(c)} y1={cy(5)} x2={cx(c)} y2={H-PAD} stroke={bt.lineColor} strokeWidth="0.8" opacity="0.7"/>
      ])}
      {[[[0,3],[2,5]],[[7,3],[9,5]]].map(([[r1,c1],[r2,c2]],i)=>(
        <g key={i}>
          <line x1={cx(c1)} y1={cy(r1)} x2={cx(c2)} y2={cy(r2)} stroke={bt.lineColor} strokeWidth="0.7" opacity="0.5"/>
          <line x1={cx(c2)} y1={cy(r1)} x2={cx(c1)} y2={cy(r2)} stroke={bt.lineColor} strokeWidth="0.7" opacity="0.5"/>
        </g>
      ))}
      <text x={W/2-32} y={cy(4.5)+5} textAnchor="middle" fill={bt.labelColor} fontSize="13" opacity="0.55" fontFamily="serif">楚　河</text>
      <text x={W/2+32} y={cy(4.5)+5} textAnchor="middle" fill={bt.labelColor} fontSize="13" opacity="0.55" fontFamily="serif">汉　界</text>
      {lastMove&&[[lastMove[0],lastMove[1]],[lastMove[2],lastMove[3]]].map(([r,c],i)=>(
        <rect key={i} x={cx(c)-17} y={cy(r)-17} width={34} height={34} fill="rgba(255,235,0,0.15)" rx="17"/>
      ))}
      {legal.map(([r,c])=>(
        <circle key={r+","+c} cx={cx(c)} cy={cy(r)} r={board[r][c]?17:6}
          fill={board[r][c]?"rgba(255,80,80,0.15)":"rgba(100,200,100,0.5)"}
          stroke={board[r][c]?"rgba(255,80,80,0.4)":"rgba(60,180,60,0.6)"} strokeWidth="1.5"/>
      ))}
      {board.map((row,r)=>row.map((p,c)=>{
        if(!p)return null;
        const isSel=selected&&selected[0]===r&&selected[1]===c;
        const isKingInCheck=inCheck&&(p.char==="帥"||p.char==="將")&&isInCheck(board,p.isRed)&&p.isRed===board[r][c].isRed;
        return(
          <g key={r+","+c} transform={"translate("+cx(c)+","+cy(r)+")"}>
            {isSel&&<circle r={20} fill="rgba(255,215,0,0.25)" stroke="#FFD700" strokeWidth="2"/>}
            <circle r={16} fill={pt.bg} stroke={isKingInCheck?"#FF3333":pt.border} strokeWidth={isKingInCheck?2.5:1.5}
              style={isKingInCheck?{filter:"drop-shadow(0 0 5px #FF0000)"}:{}}/>
            <circle r={13.5} fill="none" stroke={pt.border} strokeWidth="0.5" opacity="0.4"/>
            <text textAnchor="middle" dominantBaseline="central" fontSize="12.5" fontWeight="700"
              fill={p.isRed?pt.red:pt.black} fontFamily="KaiTi,STKaiti,serif" y="0.5">{p.char}</text>
          </g>
        );
      }))}
    </svg>
  );
}

export default function XiangqiApp(){
  const[btId,setBtId]=useState("wood");
  const[ptId,setPtId]=useState("classic");
  const bt=BOARD_THEMES.find(t=>t.id===btId)||BOARD_THEMES[0];
  const pt=PIECE_THEMES.find(t=>t.id===ptId)||PIECE_THEMES[0];

  const[gameMode,setGameMode]=useState("2p");
  const[aiLevel,setAiLevel]=useState("medium");
  const[aiThinking,setAiThinking]=useState(false);
  const[claudeComment,setClaudeComment]=useState("");
  const[board,setBoard]=useState(makeBoard);
  const[sel,setSel]=useState(null);
  const[legal,setLegal]=useState([]);
  const[isRedTurn,setIsRedTurn]=useState(true);
  const[moveLog,setMoveLog]=useState([]);
  const[lastMove,setLastMove]=useState(null);
  const[status,setStatus]=useState("playing");
  const[inCheck,setInCheck]=useState(false);
  const[showVictory,setShowVictory]=useState(false);
  const[winner,setWinner]=useState("");
  const[showTheme,setShowTheme]=useState(false);
  const[flipped,setFlipped]=useState(false);
  const[activeTab,setActiveTab]=useState("game");
  const[hist,setHist]=useState([]);
  const[btSel,setBtSel]=useState("wood");
  const[ptSel,setPtSel]=useState("classic");

  const reset=useCallback(()=>{
    setBoard(makeBoard());setSel(null);setLegal([]);setIsRedTurn(true);
    setMoveLog([]);setLastMove(null);setStatus("playing");setInCheck(false);
    setShowVictory(false);setWinner("");setAiThinking(false);setClaudeComment("");setHist([]);
  },[]);

  const execMove=useCallback((fr,fc,tr,tc,brd,red)=>{
    const nb=applyMove(brd,fr,fc,tr,tc);
    const ms=toChineseNotation(brd,fr,fc,tr,tc);
    const nextRed=!red;
    const chk=isInCheck(nb,nextRed);
    const hasMv=hasAnyMove(nb,nextRed);
    setBoard(nb);setIsRedTurn(nextRed);
    setMoveLog(p=>[...p,ms]);setLastMove([fr,fc,tr,tc]);
    setSel(null);setLegal([]);setInCheck(chk);
    setHist(h=>[...h,{board:brd,isRedTurn:red}]);
    if(!hasMv){const w=red?"红方":"黑方";setWinner(w);setStatus("over");setShowVictory(true);}
  },[]);

  const handleClick=useCallback((r,c)=>{
    if(status!=="playing"||aiThinking)return;
    const humanRed=gameMode==="2p"||(gameMode!=="ai_red"&&gameMode!=="claude_red");
    const aiTurn=(gameMode==="ai_black"&&!isRedTurn)||(gameMode==="ai_red"&&isRedTurn)||(gameMode==="claude_black"&&!isRedTurn)||(gameMode==="claude_red"&&isRedTurn);
    if(aiTurn)return;
    if(sel){
      const[sr,sc]=sel;
      if(legal.some(([tr,tc])=>tr===r&&tc===c)){execMove(sr,sc,r,c,board,isRedTurn);return;}
    }
    const p=board[r][c];
    if(p&&p.isRed===isRedTurn){setSel([r,c]);setLegal(getLegalSafe(board,r,c));}
    else{setSel(null);setLegal([]);}
  },[board,sel,legal,isRedTurn,status,gameMode,aiThinking,execMove]);

  useEffect(()=>{
    if(status!=="playing")return;
    const isAI=(gameMode==="ai_black"&&!isRedTurn)||(gameMode==="ai_red"&&isRedTurn);
    const isClaude=(gameMode==="claude_black"&&!isRedTurn)||(gameMode==="claude_red"&&isRedTurn);
    if(!isAI&&!isClaude)return;
    const aiIsRed=gameMode==="ai_red"||gameMode==="claude_red";
    setAiThinking(true);
    if(isClaude){
      getClaudeMove(board,aiIsRed,c=>setClaudeComment(c)).then(mv=>{
        if(mv)execMove(mv[0],mv[1],mv[2],mv[3],board,isRedTurn);
        setAiThinking(false);
      }).catch(()=>setAiThinking(false));
    }else{
      const t=setTimeout(()=>{
        const mv=getAIMove(board,aiIsRed,aiLevel);
        if(mv)execMove(mv[0],mv[1],mv[2],mv[3],board,isRedTurn);
        setAiThinking(false);
      },350);
      return()=>clearTimeout(t);
    }
  },[board,isRedTurn,status,gameMode,aiLevel]);

  const undo=()=>{
    const steps=gameMode==="2p"?1:2;
    if(hist.length<steps)return;
    const prev=hist[hist.length-steps];
    setBoard(prev.board);setIsRedTurn(prev.isRedTurn);
    setHist(h=>h.slice(0,-steps));setMoveLog(m=>m.slice(0,-steps));
    setSel(null);setLegal([]);setInCheck(false);setStatus("playing");setShowVictory(false);setAiThinking(false);
  };

  const modes=[{v:"2p",l:"👥 双人"},{v:"ai_black",l:"🤖 执红战AI"},{v:"ai_red",l:"🔴 AI执红"},{v:"claude_black",l:"🧠 执红战Claude"},{v:"claude_red",l:"🧠 Claude执红"}];
  const tabs=[{id:"game",l:"对局",i:"♟"},{id:"school",l:"学习",i:"📚"},{id:"style",l:"样式",i:"🎨"},{id:"online",l:"联网",i:"🌐"}];

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0F0F1A,#1A1A2E,#16213E)",fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {showTheme&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={{background:"#1A1A2E",borderRadius:16,width:520,maxHeight:"85vh",overflow:"auto",border:"1px solid rgba(255,255,255,0.12)"}}>
            <div style={{background:"linear-gradient(135deg,#667eea,#764ba2)",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:"16px 16px 0 0"}}>
              <span style={{color:"#fff",fontWeight:700}}>🎨 棋盘棋子样式</span>
              <button onClick={()=>setShowTheme(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",width:26,height:26,borderRadius:"50%",cursor:"pointer"}}>✕</button>
            </div>
            <div style={{padding:14}}>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:2,marginBottom:8}}>棋盘</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                {BOARD_THEMES.map(t=>(
                  <div key={t.id} onClick={()=>setBtSel(t.id)} style={{padding:8,borderRadius:8,cursor:"pointer",border:"2px solid "+(btSel===t.id?"#667eea":"rgba(255,255,255,0.08)")}}>
                    <div style={{height:28,borderRadius:4,background:t.bg,marginBottom:4}}/>
                    <div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{t.name}</div>
                  </div>
                ))}
              </div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:2,marginBottom:8}}>棋子</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {PIECE_THEMES.map(t=>(
                  <div key={t.id} onClick={()=>setPtSel(t.id)} style={{padding:8,borderRadius:8,cursor:"pointer",border:"2px solid "+(ptSel===t.id?"#667eea":"rgba(255,255,255,0.08)")}}>
                    <div style={{display:"flex",justifyContent:"center",gap:3,padding:4,background:t.id==="neon"?"#0d0d1a":"rgba(255,255,255,0.05)",borderRadius:4,marginBottom:4}}>
                      {["帥","炮","將"].map((c,i)=>(
                        <svg key={i} width={24} height={24} viewBox="0 0 32 32">
                          <circle cx="16" cy="16" r="13" fill={t.bg} stroke={t.border} strokeWidth="1.5"/>
                          <text x="16" y="17" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={i<2?t.red:t.black} fontFamily="serif">{c}</text>
                        </svg>
                      ))}
                    </div>
                    <div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{t.name}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"8px 14px 14px",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>setShowTheme(false)} style={{padding:"7px 18px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:12}}>取消</button>
              <button onClick={()=>{setBtId(btSel);setPtId(ptSel);setShowTheme(false);}} style={{padding:"7px 22px",background:"linear-gradient(135deg,#667eea,#764ba2)",border:"none",borderRadius:8,cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700}}>应用</button>
            </div>
          </div>
        </div>
      )}

      {showVictory&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}}>
          <div style={{background:"linear-gradient(135deg,#1A1A2E,#16213E)",borderRadius:20,padding:"36px 48px",textAlign:"center",border:"1px solid rgba(201,168,76,0.4)"}}>
            <div style={{fontSize:52,marginBottom:12}}>🏆</div>
            <div style={{color:"#FFD700",fontSize:24,fontWeight:800,marginBottom:6}}>{winner}胜利！</div>
            <div style={{color:"rgba(255,255,255,0.5)",fontSize:13,marginBottom:24}}>共 {moveLog.length} 步</div>
            <div style={{display:"flex",gap:12,justifyContent:"center"}}>
              <button onClick={reset} style={{padding:"10px 28px",background:"linear-gradient(135deg,#C9A84C,#FFD700)",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:700,color:"#1A1A2E"}}>再来一局</button>
              <button onClick={()=>setShowVictory(false)} style={{padding:"10px 24px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,cursor:"pointer",fontSize:14,color:"rgba(255,255,255,0.7)"}}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 头部 */}
      <div style={{padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{color:"#C9A84C",fontSize:18,fontWeight:800,letterSpacing:2}}>♟ 中国象棋</div>
        <div style={{display:"flex",gap:6}}>
          {[{l:"新局",f:reset},{l:"悔棋",f:undo},{l:"翻转",f:()=>setFlipped(v=>!v)},{l:"换肤",f:()=>{setBtSel(btId);setPtSel(ptId);setShowTheme(true);}}].map(b=>(
            <button key={b.l} onClick={b.f} style={{padding:"5px 12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,cursor:"pointer",color:"rgba(255,255,255,0.65)",fontSize:12,fontWeight:600}}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div style={{flex:1,overflow:"auto"}}>
        {activeTab==="game"&&(
          <div style={{display:"flex",height:"100%"}}>
            {/* 左侧 */}
            <div style={{width:152,padding:"10px 8px",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,padding:9}}>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,letterSpacing:2,marginBottom:6}}>游戏模式</div>
                {modes.map(o=>(
                  <button key={o.v} onClick={()=>{setGameMode(o.v);reset();}} style={{display:"block",width:"100%",padding:"4px 7px",marginBottom:3,background:gameMode===o.v?"rgba(201,168,76,0.18)":"rgba(255,255,255,0.03)",border:"1px solid "+(gameMode===o.v?"#C9A84C":"rgba(255,255,255,0.07)"),borderRadius:6,cursor:"pointer",color:gameMode===o.v?"#FFD700":"rgba(255,255,255,0.45)",fontSize:10,textAlign:"left"}}>{o.l}</button>
                ))}
                {(gameMode==="ai_black"||gameMode==="ai_red")&&(
                  <div style={{marginTop:6,display:"flex",gap:3}}>
                    {[["easy","初"],["medium","中"],["hard","高"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setAiLevel(v)} style={{flex:1,padding:"3px 0",background:aiLevel===v?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:"1px solid "+(aiLevel===v?"#C9A84C":"rgba(255,255,255,0.1)"),borderRadius:5,cursor:"pointer",color:aiLevel===v?"#FFD700":"rgba(255,255,255,0.35)",fontSize:10}}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {[{isRed:false,lbl:"黑方"},{isRed:true,lbl:"红方"}].map(({isRed,lbl})=>(
                <div key={lbl} style={{background:"rgba(255,255,255,0.06)",borderRadius:9,padding:9,border:isRedTurn===isRed&&status==="playing"?"1px solid rgba(201,168,76,0.35)":"1px solid transparent"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:isRed?"rgba(229,57,53,0.25)":"rgba(30,30,30,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>♟</div>
                    <span style={{color:"rgba(255,255,255,0.7)",fontSize:12,fontWeight:600}}>{lbl}</span>
                    {isRedTurn===isRed&&status==="playing"&&<span style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#C9A84C",animation:"pulse 1.5s infinite"}}/>}
                  </div>
                  <div style={{color:"rgba(255,255,255,0.28)",fontSize:9,marginTop:3}}>
                    {isRed?(gameMode==="ai_red"?"AI":gameMode==="claude_red"?"Claude":"玩家"):(gameMode==="ai_black"?"AI":gameMode==="claude_black"?"Claude":"玩家")}
                  </div>
                </div>
              ))}
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:9,padding:9,flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,letterSpacing:2,marginBottom:5}}>着法记录</div>
                <div style={{overflow:"auto",flex:1}}>
                  {moveLog.length===0?<div style={{color:"rgba(255,255,255,0.18)",fontSize:10,textAlign:"center",marginTop:6}}>暂无</div>:
                    Array.from({length:Math.ceil(moveLog.length/2)},(_,i)=>(
                      <div key={i} style={{display:"flex",gap:4,marginBottom:2}}>
                        <span style={{color:"rgba(255,255,255,0.2)",fontSize:9,width:12}}>{i+1}.</span>
                        <span style={{color:"#FFB3B3",fontSize:9,flex:1}}>{moveLog[i*2]||""}</span>
                        <span style={{color:"#B3C8FF",fontSize:9,flex:1}}>{moveLog[i*2+1]||""}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* 中央 */}
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 0",gap:8}}>
              <div style={{height:26,display:"flex",alignItems:"center"}}>
                {aiThinking?(
                  <div style={{background:"rgba(201,168,76,0.12)",borderRadius:20,padding:"4px 14px",display:"flex",alignItems:"center",gap:7}}>
                    <span style={{display:"inline-block",animation:"spin 1s linear infinite",fontSize:13}}>⟳</span>
                    <span style={{color:"#C9A84C",fontSize:11}}>{gameMode.startsWith("claude")?"🧠 Claude思考中…":"AI思考中…"}</span>
                  </div>
                ):inCheck?(
                  <div style={{background:"rgba(229,57,53,0.15)",borderRadius:20,padding:"4px 14px",border:"1px solid rgba(229,57,53,0.35)"}}>
                    <span style={{color:"#FF6B6B",fontSize:12,fontWeight:700}}>⚠ 将军！</span>
                  </div>
                ):status==="over"?(
                  <span style={{color:"#FFD700",fontSize:13,fontWeight:700}}>{winner}胜利</span>
                ):(
                  <span style={{color:"rgba(255,255,255,0.35)",fontSize:12}}>{isRedTurn?"红方走棋":"黑方走棋"}</span>
                )}
              </div>

              <ChessBoard board={board} bt={bt} pt={pt} selected={sel} legal={legal} lastMove={lastMove} inCheck={inCheck} flipped={flipped} onCellClick={handleClick}/>

              {claudeComment&&gameMode.startsWith("claude")&&(
                <div style={{padding:"6px 14px",background:"rgba(201,168,76,0.08)",borderRadius:8,border:"1px solid rgba(201,168,76,0.2)",maxWidth:510}}>
                  <span style={{color:"#C9A84C",fontSize:10}}>🧠 </span>
                  <span style={{color:"rgba(255,255,255,0.65)",fontSize:11}}>{claudeComment}</span>
                </div>
              )}
            </div>

            {/* 右侧 */}
            <div style={{width:136,padding:"10px 8px",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",gap:7,flexShrink:0}}>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,letterSpacing:2,marginBottom:2}}>快速换肤</div>
              {[{b:"wood",p:"classic",l:"🪵 木纹"},{b:"green",p:"modern",l:"🟢 竞技"},{b:"dark",p:"dark2",l:"⚫ 暗黑"},{b:"jade",p:"jade2",l:"💎 翡翠"},{b:"midnight",p:"neon",l:"🌙 霓虹"}].map(s=>(
                <button key={s.b} onClick={()=>{setBtId(s.b);setPtId(s.p);}} style={{padding:"7px 8px",background:btId===s.b?"rgba(201,168,76,0.14)":"rgba(255,255,255,0.04)",border:"1px solid "+(btId===s.b?"#C9A84C":"rgba(255,255,255,0.07)"),borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:14,height:14,borderRadius:3,background:BOARD_THEMES.find(t=>t.id===s.b)?.bg,flexShrink:0}}/>
                  <span style={{color:"rgba(255,255,255,0.45)",fontSize:10}}>{s.l}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab==="school"&&(
          <div style={{padding:16}}>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:16,fontWeight:700,marginBottom:4}}>📚 象棋学校</div>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:12,marginBottom:14}}>学习经典杀法与战术</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {[
                {t:"马后炮",d:"马控将位，炮隔子将军，经典绝杀"},
                {t:"双车错",d:"两车交替将军，残局必学"},
                {t:"铁门栓",d:"兵冲将门，封死出路"},
                {t:"卧槽马",d:"马跳对方宫侧，配合炮威胁"},
                {t:"重炮杀",d:"两炮同列，后炮借前炮发力"},
                {t:"天地炮",d:"一炮打将，一炮镇底，双面夹击"},
              ].map((l,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.07)",borderRadius:12,padding:14,border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer"}} onClick={()=>setActiveTab("game")}>
                  <div style={{color:"#C9A84C",fontSize:11,marginBottom:2}}>第 {i+1} 课</div>
                  <div style={{color:"rgba(255,255,255,0.9)",fontSize:14,fontWeight:700,marginBottom:4}}>{l.t}</div>
                  <div style={{color:"rgba(255,255,255,0.4)",fontSize:11}}>{l.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==="style"&&(
          <div style={{padding:16}}>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:15,fontWeight:700,marginBottom:12}}>棋盘主题</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
              {BOARD_THEMES.map(t=>(
                <div key={t.id} onClick={()=>setBtId(t.id)} style={{padding:10,borderRadius:10,cursor:"pointer",border:"2px solid "+(btId===t.id?"#C9A84C":"rgba(255,255,255,0.08)"),background:btId===t.id?"rgba(201,168,76,0.08)":"rgba(255,255,255,0.04)"}}>
                  <div style={{height:32,borderRadius:5,background:t.bg,marginBottom:6}}/>
                  <div style={{color:"rgba(255,255,255,0.65)",fontSize:11}}>{t.name}</div>
                </div>
              ))}
            </div>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:15,fontWeight:700,marginBottom:12}}>棋子主题</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {PIECE_THEMES.map(t=>(
                <div key={t.id} onClick={()=>setPtId(t.id)} style={{padding:10,borderRadius:10,cursor:"pointer",border:"2px solid "+(ptId===t.id?"#C9A84C":"rgba(255,255,255,0.08)"),background:ptId===t.id?"rgba(201,168,76,0.08)":"rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",justifyContent:"center",gap:4,padding:4,background:t.id==="neon"?"#0d0d1a":"rgba(255,255,255,0.04)",borderRadius:5,marginBottom:5}}>
                    {["帥","炮","將"].map((c,i)=>(
                      <svg key={i} width={26} height={26} viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="13" fill={t.bg} stroke={t.border} strokeWidth="1.5"/>
                        <text x="16" y="17" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={i<2?t.red:t.black} fontFamily="serif">{c}</text>
                      </svg>
                    ))}
                  </div>
                  <div style={{color:"rgba(255,255,255,0.65)",fontSize:11}}>{t.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==="online"&&(
          <div style={{padding:40,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16}}>🌐</div>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:18,fontWeight:700,marginBottom:8}}>联网对战</div>
            <div style={{color:"rgba(255,255,255,0.35)",fontSize:13}}>功能开发中，敬请期待</div>
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",flexShrink:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:"9px 0",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderTop:activeTab===t.id?"2px solid #C9A84C":"2px solid transparent"}}>
            <span style={{fontSize:15}}>{t.i}</span>
            <span style={{fontSize:10,color:activeTab===t.id?"#C9A84C":"rgba(255,255,255,0.35)",fontWeight:activeTab===t.id?700:400}}>{t.l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
