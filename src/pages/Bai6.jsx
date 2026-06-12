import { useState, useEffect, useRef } from "react";

// ── DARK THEME ────────────────────────────────────────────────────────
const D = {
  bg0:"#020617",bg1:"#0f172a",bg2:"#1e293b",bg3:"#0c1a2e",
  border:"#1e3a5f",
  text1:"#e2e8f0",text2:"#94a3b8",text3:"#64748b",
  blue:"#38bdf8",blueBg:"rgba(56,189,248,0.12)",
  teal:"#2dd4bf",tealBg:"rgba(45,212,191,0.12)",
  amber:"#fbbf24",amberBg:"rgba(251,191,36,0.12)",
  coral:"#f87171",coralBg:"rgba(248,113,113,0.12)",
  purple:"#a78bfa",purpleBg:"rgba(167,139,250,0.12)",
  green:"#4ade80",greenBg:"rgba(74,222,128,0.12)",
};

// ── DỮ LIỆU GỐC từ vietnam_regions_2024.csv ──────────────────────────
const REGIONS = ["Trung du MN phía Bắc","Đồng bằng sông Hồng","Bắc Trung Bộ+DHMT","Tây Nguyên","Đông Nam Bộ","ĐB sông Cửu Long"];
const RSHORT  = ["TDMNPB","ĐBSH","BTB+DHMT","TN","ĐNB","ĐBSCL"];
const RCOLORS = [D.blue, D.teal, D.amber, D.coral, D.purple, D.green];
const RBGS    = [D.blueBg,D.tealBg,D.amberBg,D.coralBg,D.purpleBg,D.greenBg];

const CRITERIA = ["GRDP/người","FDI","Digital Index","AI Readiness","LĐ đào tạo","R&D/GRDP","Internet","Gini"];
const IS_BENEFIT = [true,true,true,true,true,true,true,false];
const CSHORT = ["GRDP","FDI","Digital","AI","LĐ ĐT","R&D","Net","Gini"];
const CUNITS = ["tr.VND","tỷ USD","0-100","0-100","%","%","%","hệ số"];

// Dữ liệu gốc chính xác từ CSV
const X_RAW = [
  [ 57.0,  3.5, 38, 22, 21.5, 0.18, 72, 0.405],
  [152.3, 20.0, 78, 68, 36.8, 0.85, 92, 0.358],
  [ 87.5,  8.2, 55, 40, 27.5, 0.32, 84, 0.372],
  [ 68.9,  0.8, 32, 18, 18.2, 0.15, 68, 0.412],
  [158.9, 18.5, 82, 75, 42.5, 0.78, 94, 0.385],
  [ 80.5,  2.1, 48, 30, 16.8, 0.22, 78, 0.392],
];

// Trọng số chuyên gia từ đề 6.4.1
const W_EXPERT = [0.10, 0.10, 0.15, 0.20, 0.15, 0.15, 0.05, 0.10];
// Trọng số Entropy tính từ Python
const W_ENTROPY = [0.0787, 0.4151, 0.0597, 0.1390, 0.0628, 0.2361, 0.0073, 0.0012];

// Kết quả TOPSIS từ Python (chính xác)
const EXPERT_RESULT = {
  C_star: [0.0993, 0.8981, 0.3597, 0.0312, 0.9402, 0.1710],
  S_star: [0.1542, 0.0177, 0.1093, 0.1668, 0.0103, 0.1442],
  S_neg:  [0.0170, 0.1565, 0.0614, 0.0054, 0.1625, 0.0298],
  ranks:  [5, 2, 3, 6, 1, 4],
};
const ENTROPY_RESULT = {
  C_star: [0.1248, 0.9690, 0.3619, 0.0116, 0.9203, 0.0897],
  ranks:  [4, 1, 3, 6, 2, 5],
};

// Sensitivity: w_AI từ 0.10→0.40, top3 luôn ổn định
const SENS_WAI = [0.10,0.15,0.20,0.25,0.30,0.35,0.40];

// Tính TOPSIS trong JS để dùng cho sensitivity
function computeTOPSIS(X, w, isBenefit) {
  const n = X.length, m = X[0].length;
  // Chuẩn hóa vector
  const colNorm = Array(m).fill(0).map((_,j) =>
    Math.sqrt(X.reduce((s,row) => s + row[j]*row[j], 0)));
  const R = X.map(row => row.map((v,j) => v/colNorm[j]));
  const V = R.map(row => row.map((v,j) => v*w[j]));
  // Ideal
  const Astar = Array(m).fill(0).map((_,j) => {
    const col = V.map(row=>row[j]);
    return isBenefit[j] ? Math.max(...col) : Math.min(...col);
  });
  const Aneg = Array(m).fill(0).map((_,j) => {
    const col = V.map(row=>row[j]);
    return isBenefit[j] ? Math.min(...col) : Math.max(...col);
  });
  const Sstar = V.map(row => Math.sqrt(row.reduce((s,v,j)=>s+(v-Astar[j])**2,0)));
  const Sneg  = V.map(row => Math.sqrt(row.reduce((s,v,j)=>s+(v-Aneg[j])**2,0)));
  const Cstar = Sstar.map((ss,i) => Sneg[i]/(ss+Sneg[i]));
  return {V, Astar, Aneg, Sstar, Sneg, Cstar};
}

function getRanks(Cstar) {
  const sorted = [...Cstar].map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  const ranks = Array(Cstar.length);
  sorted.forEach(({i},rank) => ranks[i]=rank+1);
  return ranks;
}

// ── Chuẩn hóa vector để hiển thị ─────────────────────────────────────
function normalizeMatrix(X) {
  const n=X.length, m=X[0].length;
  const colNorm = Array(m).fill(0).map((_,j) =>
    Math.sqrt(X.reduce((s,row)=>s+row[j]*row[j],0)));
  return X.map(row=>row.map((v,j)=>v/colNorm[j]));
}
const R_NORM = normalizeMatrix(X_RAW);

