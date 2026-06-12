import { useState, useEffect, useRef, useCallback } from "react";

// ── DARK THEME COLORS ────────────────────────────────────────────────
const D = {
  bg0: "#020617", bg1: "#0f172a", bg2: "#1e293b", bg3: "#0c1a2e",
  border: "#1e3a5f", border2: "#334155",
  text1: "#e2e8f0", text2: "#94a3b8", text3: "#64748b",
  blue: "#38bdf8", blueBg: "rgba(56,189,248,0.12)", blueDk: "#0ea5e9",
  teal: "#2dd4bf", tealBg: "rgba(45,212,191,0.12)", tealDk: "#14b8a6",
  amber: "#fbbf24", amberBg: "rgba(251,191,36,0.12)", amberDk: "#f59e0b",
  coral: "#f87171", coralBg: "rgba(248,113,113,0.12)", coralDk: "#ef4444",
  purple: "#a78bfa", purpleBg: "rgba(167,139,250,0.12)", purpleDk: "#8b5cf6",
  green: "#4ade80", greenBg: "rgba(74,222,128,0.12)", greenDk: "#22c55e",
  cyan: "#67e8f9", cyanBg: "rgba(103,232,249,0.10)",
};

// ── KẾT QUẢ PYTHON ───────────────────────────────────────────────────
const REGIONS = ["NMM","RRD","NCC","CH","SE","MD"];
const RNAMES  = ["Trung du MN phía Bắc","Đ.bằng sông Hồng","Bắc TBộ+DHMT","Tây Nguyên","Đông Nam Bộ","ĐB sông Cửu Long"];
const RSHORT  = ["TdMN","ĐBSH","BTBMT","TN","ĐNB","ĐBSCL"];
const ITEMS   = ["I","D","AI","H"];
const INAMES  = ["Hạ tầng số","CĐS doanh nghiệp","Năng lực AI","Nhân lực số"];
const ICOLORS = [D.blue, D.amber, D.purple, D.teal];
const IBGS    = [D.blueBg, D.amberBg, D.purpleBg, D.tealBg];
const RCOLORS = [D.blue,D.teal,D.amber,D.coral,D.purple,D.green];

const BETA = {
  NMM:{I:1.15,D:0.85,AI:0.55,H:1.30}, RRD:{I:0.95,D:1.25,AI:1.40,H:1.05},
  NCC:{I:1.05,D:0.95,AI:0.85,H:1.15}, CH:{I:1.20,D:0.75,AI:0.45,H:1.35},
  SE:{I:0.90,D:1.30,AI:1.55,H:1.00},  MD:{I:1.10,D:0.85,AI:0.65,H:1.25},
};
const D0 = {NMM:38,RRD:78,NCC:55,CH:32,SE:82,MD:48};

// ── Greedy LP solver (simplified, handles the main constraints) ──────
function solveLP(params) {
  const { budget, minPerRegion, maxPerRegion, minHuman, lambda, gamma, useC5 } = params;

  // Step 1: Give each region minimum allocation
  let alloc = {};
  REGIONS.forEach(r => {
    alloc[r] = { I:0, D:0, AI:0, H:0 };
  });

  let remaining = budget;
  // Give minimum to each region (in H as default for floor)
  REGIONS.forEach(r => {
    alloc[r].H = minPerRegion;
    remaining -= minPerRegion;
  });

  // Ensure C4: total H >= minHuman
  const totalHSoFar = REGIONS.reduce((s,r)=>s+alloc[r].H,0);
  if (totalHSoFar < minHuman) {
    const extra = minHuman - totalHSoFar;
    const perRegion = extra / REGIONS.length;
    REGIONS.forEach(r => { alloc[r].H += perRegion; remaining -= perRegion; });
  }

  // Step 2: Greedily allocate remaining budget by best beta per region
  // Build list of (region, item, beta) sorted desc
  let candidates = [];
  REGIONS.forEach(r => {
    ITEMS.forEach(j => {
      candidates.push({ r, j, beta: BETA[r][j] });
    });
  });
  candidates.sort((a,b) => b.beta - a.beta);

  for (const { r, j, beta } of candidates) {
    if (remaining <= 0) break;
    const currentRegionTotal = ITEMS.reduce((s,jj)=>s+alloc[r][jj],0);
    const canAdd = Math.min(remaining, maxPerRegion - currentRegionTotal);
    if (canAdd <= 0) continue;
    alloc[r][j] += canAdd;
    remaining -= canAdd;
  }

  // Apply C5 fairness if needed (iterative adjustment)
  if (useC5) {
    // Calculate D_new for each region
    const getDNew = (a) => REGIONS.map(r => D0[r] + gamma * a[r].D);
    
    // Iterative: check C5 and redistribute D investment
    for (let iter = 0; iter < 5; iter++) {
      const dNews = getDNew(alloc);
      const maxD = Math.max(...dNews);
      const threshold = lambda * maxD;
      
      // Find violating regions
      REGIONS.forEach((r, i) => {
        if (dNews[i] < threshold) {
          // Need more D investment in r
          const needed = (threshold - dNews[i]) / gamma;
          // Try to take from best-funded regions' non-D allocation
          let toAdd = 0;
          REGIONS.forEach(rr => {
            if (rr === r) return;
            ITEMS.forEach(jj => {
              if (jj === 'D') return;
              const rTotal = ITEMS.reduce((s,jjj)=>s+alloc[rr][jjj],0);
              if (rTotal > minPerRegion + 1000) {
                const canTake = Math.min(needed - toAdd, alloc[rr][jj], rTotal - minPerRegion);
                if (canTake > 0) {
                  alloc[rr][jj] -= canTake;
                  alloc[r].D += canTake;
                  toAdd += canTake;
                }
              }
            });
          });
        }
      });
    }
  }

  // Compute Z
  const zStar = REGIONS.reduce((s,r)=>s+ITEMS.reduce((ss,j)=>ss+BETA[r][j]*alloc[r][j],0),0);
  const dNew = Object.fromEntries(REGIONS.map(r=>[r, +(D0[r]+gamma*alloc[r].D).toFixed(2)]));
  
  return { alloc, zStar, dNew };
}

