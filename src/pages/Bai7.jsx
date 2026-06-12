import { useState, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, BarChart, Bar, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, ReferenceLine
} from "recharts";

// ── THEME ─────────────────────────────────────────────────────────────
const D = {
  bg0:"#020617",bg1:"#0f172a",bg2:"#1e293b",bg3:"#0c1a2e",
  border:"#1e3a5f",
  t1:"#e2e8f0",t2:"#94a3b8",t3:"#64748b",
  blue:"#38bdf8",   blueBg:"rgba(56,189,248,0.10)",
  teal:"#2dd4bf",   tealBg:"rgba(45,212,191,0.10)",
  amber:"#fbbf24",  amberBg:"rgba(251,191,36,0.10)",
  coral:"#f87171",  coralBg:"rgba(248,113,113,0.10)",
  purple:"#a78bfa", purpleBg:"rgba(167,139,250,0.10)",
  green:"#4ade80",  greenBg:"rgba(74,222,128,0.10)",
  cyan:"#67e8f9",
};

// ── DỮ LIỆU PARETO FRONT (100 nghiệm từ NSGA-II) ─────────────────────
const GDP  = [61336.5,55046.8,54942.0,57979.1,41506.9,50720.5,61228.4,62238.7,59898.8,47142.6,61697.5,55980.2,62615.5,43263.9,62779.9,60649.2,58616.1,53055.2,49025.3,42629.1,60668.6,58537.6,44075.7,61234.5,60423.6,55503.6,51662.3,61224.3,62514.6,60067.7,47311.9,59384.4,61801.4,54276.8,61618.0,58025.4,61548.4,59903.7,60647.7,56556.0,61793.0,47694.8,54455.4,57086.2,59210.2,48941.1,41602.8,60430.4,55079.2,59989.9,42150.4,57218.9,62225.4,57714.4,58577.9,61266.6,55669.4,59395.3,52236.5,58152.1,47801.4,54643.5,61958.9,58996.0,60288.6,52661.4,48456.1,51230.2,51296.7,54328.1,61516.4,58924.0,61357.3,55425.9,57386.4,60538.2,55653.4,61308.4,58498.3,62365.7];
const GINI = [146.1,1817.8,34.7,1626.8,206.0,876.7,134.7,207.7,686.9,143.2,567.3,76.3,1344.5,95.7,971.6,450.9,530.1,352.1,225.5,86.8,1000.3,1476.2,136.4,299.4,1632.3,110.7,786.2,752.3,1160.6,333.8,176.4,1736.0,852.5,427.4,1247.9,1529.8,467.1,423.6,885.2,1116.6,833.0,188.3,643.1,243.8,281.6,202.6,210.2,382.3,1811.8,794.1,174.2,1417.3,1093.6,1216.9,118.4,812.3,1383.6,1737.4,284.7,400.3,857.9,69.3,398.6,934.5,1349.6,372.4,288.7,922.5,1299.7,267.6,1028.1,1172.9,1009.1,69.8,254.1,401.7,41.3,1064.9,492.4,1263.0];
const EMIT = [6651.9,136.2,4079.4,281.7,324.8,102.4,6388.6,5782.3,2705.3,945.1,4516.9,4299.2,4894.2,707.8,5349.1,2277.0,2007.8,939.5,670.4,791.5,3050.6,359.9,629.3,5608.8,2099.8,4113.8,165.2,3573.5,5299.1,3249.5,945.1,657.6,4512.0,209.8,3515.0,219.3,3773.7,2871.4,2174.3,143.5,4232.0,516.2,412.4,1814.8,1525.7,914.1,383.5,3977.8,158.5,1238.2,506.0,253.2,4942.7,220.1,1613.2,3624.3,129.4,663.8,444.3,1406.3,106.4,4069.6,5503.1,432.9,2093.4,481.9,392.5,127.6,124.8,1327.6,3349.5,330.4,3343.6,4220.6,1814.8,3917.5,4233.0,3243.8,1249.7,5005.1];
const SEC  = [3999,11563,7452,12290,7322,10643,4285,4502,9371,8380,6724,6230,5641,7061,5067,8790,10728,10336,9175,6882,8062,12057,7383,4491,9233,6447,10812,6892,5173,7921,8380,10486,5791,10614,8222,11564,7026,8656,8495,10781,5907,9050,10416,10563,9882,8938,7182,6656,11563,10966,7243,11934,5358,11180,10180,7386,11406,10482,10384,11306,9933,7453,5090,12180,9299,10152,9141,10252,10427,10018,7624,11662,7590,6140,10635,6684,6191,7255,9941,5527];
const N = GDP.length;

// Phân bổ nghiệm thỏa hiệp mặc định (idx=58)
const ALLOC_DEFAULT = [
  {r:"NMM",I:4,   D:49,   AI:64,  H:7685},
  {r:"RRD",I:142, D:1776, AI:95,  H:4999},
  {r:"NCC",I:5,   D:3400, AI:133, H:3713},
  {r:"CH", I:69,  D:30,   AI:34,  H:6879},
  {r:"SE", I:219, D:2665, AI:26,  H:4845},
  {r:"MD", I:0,   D:925,  AI:91,  H:6408},
];
const RNAMES  = ["TdMN phía Bắc","Đ.bằng sông Hồng","Bắc TB+DHMT","Tây Nguyên","Đông Nam Bộ","ĐB Cửu Long"];
const RCOLORS = [D.blue,D.teal,D.amber,D.coral,D.purple,D.green];
const INAMES  = ["Hạ tầng","CĐS DN","Năng lực AI","Nhân lực"];
const ICOLORS = [D.blue,D.amber,D.purple,D.teal];

// ── TOPSIS (tính nghiệm thỏa hiệp theo trọng số slider) ──────────────
function topsis(w) {
  const norm = (arr, isGood) => {
    const mn = Math.min(...arr), mx = Math.max(...arr);
    return arr.map(v => isGood ? (v-mn)/(mx-mn) : (mx-v)/(mx-mn));
  };
  const n1 = norm(GDP, true);
  const n2 = norm(GINI, false);
  const n3 = norm(EMIT, false);
  const n4 = norm(SEC, false);
  const wSum = w.reduce((a,b)=>a+b,0);
  const wn = w.map(x=>x/wSum);
  const scores = Array.from({length:N}, (_,i) =>
    wn[0]*n1[i] + wn[1]*n2[i] + wn[2]*n3[i] + wn[3]*n4[i]
  );
  const bestIdx = scores.indexOf(Math.max(...scores));
  const cstar = Math.max(...scores);
  return { bestIdx, cstar: +cstar.toFixed(4), scores };
}

// ── UI Components ─────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,padding:"1.2rem",...style}}>
    {children}
  </div>
);
const TabBtn = ({label,active,onClick}) => (
  <button onClick={onClick} style={{
    padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:600,
    cursor:"pointer",border:"none",transition:"all .2s",
    background:active?"#0ea5e9":"rgba(30,41,59,0.7)",
    color:active?"#fff":D.t2,
    boxShadow:active?"0 0 14px #0ea5e940":"none"
  }}>{label}</button>
);
const SliderRow = ({label,value,min,max,step=0.05,onChange,color,unit="",fmt}) => (
  <div style={{marginBottom:11}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
      <span style={{fontSize:12,color:D.t2}}>{label}</span>
      <span style={{fontSize:13,fontWeight:700,color,fontFamily:"monospace"}}>
        {fmt?fmt(value):value.toFixed(2)}{unit}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(+e.target.value)}
      style={{
        width:"100%",height:6,borderRadius:3,outline:"none",cursor:"pointer",
        appearance:"none",WebkitAppearance:"none",
        background:`linear-gradient(to right,${color} 0%,${color} ${(value-min)/(max-min)*100}%,#1e3a5f ${(value-min)/(max-min)*100}%,#1e3a5f 100%)`
      }}
    />
    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:D.t3,marginTop:1}}>
      <span>{min}</span><span>{max}</span>
    </div>
  </div>
);