// ── Helpers ───────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,
    padding:"1.2rem",...style}}>{children}</div>
);
const KPI = ({label,value,unit,color,sub}) => (
  <div style={{background:D.bg1,border:`1px solid ${color}33`,borderRadius:10,
    padding:"13px 16px",flex:1,minWidth:130}}>
    <p style={{fontSize:11,color:D.text3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
    <p style={{fontSize:20,fontWeight:700,color,margin:0}}>{value}</p>
    {unit&&<p style={{fontSize:11,color:D.text3,margin:"2px 0 0"}}>{unit}</p>}
    {sub&&<p style={{fontSize:10,color:D.text3,margin:"3px 0 0"}}>{sub}</p>}
  </div>
);
const TabBtn = ({label,active,onClick}) => (
  <button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:600,
    cursor:"pointer",border:"none",transition:"all .2s",
    background:active?"#0ea5e9":"rgba(30,41,59,0.7)",
    color:active?"#fff":D.text2,boxShadow:active?"0 0 14px #0ea5e940":"none"}}>
    {label}
  </button>
);

// ── Chart.js wrappers ─────────────────────────────────────────────────
function BarChart({labels,datasets,height=240,horizontal=false,opts={}}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"bar",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        indexAxis:horizontal?"y":"x",
        plugins:{legend:{display:datasets.length>1,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
                y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}}},
        ...opts}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

function LineChart({labels,datasets,height=240}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"line",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
                y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}}}}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