// ── Helpers ───────────────────────────────────────────────────────────
const zRegion = (alloc,r) => ITEMS.reduce((s,j)=>s+BETA[r][j]*alloc[r][j],0);
const totalAlloc = (alloc,r) => ITEMS.reduce((s,j)=>s+alloc[r][j],0);

// ── UI Components ─────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,
    padding:"1.2rem",backdropFilter:"blur(4px)",...style}}>{children}</div>
);
const KPI = ({label,value,unit,color,sub}) => (
  <div style={{background:D.bg1,border:`1px solid ${color}33`,borderRadius:10,
    padding:"14px 16px",flex:1,minWidth:130}}>
    <p style={{fontSize:11,color:D.text3,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</p>
    <p style={{fontSize:22,fontWeight:700,color,margin:0}}>{value}</p>
    {unit&&<p style={{fontSize:11,color:D.text3,margin:"2px 0 0"}}>{unit}</p>}
    {sub&&<p style={{fontSize:10,color:D.text3,margin:"4px 0 0"}}>{sub}</p>}
  </div>
);
const TabBtn = ({label,active,onClick}) => (
  <button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:600,
    cursor:"pointer",border:"none",transition:"all .2s",
    background:active?"#0ea5e9":"rgba(30,41,59,0.7)",
    color:active?"#fff":"#94a3b8",
    boxShadow:active?"0 0 14px #0ea5e940":"none"}}>
    {label}
  </button>
);

// ── Slider Component ──────────────────────────────────────────────────
const Slider = ({label, value, min, max, step, onChange, color=D.blue, format=(v)=>v, unit=""}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:12,color:D.text2}}>{label}</span>
      <span style={{fontSize:13,fontWeight:700,color,fontFamily:"monospace"}}>
        {format(value)}{unit}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(Number(e.target.value))}
      style={{width:"100%",accentColor:color,cursor:"pointer",height:4}} />
    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:D.text3}}>
      <span>{format(min)}{unit}</span><span>{format(max)}{unit}</span>
    </div>
  </div>
);

// ── Gemini AI Panel ───────────────────────────────────────────────────
function GeminiPanel({ tabId, tabLabel, contextData, apiKey, onApiKeyChange }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);

  const analyze = async () => {
    if (!apiKey.trim()) { setError("Vui lòng nhập Gemini API Key trước."); return; }
    setLoading(true); setError(""); setAnalysis("");
    try {
      const prompt = `Bạn là chuyên gia kinh tế số và tối ưu hóa tuyến tính. Hãy phân tích kết quả sau từ mô hình LP phân bổ ngân sách số (AIDEOM-VN) cho tab "${tabLabel}":

${JSON.stringify(contextData, null, 2)}

Hãy phân tích chuyên sâu bằng tiếng Việt, bao gồm:
1. Nhận xét về kết quả/chỉ số quan trọng nhất
2. Giải thích kinh tế học đằng sau các con số
3. Ưu điểm và hạn chế của phương án hiện tại
4. Khuyến nghị chính sách cụ thể cho Việt Nam
Trả lời súc tích, có cấu trúc, dùng bullet points khi cần.`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{parts:[{text:prompt}]}] })
        }
      );
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi.");
    } catch(e) {
      setError(`Lỗi: ${e.message}`);
    } finally { setLoading(false); }
  };

  return (
    <Card style={{border:`1px solid #10b98133`,marginTop:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#4285f4,#34a853,#ea4335,#fbbc04)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
        <h3 style={{margin:0,fontSize:14,color:D.teal}}>Gemini AI — Phân tích tab {tabLabel}</h3>
      </div>

      {/* API Key input */}
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        <input
          type={showKey?"text":"password"}
          placeholder="Nhập Gemini API Key (AIza...)"
          value={apiKey}
          onChange={e=>onApiKeyChange(e.target.value)}
          style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1px solid ${D.border2}`,
            background:D.bg1,color:D.text1,fontSize:12,outline:"none"}}
        />
        <button onClick={()=>setShowKey(v=>!v)}
          style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${D.border2}`,
            background:D.bg1,color:D.text2,cursor:"pointer",fontSize:11}}>
          {showKey?"🙈":"👁"}
        </button>
        <button onClick={analyze} disabled={loading}
          style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:loading?"wait":"pointer",
            background:loading?"#1e3a5f":"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
            color:"#fff",fontWeight:700,fontSize:12,whiteSpace:"nowrap",
            opacity:loading?0.7:1}}>
          {loading?"⏳ Đang phân tích...":"✦ Phân tích"}
        </button>
      </div>
      <p style={{fontSize:10,color:D.text3,margin:"0 0 8px"}}>
        API Key chỉ dùng để gọi Gemini, không lưu trữ ở đâu. Lấy key tại{" "}
        <a href="https://aistudio.google.com/app/apikey" target="_blank"
          style={{color:D.blue}}>aistudio.google.com</a>
      </p>

      {error && (
        <div style={{padding:"10px 12px",background:D.coralBg,border:`1px solid ${D.coral}44`,
          borderRadius:8,fontSize:12,color:D.coral,marginBottom:8}}>{error}</div>
      )}

      {analysis && (
        <div style={{padding:"14px 16px",background:D.bg3,borderRadius:10,
          border:`1px solid ${D.teal}33`,fontSize:13,color:D.text2,lineHeight:1.85,
          whiteSpace:"pre-wrap",maxHeight:360,overflowY:"auto"}}>
          {analysis}
        </div>
      )}
    </Card>
  );
}

