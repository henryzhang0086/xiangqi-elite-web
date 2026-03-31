import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";

// ══════════════════════════════════════════════════════════════════════
// ① 核心常量 & 棋规引擎（复用 M1，精简版）
// ══════════════════════════════════════════════════════════════════════
const ROWS=10, COLS=9, RED="red", BLACK="black";
const CELL=52, PAD=36, BW=CELL*(COLS-1)+PAD*2, BH=CELL*(ROWS-1)+PAD*2;

const DISP={
  red:{将:"帅",士:"仕",象:"相",马:"傌",车:"俥",炮:"炮",兵:"兵"},
  black:{将:"将",士:"士",象:"象",马:"馬",车:"車",炮:"砲",兵:"卒"},
};
const PIECE_VAL={将:10000,车:900,炮:450,马:400,象:200,士:200,兵:100};

const INIT_FEN="rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r";
const FEN_MAP={r:"车",n:"马",b:"象",a:"士",k:"将",c:"炮",p:"兵"};
const FEN_REV=Object.fromEntries(Object.entries(FEN_MAP).map(([k,v])=>[v,k]));

function fenToBoard(fen){
  const rows=fen.split(" ")[0].split("/");
  const b=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  rows.forEach((row,r)=>{
    let c=0;
    for(const ch of row){
      if(/\d/.test(ch)){c+=+ch;}
      else{
        const upper=ch.toUpperCase();
        const color=ch===upper?RED:BLACK;
        b[r][c]={color,type:FEN_MAP[ch.toLowerCase()]};
        c++;
      }
    }
  });
  return b;
}

function boardToFen(board,turn=RED){
  const rows=board.map(row=>{
    let s="",empty=0;
    row.forEach(cell=>{
      if(!cell){empty++;}
      else{
        if(empty){s+=empty;empty=0;}
        const ch=FEN_REV[cell.type]||"p";
        s+=cell.color===RED?ch.toUpperCase():ch;
      }
    });
    if(empty) s+=empty;
    return s;
  });
  return rows.join("/")+` ${turn===RED?"r":"b"}`;
}

function createBoard(){return fenToBoard(INIT_FEN);}
const inB=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
const inPalace=(r,c,color)=>{
  const rs=color===RED?[7,8,9]:[0,1,2];
  return rs.includes(r)&&c>=3&&c<=5;
};

function rawMoves(board,r,c){
  const p=board[r][c]; if(!p) return [];
  const {color,type}=p, opp=color===RED?BLACK:RED, res=[];
  const add=(nr,nc)=>{if(inB(nr,nc)&&(!board[nr][nc]||board[nr][nc].color===opp))res.push([nr,nc]);};
  switch(type){
    case"将":[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(inB(nr,nc)&&inPalace(nr,nc,color))add(nr,nc);});break;
    case"士":[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(inB(nr,nc)&&inPalace(nr,nc,color))add(nr,nc);});break;
    case"象":[[2,2],[2,-2],[-2,2],[-2,-2]].forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(!inB(nr,nc))return;if(color===RED&&nr<5)return;if(color===BLACK&&nr>4)return;if(!board[r+dr/2][c+dc/2])add(nr,nc);});break;
    case"马":[[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]].forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(!inB(nr,nc))return;const lr=r+(Math.abs(dr)===2?dr/2:0),lc=c+(Math.abs(dc)===2?dc/2:0);if(!board[lr][lc])add(nr,nc);});break;
    case"车":[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{let nr=r+dr,nc=c+dc;while(inB(nr,nc)){if(board[nr][nc]){add(nr,nc);break;}res.push([nr,nc]);nr+=dr;nc+=dc;}});break;
    case"炮":[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{let nr=r+dr,nc=c+dc,j=false;while(inB(nr,nc)){if(!j){if(board[nr][nc])j=true;else res.push([nr,nc]);}else{if(board[nr][nc]){add(nr,nc);break;}}nr+=dr;nc+=dc;}});break;
    case"兵":{const fwd=color===RED?-1:1;add(r+fwd,c);if(color===RED?r<=4:r>=5){add(r,c+1);add(r,c-1);}break;}
  }
  return res;
}

function isCheck(board,color){
  let kr=-1,kc=-1;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]?.color===color&&board[r][c]?.type==="将"){kr=r;kc=c;}
  if(kr<0)return true;
  const opp=color===RED?BLACK:RED;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    if(board[r][c]?.color===opp&&rawMoves(board,r,c).some(([mr,mc])=>mr===kr&&mc===kc))return true;
  // 飞将
  let ok=-1,oc=-1;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]?.color===opp&&board[r][c]?.type==="将"){ok=r;oc=c;}
  if(oc===kc&&ok>=0){let bl=false;for(let rr=Math.min(kr,ok)+1;rr<Math.max(kr,ok);rr++)if(board[rr][kc]){bl=true;break;}if(!bl)return true;}
  return false;
}

function applyMove(board,from,to){
  const nb=board.map(row=>[...row]);
  nb[to[0]][to[1]]=nb[from[0]][from[1]];
  nb[from[0]][from[1]]=null;
  return nb;
}

function legalMoves(board,r,c){
  const p=board[r][c]; if(!p) return [];
  return rawMoves(board,r,c).filter(([nr,nc])=>!isCheck(applyMove(board,[r,c],[nr,nc]),p.color));
}

function hasAnyLegal(board,color){
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    if(board[r][c]?.color===color&&legalMoves(board,r,c).length>0)return true;
  return false;
}

// 中文着法
const CNUMS_R=["一","二","三","四","五","六","七","八","九"];
const CNUMS_B=["１","２","３","４","５","６","７","８","９"];
function toChineseMove(board,from,to){
  const[fr,fc]=from,[tr,tc]=to,p=board[fr][fc];if(!p)return"??";
  const isR=p.color===RED,disp=DISP[p.color][p.type],nums=isR?CNUMS_R:CNUMS_B;
  const fc_=isR?nums[COLS-1-fc]:nums[fc];
  let dir,steps;
  if(fr===tr){dir="平";steps=isR?nums[COLS-1-tc]:nums[tc];}
  else if((isR&&tr<fr)||(!isR&&tr>fr)){
    dir="进";steps=(p.type==="马"||p.type==="象"||p.type==="士")?(isR?nums[COLS-1-tc]:nums[tc]):nums[Math.abs(tr-fr)-1];
  } else {
    dir="退";steps=(p.type==="马"||p.type==="象"||p.type==="士")?(isR?nums[COLS-1-tc]:nums[tc]):nums[Math.abs(tr-fr)-1];
  }
  return`${disp}${fc_}${dir}${steps}`;
}

// 简单 AI
function aiMove(board,color){
  const moves=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    if(board[r][c]?.color===color)legalMoves(board,r,c).forEach(to=>moves.push({from:[r,c],to}));
  if(!moves.length)return null;
  const caps=moves.filter(m=>board[m.to[0]][m.to[1]]);
  caps.sort((a,b)=>PIECE_VAL[board[b.to[0]][b.to[1]].type]-PIECE_VAL[board[a.to[0]][a.to[1]].type]);
  return caps.length?caps[0]:moves[Math.floor(Math.random()*moves.length)];
}

// ══════════════════════════════════════════════════════════════════════
// ② 主题系统
// ══════════════════════════════════════════════════════════════════════
const BT={
  classic:{id:"classic",name:"经典木纹",board:"#D4C4A0",grid:"#5C4A32",border:"#8B7355",river:"rgba(92,74,50,0.15)"},
  ink:    {id:"ink",    name:"水墨",    board:"#F0E8D8",grid:"#4A4035",border:"#8B7D6B",river:"rgba(74,64,53,0.1)"},
  night:  {id:"night",  name:"夜间",    board:"#2C3E50",grid:"#8899AA",border:"#34495E",river:"rgba(136,153,170,0.08)"},
  green:  {id:"green",  name:"竞技",    board:"#1B5E20",grid:"#FFD600",border:"#2E7D32",river:"rgba(255,214,0,0.1)"},
};
const PT={
  classic:{id:"classic",name:"木质",redColor:"#8B0000",blackColor:"#1A1A1A",bg:"#D4B896",borderColor:"#A08060"},
  golden: {id:"golden", name:"鎏金", redColor:"#BF360C",blackColor:"#1A1A1A",bg:"#FFD54F",borderColor:"#FFA000"},
  ink:    {id:"ink",    name:"水墨", redColor:"#B71C1C",blackColor:"#212121",bg:"#FFF8E1",borderColor:"#D7CCC8"},
};