// ── Gemini AI Panel (có nhập API key, context theo tab) ───────────────
function GeminiPanel({ result, loading, onAnalyze, geminiContext }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleAnalyze = () => {
    if (!apiKey.trim()) {
      alert("⚠️ Vui lòng nhập Gemini API Key trước khi phân tích.");
      return;
    }
    onAnalyze(apiKey.trim(), geminiContext);
  };

  return (
    <Card style={{ border:`1px solid #4285f433`, marginTop:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:20 }}>🤖</span>
        <span style={{ color:D.t1, fontWeight:700, fontSize:15 }}>Tác nhân Gemini AI — Phân tích kết quả</span>
        <span style={{ background:"#4285f4", color:"#fff", fontSize:10, padding:"2px 8px", borderRadius:99 }}>Google Gemini</span>
      </div>

      {/* API Key input */}
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <div style={{ flex:1, position:"relative" }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e=>setApiKey(e.target.value)}
            placeholder="Dán Gemini API Key vào đây (AIza...)"
            style={{
              width:"100%", padding:"8px 40px 8px 12px", borderRadius:8,
              background:D.bg3, border:`1px solid ${apiKey ? "#4285f4" : D.border}`,
              color:D.t1, fontSize:12, fontFamily:"monospace", boxSizing:"border-box"
            }}
          />
          <button
            onClick={()=>setShowKey(!showKey)}
            style={{
              position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", color:D.t3, cursor:"pointer", fontSize:14
            }}
          >
            {showKey ? "🙈" : "👁"}
          </button>
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
          style={{ fontSize:11, color:"#4285f4", textDecoration:"none", whiteSpace:"nowrap" }}>
          Lấy API Key →
        </a>
      </div>

      <button onClick={handleAnalyze} disabled={loading} style={{
        background:loading?"#374151":"linear-gradient(135deg,#4285f4,#0f9d58)",
        color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",
        fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",marginBottom:14
      }}>
        {loading?"⏳ Đang phân tích...":"✨ Phân tích với Gemini AI"}
      </button>
      {result&&(
        <div style={{background:D.bg3,borderRadius:8,padding:16,color:D.t2,
          fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",border:`1px solid ${D.border}`}}>
          {result}
        </div>
      )}
    </Card>
  );
}

// ── Custom SVG Pareto Scatter ─────────────────────────────────────────
function ParetoScatter({xArr,yArr,xLabel,yLabel,bestIdx,highlightIdx,colorArr}){
  const W=460,H=260,LP=52,RP=16,TP=16,BP=36;
  const xmn=Math.min(...xArr),xmx=Math.max(...xArr);
  const ymn=Math.min(...yArr),ymx=Math.max(...yArr);
  const px=v=>LP+(v-xmn)/(xmx-xmn)*(W-LP-RP);
  const py=v=>TP+(1-(v-ymn)/(ymx-ymn))*(H-TP-BP);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <line x1={LP} y1={TP} x2={LP} y2={H-BP} stroke={D.border} strokeWidth={1}/>
      <line x1={LP} y1={H-BP} x2={W-RP} y2={H-BP} stroke={D.border} strokeWidth={1}/>
      {xArr.map((x,i)=>{
        const isB=i===bestIdx,isH=i===highlightIdx;
        const col=colorArr?colorArr[i]:isB?D.amber:isH?D.coral:"rgba(56,189,248,0.55)";
        return(
          <circle key={i} cx={px(x)} cy={py(yArr[i])} r={isB?8:isH?7:3.5}
            fill={col} opacity={isB||isH?1:0.7}
            stroke={isB?"#fff":isH?D.coral:"none"} strokeWidth={isB?2:0}/>
        );
      })}
      {bestIdx!=null&&(
        <text x={Math.min(px(xArr[bestIdx])+10,W-80)} y={py(yArr[bestIdx])-8}
          fontSize={10} fill={D.amber} fontWeight="bold">★ Thỏa hiệp</text>
      )}
      {highlightIdx!=null&&highlightIdx!==bestIdx&&(
        <text x={Math.min(px(xArr[highlightIdx])+10,W-80)} y={py(yArr[highlightIdx])-8}
          fontSize={10} fill={D.coral} fontWeight="bold">Max GDP</text>
      )}
      <text x={(LP+W-RP)/2} y={H-4} textAnchor="middle" fontSize={10} fill={D.t3}>{xLabel}</text>
      <text x={10} y={(TP+H-BP)/2} textAnchor="middle" fontSize={10} fill={D.t3}
        transform={`rotate(-90,10,${(TP+H-BP)/2})`}>{yLabel}</text>
      {[0,0.5,1].map(t=>(
        <g key={t}>
          <text x={LP-4} y={py(ymn+t*(ymx-ymn))+4} textAnchor="end" fontSize={8} fill={D.t3}>
            {Math.round((ymn+t*(ymx-ymn))/1000)}K
          </text>
          <text x={px(xmn+t*(xmx-xmn))} y={H-BP+13} textAnchor="middle" fontSize={8} fill={D.t3}>
            {Math.round((xmn+t*(xmx-xmn))/1000)}K
          </text>
        </g>
      ))}
    </svg>
  );
}

// Parallel Coordinates SVG
function ParallelCoords({bestIdx,highlightIdx}){
  const W=540,H=230,LP=36,RP=36,TP=36,BP=24;
  const axes=[
    {label:"GDP↑",arr:GDP,  color:D.blue,  good:true},
    {label:"Gini↓",arr:GINI,color:D.coral, good:false},
    {label:"Emit↓",arr:EMIT,color:D.green, good:false},
    {label:"SecRisk↓",arr:SEC, color:D.amber, good:false},
  ];
  const nAx=axes.length;
  const axX=axes.map((_,i)=>LP+(W-LP-RP)*i/(nAx-1));
  const norm=(arr,v,good)=>{
    const mn=Math.min(...arr),mx=Math.max(...arr);
    return good?(v-mn)/(mx-mn):(mx-v)/(mx-mn);
  };
  const getY=(ai,v)=>TP+(1-norm(axes[ai].arr,v,axes[ai].good))*(H-TP-BP);
  const sampleIdx=Array.from({length:25},(_,k)=>Math.floor(k*N/25));
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {axes.map((ax,i)=>(
        <g key={i}>
          <line x1={axX[i]} y1={TP} x2={axX[i]} y2={H-BP} stroke={D.border} strokeWidth={1}/>
          <text x={axX[i]} y={TP-8} textAnchor="middle" fontSize={10} fill={ax.color} fontWeight="600">{ax.label}</text>
          <text x={axX[i]} y={TP-18} textAnchor="middle" fontSize={7} fill={D.t3}>{Math.round(Math.max(...ax.arr)/1000)}K</text>
          <text x={axX[i]} y={H-BP+11} textAnchor="middle" fontSize={7} fill={D.t3}>{Math.round(Math.min(...ax.arr)/1000)}K</text>
        </g>
      ))}
      {sampleIdx.map(i=>{
        const vals=[GDP[i],GINI[i],EMIT[i],SEC[i]];
        const pts=axX.map((x,j)=>`${x},${getY(j,vals[j])}`).join(" ");
        const isB=i===bestIdx,isH=i===highlightIdx;
        return(
          <polyline key={i} points={pts} fill="none"
            stroke={isB?D.amber:isH?D.coral:"rgba(56,189,248,0.18)"}
            strokeWidth={isB||isH?2.5:0.7} opacity={isB||isH?1:0.6}/>
        );
      })}
      {[bestIdx,highlightIdx].filter((v,i,a)=>v!=null&&a.indexOf(v)===i).map(i=>{
        const vals=[GDP[i],GINI[i],EMIT[i],SEC[i]];
        const col=i===bestIdx?D.amber:D.coral;
        return(
          <g key={i}>
            <polyline points={axX.map((x,j)=>`${x},${getY(j,vals[j])}`).join(" ")}
              fill="none" stroke={col} strokeWidth={2.5}/>
            {axX.map((x,j)=><circle key={j} cx={x} cy={getY(j,vals[j])} r={4} fill={col}/>)}
          </g>
        );
      })}
    </svg>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function Bai7(){
  // ── Trọng số TOPSIS (slider) ──────────────────────────────────────
  const [wGDP,  setWGDP]  = useState(0.40);
  const [wGini, setWGini] = useState(0.25);
  const [wEmit, setWEmit] = useState(0.20);
  const [wSec,  setWSec]  = useState(0.15);

  // ── Lọc Pareto (slider) ───────────────────────────────────────────
  const [minGDP,  setMinGDP]  = useState(41000);
  const [maxGini, setMaxGini] = useState(1818);
  const [maxEmit, setMaxEmit] = useState(6700);

  // ── Max GDP highlight ─────────────────────────────────────────────
  const maxGDPIdx = useMemo(() => GDP.indexOf(Math.max(...GDP)), []);

  const [tab,    setTab]    = useState("c1");
  const [aiRes,  setAiRes]  = useState("");
  const [aiLoad, setAiLoad] = useState(false);

  // ── TOPSIS tính theo trọng số slider ─────────────────────────────
  const { bestIdx, cstar, scores } = useMemo(() =>
    topsis([wGDP, wGini, wEmit, wSec]),
    [wGDP, wGini, wEmit, wSec]
  );

  const wSum = wGDP+wGini+wEmit+wSec;
  const wn   = [wGDP,wGini,wEmit,wSec].map(w=>w/wSum);

  // Dữ liệu nghiệm thỏa hiệp hiện tại
  const best = useMemo(() => ({
    gdp:  GDP[bestIdx],
    gini: GINI[bestIdx],
    emit: EMIT[bestIdx],
    sec:  SEC[bestIdx],
    cstar,
    idx:  bestIdx,
  }), [bestIdx, cstar]);

  // ── Lọc Pareto ────────────────────────────────────────────────────
  const filteredIdx = useMemo(() =>
    Array.from({length:N},(_,i)=>i).filter(i =>
      GDP[i]>=minGDP && GINI[i]<=maxGini && EMIT[i]<=maxEmit
    ), [minGDP, maxGini, maxEmit]
  );

  // Màu điểm theo C* score
  const pointColors = useMemo(() => Array.from({length:N},(_,i)=>{
    if(i===bestIdx) return D.amber;
    if(i===maxGDPIdx) return D.coral;
    const t = (scores[i]-Math.min(...scores))/(Math.max(...scores)-Math.min(...scores));
    return `rgba(${Math.round(56+t*60)},${Math.round(189-t*50)},248,${0.4+t*0.4})`;
  }), [bestIdx, maxGDPIdx, scores]);

  // Sensitivity: C* khi thay đổi wGDP
  const sensData = useMemo(() => {
    return [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8].map(w => {
      const r = topsis([w, wGini, wEmit, wSec]);
      return {
        wGDP:`${(w*100).toFixed(0)}%`,
        cstar: r.cstar,
        gdp: GDP[r.bestIdx]/1000,
        gini: GINI[r.bestIdx],
      };
    });
  }, [wGini, wEmit, wSec]);

  // Tradeoff: nghiệm Max GDP
  const maxSol = { gdp:GDP[maxGDPIdx], gini:GINI[maxGDPIdx], emit:EMIT[maxGDPIdx], sec:SEC[maxGDPIdx] };

  // ── Context cho Gemini theo từng tab ──────────────────────────────
  const geminiContexts = {
    c1: `Bài 7 — Biên Pareto (NSGA-II)
4 mục tiêu: max GDP, min Gini, min Emission, min Security Risk
Số nghiệm Pareto: ${N} | Số nghiệm sau lọc: ${filteredIdx.length}
Trọng số TOPSIS hiện tại (chuẩn hóa): w₁ GDP=${(wn[0]*100).toFixed(1)}% · w₂ Gini=${(wn[1]*100).toFixed(1)}% · w₃ Emit=${(wn[2]*100).toFixed(1)}% · w₄ Sec=${(wn[3]*100).toFixed(1)}%
Nghiệm thỏa hiệp (★): GDP=${(best.gdp/1000).toFixed(1)}K tỷ, Gini=${best.gini.toFixed(1)}, Emission=${best.emit.toFixed(1)} CO₂, Security=${best.sec.toFixed(1)}, C*=${best.cstar}
Nghiệm Max GDP (🔴): GDP=${(maxSol.gdp/1000).toFixed(1)}K tỷ, Gini=${maxSol.gini.toFixed(1)}, Emit=${maxSol.emit.toFixed(1)}, Sec=${maxSol.sec.toFixed(1)}
Đánh đổi từ thỏa hiệp → Max GDP: GDP +${((maxSol.gdp-best.gdp)/1000).toFixed(1)}K tỷ (+${((maxSol.gdp-best.gdp)/best.gdp*100).toFixed(1)}%), Gini tăng x${(maxSol.gini/best.gini).toFixed(1)}, Emission tăng x${(maxSol.emit/best.emit).toFixed(1)}.
Hãy phân tích biên Pareto, sự phân phối các mục tiêu và ý nghĩa của các đánh đổi.`,

    c2: `Bài 7 — TOPSIS Thỏa hiệp
Trọng số hiện tại: w₁=${(wn[0]*100).toFixed(1)}%, w₂=${(wn[1]*100).toFixed(1)}%, w₃=${(wn[2]*100).toFixed(1)}%, w₄=${(wn[3]*100).toFixed(1)}%
Top 10 nghiệm theo C*:
${[...Array(N).keys()].sort((a,b)=>scores[b]-scores[a]).slice(0,10).map((i,rank)=>`#${rank+1}: GDP=${(GDP[i]/1000).toFixed(1)}K, Gini=${GINI[i].toFixed(1)}, Emit=${EMIT[i].toFixed(1)}, Sec=${SEC[i].toFixed(1)}, C*=${scores[i].toFixed(4)}`).join('\n')}
Độ nhạy C* khi thay đổi w₁: ${sensData.map(d=>`w₁=${d.wGDP} → C*=${d.cstar}`).join(', ')}.
Phân tích sự thay đổi của nghiệm thỏa hiệp theo trọng số và đề xuất bộ trọng số hợp lý.`,

    c3: `Bài 7 — Chi phí đánh đổi
So sánh hai nghiệm: Thỏa hiệp (★) và Max GDP (🔴):
- GDP: ★=${(best.gdp/1000).toFixed(1)}K tỷ, 🔴=${(maxSol.gdp/1000).toFixed(1)}K tỷ (chênh +${((maxSol.gdp-best.gdp)/1000).toFixed(1)}K tỷ)
- Gini: ★=${best.gini.toFixed(1)}, 🔴=${maxSol.gini.toFixed(1)} (tăng x${(maxSol.gini/best.gini).toFixed(1)})
- Emission: ★=${best.emit.toFixed(1)} CO₂, 🔴=${maxSol.emit.toFixed(1)} (tăng x${(maxSol.emit/best.emit).toFixed(1)})
- Security: ★=${best.sec.toFixed(1)}, 🔴=${maxSol.sec.toFixed(1)}
Giải thích chi phí của việc theo đuổi GDP tối đa về mặt bất bình đẳng và môi trường.`,

    c4: `Bài 7 — Phân bổ tối ưu (nghiệm thỏa hiệp idx=${best.idx})
Phân bổ 6 vùng theo 4 hạng mục: I (Hạ tầng), D (CĐS DN), AI (Năng lực AI), H (Nhân lực)
Chi tiết:
${ALLOC_DEFAULT.map((row,i)=>`${RNAMES[i]}: I=${row.I}, D=${row.D}, AI=${row.AI}, H=${row.H} (tổng ${(row.I+row.D+row.AI+row.H)/1000}K tỷ, H chiếm ${(row.H/(row.I+row.D+row.AI+row.H)*100).toFixed(0)}%)`).join('\n')}
Cơ cấu toàn bộ: Hạ tầng: ${(ALLOC_DEFAULT.reduce((s,r)=>s+r.I,0)/50000*100).toFixed(1)}%, D: ${(ALLOC_DEFAULT.reduce((s,r)=>s+r.D,0)/50000*100).toFixed(1)}%, AI: ${(ALLOC_DEFAULT.reduce((s,r)=>s+r.AI,0)/50000*100).toFixed(1)}%, H: ${(ALLOC_DEFAULT.reduce((s,r)=>s+r.H,0)/50000*100).toFixed(1)}%.
So sánh với LP đơn mục tiêu: LP đơn chỉ tập trung AI, còn NSGA-II ưu tiên H nhiều hơn. Phân tích ý nghĩa chính sách.`,

    c5: `Bài 7 — Thảo luận
Các câu hỏi đã được trả lời trong tab, nhưng hãy đưa ra kết luận tổng quan:
(1) Đánh đổi GDP – Gini – Emission rõ ràng, phù hợp với cơ cấu kinh tế VN hiện tại.
(2) Trọng số hiện tại (w₁=${(wn[0]*100).toFixed(0)}%) phản ánh ưu tiên Đại hội XIII. Có thể điều chỉnh để phù hợp COP26 hoặc an ninh mạng.
(3) NSGA-II cung cấp tập Pareto, không thay thế quyết định chính trị nhưng hỗ trợ thảo luận đa mục tiêu.
Hãy tóm tắt và khuyến nghị chính sách.`,
  };

  // Gemini analyze (nhận apiKey và context)
  const handleAnalyze = async (apiKey, ctx) => {
    setAiLoad(true); setAiRes("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{parts:[{text:
            `Bạn là chuyên gia kinh tế và tối ưu đa mục tiêu Việt Nam. Phân tích kết quả NSGA-II Pareto sau bằng tiếng Việt: (1) nhận xét chính, (2) ý nghĩa các đánh đổi, (3) khuyến nghị chính sách phù hợp với Nghị quyết 57-NQ/TW và cam kết COP26. Dữ liệu:\n\n${ctx}`
          }]}]}) }
      );
      const d = await res.json();
      if (d.error) {
        setAiRes(`❌ Lỗi API: ${d.error.message}`);
      } else {
        setAiRes(d.candidates?.[0]?.content?.parts?.[0]?.text||"Không có kết quả từ Gemini.");
      }
    } catch(e){ setAiRes("❌ Lỗi kết nối: "+e.message); }
    setAiLoad(false);
  };

  const TABS = [
    {id:"c1",label:"① Biên Pareto"},
    {id:"c2",label:"② TOPSIS Thỏa hiệp"},
    {id:"c3",label:"③ Chi phí đánh đổi"},
    {id:"c4",label:"④ Phân bổ tối ưu"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

  return(
    <div style={{minHeight:"100vh",fontFamily:"'Segoe UI',sans-serif",color:D.t1,
      padding:"24px 20px",
      background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{display:"inline-block",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,
          letterSpacing:2,marginBottom:10,color:"#fff"}}>
          AIDEOM-VN • PHẦN D – CẤP ĐỘ KHÁ KHÓ
        </div>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#a78bfa)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 7 — Tối ưu Đa mục tiêu Pareto với NSGA-II
        </h1>
        <p style={{fontSize:13,color:D.t3,margin:0}}>
          4 mục tiêu xung đột · 24 biến · 100 nghiệm Pareto · NSGA-II (pop=100, gen=200)
          &nbsp;|&nbsp; Kéo slider trọng số → nghiệm thỏa hiệp cập nhật ngay
        </p>
      </div>

      {/* ══ CONTROL PANEL ════════════════════════════════════════════ */}
      <Card style={{marginBottom:20,border:`1px solid #0ea5e955`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <span style={{fontSize:16}}>🎛️</span>
          <span style={{fontWeight:700,fontSize:15,color:D.cyan}}>Bảng điều khiển tham số TOPSIS</span>
          <span style={{fontSize:11,color:D.t3,marginLeft:4}}>— kéo slider → nghiệm thỏa hiệp thay đổi ngay</span>
          <span style={{marginLeft:"auto",fontSize:12,color:D.amber,fontFamily:"monospace"}}>
            Tổng: {wSum.toFixed(2)} → chuẩn hóa = 1.00
          </span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 32px"}}>

          {/* Cột 1: Trọng số TOPSIS */}
          <div>
            <p style={{fontSize:12,fontWeight:700,color:D.amber,margin:"0 0 12px"}}>
              ⚖️ Trọng số TOPSIS w (tự chuẩn hóa)
            </p>
            <SliderRow label="w₁ GDP gain (tối đa ↑)" value={wGDP} min={0.05} max={0.7}
              onChange={setWGDP} color={D.blue} fmt={v=>v.toFixed(2)}/>
            <SliderRow label="w₂ Gini MAD (công bằng ↓)" value={wGini} min={0.05} max={0.5}
              onChange={setWGini} color={D.coral} fmt={v=>v.toFixed(2)}/>
            <SliderRow label="w₃ Emission (môi trường ↓)" value={wEmit} min={0.05} max={0.5}
              onChange={setWEmit} color={D.green} fmt={v=>v.toFixed(2)}/>
            <SliderRow label="w₄ Security risk (an ninh ↓)" value={wSec} min={0.05} max={0.5}
              onChange={setWSec} color={D.amber} fmt={v=>v.toFixed(2)}/>

            {/* Preset kịch bản */}
            <p style={{fontSize:11,color:D.t3,margin:"8px 0 4px"}}>Kịch bản nhanh:</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[
                {label:"ĐH XIII",   w:[0.40,0.25,0.20,0.15]},
                {label:"COP26",     w:[0.30,0.25,0.30,0.15]},
                {label:"Bao trùm",  w:[0.25,0.40,0.20,0.15]},
                {label:"An ninh",   w:[0.30,0.20,0.20,0.30]},
              ].map(({label,w})=>(
                <button key={label} onClick={()=>{setWGDP(w[0]);setWGini(w[1]);setWEmit(w[2]);setWSec(w[3]);}}
                  style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${D.border}`,
                    background:"transparent",color:D.t2,fontSize:11,cursor:"pointer"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cột 2: Lọc Pareto */}
          <div>
            <p style={{fontSize:12,fontWeight:700,color:D.purple,margin:"0 0 12px"}}>
              🔍 Lọc Pareto front theo ngưỡng
            </p>
            <SliderRow label="GDP tối thiểu" value={minGDP} min={41000} max={63000} step={500}
              onChange={setMinGDP} color={D.blue} unit=" tỷ" fmt={v=>`${(v/1000).toFixed(1)}K`}/>
            <SliderRow label="Gini tối đa (công bằng)" value={maxGini} min={50} max={1818} step={50}
              onChange={setMaxGini} color={D.coral} unit="" fmt={v=>`${v}`}/>
            <SliderRow label="Emission tối đa" value={maxEmit} min={100} max={6700} step={100}
              onChange={setMaxEmit} color={D.green} unit="" fmt={v=>`${v}`}/>

            <div style={{marginTop:12,padding:"10px 14px",
              background:`${D.purple}0e`,border:`1px solid ${D.purple}33`,borderRadius:8}}>
              <p style={{fontSize:12,fontWeight:700,color:D.purple,margin:"0 0 6px"}}>
                Nghiệm sau lọc: {filteredIdx.length} / {N}
              </p>
              <p style={{fontSize:11,color:D.t3,margin:0}}>
                Nghiệm thỏa hiệp {filteredIdx.includes(bestIdx)?"✅ nằm trong":"⚠️ ngoài"} vùng lọc
              </p>
            </div>
          </div>

          {/* Cột 3: Nghiệm thỏa hiệp live */}
          <div>
            <p style={{fontSize:12,fontWeight:700,color:D.cyan,margin:"0 0 12px"}}>
              ★ Nghiệm thỏa hiệp (cập nhật theo w)
            </p>
            {[
              {label:"GDP gain",    val:`${(best.gdp/1000).toFixed(2)}K tỷ`,  color:D.blue},
              {label:"Gini MAD",    val:best.gini.toFixed(1),                  color:D.coral},
              {label:"Emission",    val:best.emit.toFixed(1),                  color:D.green},
              {label:"Sec. Risk",   val:best.sec.toFixed(1),                   color:D.amber},
              {label:"C* (TOPSIS)", val:best.cstar,                            color:D.amber},
              {label:"Pareto idx",  val:`#${best.idx}`,                        color:D.purple},
            ].map((k,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"5px 0",borderBottom:`1px solid ${D.border}22`}}>
                <span style={{fontSize:12,color:D.t2}}>{k.label}</span>
                <span style={{fontSize:13,fontWeight:700,color:k.color,fontFamily:"monospace"}}>{k.val}</span>
              </div>
            ))}

            <div style={{marginTop:12,padding:"8px 12px",
              background:D.amberBg,borderLeft:`3px solid ${D.amber}`,borderRadius:6}}>
              <p style={{fontSize:11,color:D.amber,margin:0,fontWeight:600}}>
                Đánh đổi: Thỏa hiệp → Max GDP
              </p>
              <p style={{fontSize:11,color:D.t2,margin:"4px 0 0"}}>
                GDP +{((maxSol.gdp-best.gdp)/1000).toFixed(1)}K tỷ (+{((maxSol.gdp-best.gdp)/best.gdp*100).toFixed(1)}%)
              </p>
              <p style={{fontSize:11,color:D.t2,margin:"2px 0 0"}}>
                Gini ×{(maxSol.gini/best.gini).toFixed(1)} | Emit ×{(maxSol.emit/best.emit).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {label:"Nghiệm thỏa hiệp",val:`${(best.gdp/1000).toFixed(1)}K tỷ`, unit:`GDP | C*=${best.cstar}`, color:D.amber},
          {label:"Gini MAD",         val:best.gini.toFixed(0),                 unit:"vs "+maxSol.gini.toFixed(0)+" (Max GDP)", color:D.coral},
          {label:"Emission",         val:best.emit.toFixed(0),                 unit:`CO₂ | vs ${maxSol.emit.toFixed(0)} (−${(100-(best.emit/maxSol.emit*100)).toFixed(0)}%)`, color:D.green},
          {label:"Max GDP",          val:`${(maxSol.gdp/1000).toFixed(1)}K tỷ`,unit:"Gini "+maxSol.gini.toFixed(0)+" Emit "+maxSol.emit.toFixed(0), color:D.coral},
          {label:"Nghiệm sau lọc",   val:filteredIdx.length,                   unit:`/ ${N} tổng`, color:D.purple},
        ].map((k,i)=>(
          <div key={i} style={{background:D.bg1,border:`1px solid ${k.color}33`,
            borderRadius:10,padding:"12px 16px",flex:1,minWidth:120}}>
            <p style={{fontSize:11,color:D.t3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{k.label}</p>
            <p style={{fontSize:19,fontWeight:700,color:k.color,margin:0}}>{k.val}</p>
            <p style={{fontSize:11,color:D.t3,margin:"2px 0 0"}}>{k.unit}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1: BIÊN PARETO ═══════════════════════════════════════ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
              Biên Pareto — 3 mặt phẳng 2D · ★ = nghiệm thỏa hiệp theo trọng số hiện tại
            </h3>
            <p style={{fontSize:12,color:D.t3,margin:"0 0 14px"}}>
              Thay đổi trọng số w ở bảng điều khiển → ★ di chuyển sang nghiệm khác
            </p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[
                {xA:GDP,yA:GINI,xL:"GDP gain (K tỷ)",yL:"Gini MAD"},
                {xA:GDP,yA:EMIT,xL:"GDP gain (K tỷ)",yL:"Emission (CO₂)"},
                {xA:GINI,yA:EMIT,xL:"Gini MAD",yL:"Emission (CO₂)"},
              ].map(({xA,yA,xL,yL},i)=>(
                <div key={i}>
                  <p style={{fontSize:10,color:D.t3,margin:"0 0 4px",textAlign:"center"}}>{xL} vs {yL}</p>
                  <ParetoScatter xArr={xA} yArr={yA} xLabel={xL} yLabel={yL}
                    bestIdx={bestIdx} highlightIdx={maxGDPIdx}
                    colorArr={pointColors}/>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:14}}>
              Tọa độ song song — 4 mục tiêu (25 nghiệm mẫu)
            </h3>
            <p style={{fontSize:12,color:D.t3,margin:"0 0 12px"}}>
              🟡 Thỏa hiệp (w hiện tại) · 🔴 Max GDP · Đường nhạt = nghiệm khác
            </p>
            <ParallelCoords bestIdx={bestIdx} highlightIdx={maxGDPIdx}/>
          </Card>

          {/* Phân phối 4 mục tiêu */}
          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>
              Phân phối 4 mục tiêu trên Pareto front (lọc: {filteredIdx.length} nghiệm)
            </h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[
                {label:"f₁ GDP gain",arr:GDP,  color:D.blue,  unit:"tỷ"},
                {label:"f₂ Gini MAD",arr:GINI, color:D.coral, unit:""},
                {label:"f₃ Emission",arr:EMIT, color:D.green, unit:"CO₂"},
                {label:"f₄ Sec. Risk",arr:SEC,  color:D.amber, unit:""},
              ].map(({label,arr,color,unit},ki)=>{
                const vals=filteredIdx.map(i=>arr[i]);
                const mn=Math.min(...vals),mx=Math.max(...vals),avg=vals.reduce((a,b)=>a+b,0)/vals.length;
                const bestVal=arr[bestIdx];
                return(
                  <div key={ki} style={{padding:"12px",background:`${color}0a`,
                    border:`1px solid ${color}33`,borderRadius:8}}>
                    <p style={{fontSize:11,fontWeight:700,color,margin:"0 0 8px"}}>{label}</p>
                    {[
                      {k:"Min",v:mn},{k:"Max",v:mx},{k:"Avg",v:avg},{k:"★ TC",v:bestVal}
                    ].map(({k,v})=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:10,color:D.t3}}>{k}</span>
                        <span style={{fontSize:11,fontFamily:"monospace",
                          color:k==="★ TC"?color:D.t2,fontWeight:k==="★ TC"?700:400}}>
                          {(v/1000).toFixed(1)}K {unit}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze} geminiContext={geminiContexts.c1}/>
        </div>
      )}

      {/* ══ TAB 2: TOPSIS THỎA HIỆP ═════════════════════════════════ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.amber,fontSize:15}}>
                Top 10 nghiệm TOPSIS C* (trọng số hiện tại)
              </h3>
              <p style={{fontSize:12,color:D.t3,margin:"0 0 14px"}}>
                w=[{wn.map(w=>(w*100).toFixed(0)+"%").join(",")}] (chuẩn hóa)
              </p>
              {[...Array(N).keys()]
                .sort((a,b)=>scores[b]-scores[a])
                .slice(0,10)
                .map((i,rank)=>{
                  const isBest=i===bestIdx;
                  const pct=scores[i]/scores[bestIdx]*100;
                  return(
                    <div key={i} style={{marginBottom:9}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <span style={{fontSize:12,color:isBest?D.amber:D.t2,fontWeight:isBest?700:400}}>
                          {isBest?"★ ":""}#{rank+1} · Pareto[{i}]
                        </span>
                        <div style={{display:"flex",gap:10,fontSize:11,color:D.t3,fontFamily:"monospace"}}>
                          <span style={{color:D.blue}}>{(GDP[i]/1000).toFixed(1)}K</span>
                          <span style={{color:D.coral}}>{GINI[i].toFixed(0)}</span>
                          <span style={{color:D.green}}>{EMIT[i].toFixed(0)}</span>
                          <span style={{color:isBest?D.amber:D.t2,fontWeight:isBest?700:400}}>{scores[i].toFixed(4)}</span>
                        </div>
                      </div>
                      <div style={{height:5,background:D.bg1,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,
                          background:isBest?D.amber:D.blue+"88",borderRadius:3,transition:"width .3s"}}/>
                      </div>
                    </div>
                  );
                })}
              <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:D.t3}}>
                <span style={{color:D.blue}}>■ GDP</span>
                <span style={{color:D.coral}}>■ Gini</span>
                <span style={{color:D.green}}>■ Emit</span>
                <span style={{color:D.amber}}>■ C*</span>
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:14}}>
                Radar: Thỏa hiệp vs Max GDP (chuẩn hóa 0–1)
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={[
                  {subject:"GDP↑",   TC:scores[bestIdx]>0?(GDP[bestIdx]-Math.min(...GDP))/(Math.max(...GDP)-Math.min(...GDP)):0,
                                     MG:(GDP[maxGDPIdx]-Math.min(...GDP))/(Math.max(...GDP)-Math.min(...GDP))},
                  {subject:"Gini↓",  TC:1-(GINI[bestIdx]-Math.min(...GINI))/(Math.max(...GINI)-Math.min(...GINI)),
                                     MG:1-(GINI[maxGDPIdx]-Math.min(...GINI))/(Math.max(...GINI)-Math.min(...GINI))},
                  {subject:"Emit↓",  TC:1-(EMIT[bestIdx]-Math.min(...EMIT))/(Math.max(...EMIT)-Math.min(...EMIT)),
                                     MG:1-(EMIT[maxGDPIdx]-Math.min(...EMIT))/(Math.max(...EMIT)-Math.min(...EMIT))},
                  {subject:"Sec↓",   TC:1-(SEC[bestIdx]-Math.min(...SEC))/(Math.max(...SEC)-Math.min(...SEC)),
                                     MG:1-(SEC[maxGDPIdx]-Math.min(...SEC))/(Math.max(...SEC)-Math.min(...SEC))},
                ]}>
                  <PolarGrid stroke="#1e3a5f"/>
                  <PolarAngleAxis dataKey="subject" tick={{fill:D.t2,fontSize:11}}/>
                  <PolarRadiusAxis domain={[0,1]} tick={{fill:D.t3,fontSize:9}}/>
                  <Radar name="★ Thỏa hiệp" dataKey="TC" stroke={D.amber} fill={D.amber} fillOpacity={0.25} strokeWidth={2}/>
                  <Radar name="Max GDP" dataKey="MG" stroke={D.coral} fill={D.coral} fillOpacity={0.1} strokeWidth={2}/>
                  <Legend wrapperStyle={{color:D.t2,fontSize:11}}/>
                  <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Sensitivity C* vs wGDP */}
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:14}}>
              Độ nhạy C* theo w₁ (GDP weight) — giữ nguyên w₂, w₃, w₄ hiện tại
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sensData} margin={{top:5,right:20,bottom:5,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                <XAxis dataKey="wGDP" tick={{fill:D.t2,fontSize:11}} label={{value:"w₁ GDP",position:"insideBottom",fill:D.t3,fontSize:11}}/>
                <YAxis tick={{fill:D.t2,fontSize:10}} domain={[0,1]}/>
                <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
                <ReferenceLine x={`${(wn[0]*100).toFixed(0)}%`} stroke={D.amber} strokeDasharray="4 4"
                  label={{value:"Hiện tại",fill:D.amber,fontSize:10}}/>
                <Line type="monotone" dataKey="cstar" stroke={D.purple} strokeWidth={2.5}
                  dot={{fill:D.purple,r:5}} name="C* (TOPSIS score)"/>
              </LineChart>
            </ResponsiveContainer>
            <p style={{fontSize:12,color:D.t3,margin:"6px 0 0"}}>
              Khi tăng w₁ → ưu tiên GDP → C* của nghiệm Max GDP tăng → nghiệm thỏa hiệp dịch về phía Max GDP
            </p>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze} geminiContext={geminiContexts.c2}/>
        </div>
      )}

      {/* ══ TAB 3: CHI PHÍ ĐÁNH ĐỔI ═════════════════════════════════ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.coral,fontSize:14}}>
                Đánh đổi: Thỏa hiệp ↔ Max GDP
              </h3>
              {[
                {label:"GDP gain",   tc:best.gdp,   mg:maxSol.gdp,  color:D.blue,  unit:"tỷ",  good:true},
                {label:"Gini MAD",   tc:best.gini,  mg:maxSol.gini, color:D.coral, unit:"",    good:false},
                {label:"Emission",   tc:best.emit,  mg:maxSol.emit, color:D.green, unit:"CO₂", good:false},
                {label:"Sec. Risk",  tc:best.sec,   mg:maxSol.sec,  color:D.amber, unit:"",    good:false},
              ].map(({label,tc,mg,color,unit,good})=>{
                const delta=mg-tc, pct=((delta/tc)*100).toFixed(1);
                const worse=good?(mg<tc):(mg>tc);
                return(
                  <div key={label} style={{marginBottom:14,padding:"10px 14px",
                    background:`${color}0a`,border:`1px solid ${color}33`,borderRadius:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:600,color}}>{label}</span>
                      <span style={{fontSize:12,color:worse?D.coral:D.green,fontWeight:700}}>
                        {worse?"↑ ":"↓ "}{Math.abs(pct)}% {worse?"xấu hơn":"tốt hơn"}
                      </span>
                    </div>
                    <div style={{display:"flex",gap:16,justifyContent:"space-between"}}>
                      <div style={{textAlign:"center"}}>
                        <p style={{fontSize:10,color:D.t3,margin:"0 0 2px"}}>★ Thỏa hiệp</p>
                        <p style={{fontSize:15,fontWeight:700,color:D.amber,margin:0,fontFamily:"monospace"}}>
                          {(tc/1000).toFixed(1)}K
                        </p>
                      </div>
                      <div style={{display:"flex",alignItems:"center",color:D.t3,fontSize:18}}>→</div>
                      <div style={{textAlign:"center"}}>
                        <p style={{fontSize:10,color:D.t3,margin:"0 0 2px"}}>Max GDP</p>
                        <p style={{fontSize:15,fontWeight:700,color:D.coral,margin:0,fontFamily:"monospace"}}>
                          {(mg/1000).toFixed(1)}K
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card>
              <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:14}}>So sánh 4 chỉ tiêu</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[
                    {name:"GDP/K",  TC:best.gdp/1000,   MG:maxSol.gdp/1000},
                    {name:"Gini",   TC:best.gini,        MG:maxSol.gini},
                    {name:"Emit",   TC:best.emit,        MG:maxSol.emit},
                    {name:"SecRisk",TC:best.sec,         MG:maxSol.sec},
                  ]}
                  margin={{top:5,right:10,bottom:5,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis dataKey="name" tick={{fill:D.t2,fontSize:11}}/>
                  <YAxis tick={{fill:D.t2,fontSize:10}}/>
                  <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
                  <Legend wrapperStyle={{color:D.t2,fontSize:11}}/>
                  <Bar dataKey="TC" name="★ Thỏa hiệp" fill={D.amber+"bb"} radius={[4,4,0,0]}/>
                  <Bar dataKey="MG" name="Max GDP"     fill={D.coral+"bb"} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{marginTop:10,padding:"8px 12px",background:D.amberBg,
                borderLeft:`3px solid ${D.amber}`,borderRadius:6,fontSize:12,color:D.t2}}>
                Chú ý: Gini, Emit, SecRisk đơn vị khác nhau — so sánh tương đối trong cột.
                Max GDP đạt GDP cao hơn {((maxSol.gdp-best.gdp)/1000).toFixed(1)}K tỷ nhưng Gini tăng ×{(maxSol.gini/best.gini).toFixed(1)}, Emission tăng ×{(maxSol.emit/best.emit).toFixed(1)}.
              </div>
            </Card>
          </div>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze} geminiContext={geminiContexts.c3}/>
        </div>
      )}

      {/* ══ TAB 4: PHÂN BỔ TỐI ƯU ═══════════════════════════════════ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>
                Phân bổ nghiệm thỏa hiệp (idx={best.idx}) theo vùng
              </h3>
              {ALLOC_DEFAULT.map((row,i)=>{
                const tot=row.I+row.D+row.AI+row.H;
                return(
                  <div key={row.r} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,color:RCOLORS[i],fontWeight:600}}>{RNAMES[i]}</span>
                      <span style={{fontSize:11,color:D.t3}}>{(tot/1000).toFixed(1)}K tỷ</span>
                    </div>
                    <div style={{display:"flex",height:12,borderRadius:4,overflow:"hidden",background:D.bg1}}>
                      {[row.I,row.D,row.AI,row.H].map((v,ji)=>{
                        const w=v/tot*100;
                        return w>0?<div key={ji} style={{width:`${w}%`,background:ICOLORS[ji],
                          transition:"width .4s"}} title={`${INAMES[ji]}: ${v.toLocaleString()}`}/>:null;
                      })}
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
                      {[row.I,row.D,row.AI,row.H].map((v,ji)=>v>0?(
                        <span key={ji} style={{fontSize:9,color:ICOLORS[ji]}}>
                          {INAMES[ji].split(" ")[0]}:{v.toLocaleString()}
                        </span>
                      ):null)}
                    </div>
                  </div>
                );
              })}
              <div style={{marginTop:8,display:"flex",gap:8,flexWrap:"wrap"}}>
                {INAMES.map((n,i)=>(
                  <div key={n} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:D.t2}}>
                    <div style={{width:10,height:10,borderRadius:2,background:ICOLORS[i]}}/>
                    {n}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>Cơ cấu hạng mục (%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={INAMES.map((n,ji)=>{
                    const total=ALLOC_DEFAULT.reduce((s,r)=>s+[r.I,r.D,r.AI,r.H][ji],0);
                    return {name:n, NSGA2:+(total/50000*100).toFixed(1), "LP đơn":[6,28,42,24][ji]};
                  })}
                  margin={{top:5,right:10,bottom:5,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis dataKey="name" tick={{fill:D.t2,fontSize:10}}/>
                  <YAxis tick={{fill:D.t2,fontSize:10}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
                  <Legend wrapperStyle={{color:D.t2,fontSize:11}}/>
                  <Bar dataKey="NSGA2" name="NSGA-II TC" fill={D.amber+"bb"} radius={[4,4,0,0]}/>
                  <Bar dataKey="LP đơn" name="LP đơn mục tiêu" fill={D.blue+"66"} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{marginTop:10,padding:"8px 12px",background:D.purpleBg,
                borderLeft:`3px solid ${D.purple}`,borderRadius:6,fontSize:12,color:D.t2}}>
                NSGA-II ưu tiên H (Nhân lực) hơn LP đơn mục tiêu — vì H vừa giảm emission gián tiếp,
                vừa tăng an ninh số (σᵣ·xH).
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 12px",color:D.cyan,fontSize:14}}>Bảng phân bổ 6×4 chi tiết (tỷ VND)</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    <th style={{padding:"7px 10px",textAlign:"left",color:D.t3}}>Vùng</th>
                    {INAMES.map((n,i)=>(
                      <th key={n} style={{padding:"7px 10px",textAlign:"right",color:ICOLORS[i]}}>{n}</th>
                    ))}
                    <th style={{padding:"7px 10px",textAlign:"right",color:D.t3}}>Tổng</th>
                    <th style={{padding:"7px 10px",textAlign:"right",color:D.amber}}>H(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {ALLOC_DEFAULT.map((row,i)=>{
                    const tot=row.I+row.D+row.AI+row.H;
                    return(
                      <tr key={row.r} style={{borderBottom:`1px solid ${D.border}22`,background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 10px",fontWeight:600,color:RCOLORS[i]}}>{RNAMES[i]}</td>
                        {[row.I,row.D,row.AI,row.H].map((v,ji)=>(
                          <td key={ji} style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",
                            color:v>0?ICOLORS[ji]:D.t3}}>{v.toLocaleString()}</td>
                        ))}
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",color:D.t2}}>
                          {tot.toLocaleString()}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:D.amber,fontWeight:600}}>
                          {(row.H/tot*100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze} geminiContext={geminiContexts.c4}/>
        </div>
      )}

      {/* ══ TAB 5: THẢO LUẬN ════════════════════════════════════════ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[
            {
              q:"a) Đánh đổi tăng trưởng ↔ bao trùm có rõ ràng không? Nói lên điều gì về cơ cấu kinh tế VN?",
              color:D.coral,
              a:`Đánh đổi rất rõ ràng với trọng số hiện tại (w₁=${(wn[0]*100).toFixed(0)}%): GDP tăng ${((maxSol.gdp-best.gdp)/1000).toFixed(1)}K tỷ (+${((maxSol.gdp-best.gdp)/best.gdp*100).toFixed(1)}%) kéo theo Gini tăng ×${(maxSol.gini/best.gini).toFixed(1)} lần.

Cứ mỗi 1% tăng GDP, bất bình đẳng tăng ~${((maxSol.gini/best.gini-1)/(maxSol.gdp/best.gdp-1)).toFixed(1)} lần tương ứng. Đây là dấu hiệu tăng trưởng "dẫn dắt bởi vùng lõi" — vốn tập trung vào ĐNB và ĐBSH (β_AI cao nhất) tạo GDP lớn nhưng khoét sâu khoảng cách vùng miền.

Thử kéo slider w₂ (Gini) lên cao → nghiệm thỏa hiệp sẽ dịch sang nghiệm có Gini thấp hơn, chấp nhận GDP thấp hơn.`
            },
            {
              q:`b) Trọng số (${wn.map(w=>(w*100).toFixed(0)+"%").join(",")}) có phản ánh đúng ưu tiên Đại hội XIII? Điều chỉnh cho COP26?`,
              color:D.green,
              a:`Trọng số hiện tại w₁=${(wn[0]*100).toFixed(0)}% (GDP) khá phù hợp với Văn kiện Đại hội XIII: "GDP tăng 6.5-7%/năm, thu nhập trung bình cao vào 2030".

Để phù hợp cam kết COP26 (Net-zero 2050): bấm preset "COP26" — tăng w₃ (Emission) lên 30%, giảm w₁ xuống 30%. Với bộ trọng số này nghiệm thỏa hiệp dịch về phía Emission thấp hơn.

Để phù hợp QĐ 127/QĐ-TTg (AI ASEAN): bấm preset "An ninh" — tăng w₄ (Security) lên 30%. Thực tế VN 2025: ưu tiên số 1 vẫn là tăng trưởng kinh tế, môi trường và an ninh số là ưu tiên thứ yếu.`
            },
            {
              q:"c) NSGA-II khác LP đơn mục tiêu thế nào? Có thay thế được quyết định chính trị không?",
              color:D.purple,
              a:`NSGA-II và LP đơn mục tiêu khác nhau về bản chất:
• LP: 1 nghiệm tối ưu duy nhất, hàm mục tiêu cố định trước
• NSGA-II: toàn bộ tập Pareto — không gian các lựa chọn không bị trội — để nhà hoạch định chính sách lựa chọn theo giá trị

Ưu điểm NSGA-II:
(1) Không cần xác định trọng số TRƯỚC khi chạy — chỉ cần sau khi có Pareto front
(2) Hiển thị rõ chi phí đánh đổi định lượng
(3) Phù hợp quyết định đa bên (multi-stakeholder)

NSGA-II KHÔNG thay thế quyết định chính trị:
(1) Chọn nghiệm nào trong Pareto front = quyết định giá trị, không phải kỹ thuật
(2) Trọng số TOPSIS bản thân đã là quyết định chính trị
(3) Mô hình không nắm bắt ràng buộc thể chế, áp lực dư luận

→ Vai trò đúng đắn: công cụ hỗ trợ, cung cấp thông tin định lượng cho thảo luận chính sách.`
            },
          ].map((item,i)=>(
            <Card key={i}>
              <div style={{padding:"8px 12px",background:`${item.color}10`,
                borderLeft:`3px solid ${item.color}`,borderRadius:6,marginBottom:10}}>
                <p style={{fontSize:13,fontWeight:600,color:item.color,margin:0}}>{item.q}</p>
              </div>
              <p style={{fontSize:13,color:D.t2,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{item.a}</p>
            </Card>
          ))}

          <Card style={{border:`1px solid ${D.blue}33`}}>
            <h3 style={{margin:"0 0 12px",color:D.blue,fontSize:14}}>NSGA-II — Thuật toán tiến hóa đa mục tiêu</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[
                {step:"Khởi tạo",    desc:"Pop=100 nghiệm ngẫu nhiên trong [0,12000]²⁴",                            color:D.blue},
                {step:"Đánh giá",    desc:"Tính (f1,f2,f3,f4) mỗi cá thể + kiểm tra 14 ràng buộc",                  color:D.teal},
                {step:"Non-dom Sort",desc:"Xếp hạng front: front₁>front₂... Crowding distance tránh tập trung cụm", color:D.amber},
                {step:"200 thế hệ",  desc:"SBX crossover (η=15) + PM mutation (η=20) → Pareto front hội tụ",        color:D.purple},
              ].map((s,i)=>(
                <div key={i} style={{padding:10,background:`${s.color}0e`,border:`1px solid ${s.color}33`,borderRadius:8}}>
                  <p style={{fontSize:11,fontWeight:700,color:s.color,margin:"0 0 4px"}}>{s.step}</p>
                  <p style={{fontSize:11,color:D.t2,margin:0,lineHeight:1.5}}>{s.desc}</p>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,fontFamily:"monospace",fontSize:11,lineHeight:2,
              background:D.bg3,borderRadius:8,padding:"10px 14px",color:D.t2}}>
              <p style={{margin:0}}>Kết quả: {N} nghiệm Pareto-optimal | GDP∈[{Math.round(Math.min(...GDP)/1000)}K, {Math.round(Math.max(...GDP)/1000)}K] tỷ</p>
              <p style={{margin:0}}>Thỏa hiệp TOPSIS (w hiện tại):
                <span style={{color:D.amber}}> GDP={(best.gdp/1000).toFixed(1)}K | Gini={best.gini.toFixed(0)} | Emit={best.emit.toFixed(0)} | C*={best.cstar}</span>
              </p>
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze} geminiContext={geminiContexts.c5}/>
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.t3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 7 — AIDEOM-VN | pymoo NSGA-II (pop=100, gen=200, seed=42) | Dữ liệu: Bài 4 beta matrix
      </div>
    </div>
  );
}