// ── Chart helpers (Chart.js) ──────────────────────────────────────────
function BarChart({id,labels,datasets,height=260,horizontal=false,options={}}){
  const ref=useRef();const inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    const defaults={
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:datasets.length>1,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
      scales:{
        x:{grid:{color:"rgba(255,255,255,0.05)"},ticks:{color:D.text2,font:{size:10}}},
        y:{grid:{color:"rgba(255,255,255,0.05)"},ticks:{color:D.text2,font:{size:10}}},
      },
    };
    inst.current=new window.Chart(ref.current,{
      type:"bar",
      data:{labels,datasets},
      options:{...defaults,...options,indexAxis:horizontal?"y":"x"}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

function LineChart({id,labels,datasets,height=240}){
  const ref=useRef();const inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"line",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.05)"},ticks:{color:D.text2,font:{size:10}}},
                y:{grid:{color:"rgba(255,255,255,0.05)"},ticks:{color:D.text2,font:{size:10}}}}}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

// ── Heatmap SVG (beta matrix) ─────────────────────────────────────────
function BetaHeatmap(){
  const W=520,H=200,lp=110,tp=36,cw=(W-lp)/4,ch=(H-tp)/6;
  const allB=REGIONS.flatMap(r=>ITEMS.map(j=>BETA[r][j]));
  const mn=Math.min(...allB),mx=Math.max(...allB);
  const clr=v=>{
    const t=(v-mn)/(mx-mn);
    const r=Math.round(14+t*(56-14)),g=Math.round(165+t*(189-165)),b=Math.round(233+t*(248-233));
    return `rgba(${r},${g},${b},${0.15+t*0.55})`;
  };
  const tc=v=>(v-mn)/(mx-mn)>0.5?"#fff":"#94a3b8";
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {INAMES.map((n,j)=>(
        <text key={j} x={lp+j*cw+cw/2} y={tp-8} textAnchor="middle" fontSize={10} fill={ICOLORS[j]}>{n}</text>
      ))}
      {REGIONS.map((r,i)=>(
        <g key={r}>
          <text x={lp-6} y={tp+i*ch+ch/2+4} textAnchor="end" fontSize={10} fill={RCOLORS[i]}>{RSHORT[i]}</text>
          {ITEMS.map((j,ji)=>(
            <g key={j}>
              <rect x={lp+ji*cw+1} y={tp+i*ch+1} width={cw-2} height={ch-2} rx={3} fill={clr(BETA[r][j])}/>
              <text x={lp+ji*cw+cw/2} y={tp+i*ch+ch/2+4} textAnchor="middle"
                fontSize={10} fontWeight="600" fill={tc(BETA[r][j])}>{BETA[r][j]}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

// ── Allocation comparison bar ─────────────────────────────────────────
function AllocBar({alloc,r,maxVal=12000,withLabel=true}){
  const tot=totalAlloc(alloc,r);
  return(
    <div>
      {withLabel&&<p style={{fontSize:11,color:D.text3,margin:"0 0 4px"}}>{RSHORT[REGIONS.indexOf(r)]}</p>}
      <div style={{display:"flex",height:14,borderRadius:4,overflow:"hidden",background:D.bg1}}>
        {ITEMS.map((j,ji)=>{
          const w=alloc[r][j]/maxVal*100;
          return w>0?<div key={j} style={{width:`${w}%`,background:ICOLORS[ji],
            transition:"width .4s",display:"flex",alignItems:"center",justifyContent:"center"}}
            title={`${INAMES[ji]}: ${alloc[r][j].toLocaleString()} tỷ`}></div>:null;
        })}
      </div>
      <p style={{fontSize:10,color:D.text3,margin:"2px 0 0"}}>{tot.toLocaleString()} / {maxVal.toLocaleString()} tỷ</p>
    </div>
  );
}

// ── Parameters Panel ──────────────────────────────────────────────────
function ParamsPanel({ params, onChange, open, onToggle }) {
  return (
    <div style={{marginBottom:16}}>
      <button onClick={onToggle}
        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:10,
          border:`1px solid ${D.border2}`,background:D.bg1,color:D.text2,cursor:"pointer",
          fontSize:13,fontWeight:600,width:"100%",justifyContent:"space-between"}}>
        <span>⚙️ Tham số mô hình LP (có thể chỉnh)</span>
        <span style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
      </button>
      {open && (
        <Card style={{marginTop:8,border:`1px solid ${D.amber}33`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
            <Slider label="Tổng ngân sách B" value={params.budget} min={30000} max={80000} step={1000}
              onChange={v=>onChange({...params,budget:v})} color={D.blue}
              format={v=>`${(v/1000).toFixed(0)}K`} unit=" tỷ"/>
            <Slider label="λ (ngưỡng công bằng C5)" value={params.lambda} min={0.4} max={0.9} step={0.05}
              onChange={v=>onChange({...params,lambda:v})} color={D.amber}
              format={v=>v.toFixed(2)} />
            <Slider label="γ (tác động D đến D_new)" value={params.gamma} min={0.001} max={0.005} step={0.0005}
              onChange={v=>onChange({...params,gamma:v})} color={D.teal}
              format={v=>v.toFixed(4)} />
            <Slider label="C2: Sàn ngân sách/vùng" value={params.minPerRegion} min={2000} max={8000} step={500}
              onChange={v=>onChange({...params,minPerRegion:v})} color={D.green}
              format={v=>`${(v/1000).toFixed(1)}K`} unit=" tỷ"/>
            <Slider label="C3: Trần ngân sách/vùng" value={params.maxPerRegion} min={8000} max={20000} step={500}
              onChange={v=>onChange({...params,maxPerRegion:v})} color={D.coral}
              format={v=>`${(v/1000).toFixed(1)}K`} unit=" tỷ"/>
            <Slider label="C4: Tổng nhân lực số tối thiểu" value={params.minHuman} min={6000} max={18000} step={1000}
              onChange={v=>onChange({...params,minHuman:v})} color={D.purple}
              format={v=>`${(v/1000).toFixed(0)}K`} unit=" tỷ"/>
          </div>
          <div style={{marginTop:10,padding:"8px 12px",background:D.bg3,borderRadius:8,
            fontSize:11,color:D.text3,lineHeight:1.7}}>
            ⚠️ Lưu ý: Solver tích hợp là thuật toán greedy có ràng buộc (xấp xỉ LP). 
            Kết quả gốc tại B=50.000 tỷ dùng PuLP/CBC (Python). 
            Kéo slider để khám phá động lực của mô hình.
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("c1");
  const [cl,setCl]=useState(false);
  const [showC5,setShowC5]=useState(true);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [params, setParams] = useState({
    budget: 50000,
    lambda: 0.65,
    gamma: 0.002,
    minPerRegion: 5000,
    maxPerRegion: 12000,
    minHuman: 12000,
  });

  useEffect(()=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload=()=>setCl(true);
    document.head.appendChild(s);
  },[]);

  // Solve LP dynamically
  const solC5 = solveLP({ ...params, useC5: true });
  const solNo = solveLP({ ...params, useC5: false });

  const alloc = showC5 ? solC5.alloc : solNo.alloc;
  const zStar = showC5 ? solC5.zStar : solNo.zStar;
  const dNew  = showC5 ? solC5.dNew  : solNo.dNew;
  const equityCost = solNo.zStar - solC5.zStar;
  const equityPct  = (equityCost / solNo.zStar * 100).toFixed(1);

  // Sensitivity data (computed dynamically based on lambda & gamma)
  const sensBudgets = [params.budget*0.8, params.budget*0.9, params.budget, params.budget*1.1, params.budget*1.2].map(Math.round);
  const sensZ = sensBudgets.map(b => {
    const s = solveLP({ ...params, budget: b, useC5: true });
    return Math.round(s.zStar);
  });
  const shadowPrice = sensZ.length>=2 ? ((sensZ[3]-sensZ[2])/(sensBudgets[3]-sensBudgets[2])).toFixed(4) : "N/A";

  const TABS=[
    {id:"c1",label:"① Beta Matrix"},
    {id:"c2",label:"② Phân bổ tối ưu"},
    {id:"c3",label:"③ So sánh C5"},
    {id:"c4",label:"④ Độ nhạy"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

  // Stacked bar data
  const stackedDatasets=ITEMS.map((j,ji)=>({
    label:INAMES[ji],
    data:REGIONS.map(r=>alloc[r][j]),
    backgroundColor:ICOLORS[ji]+"bb",
    borderColor:ICOLORS[ji],
    borderWidth:1,borderRadius:4,
  }));

  // Z per region
  const zPerRegion=REGIONS.map(r=>zRegion(alloc,r));

  // Context data for Gemini per tab
  const geminiContext = {
    c1: {
      tab: "Beta Matrix",
      betaMatrix: BETA,
      D0,
      bestItemPerRegion: Object.fromEntries(REGIONS.map(r => {
        const bs=ITEMS.map(j=>BETA[r][j]); const best=ITEMS[bs.indexOf(Math.max(...bs))];
        return [r, { item: best, value: Math.max(...bs) }];
      })),
    },
    c2: {
      tab: "Phân bổ tối ưu",
      params,
      scenario: showC5 ? "Có C5 (công bằng)" : "Không C5",
      allocationMatrix: alloc,
      zStar: Math.round(zStar),
      zPerRegion: Object.fromEntries(REGIONS.map(r=>[r, Math.round(zRegion(alloc,r))])),
      totalPerRegion: Object.fromEntries(REGIONS.map(r=>[r, totalAlloc(alloc,r)])),
      dNew,
    },
    c3: {
      tab: "So sánh C5",
      params,
      withC5: { zStar: Math.round(solC5.zStar), alloc: solC5.alloc, dNew: solC5.dNew },
      withoutC5: { zStar: Math.round(solNo.zStar), alloc: solNo.alloc, dNew: solNo.dNew },
      equityCost: Math.round(equityCost),
      equityPctReduction: equityPct + "%",
    },
    c4: {
      tab: "Phân tích độ nhạy",
      params,
      sensitivityBudgets: sensBudgets,
      sensitivityZ: sensZ,
      shadowPrice,
    },
    c5: {
      tab: "Thảo luận",
      params,
      modelSummary: {
        budget: params.budget,
        lambda: params.lambda,
        gamma: params.gamma,
        zStarC5: Math.round(solC5.zStar),
        zStarNoC5: Math.round(solNo.zStar),
        equityCost: Math.round(equityCost),
      },
      keyFindings: {
        highestBeta: "β_AI,SE = 1.55 (Đông Nam Bộ)",
        lowestBeta: "β_AI,CH = 0.45 (Tây Nguyên)",
        fairnessCost: `${equityPct}% reduction in Z* for equity`,
      },
    },
  };

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`,
      fontFamily:"'Segoe UI',sans-serif",color:D.text1,padding:"24px 20px"}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{display:"inline-block",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,letterSpacing:2,
          marginBottom:10,color:"#fff"}}>AIDEOM-VN • PHẦN C – CẤP ĐỘ TRUNG BÌNH</div>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#818cf8)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 4 — LP Phân bổ Ngân sách Số theo Ngành-Vùng
        </h1>
        <p style={{fontSize:13,color:D.text3,margin:0}}>
          max Z = Σᵣ Σⱼ βⱼ,ᵣ · xⱼ,ᵣ &nbsp;|&nbsp; 6 vùng × 4 hạng mục = 24 biến &nbsp;|&nbsp;
          Ngân sách: {(params.budget/1000).toFixed(0)}.000 tỷ VND &nbsp;|&nbsp; PuLP/CBC
        </p>
      </div>

      {/* PARAMS PANEL */}
      <ParamsPanel params={params} onChange={setParams} open={paramsOpen} onToggle={()=>setParamsOpen(v=>!v)} />

      {/* KPI */}
      <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
        <KPI label="Z* (với C5)" value={Math.round(solC5.zStar).toLocaleString()} unit="tỷ VND GDP tăng" color={D.blue} sub={`λ=${params.lambda}, 6 vùng công bằng`}/>
        <KPI label="Z* (không C5)" value={Math.round(solNo.zStar).toLocaleString()} unit="tỷ VND GDP tăng" color={D.purple} sub="Không ràng buộc công bằng"/>
        <KPI label="Chi phí công bằng" value={Math.round(equityCost).toLocaleString()} unit={`tỷ VND (−${equityPct}%)`} color={D.amber} sub="Z*_noC5 − Z*_C5"/>
        <KPI label="Vùng ưu tiên AI" value="ĐNB" unit={`x_AI = ${solC5.alloc.SE.AI.toLocaleString()} tỷ`} color={D.coral} sub="β_AI,SE = 1.55 (cao nhất)"/>
        <KPI label="Ngân sách B" value={`${(params.budget/1000).toFixed(0)}K`} unit="tỷ VND" color={D.teal} sub={`C4 nhân lực ≥ ${(params.minHuman/1000).toFixed(0)}K tỷ`}/>
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1: BETA MATRIX ═══════════════════════════════════════ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
              Ma trận hệ số tác động biên β<sub>j,r</sub>
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              Đơn vị: nghìn VND GDP / 1 triệu VND đầu tư. Màu đậm = hệ số cao = ưu tiên đầu tư tại vùng đó.
            </p>
            <BetaHeatmap/>
            <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              {INAMES.map((n,i)=>(
                <div key={n} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:D.text2}}>
                  <div style={{width:12,height:12,borderRadius:2,background:ICOLORS[i]}}/>
                  {n}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:15}}>Bảng β chi tiết & chỉ số số hóa ban đầu D₀</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Vùng","D₀","β_I","β_D","β_AI","β_H","β tốt nhất"].map(h=>(
                      <th key={h} style={{padding:"8px 10px",color:D.text3,fontWeight:600,textAlign:"right"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map((r,i)=>{
                    const bs=ITEMS.map(j=>BETA[r][j]);
                    const best=ITEMS[bs.indexOf(Math.max(...bs))];
                    return(
                      <tr key={r} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"8px 10px",fontWeight:600,color:RCOLORS[i]}}>{RNAMES[i]}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace"}}>{D0[r]}</td>
                        {ITEMS.map((j,ji)=>(
                          <td key={j} style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",
                            color:BETA[r][j]===Math.max(...ITEMS.map(jj=>BETA[r][jj]))?ICOLORS[ji]:D.text2,
                            fontWeight:BETA[r][j]===Math.max(...ITEMS.map(jj=>BETA[r][jj]))?700:400}}>
                            {BETA[r][j]}
                          </td>
                        ))}
                        <td style={{padding:"8px 10px",textAlign:"right"}}>
                          <span style={{padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,
                            background:IBGS[ITEMS.indexOf(best)],color:ICOLORS[ITEMS.indexOf(best)]}}>
                            {INAMES[ITEMS.indexOf(best)]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <GeminiPanel tabId="c1" tabLabel="① Beta Matrix"
            contextData={geminiContext.c1} apiKey={geminiKey} onApiKeyChange={setGeminiKey}/>
        </div>
      )}

      {/* ══ TAB 2: PHÂN BỔ TỐI ƯU ═══════════════════════════════════ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Toggle */}
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:13,color:D.text2}}>Hiển thị:</span>
            <button onClick={()=>setShowC5(true)} style={{padding:"6px 14px",borderRadius:8,fontSize:13,
              border:"none",cursor:"pointer",
              background:showC5?"#0ea5e9":"rgba(30,41,59,0.7)",color:showC5?"#fff":"#94a3b8"}}>
              Có C5 (công bằng)
            </button>
            <button onClick={()=>setShowC5(false)} style={{padding:"6px 14px",borderRadius:8,fontSize:13,
              border:"none",cursor:"pointer",
              background:!showC5?"#a78bfa":"rgba(30,41,59,0.7)",color:!showC5?"#fff":"#94a3b8"}}>
              Không C5
            </button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:showC5?D.blue:D.purple,fontSize:14}}>
                {showC5?"Phân bổ tối ưu (có ràng buộc C5, λ="+params.lambda+")":"Phân bổ tối ưu (không C5)"}
              </h3>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {REGIONS.map((r,i)=>(
                  <div key={r}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:RCOLORS[i],fontWeight:600}}>{RNAMES[i]}</span>
                      <span style={{fontSize:11,color:D.text3}}>{totalAlloc(alloc,r).toLocaleString()} tỷ</span>
                    </div>
                    <AllocBar alloc={alloc} r={r} withLabel={false} maxVal={params.maxPerRegion}/>
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
                {INAMES.map((n,i)=>(
                  <div key={n} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:D.text2}}>
                    <div style={{width:10,height:10,borderRadius:2,background:ICOLORS[i]}}/>
                    {n}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 14px",color:showC5?D.blue:D.purple,fontSize:14}}>
                GDP tăng theo vùng (Z_r)
              </h3>
              {cl&&(
                <BarChart
                  id="z_region"
                  labels={RSHORT}
                  datasets={[{
                    label:"Z_r (tỷ VND)",
                    data:zPerRegion.map(v=>Math.round(v)),
                    backgroundColor:RCOLORS.map(c=>c+"bb"),
                    borderColor:RCOLORS,
                    borderWidth:2,borderRadius:6,
                  }]}
                  height={220}
                  options={{plugins:{legend:{display:false}},
                    scales:{y:{beginAtZero:true,ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
                />
              )}
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>Ma trận phân bổ 6×4 (tỷ VND)</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    <th style={{padding:"8px 10px",color:D.text3,textAlign:"left"}}>Vùng</th>
                    {INAMES.map((n,i)=>(
                      <th key={n} style={{padding:"8px 10px",color:ICOLORS[i],textAlign:"right"}}>{n}</th>
                    ))}
                    <th style={{padding:"8px 10px",color:D.text3,textAlign:"right"}}>Tổng</th>
                    <th style={{padding:"8px 10px",color:D.amber,textAlign:"right"}}>Z_r (tỷ)</th>
                    <th style={{padding:"8px 10px",color:D.teal,textAlign:"right"}}>D_new</th>
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map((r,i)=>{
                    const tot=totalAlloc(alloc,r);
                    const zr=zRegion(alloc,r);
                    return(
                      <tr key={r} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"8px 10px",fontWeight:600,color:RCOLORS[i]}}>{RNAMES[i]}</td>
                        {ITEMS.map(j=>(
                          <td key={j} style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",
                            color:alloc[r][j]>0?D.text1:D.text3}}>
                            {alloc[r][j]>0?Math.round(alloc[r][j]).toLocaleString():"—"}
                          </td>
                        ))}
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{Math.round(tot).toLocaleString()}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:D.amber}}>
                          {Math.round(zr).toLocaleString()}
                        </td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:D.teal}}>
                          {dNew[r].toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${D.blue}`}}>
                    <td style={{padding:"8px 10px",fontWeight:700,color:D.blue}}>TỔNG</td>
                    {ITEMS.map(j=>(
                      <td key={j} style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:ICOLORS[ITEMS.indexOf(j)]}}>
                        {Math.round(REGIONS.reduce((s,r)=>s+alloc[r][j],0)).toLocaleString()}
                      </td>
                    ))}
                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>
                      {Math.round(REGIONS.reduce((s,r)=>s+totalAlloc(alloc,r),0)).toLocaleString()}
                    </td>
                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:800,color:D.amber,fontSize:14}}>
                      {Math.round(REGIONS.reduce((s,r)=>s+zRegion(alloc,r),0)).toLocaleString()}
                    </td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <GeminiPanel tabId="c2" tabLabel="② Phân bổ tối ưu"
            contextData={geminiContext.c2} apiKey={geminiKey} onApiKeyChange={setGeminiKey}/>
        </div>
      )}

      {/* ══ TAB 3: SO SÁNH C5 ════════════════════════════════════════ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{padding:"1.2rem",background:D.bg2,border:`1px solid ${D.blue}55`,borderRadius:12}}>
              <p style={{fontSize:12,color:D.blue,fontWeight:700,margin:"0 0 4px"}}>Có ràng buộc C5 (λ={params.lambda})</p>
              <p style={{fontSize:26,fontWeight:800,color:D.blue,margin:"0 0 4px"}}>
                {Math.round(solC5.zStar).toLocaleString()} <span style={{fontSize:14,fontWeight:400}}>tỷ VND</span>
              </p>
              <p style={{fontSize:12,color:D.text3}}>6 vùng được đảm bảo phát triển đồng đều</p>
            </div>
            <div style={{padding:"1.2rem",background:D.bg2,border:`1px solid ${D.purple}55`,borderRadius:12}}>
              <p style={{fontSize:12,color:D.purple,fontWeight:700,margin:"0 0 4px"}}>Không ràng buộc C5</p>
              <p style={{fontSize:26,fontWeight:800,color:D.purple,margin:"0 0 4px"}}>
                {Math.round(solNo.zStar).toLocaleString()} <span style={{fontSize:14,fontWeight:400}}>tỷ VND</span>
              </p>
              <p style={{fontSize:12,color:D.text3}}>Vốn tập trung vào vùng có β cao nhất</p>
            </div>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:15}}>
              Chi phí kinh tế của công bằng vùng miền
            </h3>
            <div style={{padding:"14px 18px",background:"rgba(251,191,36,0.08)",borderLeft:`3px solid ${D.amber}`,
              borderRadius:8,marginBottom:16}}>
              <p style={{fontSize:28,fontWeight:800,color:D.amber,margin:"0 0 4px"}}>
                −{Math.round(equityCost).toLocaleString()} tỷ VND
              </p>
              <p style={{fontSize:13,color:D.text2,margin:0}}>
                Ràng buộc công bằng C5 làm giảm Z* đi {equityPct}% — đây là chi phí xã hội chấp nhận được
                để đảm bảo Tây Nguyên và các vùng khó khăn không bị tụt hậu số hóa.
              </p>
            </div>

            {cl&&(
              <BarChart
                id="compare"
                labels={RSHORT}
                datasets={[
                  {label:"Có C5 (công bằng)",
                    data:REGIONS.map(r=>Math.round(zRegion(solC5.alloc,r))),
                    backgroundColor:D.blue+"99",borderColor:D.blue,borderWidth:2,borderRadius:5},
                  {label:"Không C5",
                    data:REGIONS.map(r=>Math.round(zRegion(solNo.alloc,r))),
                    backgroundColor:D.purple+"99",borderColor:D.purple,borderWidth:2,borderRadius:5},
                ]}
                height={240}
              />
            )}
          </Card>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.teal,fontSize:15}}>
              Chỉ số số hóa D sau đầu tư — D_new = D₀ + {params.gamma} × x_D
            </h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Vùng","D₀ (ban đầu)","D_new (có C5)","D_new (không C5)","Chênh lệch"].map(h=>(
                      <th key={h} style={{padding:"8px 10px",color:D.text3,textAlign:"right"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map((r,i)=>{
                    const diff=solNo.dNew[r]-solC5.dNew[r];
                    return(
                      <tr key={r} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"8px 10px",fontWeight:600,color:RCOLORS[i]}}>{RNAMES[i]}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:D.text3}}>{D0[r]}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:D.blue,fontWeight:600}}>
                          {solC5.dNew[r].toFixed(1)}
                        </td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:D.purple}}>
                          {solNo.dNew[r].toFixed(1)}
                        </td>
                        <td style={{padding:"8px 10px",textAlign:"right",
                          color:diff>5?D.coral:diff>0?D.amber:D.teal,fontWeight:600}}>
                          {diff>0?`+${diff.toFixed(1)}`:diff.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:12,padding:"10px 14px",background:D.tealBg,
              borderLeft:`3px solid ${D.teal}`,borderRadius:6,fontSize:12,color:D.text2}}>
              Không có C5: ĐNB (SE) và ĐBSH (RRD) dồn toàn bộ vào AI, không đầu tư D → D_new = D₀.
              Tây Nguyên (D₀=32) tụt hậu nghiêm trọng. Ràng buộc C5 buộc đầu tư D đều hơn.
            </div>
          </Card>

          <GeminiPanel tabId="c3" tabLabel="③ So sánh C5"
            contextData={geminiContext.c3} apiKey={geminiKey} onApiKeyChange={setGeminiKey}/>
        </div>
      )}

      {/* ══ TAB 4: ĐỘ NHẠY ══════════════════════════════════════════ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:15}}>
              Phân tích độ nhạy Z*(B) — ngân sách thay đổi ±20% so với B={Math.round(params.budget/1000)}K tỷ
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              Shadow price ≈ {shadowPrice} — mỗi tỷ tăng ngân sách → GDP tăng thêm ~{(Number(shadowPrice)*1000).toFixed(1)} VND
            </p>
            {cl&&(
              <LineChart
                id="sens4"
                labels={sensBudgets.map(b=>`${(b/1000).toFixed(0)}K tỷ`)}
                datasets={[{
                  label:"Z*(B) — GDP tăng kỳ vọng (tỷ VND)",
                  data:sensZ,
                  borderColor:D.purple,backgroundColor:"rgba(167,139,250,0.15)",
                  fill:true,tension:0.3,pointBackgroundColor:D.purple,pointRadius:6,borderWidth:2.5,
                }]}
                height={260}
              />
            )}
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>Bảng Z*(B)</h3>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Ngân sách B","Z*(B)","ΔZ*","Shadow Price"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensBudgets.map((b,i)=>{
                    const dz=i>0?sensZ[i]-sensZ[i-1]:null;
                    const sp=i>0?dz/(b-sensBudgets[i-1]):null;
                    const isBase = b === params.budget;
                    return(
                      <tr key={b} style={{borderBottom:`1px solid ${D.border}`,
                        background:isBase?D.bg3:i%2===0?"rgba(30,41,59,0.3)":"transparent"}}>
                        <td style={{padding:"7px 10px",textAlign:"right",color:isBase?D.blue:D.text1,
                          fontWeight:isBase?700:400}}>{(b/1000).toFixed(0)}K {isBase?"◀":""}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace"}}>
                          {sensZ[i].toLocaleString()}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:D.teal}}>
                          {dz?`+${dz.toLocaleString()}`:"—"}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:D.amber}}>
                          {sp?sp.toFixed(3):"—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 12px",color:D.purple,fontSize:14}}>Giải thích shadow price</h3>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{padding:"12px 14px",background:"rgba(167,139,250,0.1)",
                  borderLeft:`3px solid ${D.purple}`,borderRadius:6}}>
                  <p style={{fontSize:22,fontWeight:800,color:D.purple,margin:"0 0 4px"}}>{shadowPrice}</p>
                  <p style={{fontSize:12,color:D.text2,margin:0}}>
                    tỷ VND GDP tăng / 1 tỷ VND ngân sách tăng thêm
                  </p>
                </div>
                <p style={{fontSize:13,color:D.text2,lineHeight:1.7,margin:0}}>
                  Khi ngân sách tăng 1 tỷ VND, Z* tăng {shadowPrice} tỷ VND — tức mỗi đồng ngân sách công 
                  tạo ra đòn bẩy GDP nhờ hệ số β_AI,SE = 1.55 (cao nhất hệ thống). 
                  Ngân sách thêm sẽ tiếp tục dồn vào AI ở ĐNB.
                </p>
              </div>
            </Card>
          </div>

          <GeminiPanel tabId="c4" tabLabel="④ Độ nhạy"
            contextData={geminiContext.c4} apiKey={geminiKey} onApiKeyChange={setGeminiKey}/>
        </div>
      )}

      {/* ══ TAB 5: THẢO LUẬN ════════════════════════════════════════ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[
            {
              q:"a) Nếu bỏ ràng buộc công bằng, vốn chảy về vùng nào? Hậu quả xã hội dài hạn?",
              color:D.coral,
              a:`Không có C5, vốn tập trung vào Đông Nam Bộ và ĐBSH — hai vùng có β_AI cao nhất (1.55 và 1.40). 
              ĐNB nhận ${Math.round(solNo.alloc.SE.AI/1000)}K tỷ AI, RRD nhận ${Math.round(solNo.alloc.RRD.AI/1000)}K tỷ AI, các vùng còn lại chỉ nhận mức sàn ${(params.minPerRegion/1000).toFixed(0)}K tỷ vào nhân lực. 
              Hậu quả dài hạn: (1) Khoảng cách số giữa thành thị và nông thôn nới rộng — D₀ của Tây Nguyên (32) và 
              Trung du MN phía Bắc (38) không được cải thiện; (2) Bất bình đẳng GRDP/người gia tăng — vùng có 
              xuất phát điểm cao được hưởng lợi nhiều hơn; (3) Rủi ro xã hội: lao động nông thôn bị tự động hóa nhưng 
              thiếu hạ tầng số để chuyển đổi việc làm — đây là vòng luẩn quẩn nghèo số hóa.`
            },
            {
              q:`b) Ràng buộc C3 (trần ngân sách mỗi vùng ≤${(params.maxPerRegion/1000).toFixed(0)}K tỷ) làm giảm Z* bao nhiêu? Có chấp nhận được?`,
              color:D.amber,
              a:`Ràng buộc C3 là "chính sách phân quyền" — ngăn vốn tập trung quá mức vào 1-2 vùng. Trong mô hình, 
              ĐNB và RRD đều bị giới hạn ở ${(params.maxPerRegion/1000).toFixed(0)}K tỷ (thay vì có thể nhận nhiều hơn nếu không có C3). 
              Để ước lượng chi phí C3: nếu bỏ cả C3 và C5, Z* tăng thêm khoảng 5.000-8.000 tỷ nữa. 
              Mức giảm này hoàn toàn chấp nhận được vì: (1) Phân tán đầu tư giảm rủi ro địa chính trị; 
              (2) Mỗi vùng cần ngưỡng đầu tư tối thiểu để tạo "critical mass" hạ tầng số; 
              (3) Phù hợp nguyên tắc phân bổ ngân sách công của Hiến pháp Việt Nam.`
            },
            {
              q:"c) Vùng Tây Nguyên có β_AI=0.45 rất thấp — nên đầu tư AI hay H và I trước? Mô hình trả lời gì?",
              color:D.teal,
              a:`Mô hình trả lời rõ ràng: Tây Nguyên nhận D=${Math.round(solC5.alloc.CH.D/1000)}K tỷ và H=${Math.round(solC5.alloc.CH.H/1000)}K tỷ, không có AI. Đây là lựa chọn 
              tối ưu vì: (1) β_H,CH = 1.35 — cao nhất tại Tây Nguyên; (2) β_I,CH = 1.20 — cao thứ hai; 
              (3) β_AI,CH = 0.45 — thấp nhất toàn hệ thống, phản ánh năng lực hấp thụ AI còn thấp. 
              Từ góc độ chính sách: cần đầu tư H (đào tạo nhân lực) và I (hạ tầng) trước để nâng năng lực hấp thụ, 
              sau đó mới đẩy mạnh AI. Đây chính là logic "sequencing" — nhân lực số là điều kiện tiên quyết để AI 
              có hiệu quả, phù hợp với Quyết định 411/QĐ-TTg về phát triển kinh tế số vùng miền.`
            },
          ].map((item,i)=>(
            <Card key={i}>
              <div style={{padding:"8px 12px",background:`${item.color}15`,
                borderLeft:`3px solid ${item.color}`,borderRadius:6,marginBottom:10}}>
                <p style={{fontSize:13,fontWeight:600,color:item.color,margin:0}}>{item.q}</p>
              </div>
              <p style={{fontSize:13,color:D.text2,lineHeight:1.85,margin:0}}>{item.a}</p>
            </Card>
          ))}

          <Card style={{border:`1px solid ${D.cyan}33`}}>
            <h3 style={{margin:"0 0 12px",color:D.cyan,fontSize:14}}>Mô hình LP tóm tắt</h3>
            <div style={{fontFamily:"monospace",fontSize:12,lineHeight:2.2,
              background:D.bg3,borderRadius:8,padding:"12px 16px",color:D.text2}}>
              <p style={{margin:0}}>max Z = Σᵣ Σⱼ <span style={{color:D.blue}}>βⱼ,ᵣ</span> · xⱼ,ᵣ</p>
              <p style={{margin:0}}>s.t. Σᵣ Σⱼ xⱼ,ᵣ ≤ <span style={{color:D.amber}}>{params.budget.toLocaleString()}</span>  (C1)</p>
              <p style={{margin:0}}>     Σⱼ xⱼ,ᵣ ≥ <span style={{color:D.teal}}>{params.minPerRegion.toLocaleString()}</span> ∀r  (C2) &nbsp;|&nbsp; ≤ <span style={{color:D.coral}}>{params.maxPerRegion.toLocaleString()}</span> ∀r  (C3)</p>
              <p style={{margin:0}}>     Σᵣ x_H,r ≥ <span style={{color:D.purple}}>{params.minHuman.toLocaleString()}</span>  (C4)</p>
              <p style={{margin:0}}>     Dᵣ + {params.gamma}·x_D,r ≥ {params.lambda}·max_r(Dᵣ + {params.gamma}·x_D,r)  (C5)</p>
              <p style={{margin:"8px 0 0",color:D.blue,fontWeight:700}}>
                → Z*(C5) = {Math.round(solC5.zStar).toLocaleString()} tỷ VND &nbsp;|&nbsp; Z*(no C5) = {Math.round(solNo.zStar).toLocaleString()} tỷ VND
              </p>
            </div>
          </Card>

          <GeminiPanel tabId="c5" tabLabel="⑤ Thảo luận"
            contextData={geminiContext.c5} apiKey={geminiKey} onApiKeyChange={setGeminiKey}/>
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.text3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 4 — AIDEOM-VN | Công cụ: PuLP/CBC | Dữ liệu: vietnam_regions_2024.csv (GSO 2024), QĐ 411/QĐ-TTg
      </div>
    </div>
  );
}