// ══════════════════════════════════════════════════════════════════════
// ③ M3 教学数据：象棋学校课程库
// ══════════════════════════════════════════════════════════════════════
const SCHOOL_COURSES = [
  {
    id:"A", name:"基本杀法", icon:"⚔️", color:"#E8C170", total:8,
    desc:"白脸将、马后炮、铁门栓等经典杀法",
    lessons:[
      {
        id:"A1", title:"白脸将", difficulty:1,
        desc:"利用将帅不能照面的规则，逼迫对方将死。",
        fen:"4k4/4a4/3aK4/9/9/9/9/9/9/9 r",
        solution:[],
        hint:"红帅移到与黑将同列，利用飞将规则形成杀势",
        explanation:"白脸将是最基础的杀法。当红帅与黑将在同一列，中间没有任何棋子阻隔时，即构成「飞将」，黑方必须立即解除。"
      },
      {
        id:"A2", title:"马后炮", difficulty:2,
        desc:"马控制将的逃路，炮从后方将军形成绝杀。",
        fen:"3k5/9/3C5/9/9/9/9/9/4N4/3K5 r",
        solution:[[[8,4],[6,3]]],
        hint:"马跳至将前，使炮形成绝杀",
        explanation:"马后炮：马跳到将前方格，限制将的移动，炮从后方沿同列（行）将军，形成绝杀。此为象棋中最常见的基础联合杀法。"
      },
      {
        id:"A3", title:"铁门栓", difficulty:2,
        desc:"车控制底线，封锁将的退路。",
        fen:"3k5/9/3R5/9/9/9/9/9/9/3K5 r",
        solution:[[[2,3],[0,3]]],
        hint:"车直接冲入对方底线将军",
        explanation:"铁门栓：车直接冲入对方底线（将的起始行），形成将军。若将无路可逃即为绝杀。适合车占据有利纵线时使用。"
      },
      {
        id:"A4", title:"双车错", difficulty:3,
        desc:"两车交替将军，形成必杀。",
        fen:"3k5/9/3R5/9/9/9/9/9/9/2RK5 r",
        solution:[[[2,3],[2,4]],[[9,2],[0,2]]],
        hint:"两车轮流将军，对方无法同时应对",
        explanation:"双车错：两车交替将军，一车将军，将跑开，另一车再将军，如此循环，将无路可逃。是车类杀法中威力最强的一种。"
      },
      {id:"A5",title:"闷宫",difficulty:3,desc:"用炮或马封锁将的所有退路后将军。",fen:"2bkab3/4a4/4C4/9/9/9/9/9/9/4K4 r",solution:[],hint:"炮直接将军，将被自己的士象闷死",explanation:"闷宫：将被自己的棋子和对方棋子四面包围，当对方将军时无路可逃。常见于将守卫过多反而自缚的局面。"},
      {id:"A6",title:"炮辗丹砂",difficulty:4,desc:"炮利用不同的炮架连续将军。",fen:"3k5/4C4/9/9/9/9/9/9/4C4/3K5 r",solution:[],hint:"双炮互为炮架，交替将军",explanation:"炮辗丹砂：双炮互为炮架，一炮将军，对方用子阻挡成另一炮架，另一炮再将军，形成连环将杀。"},
      {id:"A7",title:"天地炮",difficulty:4,desc:"一炮占中路，另一炮在底线，形成联合攻势。",fen:"3k5/9/4C4/9/9/9/4C4/9/9/3K5 r",solution:[],hint:"两炮分居要道，相互配合",explanation:"天地炮：两炮一上一下占据要道，形成立体攻势。上炮（天炮）压制将的上方，下炮（地炮）攻击底线，协同作战。"},
      {id:"A8",title:"重炮",difficulty:2,desc:"两炮同列，前炮为后炮的炮架。",fen:"3k5/3C5/3C5/9/9/9/9/9/9/3K5 r",solution:[[[1,3],[0,3]]],hint:"前炮冲入底线将军，后炮为炮架",explanation:"重炮：两炮在同一条线上，前炮直接将军，由于后炮充当炮架，前炮的将军无法被阻挡（除非吃掉前炮）。"},
    ]
  },
  {
    id:"B", name:"实用残局", icon:"♟️", color:"#A8C8E8", total:6,
    desc:"100个经典残局精选，车马炮兵运用",
    lessons:[
      {id:"B1",title:"车兵胜单将",difficulty:1,desc:"车配合兵逼将入角落。",fen:"3k5/9/9/9/9/9/9/9/3R5/3K1P3 r",solution:[],hint:"用车将对方将逼到角落，兵配合封路",explanation:"车兵胜单将是最基础的残局之一。车负责驱逐将，兵负责封住逃路，最终在角落形成将杀。"},
      {id:"B2",title:"马低兵胜单将",difficulty:3,desc:"马兵配合，精确计算步法。",fen:"4k4/9/9/9/9/9/9/9/9/4KN1P1 r",solution:[],hint:"马控制将的逃路，兵步步紧逼",explanation:"马低兵胜单将需要精确计算。马控制关键格子，兵推进封锁，最终形成绝杀。此局型需要约20手以内完成。"},
      {id:"B3",title:"炮兵胜单将",difficulty:3,desc:"炮兵组合，利用炮的特殊攻击方式。",fen:"9/9/3k5/9/9/9/9/9/3C5/3K2P2 r",solution:[],hint:"炮占据要道，兵向前推进形成配合",explanation:"炮兵胜单将：炮控制纵线，兵推进封锁，利用炮隔子打的特性形成将杀。注意炮需要炮架才能将军。"},
      {id:"B4",title:"车马胜车",difficulty:4,desc:"以多子之利逐步实现胜势。",fen:"3k5/3r5/9/9/9/9/9/9/3R4N/3K5 r",solution:[],hint:"马控制对方车的活动，车协助进攻",explanation:"车马胜车是常见的残局类型。己方多一马，通过精确的子力配合，逐步压缩对方空间，最终实现绝杀。"},
      {id:"B5",title:"双马胜单将",difficulty:4,desc:"两马协作，互相补充弱点。",fen:"9/4k4/9/9/9/9/9/9/9/4KNN3 r",solution:[],hint:"两马互相保护，共同封锁将的逃路",explanation:"双马胜单将：两马互为补充，一马控制将前方格子，另一马绕后将军。双马的协作可以弥补单马的跛脚弱点。"},
      {id:"B6",title:"车炮胜车炮",difficulty:5,desc:"同等子力下，利用位置优势取胜。",fen:"3k5/3r3c1/9/9/9/9/9/9/3R3C1/3K5 r",solution:[],hint:"占据优势位置，利用子力配合制造威胁",explanation:"车炮胜车炮是高级残局。双方子力相当，胜负取决于子力位置、将位强弱和攻防转换。需要深度计算。"},
    ]
  },
  {
    id:"C", name:"子力定式", icon:"🎯", color:"#C8A8E8", total:5,
    desc:"各兵种基本定式和配合技巧",
    lessons:[
      {id:"C1",title:"车的基本运用",difficulty:1,desc:"车是象棋中最强的子，掌握车的基本走法和摆放原则。",fen:INIT_FEN,solution:[],hint:"车应尽早出动，占据要道",explanation:"车是象棋中价值最高的棋子（价值约相当于马+炮）。基本原则：①尽早出动车；②争夺中路和兵线；③避免车被困住；④双车互相保护。"},
      {id:"C2",title:"炮的攻防原理",difficulty:2,desc:"炮隔子打的独特机制，进攻与防守要点。",fen:INIT_FEN,solution:[],hint:"炮需要炮架才能将军，注意保护炮架",explanation:"炮的独特性在于「隔子打」——必须跳过一个棋子（炮架）才能吃子。进攻时注意建立炮架；防守时注意不要给对方当炮架。中炮布局是最常见的开局。"},
      {id:"C3",title:"马的灵活运用",difficulty:2,desc:"马走日的特点，跳马路线规划。",fen:INIT_FEN,solution:[],hint:"马在中心控制最多格子，避免被别腿",explanation:"马的控制范围随位置变化明显。在中心区域马可控制最多8个格子；在边角最少只有2个。基本原则：①尽早跳出马；②避免被别腿；③马在中心比在边路强。"},
      {id:"C4",title:"士象的防守价值",difficulty:2,desc:"士象协同防守将的安全。",fen:INIT_FEN,solution:[],hint:"士象应保持完整，形成严密防线",explanation:"士象是将的主要护卫。基本原则：①保持士象完整；②士走对角线形成防线；③象飞田字，注意塞象眼；④将不宜过于主动，以防暴露。"},
      {id:"C5",title:"兵的推进艺术",difficulty:3,desc:"兵过河后的运用，配合大子进攻。",fen:INIT_FEN,solution:[],hint:"过河兵比未过河兵价值更高，要善加利用",explanation:"兵（卒）过河后威力大增，可以横移。基本原则：①有条件时尽量推进兵；②过河兵与车马炮配合进攻；③两兵相连更强；④不轻易丢失过河兵。"},
    ]
  },
  {
    id:"D", name:"中局妙手", icon:"💡", color:"#A8E8C8", total:5,
    desc:"300个中局战术练习精选",
    lessons:[
      {id:"D1",title:"发现将军",difficulty:3,desc:"移动一子揭开后面棋子的攻击线路。",fen:"3k1ab2/4a4/b3C4/2p1p4/p3P4/6B2/P1P6/3AB4/4A4/2BK5 r",solution:[],hint:"找到能通过移动揭开将军的棋子",explanation:"发现将军（闪将）：移动一个棋子，露出后面另一个棋子的攻击线，对将形成威胁。被移动的棋子同时也可以攻击对方。"},
      {id:"D2",title:"双将",difficulty:4,desc:"同时对将形成两路将军威胁。",fen:"3k5/4aC3/4b4/9/9/9/9/4B4/4A4/3K1R3 r",solution:[],hint:"寻找能同时形成两路攻击的着法",explanation:"双将：一手棋同时形成两路或多路将军威胁，对方只能应对一路，另一路即成绝杀。是中局战术中最具威力的手段之一。"},
      {id:"D3",title:"牵制战术",difficulty:3,desc:"牵制对方关键棋子，使其无法移动。",fen:"rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r",solution:[],hint:"找出对方被牵制的棋子，加以利用",explanation:"牵制：使对方某个棋子因为移动会导致更大损失而无法移动。被牵制的棋子等于暂时从棋盘上消失，可利用其空缺发动攻势。"},
      {id:"D4",title:"弃子战术",difficulty:4,desc:"主动放弃子力换取更大利益。",fen:"r1bakabnr/1cn6/1p2b2c1/p1p1p1p1p/9/2P6/P3P1P1P/1C2B1N2/9/RNBAKA1NR r",solution:[],hint:"计算弃子后的子力和局势变化",explanation:"弃子战术：主动送出子力，换取局势上更大的优势。常见形式：①弃子开路；②弃子引离；③弃子强制兑换；④弃子破坏对方防线。"},
      {id:"D5",title:"兑子简化",difficulty:3,desc:"在优势时通过兑子简化局面，锁定胜势。",fen:"rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r",solution:[],hint:"在有利局面下主动寻求兑子",explanation:"兑子简化：在己方占优时，通过交换棋子减少棋盘上的棋子数量，使局势更加清晰，优势更易维持。避免变化复杂时对方有机可乘。"},
    ]
  },
  {
    id:"E", name:"全局兵法", icon:"🏛️", color:"#E8A8A8", total:4,
    desc:"从布局到残局的完整战略思维",
    lessons:[
      {id:"E1",title:"中炮布局",difficulty:2,desc:"最常见的开局——中炮对屏风马。",fen:INIT_FEN,solution:[],hint:"炮二平五，马八进七，车九进一",explanation:"中炮开局：红方炮二平五占据中路，是进攻性最强的开局。黑方屏风马（马2进3、马8进7）是最稳健的应对。双方围绕中路展开激烈争夺。"},
      {id:"E2",title:"飞象局",difficulty:2,desc:"以象开局，稳健防守反击。",fen:INIT_FEN,solution:[],hint:"象三进五，稳固防线后择机反击",explanation:"飞象局：开局先飞象，构筑稳固防线。飞象局着重防守，待对方攻势受阻后转入反击。适合注重稳健、不喜欢激烈对攻的棋手。"},
      {id:"E3",title:"中局转换",difficulty:4,desc:"从布局优势转化为中局攻势。",fen:"r1bak1bnr/1cn4c1/1p2b4/p1p1p1p1p/9/2P6/P3P1P1P/N1C1B1N2/9/R1BAKAB1R r",solution:[],hint:"利用子力优势，找准进攻时机",explanation:"中局转换是象棋技术的核心。从布局进入中局，需要：①评估子力和位置；②找到对方弱点；③组织攻势；④防止对方反击。子力活跃度是关键。"},
      {id:"E4",title:"残局技术",difficulty:4,desc:"优势转化为胜局的精确技术。",fen:"3k5/9/3C5/9/9/9/9/9/9/1R1K5 r",solution:[],hint:"双车配合，逐步缩小将的活动范围",explanation:"残局技术：将优势转化为胜局需要精确计算。基本思路：①集中优势子力；②限制对方将的活动；③避免不必要的风险；④步步为营，稳健推进。"},
    ]
  },
  {
    id:"F", name:"江湖排局", icon:"🎭", color:"#E8C8A8", total:4,
    desc:"经典江湖残局和排局收集",
    lessons:[
      {id:"F1",title:"七星聚会",difficulty:5,desc:"经典江湖排局，红方先行求胜。",fen:"1Ckak4/9/2C1b4/9/9/9/9/9/9/R3K4 r",solution:[],hint:"观察将的被围困局面，找到突破口",explanation:"七星聚会是著名的江湖排局之一。局面看似平静，实则杀机四伏。解题关键在于找到精妙的弃子手段，打开局面。"},
      {id:"F2",title:"华容道",difficulty:5,desc:"多子配合，精妙入微。",fen:"r1bak4/4a4/4b4/9/9/9/9/4B4/4A4/R1BAK4 r",solution:[],hint:"寻找子力最优配合路线",explanation:"华容道取自三国演义典故，寓意棋路精妙如曹操脱困。此类排局着重展示子力的最优配合，每步棋都必须精确到位。"},
      {id:"F3",title:"单鞭救主",difficulty:4,desc:"孤车解救被困将帅。",fen:"rnb1kabnr/4a4/2c1bc3/p1p1p1p1p/9/9/P1P1P1P1P/2C1BC3/4A4/RNB1K1NR r",solution:[],hint:"利用车的强大机动性，解救被困将帅",explanation:"单鞭救主：在将帅面临威胁时，通过精确的车路运用化解危机。展示了车在防守中的重要作用。"},
      {id:"F4",title:"蜻蜓点水",difficulty:5,desc:"轻灵的弃子手法，出人意料的攻杀。",fen:"3k5/3ab4/3ab4/9/9/9/9/3AB4/3AB4/3K5 r",solution:[],hint:"士象严密防守，如何突破？",explanation:"蜻蜓点水：面对严密的士象防线，通过轻灵的弃子手法找到突破口。展示了象棋进攻中\"以巧破力\"的艺术。"},
    ]
  },
];