// ── Heatmap SVG (normalized matrix) ──────────────────────────────────
function MatrixHeatmap({data,rowLabels,colLabels,title,colorFn}){
  const rows=rowLabels.length,cols=colLabels.length;
  const W=620,H=40+rows*36;
  const LP=100,TP=36,CW=(W-LP)/cols,CH=32;
  const allVals=data.flat();
  const mn=Math.min(...allVals),mx=Math.max(...allVals);
  const alpha=v=>0.1+0.8*((v-mn)/(mx-mn||1));
  const defColor=(v,j)=>{
    const t=(v-mn)/(mx-mn||1);
    if(!IS_BENEFIT[j]) return `rgba(248,113,113,${alpha(v)})`;
    return t>0.6?`rgba(45,212,191,${alpha(v)})`:t>0.3?`rgba(251,191,36,${alpha(v)})`:`rgba(100,116,139,${alpha(v)})`;
  };
  const cf = colorFn||defColor;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {colLabels.map((c,j)=>(
        <text key={j} x={LP+j*CW+CW/2} y={TP-8} textAnchor="middle"
          fontSize={10} fill={j===3?D.purple:D.text3}>{c}</text>
      ))}
      {rowLabels.map((r,i)=>(
        <g key={i}>
          <text x={LP-4} y={TP+i*CH+CH/2+4} textAnchor="end"
            fontSize={11} fontWeight="600" fill={RCOLORS[i]}>{r}</text>
          {data[i].map((v,j)=>(
            <g key={j}>
              <rect x={LP+j*CW+1} y={TP+i*CH+1} width={CW-2} height={CH-2}
                rx={3} fill={cf(v,j)}/>
              <text x={LP+j*CW+CW/2} y={TP+i*CH+CH/2+4} textAnchor="middle"
                fontSize={9} fontWeight="600"
                fill={(v-mn)/(mx-mn||1)>0.5?"#fff":"#94a3b8"}>
                {v>1?v.toFixed(1):v.toFixed(3)}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

// ── Radar chart (SVG) ─────────────────────────────────────────────────
function RadarSVG({selected}){
  const W=320,H=300,cx=160,cy=150,r=110;
  const n=CRITERIA.length;
  const angles=CRITERIA.map((_,i)=>((i/n)*2*Math.PI)-Math.PI/2);
  const getXY=(angle,radius)=>([cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)]);
  // Normalize data to 0-1
  const mins=X_RAW[0].map((_,j)=>Math.min(...X_RAW.map(row=>row[j])));
  const maxs=X_RAW[0].map((_,j)=>Math.max(...X_RAW.map(row=>row[j])));
  const normalize=(row,j)=>{
    const v=(row[j]-mins[j])/(maxs[j]-mins[j]||1);
    return IS_BENEFIT[j]?v:1-v;
  };
  const gridLevels=[0.25,0.5,0.75,1.0];
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {/* Grid */}
      {gridLevels.map(lvl=>(
        <polygon key={lvl}
          points={angles.map(a=>getXY(a,r*lvl).join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>
      ))}
      {/* Axes */}
      {angles.map((a,i)=>{
        const [x2,y2]=getXY(a,r);
        const [lx,ly]=getXY(a,r+18);
        return(
          <g key={i}>
            <line x1={cx} y1={cy} x2={x2} y2={y2}
              stroke="rgba(255,255,255,0.08)" strokeWidth={1}/>
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill={i===3?D.purple:D.text3}>{CSHORT[i]}</text>
          </g>
        );
      })}
      {/* Regions */}
      {selected.map(ri=>{
        const pts=angles.map((a,j)=>{
          const v=normalize(X_RAW[ri],j);
          return getXY(a,r*v).join(",");
        }).join(" ");
        return(
          <polygon key={ri} points={pts}
            fill={RCOLORS[ri]+"30"} stroke={RCOLORS[ri]}
            strokeWidth={1.5} opacity={0.85}/>
        );
      })}
      {/* Legend */}
      {selected.map((ri,k)=>(
        <g key={ri}>
          <circle cx={8} cy={H-12-k*14} r={4} fill={RCOLORS[ri]}/>
          <text x={16} y={H-8-k*14} fontSize={9} fill={RCOLORS[ri]}>{RSHORT[ri]}</text>
        </g>
      ))}
    </svg>
  );
}

// ── TOPSIS Step-by-step display ───────────────────────────────────────
function StepsDisplay({result, weights, label, color}){
  return(
    <div>
      <p style={{fontSize:12,color:D.text3,margin:"0 0 10px"}}>
        Trọng số: [{weights.map(w=>w.toFixed(3)).join(", ")}]
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {REGIONS.map((r,i)=>{
          const rank=result.ranks[i];
          const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"";
          const pct=result.C_star[i];
          return(
            <div key={r} style={{display:"flex",alignItems:"center",gap:10,
              padding:"9px 12px",borderRadius:8,
              background:rank<=3?`${RCOLORS[i]}10`:`${D.bg1}`,
              border:`1px solid ${rank<=3?RCOLORS[i]+44:D.border}`}}>
              <span style={{fontSize:14,minWidth:24}}>{medal||`#${rank}`}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:rank<=3?600:400,
                    color:rank<=3?RCOLORS[i]:D.text2}}>{r}</span>
                  <span style={{fontSize:13,fontWeight:600,color:RCOLORS[i],fontFamily:"monospace"}}>
                    C* = {pct.toFixed(4)}
                  </span>
                </div>
                <div style={{height:6,background:D.bg1,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct*100}%`,
                    background:RCOLORS[i],borderRadius:3,transition:"width .5s"}}/>
                </div>
                <div style={{display:"flex",gap:12,marginTop:2}}>
                  {result.S_star&&<span style={{fontSize:10,color:D.text3}}>
                    S* = {result.S_star[i].toFixed(4)}
                  </span>}
                  {result.S_neg&&<span style={{fontSize:10,color:D.text3}}>
                    S⁻ = {result.S_neg[i].toFixed(4)}
                  </span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sensitivity Heatmap (rank matrix) ────────────────────────────────
function SensHeatmap({sensData}){
  const W=560,H=40+6*32,LP=100,TP=36,CW=(W-LP)/7,CH=30;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {SENS_WAI.map((w,j)=>(
        <text key={j} x={LP+j*CW+CW/2} y={TP-8} textAnchor="middle"
          fontSize={9} fill={D.purple}>a₄={w.toFixed(2)}</text>
      ))}
      {RSHORT.map((r,i)=>(
        <g key={i}>
          <text x={LP-4} y={TP+i*CH+CH/2+4} textAnchor="end"
            fontSize={10} fontWeight="600" fill={RCOLORS[i]}>{r}</text>
          {sensData.map(({ranks},j)=>{
            const rank=ranks[i];
            const t=1-((rank-1)/5);
            const fill=rank===1?`rgba(45,212,191,0.85)`:rank===2?`rgba(56,189,248,0.75)`:
              rank===3?`rgba(167,139,250,0.65)`:rank<=4?`rgba(251,191,36,0.4)`:`rgba(100,116,139,0.25)`;
            return(
              <g key={j}>
                <rect x={LP+j*CW+1} y={TP+i*CH+1} width={CW-2} height={CH-2}
                  rx={3} fill={fill}/>
                <text x={LP+j*CW+CW/2} y={TP+i*CH+CH/2+4} textAnchor="middle"
                  fontSize={11} fontWeight="700" fill={rank<=3?"#fff":"#64748b"}>
                  {rank}
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

// ── Gemini AI Panel (đã sửa: có ô nhập API key) ───────────────────────
function GeminiPanel({ context }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);

  const ask = async () => {
    if (!apiKey.trim()) {
      setAnswer("⚠️ Vui lòng nhập Gemini API Key trước khi hỏi.");
      return;
    }
    if (!question.trim()) return;
    setLoading(true); setAnswer("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{ parts:[{ text:
            `Bạn là chuyên gia phân tích TOPSIS và kinh tế vùng Việt Nam.\n\nDữ liệu hiện tại:\n${context}\n\nCâu hỏi: ${question}`
          }]}]})
        }
      );
      const d = await res.json();
      if (d.error) {
        setAnswer(`❌ Lỗi API: ${d.error.message}`);
      } else {
        setAnswer(d.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi.");
      }
    } catch(e) { setAnswer("❌ Lỗi kết nối Gemini: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{marginTop:20,border:`1px solid ${D.purple}44`,borderRadius:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",padding:"12px 16px",background:`linear-gradient(90deg,${D.purpleBg},${D.blueBg})`,
          border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:D.text1}}>
        <span style={{fontSize:18}}>✨</span>
        <span style={{fontWeight:700,fontSize:14,color:D.purple}}>Hỏi Gemini AI về kết quả TOPSIS</span>
        <span style={{marginLeft:"auto",color:D.text3,fontSize:12}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{padding:16,background:D.bg1}}>
          {/* API Key input */}
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:1,position:"relative",minWidth:200}}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e=>setApiKey(e.target.value)}
                placeholder="Dán Gemini API Key vào đây (AIza...)"
                style={{
                  width:"100%",padding:"8px 40px 8px 12px",borderRadius:8,
                  background:D.bg3,border:`1px solid ${apiKey?"#4285f4":D.border}`,
                  color:D.text1,fontSize:12,fontFamily:"monospace",boxSizing:"border-box"
                }}
              />
              <button
                onClick={()=>setShowKey(!showKey)}
                style={{
                  position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",color:D.text3,cursor:"pointer",fontSize:14
                }}
              >
                {showKey?"🙈":"👁"}
              </button>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
              style={{fontSize:11,color:"#4285f4",textDecoration:"none",whiteSpace:"nowrap"}}>
              Lấy API Key →
            </a>
          </div>

          <p style={{fontSize:11,color:D.text3,margin:"0 0 10px"}}>
            Context: kết quả TOPSIS thực tế với trọng số hiện tại đã được gửi cho AI.
          </p>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={question} onChange={e=>setQuestion(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&ask()}
              placeholder="Vd: Tại sao ĐNB đứng #1? So sánh hai phương pháp trọng số?"
              style={{flex:1,padding:"9px 13px",borderRadius:8,border:`1px solid ${D.border}`,
                background:D.bg2,color:D.text1,fontSize:13}}/>
            <button onClick={ask} disabled={loading}
              style={{padding:"9px 18px",borderRadius:8,background:D.purple,
                color:"#fff",border:"none",cursor:loading?"not-allowed":"pointer",
                fontWeight:600,fontSize:13,opacity:loading?0.6:1}}>
              {loading?"...":"Hỏi"}
            </button>
          </div>
          {answer&&(
            <div style={{padding:"12px 14px",background:D.bg2,borderRadius:8,
              border:`1px solid ${D.purple}33`,fontSize:13,color:D.text2,
              lineHeight:1.75,whiteSpace:"pre-wrap",maxHeight:320,overflowY:"auto"}}>
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("c1");
  const [cl,setCl]=useState(false);
  const [selectedRegions,setSelectedRegions]=useState([0,1,2,3,4,5]);
  const [wAI,setWAI]=useState(0.20);

  // Sliders cho 8 trọng số chuyên gia (raw, sẽ normalize tự động)
  const [wRaw,setWRaw]=useState([0.10,0.10,0.15,0.20,0.15,0.15,0.05,0.10]);

  useEffect(()=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload=()=>setCl(true);
    document.head.appendChild(s);
  },[]);

  // Trọng số chuyên gia normalized từ sliders
  const wRawSum = wRaw.reduce((s,v)=>s+v,0);
  const W_LIVE  = wRaw.map(v=>v/wRawSum);

  // Kết quả TOPSIS live từ sliders
  const {Cstar:cLive,Sstar:sLive,Sneg:snLive} = computeTOPSIS(X_RAW, W_LIVE, IS_BENEFIT);
  const rankLive = getRanks(cLive);
  const EXPERT_LIVE = { C_star:cLive, S_star:sLive, S_neg:snLive, ranks:rankLive };

  // Context cho Gemini (động theo tham số hiện tại)
  const geminiCtx = `TOPSIS 6 vùng kinh tế Việt Nam
Trọng số hiện tại (đã normalize): ${W_LIVE.map((w,j)=>`${CSHORT[j]}=${w.toFixed(3)}`).join(", ")}
Kết quả C* theo thứ hạng:
${[...cLive.map((v,i)=>({v,i,r:rankLive[i]}))].sort((a,b)=>a.r-b.r)
  .map(({v,i,r})=>`  #${r} ${REGIONS[i]}: C*=${v.toFixed(4)}, S*=${sLive[i].toFixed(4)}, S⁻=${snLive[i].toFixed(4)}`).join("\n")}
Trọng số Entropy (khách quan): FDI=${W_ENTROPY[1].toFixed(3)}, R&D=${W_ENTROPY[5].toFixed(3)}, AI=${W_ENTROPY[3].toFixed(3)}
Top-3 ổn định: ĐNB, ĐBSH, BTB+DHMT ở mọi mức w_AI 0.10→0.40`;

  // sensData reactive: sensitivity của w_AI dựa trên W_LIVE hiện tại
  const sensData = SENS_WAI.map(wai => {
    const wNew = [...W_LIVE];
    wNew[3] = wai;
    const tot = wNew.reduce((s,v)=>s+v,0);
    const wNorm = wNew.map(v=>v/tot);
    const {Cstar} = computeTOPSIS(X_RAW, wNorm, IS_BENEFIT);
    return { wai, Cstar, ranks: getRanks(Cstar) };
  });

  // Tính TOPSIS realtime cho slider w_AI độc lập (Tab 4)
  const wSensBase=[...W_LIVE];
  wSensBase[3]=wAI;
  const totSens=wSensBase.reduce((s,v)=>s+v,0);
  const wSensNorm=wSensBase.map(v=>v/totSens);
  const {Cstar:cSens}=computeTOPSIS(X_RAW,wSensNorm,IS_BENEFIT);
  const rankSens=getRanks(cSens);
  const top3Sens=[...cSens].map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).slice(0,3).map(x=>x.i);

  const TABS=[
    {id:"c1",label:"① Dữ liệu & Chuẩn hóa"},
    {id:"c2",label:"② TOPSIS Chuyên gia"},
    {id:"c3",label:"③ Trọng số Entropy"},
    {id:"c4",label:"④ Độ nhạy w_AI"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

  const toggleRegion=(i)=>{
    setSelectedRegions(prev=>
      prev.includes(i)?prev.filter(x=>x!==i):[...prev,i].sort()
    );
  };

  // Chart: C* comparison (dùng LIVE vs Entropy)
  const compDatasets=[
    {label:"C* Chuyên gia (live)",data:cLive,
      backgroundColor:RCOLORS.map(c=>c+"99"),borderColor:RCOLORS,borderWidth:2,borderRadius:5},
    {label:"C* Entropy",data:ENTROPY_RESULT.C_star,
      backgroundColor:RCOLORS.map(c=>c+"44"),borderColor:RCOLORS,borderWidth:2,borderRadius:3,
      borderDash:[4,3]},
  ];

  // Slider panel helper
  const SliderPanel = () => (
    <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,padding:"1.2rem",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{margin:0,color:D.blue,fontSize:14}}>🎛️ Thay đổi Tham số</h3>
        <button onClick={()=>setWRaw([0.10,0.10,0.15,0.20,0.15,0.15,0.05,0.10])}
          style={{padding:"4px 12px",borderRadius:6,background:D.bg3,border:`1px solid ${D.border}`,
            color:D.text2,cursor:"pointer",fontSize:11}}>Reset</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {CRITERIA.map((c,j)=>(
          <div key={j} style={{background:D.bg3,borderRadius:8,padding:"8px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:11,color:j===3?D.purple:D.text2,fontWeight:j===3?700:400}}>{CSHORT[j]}</span>
              <span style={{fontSize:12,fontWeight:700,color:j===3?D.purple:D.blue,fontFamily:"monospace"}}>
                {W_LIVE[j].toFixed(2)}
              </span>
            </div>
            <input type="range" min={0.01} max={0.50} step={0.01} value={wRaw[j]}
              onChange={e=>{const nw=[...wRaw];nw[j]=+e.target.value;setWRaw(nw);}}
              style={{width:"100%",accentColor:j===3?D.purple:D.blue}}/>
            <div style={{fontSize:10,color:D.text3,marginTop:2}}>{IS_BENEFIT[j]?"↑ lợi ích":"↓ chi phí"}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:10,padding:"8px 12px",background:D.blueBg,
        borderLeft:`3px solid ${D.blue}`,borderRadius:6,fontSize:12,color:D.text2}}>
        Tổng raw: <strong style={{color:D.blue}}>{wRawSum.toFixed(2)}</strong> →
        tự động normalize → tổng = 1.00 | #1 hiện tại:&nbsp;
        <strong style={{color:RCOLORS[rankLive.indexOf(1)]}}>
          {RSHORT[rankLive.indexOf(1)]} (C*={cLive[rankLive.indexOf(1)].toFixed(4)})
        </strong>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",
      background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`,
      fontFamily:"'Segoe UI',sans-serif",color:D.text1,padding:"24px 20px"}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:26}}>
        <div style={{display:"inline-block",
          background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,
          letterSpacing:2,marginBottom:10,color:"#fff"}}>
          AIDEOM-VN • PHẦN C – CẤP ĐỘ TRUNG BÌNH
        </div>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#818cf8)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 6 — TOPSIS Xếp hạng 6 Vùng Kinh tế theo Mức độ Ưu tiên Đầu tư AI
        </h1>
        <p style={{fontSize:13,color:D.text3,margin:0}}>
          8 tiêu chí &nbsp;|&nbsp; Chuẩn hóa vector &nbsp;|&nbsp; Trọng số chuyên gia & Entropy
          &nbsp;|&nbsp; Dữ liệu: vietnam_regions_2024.csv (GSO 2024)
        </p>
      </div>

      {/* SLIDER PANEL */}
      <SliderPanel/>

      {/* KPI */}
      <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
        <KPI label="#1 — Live" value={RSHORT[rankLive.indexOf(1)]} unit={`C* = ${cLive[rankLive.indexOf(1)].toFixed(4)}`} color={D.purple}
          sub="Thay đổi slider để cập nhật"/>
        <KPI label="#2 — Live" value={RSHORT[rankLive.indexOf(2)]} unit={`C* = ${cLive[rankLive.indexOf(2)].toFixed(4)}`} color={D.teal}
          sub="Kết quả realtime"/>
        <KPI label="#1 — Entropy" value="Đ.bằng sông Hồng" unit="C* = 0.9690" color={D.blue}
          sub="FDI dominates w=0.415"/>
        <KPI label="Top-3 ổn định?" value={[...cLive.map((v,i)=>({v,i}))].sort((a,b)=>b.v-a.v).slice(0,3).map(x=>RSHORT[x.i]).join(", ")} unit="(theo tham số hiện tại)" color={D.green}
          sub="Thay slider để xem thay đổi"/>
        <KPI label="Tây Nguyên" value={`Hạng ${rankLive[3]}`} unit={`C* = ${cLive[3].toFixed(4)}`} color={D.coral}
          sub="AI=18, Digital=32"/>
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1: DỮ LIỆU & CHUẨN HÓA ══════════════════════════════ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
              Dữ liệu gốc — vietnam_regions_2024.csv
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              8 tiêu chí | Gini = tiêu chí chi phí (càng thấp càng tốt), 7 tiêu chí còn lại = lợi ích
            </p>
            <MatrixHeatmap
              data={X_RAW}
              rowLabels={RSHORT}
              colLabels={CSHORT}
            />
            <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
              {CRITERIA.map((c,j)=>(
                <div key={j} style={{fontSize:11,color:j===7?D.coral:D.text3}}>
                  <span style={{color:j===7?D.coral:D.blue}}>●</span> {c} ({CUNITS[j]})
                  {j===7&&" [cost]"}
                </div>
              ))}
            </div>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.teal,fontSize:14}}>
                Ma trận chuẩn hóa vector r<sub>ij</sub> = x<sub>ij</sub> / √(Σx²<sub>ij</sub>)
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>Bước 1 — TOPSIS</p>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${D.border}`}}>
                      <th style={{padding:"5px 8px",color:D.text3,textAlign:"left"}}>Vùng</th>
                      {CSHORT.map(c=>(
                        <th key={c} style={{padding:"5px 6px",color:D.text3,textAlign:"right"}}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RSHORT.map((r,i)=>(
                      <tr key={r} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"5px 8px",fontWeight:600,color:RCOLORS[i]}}>{r}</td>
                        {R_NORM[i].map((v,j)=>(
                          <td key={j} style={{padding:"5px 6px",textAlign:"right",
                            fontFamily:"monospace",fontSize:10,
                            color:v===Math.max(...R_NORM.map(row=>row[j]))?D.green:D.text2}}>
                            {v.toFixed(4)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 12px",color:D.amber,fontSize:14}}>
                Radar chart — so sánh vùng
              </h3>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {REGIONS.map((r,i)=>(
                  <button key={i} onClick={()=>toggleRegion(i)}
                    style={{padding:"3px 10px",borderRadius:6,fontSize:11,cursor:"pointer",
                      border:`1px solid ${RCOLORS[i]}66`,
                      background:selectedRegions.includes(i)?`${RCOLORS[i]}22`:D.bg1,
                      color:selectedRegions.includes(i)?RCOLORS[i]:D.text3}}>
                    {RSHORT[i]}
                  </button>
                ))}
              </div>
              <RadarSVG selected={selectedRegions}/>
            </Card>
          </div>
        </div>
      )}

      {/* ══ TAB 2: TOPSIS CHUYÊN GIA ══════════════════════════════════ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
                Câu 6.4.1 — Kết quả TOPSIS (trọng số chuyên gia)
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                w = [{W_LIVE.map((w,j)=><span key={j} style={{color:j===3?D.purple:D.text2}}>{w.toFixed(2)}{j<7?", ":""}</span>)}] (live)
              </p>
              <StepsDisplay result={EXPERT_LIVE} weights={W_LIVE} label="Chuyên gia" color={D.blue}/>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:14}}>
                Trọng số chuyên gia
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                Tiêu chí cao nhất: {CSHORT[W_LIVE.indexOf(Math.max(...W_LIVE))]} (w={Math.max(...W_LIVE).toFixed(2)})
              </p>
              {cl&&(
                <BarChart
                  labels={CSHORT}
                  datasets={[{
                    label:"Trọng số w",
                    data:W_LIVE,
                    backgroundColor:CSHORT.map((_,j)=>j===3?D.purple+"cc":j===2||j===4||j===5?D.teal+"99":D.blue+"66"),
                    borderColor:CSHORT.map((_,j)=>j===3?D.purple:D.blue),
                    borderWidth:2,borderRadius:6,
                  }]}
                  height={180}
                  opts={{plugins:{legend:{display:false}}}}
                />
              )}
              <div style={{marginTop:12,padding:"10px 14px",background:D.blueBg,
                borderLeft:`3px solid ${D.blue}`,borderRadius:7,fontSize:12,color:D.text2}}>
                Tiêu chí cao nhất: <strong style={{color:D.blue}}>{CRITERIA[W_LIVE.indexOf(Math.max(...W_LIVE))]}</strong> (w={Math.max(...W_LIVE).toFixed(3)}) |
                Tiêu chí thấp nhất: <strong style={{color:D.text3}}>{CRITERIA[W_LIVE.indexOf(Math.min(...W_LIVE))]}</strong> (w={Math.min(...W_LIVE).toFixed(3)})
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:14}}>
              Bảng TOPSIS đầy đủ: S*, S⁻, C*
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
              S* = khoảng cách đến ideal dương | S⁻ = khoảng cách đến ideal âm | C* = S⁻/(S*+S⁻)
            </p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Hạng","Vùng","S* (xa ideal +)","S⁻ (gần ideal −)","C* (closeness)","Đánh giá"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...REGIONS.map((r,i)=>({r,i}))]
                    .sort((a,b)=>EXPERT_LIVE.C_star[b.i]-EXPERT_LIVE.C_star[a.i])
                    .map(({r,i},rank)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${D.border}`,
                      background:rank<3?"rgba(56,189,248,0.04)":rank%2===0?D.bg3:"transparent"}}>
                      <td style={{padding:"7px 10px",textAlign:"right",
                        color:rank===0?D.amber:rank===1?D.text2:rank===2?D.coral:D.text3,
                        fontWeight:rank<3?700:400,fontSize:rank===0?16:13}}>
                        {rank===0?"🥇":rank===1?"🥈":rank===2?"🥉":`#${rank+1}`}
                      </td>
                      <td style={{padding:"7px 10px",textAlign:"right",
                        fontWeight:rank<3?600:400,color:RCOLORS[i]}}>{r}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",
                        color:D.coral}}>{EXPERT_LIVE.S_star[i].toFixed(4)}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",
                        color:D.teal}}>{EXPERT_LIVE.S_neg[i].toFixed(4)}</td>
                      <td style={{padding:"7px 10px",textAlign:"right"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                          <div style={{width:80,height:8,background:D.bg1,borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${EXPERT_LIVE.C_star[i]*100}%`,
                              background:RCOLORS[i],borderRadius:4}}/>
                          </div>
                          <span style={{fontFamily:"monospace",color:RCOLORS[i],fontWeight:600}}>
                            {EXPERT_LIVE.C_star[i].toFixed(4)}
                          </span>
                        </div>
                       </td>
                      <td style={{padding:"7px 10px",textAlign:"right"}}>
                        <span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,
                          background:rank<2?`${RCOLORS[i]}22`:`${D.bg1}`,
                          color:rank<2?RCOLORS[i]:D.text3,border:`1px solid ${rank<2?RCOLORS[i]+44:D.border}`}}>
                          {rank===0?"Ưu tiên #1":rank===1?"Ưu tiên #2":rank===2?"Ưu tiên #3":
                           rank===4?"Yếu":"Rất yếu"}
                        </span>
                       </td>
                     </tr>
                  ))}
                </tbody>
               </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══ TAB 3: ENTROPY ════════════════════════════════════════════ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.amber,fontSize:15}}>
                Câu 6.4.2 — Trọng số Entropy (khách quan)
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                w_j = (1−E_j)/Σ(1−E_j) | E_j = −(1/ln6)·Σ p_ij·ln(p_ij)
              </p>
              {cl&&(
                <BarChart
                  labels={CSHORT}
                  datasets={[
                    {label:"Entropy w",data:W_ENTROPY,
                      backgroundColor:W_ENTROPY.map((v,j)=>v>0.2?D.amber+"cc":v>0.1?D.teal+"88":D.blue+"55"),
                      borderColor:W_ENTROPY.map((v,j)=>v>0.2?D.amber:v>0.1?D.teal:D.blue),
                      borderWidth:2,borderRadius:6},
                    {label:"Chuyên gia w (live)",data:W_LIVE,
                      backgroundColor:D.text3+"33",borderColor:D.text3,
                      borderWidth:1,borderRadius:4},
                  ]}
                  height={200}
                />
              )}
              <div style={{marginTop:10,padding:"10px 14px",background:D.amberBg,
                borderLeft:`3px solid ${D.amber}`,borderRadius:7,fontSize:12,color:D.text2}}>
                FDI dominate w=0.415 (biến động lớn nhất giữa các vùng) | R&D w=0.236 |
                Gini w=0.001 (biến động rất nhỏ → thông tin thấp)
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 4px",color:D.amber,fontSize:15}}>
                TOPSIS với trọng số Entropy
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                FDI (w=0.415) & R&D (w=0.236) thay thế AI Readiness làm tiêu chí chủ đạo
              </p>
              <StepsDisplay result={ENTROPY_RESULT} weights={W_ENTROPY} label="Entropy" color={D.amber}/>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>
              So sánh kết quả: Chuyên gia vs Entropy
            </h3>
            {cl&&(
              <BarChart
                labels={RSHORT}
                datasets={compDatasets}
                height={240}
                opts={{scales:{y:{min:0,max:1,
                  title:{display:true,text:"C* (Closeness Coefficient)",color:D.text3}}}}}
              />
            )}
            <div style={{marginTop:14,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Vùng","C* Chuyên gia","Rank CG","C* Entropy","Rank Entropy","Δ Rank"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                   </tr>
                </thead>
                <tbody>
                  {REGIONS.map((r,i)=>{
                    const dR=EXPERT_LIVE.ranks[i]-ENTROPY_RESULT.ranks[i];
                    return(
                      <tr key={i} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 10px",fontWeight:600,color:RCOLORS[i]}}>{r}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace"}}>
                          {EXPERT_LIVE.C_star[i].toFixed(4)}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,
                          color:EXPERT_LIVE.ranks[i]<=3?D.blue:D.text3}}>
                          #{EXPERT_LIVE.ranks[i]}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace"}}>
                          {ENTROPY_RESULT.C_star[i].toFixed(4)}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,
                          color:ENTROPY_RESULT.ranks[i]<=3?D.amber:D.text3}}>
                          #{ENTROPY_RESULT.ranks[i]}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600,
                          color:Math.abs(dR)>=1?D.coral:D.teal}}>
                          {dR>0?`+${dR}`:dR<0?`${dR}`:"—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:12,padding:"10px 14px",background:D.tealBg,
              borderLeft:`3px solid ${D.teal}`,borderRadius:7,fontSize:12,color:D.text2}}>
              So sánh live: {REGIONS.map((r,i)=>{
                const d=EXPERT_LIVE.ranks[i]-ENTROPY_RESULT.ranks[i];
                if(d===0) return null;
                return <span key={i} style={{marginRight:10}}>
                  <strong style={{color:RCOLORS[i]}}>{RSHORT[i]}</strong>: {d>0?`+${d}`:`${d}`} hạng
                </span>;
              }).filter(Boolean)} | Top-3 live: {[...cLive.map((v,i)=>({v,i}))].sort((a,b)=>b.v-a.v).slice(0,3).map(x=>RSHORT[x.i]).join(", ")}
            </div>
          </Card>
        </div>
      )}

      {/* ══ TAB 4: ĐỘ NHẠY w_AI ══════════════════════════════════════ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:15}}>
              Câu 6.4.3 — Độ nhạy khi thay đổi w_AI (a₄) từ 0.10 → 0.40
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              Mỗi khi thay đổi w_AI, các trọng số còn lại được chuẩn hóa lại → tổng = 1
            </p>

            {/* Interactive slider */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,
              padding:"12px 16px",background:D.bg3,borderRadius:8}}>
              <span style={{fontSize:13,color:D.text2,minWidth:80}}>w_AI (a₄):</span>
              <input type="range" min={0.10} max={0.40} step={0.05} value={wAI}
                onChange={e=>setWAI(+e.target.value)} style={{flex:1}}/>
              <span style={{fontSize:16,fontWeight:700,color:D.purple,minWidth:60}}>
                {wAI.toFixed(2)}
              </span>
              <span style={{fontSize:12,color:D.text3}}>
                (chuẩn hóa: {wSensNorm[3].toFixed(3)})
              </span>
            </div>

            {/* Top 3 hiện tại */}
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {top3Sens.map((ri,k)=>(
                <div key={ri} style={{flex:1,padding:"10px 14px",borderRadius:8,
                  background:`${RCOLORS[ri]}10`,border:`1px solid ${RCOLORS[ri]}44`}}>
                  <p style={{fontSize:11,color:D.text3,margin:"0 0 3px"}}>
                    #{k+1} {k===0?"🥇":k===1?"🥈":"🥉"}
                  </p>
                  <p style={{fontSize:13,fontWeight:600,color:RCOLORS[ri],margin:"0 0 2px"}}>{RSHORT[ri]}</p>
                  <p style={{fontSize:12,fontFamily:"monospace",color:D.text2,margin:0}}>
                    C* = {cSens[ri].toFixed(4)}
                  </p>
                </div>
              ))}
            </div>

            <SensHeatmap sensData={sensData}/>
            <p style={{fontSize:11,color:D.text3,margin:"8px 0 0",textAlign:"center"}}>
              Ô = thứ hạng (1=tốt nhất) | Xanh=Rank1 | Xanh nhạt=Rank2 | Tím=Rank3
            </p>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>
                C* theo w_AI — đường cong từng vùng
              </h3>
              {cl&&(
                <LineChart
                  labels={SENS_WAI.map(w=>`w=${w.toFixed(2)}`)}
                  datasets={REGIONS.map((r,i)=>({
                    label:RSHORT[i],
                    data:sensData.map(({Cstar})=>+Cstar[i].toFixed(4)),
                    borderColor:RCOLORS[i],
                    backgroundColor:`${RCOLORS[i]}20`,
                    borderWidth:i<2?2.5:1.5,
                    tension:0.3,
                    pointRadius:4,
                  }))}
                  height={260}
                />
              )}
            </Card>

            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>
                Bảng rank theo từng mức w_AI
              </h3>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${D.border}`}}>
                      <th style={{padding:"5px 8px",color:D.text3,textAlign:"left"}}>Vùng</th>
                      {SENS_WAI.map(w=>(
                        <th key={w} style={{padding:"5px 6px",color:D.purple,textAlign:"center",fontSize:10}}>
                          {w.toFixed(2)}
                        </th>
                      ))}
                      <th style={{padding:"5px 8px",color:D.green,textAlign:"center"}}>Ổn định?</th>
                     </tr>
                  </thead>
                  <tbody>
                    {RSHORT.map((r,i)=>{
                      const allRanks=sensData.map(d=>d.ranks[i]);
                      const stable=new Set(allRanks).size===1;
                      return(
                        <tr key={r} style={{borderBottom:`1px solid ${D.border}`,
                          background:i%2===0?D.bg3:"transparent"}}>
                          <td style={{padding:"5px 8px",fontWeight:600,color:RCOLORS[i]}}>{r}</td>
                          {allRanks.map((rank,j)=>(
                            <td key={j} style={{padding:"5px 6px",textAlign:"center",fontWeight:600,
                              color:rank===1?D.teal:rank===2?D.blue:rank===3?D.purple:rank===4?D.amber:D.coral,
                              fontSize:12}}>{rank}</td>
                          ))}
                          <td style={{padding:"5px 8px",textAlign:"center"}}>
                            <span style={{color:stable?D.green:D.amber,fontWeight:600,fontSize:11}}>
                              {stable?"✓ Ổn":"±Biến"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:10,padding:"8px 12px",background:D.greenBg,
                borderLeft:`3px solid ${D.green}`,borderRadius:6,fontSize:12,color:D.text2}}>
                {(()=>{
                  const stableRegions=RSHORT.filter((_,i)=>{
                    const allRanks=sensData.map(d=>d.ranks[i]);
                    return new Set(allRanks).size===1;
                  });
                  return stableRegions.length>0
                    ? <><strong style={{color:D.green}}>{stableRegions.join(", ")}</strong> hoàn toàn ổn định ở mọi mức w_AI 0.10→0.40 với tham số hiện tại.</>
                    : <span style={{color:D.amber}}>Không có vùng nào hoàn toàn ổn định với tham số hiện tại — hãy thử điều chỉnh lại.</span>;
                })()}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ══ TAB 5: THẢO LUẬN ══════════════════════════════════════════ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Dynamic top-3 summary */}
          {(()=>{
            const sorted=[...cLive.map((v,i)=>({v,i}))].sort((a,b)=>b.v-a.v);
            const top3=sorted.slice(0,3);
            const last=sorted[sorted.length-1];
            return (
              <Card style={{border:`1px solid ${D.purple}33`}}>
                <h3 style={{margin:"0 0 12px",color:D.purple,fontSize:14}}>📊 Kết quả với tham số hiện tại</h3>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                  {top3.map(({v,i},k)=>(
                    <div key={i} style={{padding:"10px 14px",borderRadius:8,
                      background:`${RCOLORS[i]}10`,border:`1px solid ${RCOLORS[i]}44`}}>
                      <p style={{fontSize:11,color:D.text3,margin:"0 0 2px"}}>{k===0?"🥇":k===1?"🥈":"🥉"} #{k+1}</p>
                      <p style={{fontSize:13,fontWeight:700,color:RCOLORS[i],margin:"0 0 2px"}}>{REGIONS[i]}</p>
                      <p style={{fontSize:12,fontFamily:"monospace",color:D.text2,margin:0}}>C* = {v.toFixed(4)}</p>
                    </div>
                  ))}
                </div>
                <p style={{fontSize:12,color:D.text2,margin:0}}>
                  Hạng chót: <strong style={{color:RCOLORS[last.i]}}>{REGIONS[last.i]}</strong> (C* = {last.v.toFixed(4)}) |
                  Tiêu chí quan trọng nhất: <strong style={{color:D.blue}}>{CRITERIA[W_LIVE.indexOf(Math.max(...W_LIVE))]}</strong> (w = {Math.max(...W_LIVE).toFixed(3)})
                </p>
              </Card>
            );
          })()}

          {[
            {
              q:"a) Vùng nào dẫn đầu theo TOPSIS? Có nên triển khai Trung tâm AI đầu tiên ở đây?",
              color:D.purple,
              dynamic: ()=>{
                const top1i=rankLive.indexOf(1), top2i=rankLive.indexOf(2);
                return `${REGIONS[top1i]} dẫn đầu với C*=${cLive[top1i].toFixed(4)}, tiếp theo là ${REGIONS[top2i]} (C*=${cLive[top2i].toFixed(4)}). Đây là kết quả với trọng số hiện tại — hãy thay đổi slider để xem thứ hạng thay đổi thế nào.\n\nĐNB có AI Readiness cao nhất (75/100), Digital Index 82/100, FDI 18,5 tỷ USD. ĐBSH mạnh về R&D (0.85%/GRDP). Theo QĐ 127/QĐ-TTg, Việt Nam cần 3 trung tâm AI: TP.HCM, Hà Nội và 1 vùng khác.`;
              }
            },
            {
              q:"b) Khi dùng trọng số Entropy, vùng nào thay đổi xếp hạng lớn nhất? Vì sao?",
              color:D.amber,
              dynamic: ()=>{
                const changes=REGIONS.map((r,i)=>({r,i,d:EXPERT_LIVE.ranks[i]-ENTROPY_RESULT.ranks[i]}))
                  .sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
                const biggest=changes[0];
                return `${biggest.r} thay đổi lớn nhất: ${biggest.d>0?`tăng ${biggest.d} hạng`:`giảm ${Math.abs(biggest.d)} hạng`} (từ #${EXPERT_LIVE.ranks[biggest.i]} → #${ENTROPY_RESULT.ranks[biggest.i]}).\n\nLý do: Entropy trao w=${W_ENTROPY[1].toFixed(3)} cho FDI — tiêu chí biến động lớn nhất. Vùng có FDI thấp bị phạt nặng. Bài học: kết quả TOPSIS nhạy cảm với phương pháp xác định trọng số.`;
              }
            },
            {
              q:"c) TOPSIS giả định độc lập tuyến tính. AI Readiness và Internet có tương quan cao — ảnh hưởng thế nào?",
              color:D.teal,
              dynamic: ()=>{
                const wAIv=W_LIVE[3], wNet=W_LIVE[6];
                return `Tương quan giữa AI Readiness và Internet (Pearson ≈ 0.97) tạo "double counting". Với tham số hiện tại: w_AI=${wAIv.toFixed(3)} + w_Internet=${wNet.toFixed(3)} = tổng ảnh hưởng ${(wAIv+wNet).toFixed(3)} thay vì ${wAIv.toFixed(3)}.\n\nĐNB (Internet=94, AI=75) và ĐBSH (Internet=92, AI=68) hưởng lợi kép. Giải pháp: PCA gộp hai tiêu chí thành "Digital Capacity", hoặc CRITIC method tự điều chỉnh theo tương quan.`;
              }
            },
            {
              q:"d) Chọn 3 vùng xây Trung tâm AI theo QĐ 127/QĐ-TTg?",
              color:D.coral,
              dynamic: ()=>{
                const top3=([...cLive.map((v,i)=>({v,i}))].sort((a,b)=>b.v-a.v).slice(0,3));
                return `Với tham số hiện tại, 3 vùng đề xuất:\n${top3.map(({v,i},k)=>`  ${k+1}. ${REGIONS[i]} — C*=${v.toFixed(4)}`).join("\n")}\n\nCần bổ sung tiêu chí địa-chính trị: phân tán địa lý (tránh tập trung), kết nối ASEAN (Đà Nẵng), an ninh năng lượng, chi phí đất. Thứ hạng có thể thay đổi khi bạn điều chỉnh trọng số.`;
              }
            },
          ].map((item,idx)=>(
            <Card key={idx}>
              <div style={{padding:"8px 12px",background:`${item.color}10`,
                borderLeft:`3px solid ${item.color}`,borderRadius:6,marginBottom:10}}>
                <p style={{fontSize:13,fontWeight:600,color:item.color,margin:0}}>{item.q}</p>
              </div>
              <p style={{fontSize:13,color:D.text2,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>
                {item.dynamic()}
              </p>
            </Card>
          ))}

          <Card style={{border:`1px solid ${D.blue}33`}}>
            <h3 style={{margin:"0 0 12px",color:D.blue,fontSize:14}}>Quy trình TOPSIS — tóm tắt 5 bước</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {[
                {step:"Bước 1",title:"Chuẩn hóa vector",formula:"rᵢⱼ = xᵢⱼ / √(Σxᵢⱼ²)",color:D.blue},
                {step:"Bước 2",title:"Ma trận có trọng số",formula:"vᵢⱼ = wⱼ · rᵢⱼ",color:D.teal},
                {step:"Bước 3",title:"Ideal A⁺ và A⁻",formula:"A⁺=max(vᵢⱼ)\nA⁻=min(vᵢⱼ)",color:D.amber},
                {step:"Bước 4",title:"Khoảng cách Euclide",formula:"S⁺=√Σ(v-A⁺)²\nS⁻=√Σ(v-A⁻)²",color:D.purple},
                {step:"Bước 5",title:"Hệ số C*",formula:"C*=S⁻/(S⁺+S⁻)",color:D.green},
              ].map((s,i)=>(
                <div key={i} style={{padding:"10px 10px",background:`${s.color}10`,
                  border:`1px solid ${s.color}33`,borderRadius:8,textAlign:"center"}}>
                  <p style={{fontSize:10,color:D.text3,margin:"0 0 4px"}}>{s.step}</p>
                  <p style={{fontSize:12,fontWeight:600,color:s.color,margin:"0 0 6px"}}>{s.title}</p>
                  <p style={{fontSize:10,fontFamily:"monospace",color:D.text2,
                    margin:0,whiteSpace:"pre-line"}}>{s.formula}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <GeminiPanel context={geminiCtx}/>

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.text3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 6 — AIDEOM-VN | Dữ liệu: vietnam_regions_2024.csv (GSO 2024) |
        Công cụ: NumPy · TOPSIS from scratch · Entropy weights | QĐ 127/QĐ-TTg
      </div>
    </div>
  );
}