// ══════════════════════════════════════════════════════════════════════
// ④ M3 棋谱系统数据结构
// ══════════════════════════════════════════════════════════════════════
const SAMPLE_GAMES = [
  {
    id:"g1", title:"当代名局·胡荣华vs柳大华", date:"1980-01-15",
    red:"胡荣华", black:"柳大华", result:"红胜", event:"全国象棋个人赛",
    moves:["炮二平五","马８进７","马二进三","车９平８","车一平二","炮８平９","车二进六","马２进３","炮八平七","车１平２"],
    opening:"中炮对屏风马",tags:["名局","中炮","屏风马"],
  },
  {
    id:"g2", title:"特级大师对抗·赵国荣vs许银川", date:"1995-08-20",
    red:"赵国荣", black:"许银川", result:"和局", event:"象棋擂台赛",
    moves:["炮二平五","马８进７","马二进三","车９平８","车一平二","炮８平６","兵三进一","马２进３","马八进七","车１平２"],
    opening:"中炮对反宫马",tags:["特级大师","和局"],
  },
  {
    id:"g3", title:"人机对战·测试局", date:"2026-03-09",
    red:"玩家", black:"AI", result:"进行中", event:"人机对战",
    moves:[],opening:"初始布局",tags:["人机"],
  },
];

// FEN 转 PGN 格式（简化版）
function exportPGN(game){
  const header=`[Event "${game.event}"]\n[Date "${game.date}"]\n[Red "${game.red}"]\n[Black "${game.black}"]\n[Result "${game.result}"]\n[Opening "${game.opening}"]\n\n`;
  const moves=game.moves.map((m,i)=>i%2===0?`${Math.floor(i/2)+1}. ${m}`:`${m}`).join(" ");
  return header+moves+" "+game.result;
}

// ══════════════════════════════════════════════════════════════════════
// ⑤ M2 引擎管理系统
// ══════════════════════════════════════════════════════════════════════
const ENGINE_CONFIGS = [
  {id:"elite",name:"XiangqiElite-Pro",version:"2.0.1",type:"NNUE",threads:4,hash:256,depth:20,status:"running",elo:2800,desc:"内置高性能引擎，NNUE神经网络"},
  {id:"pikafish",name:"Pikafish",version:"1.2",type:"NNUE",threads:2,hash:128,depth:18,status:"stopped",elo:2600,desc:"开源强力引擎"},
  {id:"elephant",name:"象棋大师",version:"3.5",type:"传统α-β",threads:1,hash:64,depth:15,status:"stopped",elo:2200,desc:"传统搜索引擎，适合入门"},
];

// ══════════════════════════════════════════════════════════════════════
// ⑥ SVG 棋盘组件（复用优化版）
// ══════════════════════════════════════════════════════════════════════
function Board({board,selected,hints,lastMove,bt,pt,onCellClick,flipped,inCheck,compact=false}){
  const cell=compact?38:CELL, pad=compact?24:PAD;
  const bw=cell*(COLS-1)+pad*2, bh=cell*(ROWS-1)+pad*2;
  const cx=(c)=>pad+(flipped?COLS-1-c:c)*cell;
  const cy=(r)=>pad+(flipped?ROWS-1-r:r)*cell;
  const stars=[[0,0],[0,2],[0,6],[0,8],[2,1],[2,7],[7,1],[7,7],[9,0],[9,2],[9,6],[9,8]];
  return(
    <svg width={bw} height={bh} style={{borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.3)",display:"block"}}>
      <defs>
        <linearGradient id="bg2" x1="0" y1="0" x2={bw} y2={bh} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={bt.board}/><stop offset="100%" stopColor={bt.border} stopOpacity="0.5"/>
        </linearGradient>
        <radialGradient id="pr2" cx="38%" cy="32%"><stop offset="0%" stopColor={pt.bg}/><stop offset="100%" stopColor={pt.borderColor} stopOpacity="0.85"/></radialGradient>
        <radialGradient id="pb2" cx="38%" cy="32%"><stop offset="0%" stopColor={pt.bg}/><stop offset="100%" stopColor={pt.borderColor} stopOpacity="0.85"/></radialGradient>
        <filter id="ps2"><feDropShadow dx="1" dy="2" stdDeviation="1.2" floodOpacity="0.3"/></filter>
        <filter id="cg2"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width={bw} height={bh} fill="url(#bg2)" rx="8"/>
      <rect x={pad-5} y={pad-5} width={bw-pad*2+10} height={bh-pad*2+10} fill="none" stroke={bt.border} strokeWidth="2.5" rx="3"/>
      {Array.from({length:ROWS}).map((_,i)=><line key={`h${i}`} x1={pad} y1={pad+i*cell} x2={bw-pad} y2={pad+i*cell} stroke={bt.grid} strokeWidth="1" opacity="0.7"/>)}
      {Array.from({length:COLS}).map((_,i)=>{
        const x=pad+i*cell;
        if(i===0||i===COLS-1)return<line key={`v${i}`} x1={x} y1={pad} x2={x} y2={bh-pad} stroke={bt.grid} strokeWidth="1" opacity="0.7"/>;
        return<g key={`v${i}`}><line x1={x} y1={pad} x2={x} y2={pad+4*cell} stroke={bt.grid} strokeWidth="1" opacity="0.7"/><line x1={x} y1={pad+5*cell} x2={x} y2={bh-pad} stroke={bt.grid} strokeWidth="1" opacity="0.7"/></g>;
      })}
      <line x1={pad} y1={pad+4*cell} x2={pad} y2={pad+5*cell} stroke={bt.grid} strokeWidth="1" opacity="0.7"/>
      <line x1={bw-pad} y1={pad+4*cell} x2={bw-pad} y2={pad+5*cell} stroke={bt.grid} strokeWidth="1" opacity="0.7"/>
      {[[0,0],[7,0]].map(([br],i)=><g key={i}><line x1={pad+3*cell} y1={pad+br*cell} x2={pad+5*cell} y2={pad+(br+2)*cell} stroke={bt.grid} strokeWidth="0.8" opacity="0.5"/><line x1={pad+5*cell} y1={pad+br*cell} x2={pad+3*cell} y2={pad+(br+2)*cell} stroke={bt.grid} strokeWidth="0.8" opacity="0.5"/></g>)}
      <rect x={pad+1} y={pad+4*cell+1} width={bw-pad*2-2} height={cell-2} fill={bt.river}/>
      {!compact&&<><text x={bw/2-40} y={pad+4.55*cell} fontSize="13" fill={bt.grid} opacity="0.45" fontFamily="KaiTi,STKaiti,serif" letterSpacing="2">楚　河</text><text x={bw/2+12} y={pad+4.55*cell} fontSize="13" fill={bt.grid} opacity="0.45" fontFamily="KaiTi,STKaiti,serif" letterSpacing="2">汉　界</text></>}
      {stars.map(([sr,sc],i)=>{const px=cx(sc),py=cy(sr);return<g key={i}>{[[-4,-4],[-4,4],[4,-4],[4,4]].map(([ox,oy],j)=><g key={j}><line x1={px+ox} y1={py+oy} x2={px+ox+(oy>0?0:2)} y2={py+oy+(ox>0?0:2)} stroke={bt.grid} strokeWidth="1.1" opacity="0.45"/><line x1={px+ox} y1={py+oy} x2={px+ox+(oy>0?2:0)} y2={py+oy+(ox>0?2:0)} stroke={bt.grid} strokeWidth="1.1" opacity="0.45"/></g>)}</g>;})}
      {lastMove&&[lastMove.from,lastMove.to].map(([lr,lc],i)=><rect key={i} x={cx(lc)-cell/2+2} y={cy(lr)-cell/2+2} width={cell-4} height={cell-4} fill="rgba(255,220,0,0.18)" rx="4" stroke="rgba(255,200,0,0.4)" strokeWidth="1"/>)}
      {selected&&<circle cx={cx(selected[1])} cy={cy(selected[0])} r={cell*0.46} fill="rgba(255,235,0,0.22)" stroke="rgba(255,200,0,0.8)" strokeWidth="2"/>}
      {hints.map(([hr,hc],i)=>board[hr][hc]
        ?<circle key={i} cx={cx(hc)} cy={cy(hr)} r={cell*0.46} fill="none" stroke="rgba(255,80,80,0.7)" strokeWidth="2.5" strokeDasharray="4 2"/>
        :<circle key={i} cx={cx(hc)} cy={cy(hr)} r={compact?6:8} fill="rgba(80,200,80,0.65)"/>
      )}
      {Array.from({length:ROWS}).map((_,r)=>Array.from({length:COLS}).map((_,c)=>{
        const p=board[r][c]; if(!p) return null;
        const px=cx(c),py=cy(r),isR=p.color===RED,col=isR?pt.redColor:pt.blackColor;
        const ch=DISP[p.color][p.type],ck=inCheck&&p.type==="将"&&p.color===inCheck;
        const R=cell*0.44;
        return<g key={`${r}-${c}`} onClick={()=>onCellClick&&onCellClick(r,c)} style={{cursor:onCellClick?"pointer":"default"}} filter={ck?"url(#cg2)":"url(#ps2)"}>
          {ck&&<circle cx={px} cy={py} r={R+4} fill="rgba(255,50,50,0.3)" stroke="rgba(255,80,80,0.8)" strokeWidth="2"/>}
          <circle cx={px} cy={py} r={R} fill={`url(#p${isR?"r":"b"}2)`} stroke={pt.borderColor} strokeWidth="1.2"/>
          <circle cx={px} cy={py} r={R*0.8} fill="none" stroke={col} strokeWidth="0.7" opacity="0.4"/>
          <text x={px} y={py} textAnchor="middle" dominantBaseline="central" fontSize={R*0.98} fontWeight="700" fill={col} fontFamily="KaiTi,STKaiti,FangSong,serif">{ch}</text>
        </g>;
      }))}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ⑦ 页面组件
// ══════════════════════════════════════════════════════════════════════

// —— 对弈主界面 ——
function GamePage({bt,pt}){
  const[board,setBoard]=useState(createBoard);
  const[selected,setSelected]=useState(null);
  const[hints,setHints]=useState([]);
  const[turn,setTurn]=useState(RED);
  const[history,setHistory]=useState([]);
  const[lastMove,setLastMove]=useState(null);
  const[inCheck,setInCheck]=useState(null);
  const[status,setStatus]=useState("playing");
  const[winner,setWinner]=useState(null);
  const[vsAI,setVsAI]=useState(false);
  const[aiThinking,setAiThinking]=useState(false);
  const[flipped,setFlipped]=useState(false);
  const[reviewIdx,setReviewIdx]=useState(-1);
  const[timers,setTimers]=useState({[RED]:1800,[BLACK]:1800});
  const[depth,setDepth]=useState(1);
  const[score,setScore]=useState(0);
  const[pv,setPv]=useState([]);
  const[nps,setNps]=useState(0);
  const[engineOn,setEngineOn]=useState(true);
  const timerRef=useRef(), engineRef=useRef();

  // 计时器
  useEffect(()=>{
    if(status!=="playing"){clearInterval(timerRef.current);return;}
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>setTimers(p=>{
      const n={...p,[turn]:p[turn]-1};
      if(n[turn]<=0){setStatus("timeout");setWinner(turn===RED?BLACK:RED);}
      return n;
    }),1000);
    return()=>clearInterval(timerRef.current);
  },[turn,status]);

  // 引擎模拟
  useEffect(()=>{
    if(!engineOn){clearInterval(engineRef.current);return;}
    setDepth(1);setScore(0);setPv([]);setNps(0);
    let d=1;
    engineRef.current=setInterval(()=>{
      d++;
      const sc=(Math.random()-0.48)*2.5;
      setDepth(d);setScore(p=>p*0.4+sc*0.6);setNps(Math.floor(50000+Math.random()*300000));
      const mvs=[];
      for(let r=0;r<ROWS&&mvs.length<4;r++)for(let c=0;c<COLS&&mvs.length<4;c++)
        if(board[r][c]?.color===turn){const lm=legalMoves(board,r,c);if(lm.length)mvs.push(toChineseMove(board,[r,c],lm[Math.floor(Math.random()*lm.length)]));}
      setPv(mvs);
      if(d>=14)clearInterval(engineRef.current);
    },180);
    return()=>clearInterval(engineRef.current);
  },[lastMove,engineOn]);

  // AI
  useEffect(()=>{
    if(!vsAI||turn!==BLACK||status!=="playing"||aiThinking)return;
    setAiThinking(true);
    const t=setTimeout(()=>{
      const mv=aiMove(board,BLACK);
      if(mv)doMove(board,mv.from,mv.to,BLACK);
      setAiThinking(false);
    },500+Math.random()*500);
    return()=>clearTimeout(t);
  },[vsAI,turn,board,status,aiThinking]);

  function doMove(b,from,to,ct){
    const ms=toChineseMove(b,from,to);
    const nb=applyMove(b,from,to);
    const nt=ct===RED?BLACK:RED;
    const ck=isCheck(nb,nt)?nt:null;
    setBoard(nb);setTurn(nt);setLastMove({from,to});setSelected(null);setHints([]);
    setInCheck(ck);setHistory(h=>[...h,{from,to,moveStr:ms,board:b,turn:ct}]);setReviewIdx(-1);
    if(!hasAnyLegal(nb,nt)){setStatus(ck?"checkmate":"stalemate");setWinner(ct);}
  }

  function handleClick(r,c){
    if(status!=="playing"||reviewIdx!==-1)return;
    if(vsAI&&turn===BLACK)return;
    const p=board[r][c];
    if(selected){
      const[sr,sc]=selected;
      if(hints.some(([hr,hc])=>hr===r&&hc===c)){doMove(board,[sr,sc],[r,c],turn);return;}
    }
    if(p?.color===turn){setSelected([r,c]);setHints(legalMoves(board,r,c));}
    else{setSelected(null);setHints([]);}
  }

  function newGame(){
    setBoard(createBoard());setTurn(RED);setSelected(null);setHints([]);
    setHistory([]);setLastMove(null);setInCheck(null);setStatus("playing");
    setWinner(null);setTimers({[RED]:1800,[BLACK]:1800});setReviewIdx(-1);setAiThinking(false);
  }

  const displayBoard=reviewIdx===-1?board:useMemo(()=>{
    let b=createBoard();
    for(let i=0;i<reviewIdx&&i<history.length;i++)b=applyMove(b,history[i].from,history[i].to);
    return b;
  },[reviewIdx,history]);

  const sc=score.toFixed(2), redPct=Math.min(100,Math.max(0,50+score*10));

  return(
    <div style={{display:"flex",height:"100%",gap:0,overflow:"hidden"}}>
      {/* 左栏 */}
      <div style={{width:190,borderRight:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",padding:12,gap:10,background:"rgba(0,0,0,0.15)",overflowY:"auto"}}>
        {/* 黑方 */}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:10,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#1a1a2e,#2a2a4e)",border:"2px solid #444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>♞</div>
            <div><div style={{fontSize:12,fontWeight:700,color:"#A8C8E8"}}>黑方</div><div style={{fontSize:10,color:"#555"}}>{vsAI?"AI":"玩家"}</div></div>
          </div>
          <div style={{fontFamily:"monospace",fontSize:20,fontWeight:700,color:timers[BLACK]<30&&turn===BLACK?"#FF4444":"#A8C8E8",letterSpacing:2,padding:"3px 8px",background:turn===BLACK?"rgba(255,255,255,0.07)":"transparent",borderRadius:6,transition:"all 0.3s"}}>
            {String(Math.floor(timers[BLACK]/60)).padStart(2,"0")}:{String(timers[BLACK]%60).padStart(2,"0")}
          </div>
        </div>

        {/* 着法列表 */}
        <div style={{flex:1,background:"rgba(255,255,255,0.03)",borderRadius:10,padding:10,border:"1px solid rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",minHeight:0}}>
          <div style={{fontSize:10,color:"#555",letterSpacing:1,marginBottom:8,fontWeight:600}}>MOVE LIST</div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:1}}>
            {history.length===0&&<div style={{fontSize:11,color:"#333",textAlign:"center",marginTop:16}}>尚无着法</div>}
            {Array.from({length:Math.ceil(history.length/2)}).map((_,i)=>{
              const rm=history[i*2], bm=history[i*2+1];
              return<div key={i} style={{display:"flex",gap:3,alignItems:"center"}}>
                <span style={{fontSize:10,color:"#333",width:16,textAlign:"right",flexShrink:0}}>{i+1}</span>
                {[rm,bm].map((mv,j)=>mv?<button key={j} onClick={()=>setReviewIdx(i*2+j+1)} style={{flex:1,padding:"2px 3px",borderRadius:3,cursor:"pointer",background:reviewIdx===i*2+j+1?"rgba(232,193,112,0.18)":"transparent",border:`1px solid ${reviewIdx===i*2+j+1?"rgba(232,193,112,0.4)":"transparent"}`,color:j===0?"#E8C170":"#A8C8E8",fontSize:11,fontFamily:"KaiTi,STKaiti,serif",textAlign:"center"}}>{mv.moveStr}</button>:<div key={j} style={{flex:1}}/>)}
              </div>;
            })}
          </div>
          <div style={{display:"flex",gap:3,marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            {[["⏮",()=>setReviewIdx(0)],["◀",()=>setReviewIdx(i=>Math.max(0,i===-1?history.length-1:i-1))],["▶",()=>setReviewIdx(i=>i>=history.length-1?-1:i+1)],["⏭",()=>setReviewIdx(-1)]].map(([icon,fn],i)=>(
              <button key={i} onClick={fn} style={{flex:1,height:24,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#888",borderRadius:4,cursor:"pointer",fontSize:11}}>{icon}</button>
            ))}
          </div>
          {reviewIdx!==-1&&<div style={{fontSize:10,color:"#E8C170",textAlign:"center",marginTop:4}}>复盘 {reviewIdx}/{history.length}</div>}
        </div>

        {/* 红方 */}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:10,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#3e1010,#6b2020)",border:"2px solid #8B4545",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>♜</div>
            <div><div style={{fontSize:12,fontWeight:700,color:"#E8C170"}}>红方</div><div style={{fontSize:10,color:"#555"}}>玩家</div></div>
          </div>
          <div style={{fontFamily:"monospace",fontSize:20,fontWeight:700,color:timers[RED]<30&&turn===RED?"#FF4444":"#E8C170",letterSpacing:2,padding:"3px 8px",background:turn===RED?"rgba(255,255,255,0.07)":"transparent",borderRadius:6,transition:"all 0.3s"}}>
            {String(Math.floor(timers[RED]/60)).padStart(2,"0")}:{String(timers[RED]%60).padStart(2,"0")}
          </div>
        </div>
      </div>

      {/* 中央棋盘 */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 8px",gap:8,background:"rgba(0,0,0,0.08)",position:"relative"}}>
        {/* 状态提示 */}
        <div style={{height:28,display:"flex",alignItems:"center",gap:12}}>
          {status==="playing"&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 12px",borderRadius:20,background:turn===RED?"rgba(183,28,28,0.2)":"rgba(30,50,100,0.25)",border:`1px solid ${turn===RED?"rgba(183,28,28,0.4)":"rgba(100,140,200,0.3)"}`}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:turn===RED?"#E57373":"#7399C8",animation:"pulse 1.5s infinite"}}/>
            <span style={{fontSize:11,color:turn===RED?"#E8C170":"#A8C8E8",fontWeight:700}}>{aiThinking?"AI 思考中...":`${turn===RED?"红方":"黑方"}走棋`}</span>
          </div>}
          {status!=="playing"&&<div style={{padding:"4px 16px",borderRadius:20,background:status==="checkmate"?"rgba(183,28,28,0.5)":"rgba(50,100,50,0.5)",color:"#fff",fontSize:12,fontWeight:700}}>
            {status==="checkmate"?`🏆 ${winner===RED?"红":"黑"}方胜`:status==="stalemate"?"🤝 困毙和局":"⏱ 超时"}
          </div>}
          {inCheck&&status==="playing"&&<div style={{padding:"3px 10px",borderRadius:20,background:"rgba(255,100,0,0.5)",color:"#fff",fontSize:11,fontWeight:700,animation:"pulse 1s infinite"}}>⚡ 将军</div>}
          <div style={{display:"flex",gap:6}}>
            <button onClick={newGame} style={btnStyle("#E8C170")}>新局</button>
            <button onClick={()=>setFlipped(f=>!f)} style={btnStyle("#A8C8E8")}>翻转</button>
            <button onClick={()=>{setVsAI(v=>!v);newGame();}} style={btnStyle(vsAI?"#C8A8E8":"#888")}>{vsAI?"人机":"双人"}</button>
          </div>
        </div>
        <Board board={displayBoard} selected={reviewIdx===-1?selected:null} hints={reviewIdx===-1?hints:[]} lastMove={reviewIdx===-1?lastMove:reviewIdx>0?{from:history[reviewIdx-1].from,to:history[reviewIdx-1].to}:null} bt={bt} pt={pt} onCellClick={handleClick} flipped={flipped} inCheck={reviewIdx===-1?inCheck:null}/>
        <div style={{display:"flex",opacity:0.3}}>
          {(flipped?["一","二","三","四","五","六","七","八","九"]:["九","八","七","六","五","四","三","二","一"]).map((n,i)=>(
            <div key={i} style={{width:CELL,textAlign:"center",fontSize:10,color:"#888",fontFamily:"KaiTi,serif"}}>{n}</div>
          ))}
        </div>
      </div>

      {/* 右栏：引擎面板 */}
      <div style={{width:210,borderLeft:"1px solid rgba(255,255,255,0.07)",background:"rgba(0,0,0,0.15)",padding:12,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:10,color:"#555",letterSpacing:1,fontWeight:600}}>ENGINE</div>
          <button onClick={()=>setEngineOn(e=>!e)} style={{...btnStyle(engineOn?"#4CAF50":"#666"),padding:"2px 8px",fontSize:10}}>
            <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:engineOn?"#4CAF50":"#444",marginRight:4,boxShadow:engineOn?"0 0 4px #4CAF50":"none"}}/>
            {engineOn?"运行中":"已暂停"}
          </button>
        </div>

        {/* 评估条 */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:10,border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:11,color:"#E8C170",fontWeight:700}}>红 {score>0?"+":""}{sc}</span>
            <span style={{fontSize:11,color:"#A8C8E8",fontWeight:700}}>黑</span>
          </div>
          <div style={{height:12,borderRadius:6,overflow:"hidden",background:"#111",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{height:"100%",width:`${redPct}%`,background:"linear-gradient(90deg,#C62828,#EF5350)",transition:"width 0.4s"}}/>
          </div>
        </div>

        {/* 数据 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[["深度",depth+"层"],["NPS",nps>999999?(nps/1000000).toFixed(1)+"M":(nps/1000).toFixed(0)+"K"]].map(([l,v])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.03)",borderRadius:6,padding:"6px 8px",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:9,color:"#555",marginBottom:2}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#e0e0e0",fontFamily:"monospace"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* PV */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:8,border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontSize:9,color:"#555",marginBottom:6,letterSpacing:1}}>主变 PV</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {pv.length?pv.map((mv,i)=>(
              <span key={i} style={{background:i===0?"rgba(232,193,112,0.18)":"rgba(255,255,255,0.05)",border:`1px solid ${i===0?"rgba(232,193,112,0.35)":"rgba(255,255,255,0.08)"}`,color:i===0?"#E8C170":"#aaa",padding:"2px 6px",borderRadius:4,fontSize:11,fontFamily:"KaiTi,STKaiti,serif"}}>{i+1}.{mv}</span>
            )):<span style={{fontSize:11,color:"#333"}}>等待...</span>}
          </div>
        </div>

        {/* FEN 导出 */}
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10}}>
          <div style={{fontSize:10,color:"#555",marginBottom:6,letterSpacing:1}}>FEN 导出</div>
          <div style={{fontSize:9,color:"#666",background:"rgba(0,0,0,0.3)",borderRadius:4,padding:"4px 6px",wordBreak:"break-all",fontFamily:"monospace",marginBottom:6,userSelect:"all"}}>
            {boardToFen(board,turn).substring(0,50)}...
          </div>
          <button onClick={()=>navigator.clipboard?.writeText(boardToFen(board,turn))} style={{...btnStyle("#A8C8E8"),width:"100%",padding:"5px",fontSize:11}}>📋 复制 FEN</button>
        </div>

        {/* 引擎信息 */}
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10}}>
          <div style={{fontSize:10,color:"#555",marginBottom:4}}>XiangqiElite-Pro v2.0</div>
          <div style={{fontSize:10,color:"#444"}}>NNUE · Lazy SMP · UCCI</div>
          <div style={{fontSize:10,color:"#333",marginTop:2}}>Elo ≈ 2800</div>
        </div>
      </div>
    </div>
  );
}

// —— M2 引擎管理页 ——
function EnginePage(){
  const[engines,setEngines]=useState(ENGINE_CONFIGS);
  const[selected,setSelected]=useState("elite");
  const[editing,setEditing]=useState(null);
  const sel=engines.find(e=>e.id===selected)||engines[0];

  const toggle=(id)=>setEngines(es=>es.map(e=>e.id===id?{...e,status:e.status==="running"?"stopped":"running"}:e));
  const update=(id,key,val)=>setEngines(es=>es.map(e=>e.id===id?{...e,[key]:val}:e));

  return(
    <div style={{display:"flex",height:"100%",gap:0}}>
      {/* 引擎列表 */}
      <div style={{width:260,borderRight:"1px solid rgba(255,255,255,0.07)",padding:16,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontSize:11,color:"#555",letterSpacing:1,fontWeight:600,marginBottom:4}}>引擎管理</div>
        {engines.map(e=>(
          <div key={e.id} onClick={()=>setSelected(e.id)} style={{padding:12,borderRadius:10,cursor:"pointer",background:selected===e.id?"rgba(232,193,112,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${selected===e.id?"rgba(232,193,112,0.3)":"rgba(255,255,255,0.07)"}`,transition:"all 0.2s"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:700,color:selected===e.id?"#E8C170":"#ccc"}}>{e.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:e.status==="running"?"#4CAF50":"#555",boxShadow:e.status==="running"?"0 0 4px #4CAF50":"none"}}/>
                <span style={{fontSize:10,color:e.status==="running"?"#4CAF50":"#555"}}>{e.status==="running"?"运行":"停止"}</span>
              </div>
            </div>
            <div style={{fontSize:10,color:"#555"}}>v{e.version} · {e.type} · Elo {e.elo}</div>
          </div>
        ))}
        <button style={{...btnStyle("#A8C8E8"),padding:"8px",marginTop:4,fontSize:12}}>＋ 导入引擎</button>
      </div>

      {/* 引擎配置 */}
      <div style={{flex:1,padding:20,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#E8C170",marginBottom:2}}>{sel.name}</div>
            <div style={{fontSize:12,color:"#666"}}>v{sel.version} · {sel.desc}</div>
          </div>
          <button onClick={()=>toggle(sel.id)} style={{
            padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",
            fontWeight:700,fontSize:13,
            background:sel.status==="running"?"rgba(211,47,47,0.2)":"rgba(76,175,80,0.2)",
            color:sel.status==="running"?"#EF5350":"#66BB6A",
            border:`1px solid ${sel.status==="running"?"rgba(211,47,47,0.4)":"rgba(76,175,80,0.4)"}`,
          }}>{sel.status==="running"?"⏹ 停止引擎":"▶ 启动引擎"}</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
          {[
            {label:"搜索深度",key:"depth",min:1,max:30,unit:"层"},
            {label:"线程数",key:"threads",min:1,max:16,unit:"个"},
            {label:"Hash 大小",key:"hash",min:16,max:2048,unit:"MB"},
          ].map(({label,key,min,max,unit})=>(
            <div key={key} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:14,border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:11,color:"#888",marginBottom:8}}>{label}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="range" min={min} max={max} value={sel[key]}
                  onChange={e=>update(sel.id,key,+e.target.value)}
                  style={{flex:1,accentColor:"#E8C170"}}/>
                <span style={{fontSize:14,fontWeight:700,color:"#E8C170",fontFamily:"monospace",minWidth:50,textAlign:"right"}}>{sel[key]} {unit}</span>
              </div>
            </div>
          ))}
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:14,border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:11,color:"#888",marginBottom:8}}>引擎类型</div>
            <div style={{fontSize:14,fontWeight:700,color:"#A8C8E8"}}>{sel.type}</div>
            <div style={{fontSize:10,color:"#555",marginTop:2}}>估计 Elo: {sel.elo}</div>
          </div>
        </div>

        {/* 开局库 */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:14,border:"1px solid rgba(255,255,255,0.07)",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#ccc",marginBottom:10}}>开局库设置</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {["内置开局库（3万型）","大师对局库（50万）","自定义开局库"].map((lib,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,background:i===0?"rgba(232,193,112,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${i===0?"rgba(232,193,112,0.3)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",fontSize:12,color:i===0?"#E8C170":"#888"}}>
                {i===0&&"✓ "}{lib}
              </div>
            ))}
          </div>
        </div>

        {/* 后台思考 */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:14,border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#ccc",marginBottom:10}}>高级选项</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {label:"启用后台思考（Ponder）",desc:"对手走棋时引擎提前思考",default:true},
              {label:"MultiPV 多变例展示",desc:"同时计算多条候选路线",default:true},
              {label:"自动保存分析结果",desc:"将引擎分析结果保存到棋谱",default:false},
            ].map((opt,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:12,color:"#ccc"}}>{opt.label}</div>
                  <div style={{fontSize:10,color:"#555"}}>{opt.desc}</div>
                </div>
                <div style={{width:36,height:20,borderRadius:10,background:opt.default?"rgba(76,175,80,0.4)":"rgba(255,255,255,0.1)",border:`1px solid ${opt.default?"rgba(76,175,80,0.6)":"rgba(255,255,255,0.15)"}`,position:"relative",cursor:"pointer"}}>
                  <div style={{position:"absolute",top:2,left:opt.default?18:2,width:14,height:14,borderRadius:"50%",background:opt.default?"#66BB6A":"#555",transition:"all 0.2s"}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// —— M3 棋谱系统页 ——
function RecordPage({bt,pt}){
  const[games,setGames]=useState(SAMPLE_GAMES);
  const[activeGame,setActiveGame]=useState(null);
  const[filter,setFilter]=useState("all");
  const[searchQ,setSearchQ]=useState("");
  const[tab,setTab]=useState("list"); // list | edit | import
  const[editBoard,setEditBoard]=useState(createBoard);
  const[editPiece,setEditPiece]=useState(null); // {color,type}
  const[importText,setImportText]=useState("");
  const[importError,setImportError]=useState("");
  const[replayIdx,setReplayIdx]=useState(0);
  const replayRef=useRef();

  const filtered=useMemo(()=>games.filter(g=>{
    if(filter==="win"&&g.result!=="红胜")return false;
    if(filter==="lose"&&g.result!=="黑胜")return false;
    if(filter==="draw"&&g.result!=="和局")return false;
    if(searchQ&&!g.title.includes(searchQ)&&!g.red.includes(searchQ)&&!g.black.includes(searchQ))return false;
    return true;
  }),[games,filter,searchQ]);

  // 棋谱回放
  const replayBoard=useMemo(()=>{
    if(!activeGame)return createBoard();
    let b=createBoard();
    // 简化：只展示起始局面（真实需解析着法）
    return b;
  },[activeGame,replayIdx]);

  // 局面编辑器
  const EDIT_PIECES=[
    {color:RED,type:"将"},{color:RED,type:"车"},{color:RED,type:"马"},{color:RED,type:"炮"},
    {color:RED,type:"象"},{color:RED,type:"士"},{color:RED,type:"兵"},
    {color:BLACK,type:"将"},{color:BLACK,type:"车"},{color:BLACK,type:"马"},{color:BLACK,type:"炮"},
    {color:BLACK,type:"象"},{color:BLACK,type:"士"},{color:BLACK,type:"兵"},
  ];

  function handleEditClick(r,c){
    if(editPiece){
      setEditBoard(b=>{const nb=b.map(row=>[...row]);nb[r][c]=editPiece.type?{...editPiece}:null;return nb;});
    }
  }

  function parseFEN(fen){
    try{const b=fenToBoard(fen);setEditBoard(b);setImportError("");}
    catch(e){setImportError("FEN 格式错误");}
  }

  const fenStr=boardToFen(editBoard);

  return(
    <div style={{display:"flex",height:"100%",gap:0}}>
      {/* 左栏 */}
      <div style={{width:280,borderRight:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",background:"rgba(0,0,0,0.12)"}}>
        {/* 顶部 tab */}
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          {[["list","对局记录"],["edit","局面编辑"],["import","导入导出"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"10px 4px",background:"none",border:"none",borderBottom:`2px solid ${tab===k?"#E8C170":"transparent"}`,color:tab===k?"#E8C170":"#666",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:tab===k?700:400,transition:"all 0.2s"}}>{l}</button>
          ))}
        </div>

        {tab==="list"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {/* 搜索 */}
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="搜索对局..." style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"6px 10px",color:"#ccc",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <div style={{display:"flex",gap:4,marginTop:8}}>
                {[["all","全部"],["win","胜"],["lose","负"],["draw","和"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setFilter(k)} style={{flex:1,padding:"4px",background:filter===k?"rgba(232,193,112,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${filter===k?"rgba(232,193,112,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:4,color:filter===k?"#E8C170":"#666",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>{l}</button>
                ))}
              </div>
            </div>
            {/* 列表 */}
            <div style={{flex:1,overflowY:"auto",padding:8}}>
              {filtered.map(g=>(
                <div key={g.id} onClick={()=>setActiveGame(g)} style={{padding:10,borderRadius:8,cursor:"pointer",marginBottom:6,background:activeGame?.id===g.id?"rgba(232,193,112,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${activeGame?.id===g.id?"rgba(232,193,112,0.3)":"rgba(255,255,255,0.06)"}`,transition:"all 0.2s"}}>
                  <div style={{fontSize:12,fontWeight:700,color:activeGame?.id===g.id?"#E8C170":"#ccc",marginBottom:3,lineHeight:1.3}}>{g.title}</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:10,color:"#E8C170"}}>{g.red}</span>
                    <span style={{fontSize:10,color:"#888"}}>vs</span>
                    <span style={{fontSize:10,color:"#A8C8E8"}}>{g.black}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:"#555"}}>{g.date}</span>
                    <span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:g.result==="红胜"?"rgba(183,28,28,0.3)":g.result==="和局"?"rgba(100,100,100,0.3)":"rgba(30,50,100,0.3)",color:g.result==="红胜"?"#EF5350":g.result==="和局"?"#888":"#7399C8",fontWeight:700}}>{g.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="edit"&&(
          <div style={{flex:1,padding:12,overflow:"auto"}}>
            <div style={{fontSize:11,color:"#888",marginBottom:8}}>选择棋子放置到棋盘</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:10}}>
              {EDIT_PIECES.map((ep,i)=>{
                const sel=editPiece?.color===ep.color&&editPiece?.type===ep.type;
                return<div key={i} onClick={()=>setEditPiece(sel?null:ep)} style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,cursor:"pointer",background:sel?"rgba(232,193,112,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sel?"rgba(232,193,112,0.4)":"rgba(255,255,255,0.07)"}`,fontSize:12,color:ep.color===RED?"#E8C170":"#A8C8E8",fontFamily:"KaiTi,STKaiti,serif"}}>{DISP[ep.color][ep.type]}</div>;
              })}
              <div onClick={()=>setEditPiece({color:null,type:null})} style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,cursor:"pointer",background:editPiece?.type===null?"rgba(255,50,50,0.2)":"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",fontSize:12,color:"#888"}}>✕</div>
            </div>
            <button onClick={()=>setEditBoard(createBoard())} style={{...btnStyle("#888"),width:"100%",padding:"6px",fontSize:11,marginBottom:6}}>重置初始局面</button>
            <button onClick={()=>setEditBoard(Array.from({length:ROWS},()=>Array(COLS).fill(null)))} style={{...btnStyle("#888"),width:"100%",padding:"6px",fontSize:11}}>清空棋盘</button>
            <div style={{marginTop:10,fontSize:10,color:"#444",fontFamily:"monospace",background:"rgba(0,0,0,0.3)",borderRadius:4,padding:"4px 6px",wordBreak:"break-all"}}>{fenStr}</div>
            <button onClick={()=>navigator.clipboard?.writeText(fenStr)} style={{...btnStyle("#A8C8E8"),width:"100%",padding:"5px",fontSize:10,marginTop:4}}>复制 FEN</button>
          </div>
        )}

        {tab==="import"&&(
          <div style={{flex:1,padding:12,overflow:"auto"}}>
            <div style={{fontSize:11,color:"#888",marginBottom:8}}>粘贴 FEN / PGN</div>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder="粘贴 FEN 局面字符串或 PGN 棋谱..." style={{width:"100%",height:100,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:8,color:"#ccc",fontSize:11,fontFamily:"monospace",resize:"vertical",outline:"none"}}/>
            {importError&&<div style={{color:"#EF5350",fontSize:11,marginTop:4}}>{importError}</div>}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <button onClick={()=>parseFEN(importText.trim())} style={{...btnStyle("#E8C170"),flex:1,padding:"6px",fontSize:11}}>加载 FEN</button>
              <button onClick={()=>{setTab("edit");setImportText("");}} style={{...btnStyle("#A8C8E8"),flex:1,padding:"6px",fontSize:11}}>编辑局面</button>
            </div>
            <div style={{marginTop:12,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10}}>
              <div style={{fontSize:11,color:"#888",marginBottom:8}}>导出</div>
              {activeGame&&<button onClick={()=>{const pgn=exportPGN(activeGame);navigator.clipboard?.writeText(pgn);}} style={{...btnStyle("#C8A8E8"),width:"100%",padding:"6px",fontSize:11,marginBottom:6}}>复制当前棋谱 PGN</button>}
              <button onClick={()=>navigator.clipboard?.writeText(boardToFen(editBoard))} style={{...btnStyle("#A8E8C8"),width:"100%",padding:"6px",fontSize:11}}>复制局面 FEN</button>
            </div>
          </div>
        )}
      </div>

      {/* 右侧详情 */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {tab==="edit"?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <Board board={editBoard} selected={null} hints={[]} lastMove={null} bt={bt} pt={pt} onCellClick={handleEditClick} flipped={false} inCheck={null}/>
          </div>
        ):activeGame?(
          <div style={{flex:1,overflow:"auto",padding:16}}>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:800,color:"#E8C170",marginBottom:4}}>{activeGame.title}</div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8}}>
                {[["赛事",activeGame.event],["日期",activeGame.date],["开局",activeGame.opening]].map(([k,v])=>(
                  <span key={k} style={{fontSize:11,color:"#666"}}>{k}：<span style={{color:"#aaa"}}>{v}</span></span>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{padding:"4px 12px",borderRadius:6,background:"rgba(183,28,28,0.2)",border:"1px solid rgba(183,28,28,0.3)",fontSize:13,fontWeight:700,color:"#E8C170"}}>{activeGame.red}</div>
                <div style={{color:"#555",fontSize:12}}>vs</div>
                <div style={{padding:"4px 12px",borderRadius:6,background:"rgba(30,50,100,0.2)",border:"1px solid rgba(30,50,100,0.3)",fontSize:13,fontWeight:700,color:"#A8C8E8"}}>{activeGame.black}</div>
                <div style={{marginLeft:"auto",padding:"4px 12px",borderRadius:6,background:activeGame.result==="红胜"?"rgba(183,28,28,0.2)":"rgba(100,100,100,0.2)",border:"1px solid rgba(255,255,255,0.1)",fontSize:12,fontWeight:700,color:activeGame.result==="红胜"?"#EF5350":"#888"}}>{activeGame.result}</div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
                {activeGame.tags.map(t=><span key={t} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#888"}}>#{t}</span>)}
              </div>
            </div>

            {/* 着法记录 */}
            <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:12,border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:11,color:"#666",marginBottom:10,letterSpacing:1}}>着法序列</div>
              {activeGame.moves.length===0?(
                <div style={{color:"#333",fontSize:12}}>暂无记录</div>
              ):(
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {Array.from({length:Math.ceil(activeGame.moves.length/2)}).map((_,i)=>{
                    const rm=activeGame.moves[i*2], bm=activeGame.moves[i*2+1];
                    return<div key={i} style={{display:"flex",gap:4,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#444",minWidth:16,textAlign:"right"}}>{i+1}.</span>
                      <span style={{fontSize:12,color:"#E8C170",fontFamily:"KaiTi,serif",padding:"2px 6px",background:"rgba(232,193,112,0.1)",borderRadius:4}}>{rm}</span>
                      {bm&&<span style={{fontSize:12,color:"#A8C8E8",fontFamily:"KaiTi,serif",padding:"2px 6px",background:"rgba(168,200,232,0.1)",borderRadius:4}}>{bm}</span>}
                    </div>;
                  })}
                </div>
              )}
            </div>

            {/* 操作 */}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{const pgn=exportPGN(activeGame);navigator.clipboard?.writeText(pgn);}} style={{...btnStyle("#A8C8E8"),padding:"8px 16px",fontSize:12}}>📋 复制 PGN</button>
              <button style={{...btnStyle("#E8C170"),padding:"8px 16px",fontSize:12}}>▶ 加载到棋盘</button>
              <button style={{...btnStyle("#C8A8E8"),padding:"8px 16px",fontSize:12}}>🔍 引擎分析</button>
            </div>
          </div>
        ):(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"#333"}}>
            <div style={{fontSize:32}}>📚</div>
            <div style={{fontSize:13}}>选择一局对局查看详情</div>
          </div>
        )}
      </div>
    </div>
  );
}

// —— M4 象棋学校页 ——
function SchoolPage({bt,pt}){
  const[view,setView]=useState("list"); // list | course | lesson
  const[activeSeries,setActiveSeries]=useState(null);
  const[activeLesson,setActiveLesson]=useState(null);
  const[progress,setProgress]=useState({}); // {lessonId: "done"|"progress"}
  const[showHint,setShowHint]=useState(false);
  const[showExplain,setShowExplain]=useState(false);
  const[lessonBoard,setLessonBoard]=useState(null);
  const[lessonSel,setLessonSel]=useState(null);
  const[lessonHints,setLessonHints]=useState([]);
  const[attempt,setAttempt]=useState(null); // "correct"|"wrong"|null
  const[stepIdx,setStepIdx]=useState(0);

  const totalDone=Object.values(progress).filter(v=>v==="done").length;
  const totalLessons=SCHOOL_COURSES.reduce((s,c)=>s+c.lessons.length,0);

  function startLesson(lesson){
    setActiveLesson(lesson);
    setLessonBoard(fenToBoard(lesson.fen));
    setLessonSel(null);setLessonHints([]);setAttempt(null);setShowHint(false);setShowExplain(false);setStepIdx(0);
    setView("lesson");
    if(!progress[lesson.id])setProgress(p=>({...p,[lesson.id]:"progress"}));
  }

  function handleLessonClick(r,c){
    if(!lessonBoard||attempt==="correct")return;
    const p=lessonBoard[r][c];
    if(lessonSel){
      const[sr,sc]=lessonSel;
      if(lessonHints.some(([hr,hc])=>hr===r&&hc===c)){
        // 检查是否正确（若有解）
        const lesson=activeLesson;
        const sol=lesson.solution;
        let correct=true;
        if(sol&&sol.length>0){
          const expected=sol[stepIdx];
          if(expected&&!(expected[0][0]===sr&&expected[0][1]===sc&&expected[1][0]===r&&expected[1][1]===c)){correct=false;}
        }
        const nb=applyMove(lessonBoard,[sr,sc],[r,c]);
        setLessonBoard(nb);setLessonSel(null);setLessonHints([]);
        if(correct){
          setAttempt("correct");setProgress(p=>({...p,[lesson.id]:"done"}));
        } else {
          setAttempt("wrong");
          setTimeout(()=>{setAttempt(null);setLessonBoard(fenToBoard(activeLesson.fen));},1000);
        }
        return;
      }
    }
    if(p?.color===RED){setLessonSel([r,c]);setLessonHints(legalMoves(lessonBoard,r,c));}
    else{setLessonSel(null);setLessonHints([]);}
  }

  const diffDots=(d)=>Array.from({length:5}).map((_,i)=><span key={i} style={{fontSize:8,color:i<d?"#E8C170":"#333"}}>●</span>);

  return(
    <div style={{display:"flex",height:"100%",gap:0,overflow:"hidden"}}>

      {view==="list"&&(
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:20,fontWeight:800,color:"#E8C170",marginBottom:4}}>象棋学校</div>
            <div style={{fontSize:12,color:"#666"}}>已完成 {totalDone} / {totalLessons} 课时</div>
            <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.1)",marginTop:8,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(totalDone/totalLessons)*100}%`,background:"linear-gradient(90deg,#E8C170,#F5DFA0)",transition:"width 0.5s"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
            {SCHOOL_COURSES.map(course=>{
              const done=course.lessons.filter(l=>progress[l.id]==="done").length;
              const pct=Math.round((done/course.lessons.length)*100);
              return(
                <div key={course.id} onClick={()=>{setActiveSeries(course);setView("course");}} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:16,cursor:"pointer",border:`1px solid rgba(255,255,255,0.08)`,transition:"all 0.2s",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,height:3,width:`${pct}%`,background:course.color,transition:"width 0.5s"}}/>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                    <div style={{fontSize:28}}>{course.icon}</div>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:"#e0e0e0",marginBottom:2}}>{course.id}系列 · {course.name}</div>
                      <div style={{fontSize:11,color:"#666"}}>{course.desc}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:11,color:"#555"}}>{done}/{course.lessons.length} 完成</div>
                    <div style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:pct===100?"rgba(76,175,80,0.2)":"rgba(255,255,255,0.06)",border:`1px solid ${pct===100?"rgba(76,175,80,0.4)":"rgba(255,255,255,0.08)"}`,color:pct===100?"#66BB6A":"#666",fontWeight:700}}>{pct===100?"✓ 已完成":`${pct}%`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view==="course"&&activeSeries&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setView("list")} style={{...btnStyle("#888"),padding:"4px 10px",fontSize:11}}>← 返回</button>
            <span style={{fontSize:16,fontWeight:800,color:activeSeries.color}}>{activeSeries.icon} {activeSeries.id}系列 · {activeSeries.name}</span>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {activeSeries.lessons.map((lesson,i)=>{
                const done=progress[lesson.id]==="done";
                const prog=progress[lesson.id]==="progress";
                return(
                  <div key={lesson.id} onClick={()=>startLesson(lesson)} style={{display:"flex",alignItems:"center",gap:12,padding:14,borderRadius:10,cursor:"pointer",background:done?"rgba(76,175,80,0.07)":"rgba(255,255,255,0.04)",border:`1px solid ${done?"rgba(76,175,80,0.25)":prog?"rgba(232,193,112,0.2)":"rgba(255,255,255,0.07)"}`,transition:"all 0.2s"}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:done?"rgba(76,175,80,0.2)":prog?"rgba(232,193,112,0.15)":"rgba(255,255,255,0.06)",border:`2px solid ${done?"rgba(76,175,80,0.5)":prog?"rgba(232,193,112,0.4)":"rgba(255,255,255,0.1)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{done?"✓":i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:done?"#66BB6A":"#e0e0e0",marginBottom:2}}>{lesson.title}</div>
                      <div style={{fontSize:11,color:"#555"}}>{lesson.desc}</div>
                    </div>
                    <div style={{display:"flex",gap:2}}>{diffDots(lesson.difficulty)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view==="lesson"&&activeLesson&&lessonBoard&&(
        <div style={{flex:1,display:"flex",gap:0,overflow:"hidden"}}>
          {/* 左：讲解 */}
          <div style={{width:260,borderRight:"1px solid rgba(255,255,255,0.07)",padding:14,display:"flex",flexDirection:"column",gap:10,overflowY:"auto",background:"rgba(0,0,0,0.12)"}}>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setView("course")} style={{...btnStyle("#888"),padding:"4px 8px",fontSize:10}}>← 返回</button>
              <span style={{fontSize:11,color:activeSeries?.color,fontWeight:700,alignSelf:"center"}}>{activeSeries?.name}</span>
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:"#E8C170",marginBottom:4}}>{activeLesson.title}</div>
              <div style={{display:"flex",gap:2,marginBottom:8}}>{diffDots(activeLesson.difficulty)}</div>
              <div style={{fontSize:12,color:"#aaa",lineHeight:1.6}}>{activeLesson.desc}</div>
            </div>

            {/* 状态 */}
            {attempt==="correct"&&(
              <div style={{padding:12,borderRadius:8,background:"rgba(76,175,80,0.15)",border:"1px solid rgba(76,175,80,0.3)",textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:4}}>🎉</div>
                <div style={{fontSize:13,fontWeight:700,color:"#66BB6A"}}>正确！</div>
              </div>
            )}
            {attempt==="wrong"&&(
              <div style={{padding:12,borderRadius:8,background:"rgba(211,47,47,0.15)",border:"1px solid rgba(211,47,47,0.3)",textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:4}}>❌</div>
                <div style={{fontSize:13,fontWeight:700,color:"#EF5350"}}>走法不对，重新尝试</div>
              </div>
            )}

            {/* 提示 & 讲解 */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={()=>setShowHint(h=>!h)} style={{...btnStyle("#E8C170"),padding:"7px",fontSize:12}}>💡 {showHint?"隐藏提示":"显示提示"}</button>
              {showHint&&<div style={{padding:10,borderRadius:8,background:"rgba(232,193,112,0.1)",border:"1px solid rgba(232,193,112,0.2)",fontSize:12,color:"#E8C170",lineHeight:1.6}}>{activeLesson.hint}</div>}
              <button onClick={()=>setShowExplain(e=>!e)} style={{...btnStyle("#A8C8E8"),padding:"7px",fontSize:12}}>📖 {showExplain?"收起讲解":"查看讲解"}</button>
              {showExplain&&<div style={{padding:10,borderRadius:8,background:"rgba(168,200,232,0.08)",border:"1px solid rgba(168,200,232,0.15)",fontSize:12,color:"#A8C8E8",lineHeight:1.7}}>{activeLesson.explanation}</div>}
            </div>

            {/* 重试 */}
            <button onClick={()=>{setLessonBoard(fenToBoard(activeLesson.fen));setLessonSel(null);setLessonHints([]);setAttempt(null);setShowHint(false);}} style={{...btnStyle("#888"),padding:"7px",fontSize:12,marginTop:"auto"}}>↺ 重置局面</button>

            {/* 前后导航 */}
            {activeSeries&&(()=>{
              const idx=activeSeries.lessons.findIndex(l=>l.id===activeLesson.id);
              const prev=activeSeries.lessons[idx-1],next=activeSeries.lessons[idx+1];
              return<div style={{display:"flex",gap:6}}>
                {prev&&<button onClick={()=>startLesson(prev)} style={{...btnStyle("#666"),flex:1,padding:"6px",fontSize:11}}>← 上一课</button>}
                {next&&<button onClick={()=>startLesson(next)} style={{...btnStyle("#E8C170"),flex:1,padding:"6px",fontSize:11}}>下一课 →</button>}
              </div>;
            })()}
          </div>

          {/* 右：棋盘 */}
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.08)"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
              <div style={{fontSize:12,color:"#666",letterSpacing:1}}>红方先行 · 找出最佳着法</div>
              <Board board={lessonBoard} selected={lessonSel} hints={lessonHints} lastMove={null} bt={bt} pt={pt} onCellClick={handleLessonClick} flipped={false} inCheck={null}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ⑧ 工具函数
// ══════════════════════════════════════════════════════════════════════
function btnStyle(color){
  return{background:`rgba(255,255,255,0.06)`,border:`1px solid ${color}33`,color,borderRadius:6,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4};
}

// ══════════════════════════════════════════════════════════════════════
// ⑨ 根应用
// ══════════════════════════════════════════════════════════════════════
export default function App(){
  const[page,setPage]=useState("game");
  const[btId,setBtId]=useState("classic");
  const[ptId,setPtId]=useState("classic");
  const bt=BT[btId]||BT.classic;
  const pt=PT[ptId]||PT.classic;

  const TABS=[
    {id:"game",  icon:"♟",  label:"对弈",  color:"#E8C170"},
    {id:"engine",icon:"⚙️", label:"引擎",  color:"#A8C8E8"},
    {id:"record",icon:"📚", label:"棋谱",  color:"#C8A8E8"},
    {id:"school",icon:"🎓", label:"学校",  color:"#A8E8C8"},
  ];

  return(
    <div style={{
      height:"100vh",display:"flex",flexDirection:"column",
      background:"linear-gradient(160deg,#09090f 0%,#111118 50%,#0c0c14 100%)",
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",color:"#e0e0e0",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}
        input,textarea,button{outline:none;}
        button:hover{filter:brightness(1.2);}
      `}</style>

      {/* 顶栏 */}
      <div style={{padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:20}}>♟</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:1,background:"linear-gradient(90deg,#E8C170,#F5DFA0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>中国象棋 Pro</div>
            <div style={{fontSize:9,color:"#444",letterSpacing:3}}>CHINESE CHESS · M2+M3+M4</div>
          </div>
        </div>
        {/* 主题快选 */}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#444"}}>棋盘</span>
          {Object.values(BT).map(t=><div key={t.id} onClick={()=>setBtId(t.id)} style={{width:18,height:18,borderRadius:3,background:t.board,border:`2px solid ${btId===t.id?"#E8C170":"transparent"}`,cursor:"pointer",transition:"all 0.15s"}} title={t.name}/>)}
          <span style={{fontSize:10,color:"#444",marginLeft:8}}>棋子</span>
          {Object.values(PT).map(t=><div key={t.id} onClick={()=>setPtId(t.id)} style={{width:18,height:18,borderRadius:"50%",background:t.bg,border:`2px solid ${ptId===t.id?"#E8C170":"transparent"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.redColor,fontFamily:"KaiTi,serif",fontWeight:700,flexShrink:0}} title={t.name}>帅</div>)}
        </div>
      </div>

      {/* 主体 */}
      <div style={{flex:1,overflow:"hidden",animation:"fadeIn 0.3s ease"}}>
        {page==="game"  &&<GamePage   bt={bt} pt={pt}/>}
        {page==="engine"&&<EnginePage/>}
        {page==="record"&&<RecordPage bt={bt} pt={pt}/>}
        {page==="school"&&<SchoolPage bt={bt} pt={pt}/>}
      </div>

      {/* 底部导航 */}
      <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,0.07)",background:"rgba(0,0,0,0.4)",flexShrink:0}}>
        {TABS.map(tab=>(
          <div key={tab.id} onClick={()=>setPage(tab.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0 6px",cursor:"pointer",borderTop:`2px solid ${page===tab.id?tab.color:"transparent"}`,transition:"all 0.2s",background:page===tab.id?"rgba(255,255,255,0.03)":"transparent"}}>
            <span style={{fontSize:16,marginBottom:2}}>{tab.icon}</span>
            <span style={{fontSize:9,color:page===tab.id?tab.color:"#444",fontWeight:page===tab.id?700:400,letterSpacing:1}}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
