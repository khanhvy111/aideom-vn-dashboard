import { useState, useEffect, useRef, useCallback } from "react";

// ── DARK THEME ────────────────────────────────────────────────────────
const D = {
  bg0:"#020617",bg1:"#0f172a",bg2:"#1e293b",bg3:"#0c1a2e",
  border:"#1e3a5f",border2:"#334155",
  text1:"#e2e8f0",text2:"#94a3b8",text3:"#64748b",
  blue:"#38bdf8",   blueBg:"rgba(56,189,248,0.12)",
  teal:"#2dd4bf",   tealBg:"rgba(45,212,191,0.12)",
  amber:"#fbbf24",  amberBg:"rgba(251,191,36,0.12)",
  coral:"#f87171",  coralBg:"rgba(248,113,113,0.12)",
  purple:"#a78bfa", purpleBg:"rgba(167,139,250,0.12)",
  green:"#4ade80",  greenBg:"rgba(74,222,128,0.12)",
  cyan:"#67e8f9",
};

// ── DEFAULT PARAMS ─────────────────────────────────────────────────────
const DEFAULT_PARAMS = {
  alpha:  0.33,  // K share
  gamma:  0.10,  // D share
  delta:  0.08,  // AI share
  theta:  0.07,  // H share
  tfp:    1.00,  // TFP multiplier
  budget: 65000, // tổng ngân sách (tỷ)
  w_ai:   0.20,  // weight AI readiness
  w_dig:  0.15,  // weight Digital
  w_fdi:  0.10,  // weight FDI
  w_cyber: 0.35, // penalty cyber risk
  w_incl:  0.30, // reward inclusion
  w_job:   0.20, // reward netjob
  w_gini:  0.15, // penalty gini
};

// ── YEARS ──────────────────────────────────────────────────────────────
const YEARS_HIST = [2020,2021,2022,2023,2024,2025];
const GDP_HIST   = [8044.4,8487.5,9513.3,10221.8,11511.9,12847.6];
const YEARS_PROJ = [2026,2027,2028,2029,2030];
const GDP_2026   = 13307.8;

// ── BASE SCENARIO DATA ─────────────────────────────────────────────────
const BASE_SCENARIOS = {
  S1:{name:"S1 · Truyền thống",  short:"S1",color:D.blue,  colorBg:D.blueBg,
      sK:0.70,sD:0.10,sAI:0.10,sH:0.10,
      desc:"Tập trung vốn vật chất, FDI, hạ tầng truyền thống, xuất khẩu",
      baseY:[14356,15516,16764,18075,19644],baseD:22.8,baseAI:101,baseH:30.7,
      base:{gini:0.370,unemp:4.7,cyber:0.15,emit_idx:0.72,depend:0.20,inclusion:0.55,netjob:650000,cagr:8.10}},
  S2:{name:"S2 · Số hóa nhanh",  short:"S2",color:D.teal,  colorBg:D.tealBg,
      sK:0.25,sD:0.45,sAI:0.15,sH:0.15,
      desc:"Tăng đầu tư chính phủ số, doanh nghiệp số, thanh toán số",
      baseY:[14474,15741,17106,18583,20232],baseD:31.6,baseAI:108,baseH:31.1,
      base:{gini:0.370,unemp:4.3,cyber:0.28,emit_idx:0.55,depend:0.32,inclusion:0.65,netjob:950000,cagr:8.74}},
  S3:{name:"S3 · AI dẫn dắt",    short:"S3",color:D.purple,colorBg:D.purpleBg,
      sK:0.20,sD:0.20,sAI:0.45,sH:0.15,
      desc:"Ưu tiên AI, dữ liệu lớn, bán dẫn, trung tâm dữ liệu",
      baseY:[14629,16079,17650,19062,20701],baseD:25.3,baseAI:154,baseH:31.1,
      base:{gini:0.376,unemp:5.0,cyber:0.52,emit_idx:0.45,depend:0.48,inclusion:0.45,netjob:720000,cagr:9.24}},
  S4:{name:"S4 · Bao trùm số",   short:"S4",color:D.amber, colorBg:D.amberBg,
      sK:0.30,sD:0.20,sAI:0.10,sH:0.40,
      desc:"Ưu tiên vùng yếu, SME, giáo dục số, nông nghiệp số",
      baseY:[14233,15360,16547,17870,19463],baseD:25.3,baseAI:101,baseH:33.0,
      base:{gini:0.364,unemp:3.8,cyber:0.12,emit_idx:0.60,depend:0.15,inclusion:0.85,netjob:1380000,cagr:7.90}},
  S5:{name:"S5 · Tối ưu cân bằng",short:"S5",color:D.green,colorBg:D.greenBg,
      sK:0.22,sD:0.13,sAI:0.09,sH:0.10,
      desc:"Kết quả mô hình AIDEOM-VN tổng hợp (SLSQP + multi-objective)",
      baseY:[14473,15750,17101,18620,20325],baseD:23.5,baseAI:100,baseH:30.7,
      base:{gini:0.370,unemp:4.2,cyber:0.22,emit_idx:0.58,depend:0.22,inclusion:0.72,netjob:1050000,cagr:8.84}},
};
const SC_IDS = ["S1","S2","S3","S4","S5"];

// ── STATIC DATA (TOPSIS, LP, Sectors) ─────────────────────────────────
const REGIONS      = ["TDMNPB","ĐBSH","BTB+DHMT","TN","ĐNB","ĐBSCL"];
const REGION_NAMES = ["Trung du MN phía Bắc","Đồng bằng sông Hồng",
  "Bắc Trung Bộ+DHMT","Tây Nguyên","Đông Nam Bộ","ĐB sông Cửu Long"];
const RCOLORS      = [D.blue,D.teal,D.amber,D.coral,D.purple,D.green];
const REGION_RAW   = [[57.0,3.5,38,22],[152.3,20.0,78,68],[87.5,8.2,55,40],
  [68.9,0.8,32,18],[158.9,18.5,82,75],[80.5,2.1,48,30]];

const LP_BASE_ALLOC = {
  NMM:{I:0,D:8150,AI:0,H:5000},RRD:{I:0,D:0,AI:10000,H:0},
  NCC:{I:0,D:0,AI:0,H:5000},   CH:{I:0,D:10000,AI:0,H:5000},
  SE:{I:0,D:0,AI:15000,H:0},   MD:{I:0,D:1850,AI:0,H:5000},
};
const LP_BETAS = {
  NMM:{I:1.15,D:0.85,AI:0.55,H:1.30},RRD:{I:0.95,D:1.25,AI:1.40,H:1.05},
  NCC:{I:1.05,D:0.95,AI:0.85,H:1.15},CH:{I:1.20,D:0.75,AI:0.45,H:1.35},
  SE:{I:0.90,D:1.30,AI:1.55,H:1.00}, MD:{I:1.10,D:0.85,AI:0.65,H:1.25},
};
const LP_REGION_KEYS = ["NMM","RRD","NCC","CH","SE","MD"];

const SECTORS  = ["Nông-Lâm","CN CB-CT","Xây dựng","Bán buôn","Tài chính","Logistics","CNTT","Giáo dục"];
const L_SEC    = [13.20,11.50,4.80,7.80,0.55,1.95,0.62,2.15];
const RISK_SEC = [0.18,0.42,0.25,0.38,0.52,0.35,0.28,0.22];
const SCOLORS  = [D.green,D.blue,D.amber,D.coral,D.purple,D.teal,D.cyan,"#fb923c"];

// ── SIMULATION ENGINE ─────────────────────────────────────────────────
function simulate(p) {
  const tfpScale = p.tfp * (1 + (p.gamma - DEFAULT_PARAMS.gamma)*0.5 + (p.delta - DEFAULT_PARAMS.delta)*0.3);
  const alphaScale = p.alpha / DEFAULT_PARAMS.alpha;
  const scenarios = {};
  SC_IDS.forEach(id => {
    const b = BASE_SCENARIOS[id];
    const gdpScale = tfpScale * (0.8 + alphaScale * 0.2);
    const Y = b.baseY.map(v => Math.round(v * gdpScale));
    const cagr = +((Math.pow(Y[4]/GDP_2026,1/4)-1)*100).toFixed(2);
    const cyberPenalty = (p.w_cyber - DEFAULT_PARAMS.w_cyber) * b.base.cyber * 2;
    const inclReward   = (p.w_incl  - DEFAULT_PARAMS.w_incl)  * b.base.inclusion;
    const jobReward    = (p.w_job   - DEFAULT_PARAMS.w_job)    * (b.base.netjob/1500000);
    const giniPenalty  = (p.w_gini  - DEFAULT_PARAMS.w_gini)  * b.base.gini;
    const base_score = 0.30*(cagr/10) + 0.20*(b.base.inclusion) +
      0.20*(1-b.base.cyber) + 0.15*(b.base.netjob/1500000) + 0.15*(1-b.base.gini);
    const score = Math.min(1, Math.max(0,
      base_score + inclReward*0.3 + jobReward*0.2 - cyberPenalty*0.3 - giniPenalty*0.2
    ));
    scenarios[id] = {
      ...b, Y, cagr, score: +score.toFixed(3),
      D: Array(5).fill(+(b.baseD * (1 + (p.gamma-DEFAULT_PARAMS.gamma)*2)).toFixed(1)),
      AI: Array(5).fill(Math.round(b.baseAI * (1 + (p.delta-DEFAULT_PARAMS.delta)*3))),
      H: Array(5).fill(+(b.baseH).toFixed(1)),
    };
  });
  const aiBoost = (p.w_ai - DEFAULT_PARAMS.w_ai) * 5;
  const digBoost = (p.w_dig - DEFAULT_PARAMS.w_dig) * 3;
  const rawScores = [
    0.0993 + digBoost*0.1,
    0.8981 + aiBoost*0.03,
    0.3597 + digBoost*0.06,
    0.0312 - aiBoost*0.02,
    0.9402 + aiBoost*0.02,
    0.1710 + digBoost*0.04,
  ].map(v => Math.max(0.01, Math.min(0.99, v)));
  const ranked = rawScores.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  const topsisScores = rawScores;
  const topsisRanks  = rawScores.map((_,i)=>ranked.findIndex(r=>r.i===i)+1);
  const budgetScale = p.budget / DEFAULT_PARAMS.budget;
  const lpAlloc = {};
  LP_REGION_KEYS.forEach(r => {
    lpAlloc[r] = {};
    ["I","D","AI","H"].forEach(j => {
      lpAlloc[r][j] = Math.round(LP_BASE_ALLOC[r][j] * budgetScale);
    });
  });
  const lpZ = Math.round(LP_REGION_KEYS.reduce((tot, r) =>
    tot + ["I","D","AI","H"].reduce((s,j) => s + LP_BETAS[r][j]*lpAlloc[r][j], 0), 0));
  const best = SC_IDS.reduce((b,id) => scenarios[id].score > scenarios[b].score ? id : b, "S1");
  return { scenarios, topsisScores, topsisRanks, lpAlloc, lpZ, best };
}

// ── Helpers ───────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,
    padding:"1.2rem",...style}}>{children}</div>
);
const KPI = ({label,value,unit,color,sub}) => (
  <div style={{background:D.bg1,border:`1px solid ${color}33`,borderRadius:10,
    padding:"12px 15px",flex:1,minWidth:120}}>
    <p style={{fontSize:10,color:D.text3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
    <p style={{fontSize:19,fontWeight:700,color,margin:0}}>{value}</p>
    {unit&&<p style={{fontSize:10,color:D.text3,margin:"2px 0 0"}}>{unit}</p>}
    {sub&&<p style={{fontSize:9,color:D.text3,margin:"3px 0 0"}}>{sub}</p>}
  </div>
);
const TabBtn = ({label,active,onClick,color}) => (
  <button onClick={onClick} style={{padding:"7px 13px",borderRadius:8,fontSize:12,fontWeight:600,
    cursor:"pointer",border:"none",transition:"all .2s",
    background:active?(color||"#0ea5e9"):"rgba(30,41,59,0.7)",
    color:active?"#fff":D.text2,boxShadow:active?`0 0 14px ${color||"#0ea5e9"}40`:"none"}}>
    {label}
  </button>
);
const ScBadge = ({id,active,onClick,scenarios}) => {
  const sc = scenarios[id];
  return (
    <button onClick={()=>onClick(id)} style={{padding:"5px 12px",borderRadius:7,fontSize:12,
      fontWeight:600,cursor:"pointer",border:`1px solid ${sc.color}${active?"":"44"}`,
      background:active?sc.color:`${sc.color}11`,color:active?"#000":sc.color,transition:"all .2s"}}>
      {sc.short}
    </button>
  );
};

// ── Slider ────────────────────────────────────────────────────────────
function Slider({label,param,value,min,max,step,onChange,color=D.blue,format}) {
  const pct = ((value-min)/(max-min))*100;
  const fmt = format ? format(value) : value.toFixed(2);
  return (
    <div style={{marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:11,color:D.text2}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color,fontFamily:"monospace"}}>{fmt}</span>
      </div>
      <div style={{position:"relative",height:6,background:D.bg3,borderRadius:3}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,
          background:`linear-gradient(90deg,${color}77,${color})`,borderRadius:3}}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e=>onChange(param,parseFloat(e.target.value))}
          style={{position:"absolute",inset:0,width:"100%",opacity:0,cursor:"pointer",height:"100%"}}/>
      </div>
    </div>
  );
}

// ── Parameter Panel ───────────────────────────────────────────────────
function ParamPanel({params,onChange,onReset,collapsed,setCollapsed}) {
  const groups = [
    {
      label:"🏭 Cobb-Douglas (M1)", color:D.blue,
      items:[
        {label:"α — Share vốn K",  param:"alpha", min:0.15,max:0.55,step:0.01,format:v=>v.toFixed(2)},
        {label:"γ — Share Digital D",param:"gamma",min:0.04,max:0.20,step:0.01,format:v=>v.toFixed(2)},
        {label:"δ — Share AI",     param:"delta", min:0.02,max:0.18,step:0.01,format:v=>v.toFixed(2)},
        {label:"θ — Share H",      param:"theta", min:0.02,max:0.18,step:0.01,format:v=>v.toFixed(2)},
        {label:"TFP multiplier",   param:"tfp",   min:0.80,max:1.40,step:0.05,format:v=>`×${v.toFixed(2)}`},
      ]
    },
    {
      label:"📊 TOPSIS & LP (M2-M3)", color:D.teal,
      items:[
        {label:"w_AI — Trọng số AI readiness",param:"w_ai", min:0.05,max:0.40,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_Digital — Trọng số số hóa", param:"w_dig",min:0.05,max:0.30,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_FDI — Trọng số FDI",        param:"w_fdi",min:0.05,max:0.25,step:0.05,format:v=>v.toFixed(2)},
        {label:"Ngân sách LP (tỷ VND)",        param:"budget",min:40000,max:120000,step:5000,
         format:v=>`${(v/1000).toFixed(0)}K`},
      ]
    },
    {
      label:"⚖️ Composite Score (M5-M6)", color:D.coral,
      items:[
        {label:"w_Cyber — Phạt rủi ro AI", param:"w_cyber",min:0.10,max:0.60,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_Inclusion — Bao trùm",   param:"w_incl", min:0.10,max:0.60,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_NetJob — Việc làm ròng", param:"w_job",  min:0.05,max:0.40,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_Gini — Phạt bất bình đẳng",param:"w_gini",min:0.05,max:0.40,step:0.05,format:v=>v.toFixed(2)},
      ]
    },
  ];
  return (
    <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:14,marginBottom:18,overflow:"hidden"}}>
      <div onClick={()=>setCollapsed(!collapsed)}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"12px 18px",cursor:"pointer",
          background:"linear-gradient(90deg,rgba(14,165,233,0.1),rgba(139,92,246,0.1),rgba(34,197,94,0.08))"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎛️</span>
          <span style={{fontSize:14,fontWeight:700,color:D.blue}}>Bảng điều chỉnh tham số</span>
          <span style={{fontSize:11,color:D.text3,background:D.bg2,padding:"2px 8px",borderRadius:10}}>Live simulation · 6 Module</span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();onReset();}}
            style={{fontSize:11,padding:"4px 12px",borderRadius:6,border:`1px solid ${D.border}`,
              background:D.bg2,color:D.text2,cursor:"pointer"}}>↺ Reset</button>
          <span style={{color:D.text3,fontSize:16}}>{collapsed?"▼":"▲"}</span>
        </div>
      </div>
      {!collapsed&&(
        <div style={{padding:"16px 18px",display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"16px 28px"}}>
          {groups.map(g=>(
            <div key={g.label}>
              <p style={{fontSize:11,fontWeight:700,color:g.color,
                textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 10px"}}>{g.label}</p>
              {g.items.map(item=>(
                <Slider key={item.param} {...item} value={params[item.param]}
                  color={g.color} onChange={onChange}/>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gemini AI Block (with API Key input) ─────────────────────────────────
function GeminiBlock({context,tabLabel}) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [result,setResult]=useState("");
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false);

  const analyze = async () => {
    if (!apiKey.trim()) {
      setResult("⚠️ Vui lòng nhập Gemini API Key trước khi phân tích.");
      return;
    }
    setLoading(true); setResult("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            contents:[{parts:[{
              text:`Bạn là chuyên gia kinh tế Việt Nam, chuyên về mô hình hóa kinh tế số và chính sách phát triển. Hãy phân tích chi tiết kết quả bên dưới bằng tiếng Việt: nêu nhận xét kinh tế, ý nghĩa chính sách và khuyến nghị cụ thể cho Việt Nam 2026-2030. Đây là module: ${tabLabel} trong hệ thống AIDEOM-VN.\n\nDữ liệu:\n${context}`
            }]}]
          }),
        }
      );
      const data = await res.json();
      if (data.error) {
        setResult(`❌ Lỗi API: ${data.error.message}`);
      } else {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        setResult(text || "Không có kết quả từ Gemini.");
      }
    } catch(err) {
      setResult("❌ Lỗi kết nối Gemini: "+err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{marginTop:14,background:"#0d1526",border:"1px solid #1e3a6e",borderRadius:12,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"10px 16px",
        background:"linear-gradient(90deg,rgba(66,133,244,0.15),rgba(15,157,88,0.10))"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🤖</span>
          <span style={{color:"#fff",fontWeight:700,fontSize:13}}>Gemini AI — {tabLabel}</span>
          <span style={{background:"#4285f4",color:"#fff",fontSize:10,padding:"2px 8px",borderRadius:99}}>Gemini 2.0 Flash</span>
        </div>
        <button onClick={()=>setOpen(!open)}
          style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1px solid #1e3a6e",
            background:"transparent",color:D.text2,cursor:"pointer"}}>
          {open?"Thu gọn ▲":"Mở rộng ▼"}
        </button>
      </div>
      {(open||result)&&(
        <div style={{padding:"14px 16px"}}>
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
            <div style={{flex:1,position:"relative"}}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e=>setApiKey(e.target.value)}
                placeholder="Dán Gemini API Key vào đây (AIza...)"
                style={{width:"100%",padding:"8px 40px 8px 12px",borderRadius:8,
                  background:"#1e293b",border:`1px solid ${apiKey?"#4285f4":"#1e3a5f"}`,
                  color:D.text1,fontSize:12,fontFamily:"monospace",boxSizing:"border-box"}}
              />
              <button onClick={()=>setShowKey(!showKey)}
                style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",color:D.text3,cursor:"pointer",fontSize:14}}>
                {showKey?"🙈":"👁"}
              </button>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
              style={{fontSize:11,color:"#4285f4",textDecoration:"none",whiteSpace:"nowrap"}}>
              Lấy API Key →
            </a>
          </div>
          <button onClick={analyze} disabled={loading}
            style={{background:loading?"#374151":"linear-gradient(135deg,#4285f4,#0f9d58)",
              color:"#fff",border:"none",borderRadius:8,padding:"9px 22px",
              fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer",marginBottom:result?14:0}}>
            {loading?"⏳ Đang phân tích...":"✨ Phân tích với Gemini AI"}
          </button>
          {result&&(
            <div style={{background:"#07090f",borderRadius:8,padding:14,color:"#e2e8f0",
              fontSize:13,lineHeight:1.75,whiteSpace:"pre-wrap",
              border:"1px solid #1e3a5f",maxHeight:440,overflowY:"auto"}}>
              {result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chart wrappers ────────────────────────────────────────────────────
function LineChart({labels,datasets,height=240,opts={}}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"line",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:200},
        plugins:{legend:{display:true,labels:{color:D.text2,font:{size:10},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:9}}},
                y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:9}}}},
        ...opts}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}
function BarChart({labels,datasets,height=200,horizontal=false,opts={}}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"bar",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?"y":"x",
        animation:{duration:200},
        plugins:{legend:{display:datasets.length>1,labels:{color:D.text2,font:{size:10},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:9}}},
                y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:9}}}},
        ...opts}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}
function RadarChart({labels,datasets,height=260}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"radar",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:200},
        plugins:{legend:{display:true,labels:{color:D.text2,font:{size:10},boxWidth:12}}},
        scales:{r:{grid:{color:"rgba(255,255,255,0.08)"},
          ticks:{color:D.text3,backdropColor:"transparent",font:{size:8}},
          pointLabels:{color:D.text2,font:{size:10}},min:0,max:1}}}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

// ── SVGs (Architecture, Pie, Gauge) ───────────────────────────────────
function ArchSVG(){
  const W=580,H=200;
  const modules=[
    {x:10, y:75,w:90,h:50,c:D.blue,  n:"M1",t:"Dự báo GDP",s:"Cobb-Douglas"},
    {x:115,y:75,w:90,h:50,c:D.teal,  n:"M2",t:"Sẵn sàng số",s:"TOPSIS+Entropy"},
    {x:220,y:75,w:90,h:50,c:D.amber, n:"M3",t:"Phân bổ tối ưu",s:"LP+Dynamic"},
    {x:325,y:75,w:90,h:50,c:D.purple,n:"M4",t:"Lao động AI",s:"CVXPY NetJob"},
    {x:430,y:75,w:90,h:50,c:D.coral, n:"M5",t:"Rủi ro",s:"Pareto+SP"},
  ];
  const dash={x:200,y:155,w:180,h:40,c:D.green};
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <defs><marker id="b12arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill={D.border}/></marker></defs>
      {modules.map((m,i)=>(
        <g key={i}>
          <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={7}
            fill={`${m.c}12`} stroke={`${m.c}66`} strokeWidth={1.5}/>
          <text x={m.x+m.w/2} y={m.y+15} textAnchor="middle" fontSize={10} fontWeight="800" fill={m.c}>{m.n}</text>
          <text x={m.x+m.w/2} y={m.y+28} textAnchor="middle" fontSize={9} fontWeight="600" fill={D.text1}>{m.t}</text>
          <text x={m.x+m.w/2} y={m.y+41} textAnchor="middle" fontSize={8} fill={D.text3}>{m.s}</text>
          {i<4&&<line x1={m.x+m.w} y1={m.y+25} x2={modules[i+1].x} y2={modules[i+1].y+25}
            stroke={D.border} strokeWidth={1.5} markerEnd="url(#b12arr)"/>}
          <line x1={m.x+m.w/2} y1={m.y+m.h} x2={dash.x+dash.w/2-(2-i)*30} y2={dash.y}
            stroke={`${m.c}55`} strokeWidth={1} strokeDasharray="3,3"/>
        </g>
      ))}
      <rect x={dash.x} y={dash.y} width={dash.w} height={dash.h} rx={8}
        fill={`${dash.c}18`} stroke={`${dash.c}77`} strokeWidth={2}/>
      <text x={dash.x+dash.w/2} y={dash.y+16} textAnchor="middle" fontSize={11} fontWeight="800" fill={dash.c}>M6 DASHBOARD</text>
      <text x={dash.x+dash.w/2} y={dash.y+30} textAnchor="middle" fontSize={9} fill={D.text2}>5 Kịch bản · Cảnh báo · Khuyến nghị</text>
    </svg>
  );
}
function AllocPie({id,scenarios}){
  const sc=scenarios[id];
  const vals=[sc.sK,sc.sD,sc.sAI,sc.sH];
  const labels=["K","D","AI","H"];
  const colors=[D.blue,D.teal,D.purple,D.amber];
  let cum=0;
  const slices=vals.map((v,i)=>{ const s=cum; cum+=v; return{start:s,end:cum,v,i}; });
  const r=45,cx=60,cy=55;
  const toXY=(a)=>[cx+r*Math.cos((a-0.25)*2*Math.PI),cy+r*Math.sin((a-0.25)*2*Math.PI)];
  return(
    <svg viewBox="0 0 130 110" width="100%" style={{fontFamily:"sans-serif"}}>
      {slices.map(({start,end,v,i})=>{
        const [x1,y1]=toXY(start); const [x2,y2]=toXY(end);
        return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r},0,${end-start>0.5?1:0},1,${x2},${y2} Z`}
          fill={colors[i]} opacity={0.85}/>;
      })}
      <circle cx={cx} cy={cy} r={24} fill={D.bg2}/>
      <text x={cx} y={cy+4} textAnchor="middle" fontSize={10} fontWeight="800" fill={sc.color}>{id}</text>
      <g>{labels.map((l,i)=>(
        <g key={l}>
          <rect x={85} y={i*20+5} width={10} height={10} rx={2} fill={colors[i]}/>
          <text x={99} y={i*20+14} fontSize={9} fill={D.text2}>{l}: {(vals[i]*100).toFixed(0)}%</text>
        </g>
      ))}</g>
    </svg>
  );
}
function RiskGauge({value,label,color}){
  const pct=Math.min(value,1);
  const W=120,H=70,cx=60,cy=60,r=45;
  const angle=-Math.PI+(pct*Math.PI);
  const nx=cx+r*Math.cos(angle),ny=cy+r*Math.sin(angle);
  const arc=(a)=>[cx+r*Math.cos(-Math.PI+a*Math.PI),cy+r*Math.sin(-Math.PI+a*Math.PI)];
  const [sx,sy]=arc(0),[ex,ey]=arc(1);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <path d={`M${sx},${sy} A${r},${r},0,1,1,${ex},${ey}`}
        fill="none" stroke={D.bg1} strokeWidth={8} strokeLinecap="round"/>
      <path d={`M${sx},${sy} A${r},${r},0,${pct>0.5?1:0},1,${nx},${ny}`}
        fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" opacity={0.9}/>
      <text x={cx} y={cy-8} textAnchor="middle" fontSize={14} fontWeight="800" fill={color}>
        {(value*100).toFixed(0)}%
      </text>
      <text x={cx} y={cy+2} textAnchor="middle" fontSize={8} fill={D.text3}>{label}</text>
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("overview");
  const [cl,setCl]=useState(false);
  const [selSc,setSelSc]=useState("S5");
  const [cmpScs,setCmpScs]=useState(["S1","S2","S3","S4","S5"]);
  const [params,setParams]=useState({...DEFAULT_PARAMS});
  const [panelCollapsed,setPanelCollapsed]=useState(false);

  useEffect(()=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload=()=>setCl(true);
    document.head.appendChild(s);
  },[]);

  const handleParam=useCallback((k,v)=>setParams(prev=>({...prev,[k]:v})),[]);
  const handleReset=useCallback(()=>setParams({...DEFAULT_PARAMS}),[]);
  const toggleCmp=(id)=>setCmpScs(prev=>
    prev.includes(id)&&prev.length>1?prev.filter(x=>x!==id):
    prev.includes(id)?prev:[...prev,id].sort());

  const sim = simulate(params);
  const { scenarios, topsisScores, topsisRanks, lpAlloc, lpZ, best } = sim;
  const sc = scenarios[selSc];

  const TABS=[
    {id:"overview",  label:"① Tổng quan AIDEOM-VN",color:"#0ea5e9"},
    {id:"m1_gdp",    label:"② M1 Dự báo GDP",color:D.blue},
    {id:"m2_topsis", label:"③ M2 Sẵn sàng số",color:D.teal},
    {id:"m3_lp",     label:"④ M3 Phân bổ LP",color:D.amber},
    {id:"m4_labor",  label:"⑤ M4 Lao động AI",color:D.purple},
    {id:"m5_risk",   label:"⑥ M5 Rủi ro",color:D.coral},
    {id:"compare",   label:"⑦ So sánh 5 KBản",color:D.green},
  ];

  // Gemini contexts
  const geminiContexts = {
    overview: `AIDEOM-VN Tổng quan (tham số α=${params.alpha}, TFP×${params.tfp}, budget=${params.budget}tỷ):
Kịch bản tốt nhất: ${best} (Score=${scenarios[best].score})
5 kịch bản scores: ${SC_IDS.map(id=>`${id}:${scenarios[id].score}`).join(', ')}
GDP 2030: ${SC_IDS.map(id=>`${id}:${(scenarios[id].Y[4]/1000).toFixed(1)}K`).join(', ')}
Best composite weights: w_cyber=${params.w_cyber}, w_incl=${params.w_incl}, w_job=${params.w_job}, w_gini=${params.w_gini}`,

    m1_gdp: `M1 Cobb-Douglas mở rộng (Y=A·Kᵅ·Lᵝ·Dᵞ·AIᵟ·Hᶿ):
α=${params.alpha}, γ=${params.gamma}, δ=${params.delta}, θ=${params.theta}, TFP×${params.tfp}
Kịch bản chọn: ${selSc} — ${scenarios[selSc].name}
GDP 2030: ${(scenarios[selSc].Y[4]/1000).toFixed(2)}K tỷ | CAGR: ${scenarios[selSc].cagr}%
Bảng GDP 5 kịch bản: ${SC_IDS.map(id=>`${id}:${(scenarios[id].Y[4]/1000).toFixed(1)}K(CAGR${scenarios[id].cagr}%)`).join(', ')}`,

    m2_topsis: `M2 TOPSIS Sẵn sàng số 6 vùng (w_AI=${params.w_ai}, w_Digital=${params.w_dig}, w_FDI=${params.w_fdi}):
${REGIONS.map((r,i)=>`${r}: C*=${topsisScores[i].toFixed(4)} Rank#${topsisRanks[i]}`).join('\n')}
Top-1: ${REGIONS[topsisRanks.indexOf(1)]} | Top-6 (thấp nhất): ${REGIONS[topsisRanks.indexOf(6)]}`,

    m3_lp: `M3 LP Phân bổ Ngân sách (Budget=${params.budget}tỷ, Z*=${lpZ.toLocaleString()}tỷ):
${LP_REGION_KEYS.map((r,i)=>`${REGION_NAMES[i]}: D=${lpAlloc[r].D}, AI=${lpAlloc[r].AI}, H=${lpAlloc[r].H}`).join('\n')}
Tổng: I=${LP_REGION_KEYS.reduce((s,r)=>s+lpAlloc[r].I,0)}, D=${LP_REGION_KEYS.reduce((s,r)=>s+lpAlloc[r].D,0)}, AI=${LP_REGION_KEYS.reduce((s,r)=>s+lpAlloc[r].AI,0)}, H=${LP_REGION_KEYS.reduce((s,r)=>s+lpAlloc[r].H,0)}`,

    m4_labor: `M4 Lao động AI & NetJob:
NetJob theo kịch bản: ${SC_IDS.map(id=>`${id}:${(scenarios[id].base.netjob/1e6).toFixed(2)}M`).join(', ')}
Rủi ro tự động hóa 8 ngành: ${SECTORS.map((s,i)=>`${s}:${(RISK_SEC[i]*100).toFixed(0)}%`).join(', ')}
S4 Bao trùm (H=40%) tạo nhiều việc nhất: ${(scenarios["S4"].base.netjob/1e6).toFixed(2)}M
S1 Truyền thống (H=10%) thấp nhất: ${(scenarios["S1"].base.netjob/1e6).toFixed(2)}M`,

    m5_risk: `M5 Rủi ro đa chiều (w_cyber=${params.w_cyber}, w_incl=${params.w_incl}):
${SC_IDS.map(id=>{const s=scenarios[id]; return `${id}: Cyber=${(s.base.cyber*100).toFixed(0)}% Emit=${(s.base.emit_idx*100).toFixed(0)}% Incl=${(s.base.inclusion*100).toFixed(0)}% Depend=${(s.base.depend*100).toFixed(0)}%`}).join('\n')}
S3 AI dẫn dắt: Cyber Risk cao nhất (${(scenarios["S3"].base.cyber*100).toFixed(0)}%)
S4 Bao trùm: Inclusion cao nhất (${(scenarios["S4"].base.inclusion*100).toFixed(0)}%)`,

    compare: `So sánh 5 kịch bản (GDP, CAGR, Score) với tham số α=${params.alpha}, TFP×${params.tfp}:
${SC_IDS.map(id=>{const s=scenarios[id]; return `${id}: GDP2030=${(s.Y[4]/1000).toFixed(1)}K CAGR=${s.cagr}% Score=${s.score} Gini=${s.base.gini} Unemp=${s.base.unemp}% NetJob=${(s.base.netjob/1e6).toFixed(2)}M`}).join('\n')}
Kịch bản khuyến nghị: ${best} (Score=${scenarios[best].score})
Weights: w_cyber=${params.w_cyber} w_incl=${params.w_incl} w_job=${params.w_job} w_gini=${params.w_gini}`,
  };

  return(
    <div style={{minHeight:"100vh",
      background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`,
      fontFamily:"'Segoe UI',sans-serif",color:D.text1,padding:"20px 16px"}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{display:"inline-block",
          background:"linear-gradient(90deg,#0ea5e9,#8b5cf6,#22c55e)",
          borderRadius:6,padding:"3px 16px",fontSize:11,fontWeight:700,
          letterSpacing:2,marginBottom:10,color:"#fff"}}>
          AIDEOM-VN • BÀI 12 • ĐỒ ÁN TỔNG HỢP
        </div>
        <h1 style={{fontSize:26,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#a78bfa,#4ade80)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Mô hình Ra Quyết định Phát triển Kinh tế Việt Nam trong Kỷ nguyên AI
        </h1>
        <p style={{fontSize:13,color:D.text3,margin:0}}>
          6 Module tích hợp (M1-M6) · 5 Kịch bản chính sách · α={params.alpha} · TFP×{params.tfp} ·
          Budget={Math.round(params.budget/1000)}K tỷ · Kịch bản tốt nhất: <strong style={{color:scenarios[best].color}}>{best}</strong>
        </p>
      </div>

      {/* KPI — reactive */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <KPI label="GDP 2025 (thực tế)" value="12.848" unit="nghìn tỷ VND" color={D.blue} sub="Tăng trưởng 8.02%"/>
        <KPI label={`GDP 2030 (${selSc})`} value={`${(sc.Y[4]/1000).toFixed(2)}K`} unit="nghìn tỷ VND" color={D.green} sub={`CAGR ${sc.cagr}%/năm`}/>
        <KPI label="Kịch bản tốt nhất" value={`${best} ${scenarios[best].short===best?"":scenarios[best].name.split("·")[1]||""}`} unit={`Score=${scenarios[best].score}`} color={scenarios[best].color} sub={`NetJob=${(scenarios[best].base.netjob/1e6).toFixed(2)}M`}/>
        <KPI label="AI dẫn dắt" value={`Cyber ${(scenarios["S3"].base.cyber*100).toFixed(0)}%`} unit={`Score=${scenarios["S3"].score}`} color={D.coral} sub="GDP cao nhưng rủi ro cao"/>
        <KPI label={`TOPSIS Top#1`} value={REGIONS[topsisRanks.indexOf(1)]} unit={`C*=${topsisScores[topsisRanks.indexOf(1)].toFixed(3)}`} color={D.purple} sub={`w_AI=${params.w_ai}`}/>
        <KPI label="LP ngân sách" value={`${Math.round(params.budget/1000)}K tỷ`} unit={`Z*=${Math.round(lpZ/1000)}K`} color={D.teal} sub="6 vùng · 4 hạng mục"/>
      </div>

      {/* PARAM PANEL */}
      <ParamPanel params={params} onChange={handleParam} onReset={handleReset}
        collapsed={panelCollapsed} setCollapsed={setPanelCollapsed}/>

      {/* TABS */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id}
          onClick={()=>setTab(t.id)} color={t.color}/>)}
      </div>

      {/* ══ TAB: TỔNG QUAN ══════════════════════════════════════════ */}
      {tab==="overview"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <h3 style={{margin:"0 0 6px",color:D.green,fontSize:15}}>Kiến trúc hệ thống AIDEOM-VN — 6 Module</h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
              M1→M5 cung cấp đầu vào cho M6 Dashboard · α={params.alpha} · TFP×{params.tfp} · Budget={Math.round(params.budget/1000)}K tỷ
            </p>
            <ArchSVG/>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {SC_IDS.map(id=>{
              const s=scenarios[id];
              return(
                <div key={id} style={{padding:"12px",background:s.colorBg,
                  border:`1.5px solid ${s.color}55`,borderRadius:11,cursor:"pointer",transition:"all .2s"}}
                  onClick={()=>{setSelSc(id);setTab("m1_gdp");}}>
                  <p style={{fontSize:11,fontWeight:800,color:s.color,margin:"0 0 4px"}}>{s.name}</p>
                  <p style={{fontSize:10,color:D.text3,margin:"0 0 8px",lineHeight:1.4}}>{s.desc}</p>
                  <AllocPie id={id} scenarios={scenarios}/>
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                      <span style={{color:D.text3}}>GDP 2030</span>
                      <span style={{color:s.color,fontWeight:700}}>{(s.Y[4]/1000).toFixed(1)}K tỷ</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                      <span style={{color:D.text3}}>Score</span>
                      <span style={{color:s.color,fontWeight:700}}>{s.score}{id===best?" ★":""}</span>
                    </div>
                    <div style={{marginTop:6,height:5,background:D.bg1,borderRadius:3}}>
                      <div style={{height:"100%",width:`${s.score*100}%`,background:s.color,borderRadius:3}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.blue,fontSize:14}}>GDP lịch sử 2020-2025 (thực tế)</h3>
              {cl&&(
                <LineChart labels={YEARS_HIST.map(String)} datasets={[
                  {label:"GDP (ngh.tỷ VND)",data:GDP_HIST,borderColor:D.blue,
                   backgroundColor:"rgba(56,189,248,0.12)",fill:true,tension:0.4,
                   pointRadius:5,borderWidth:2.5},
                ]} height={200} opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}/>
              )}
            </Card>
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.teal,fontSize:14}}>Điểm tổng hợp 5 kịch bản (live)</h3>
              {cl&&(
                <BarChart labels={SC_IDS.map(id=>scenarios[id].name.split("·")[1]?.trim()||id)}
                  datasets={[{label:"Composite Score (0-1)",
                    data:SC_IDS.map(id=>scenarios[id].score),
                    backgroundColor:SC_IDS.map(id=>`${scenarios[id].color}bb`),
                    borderColor:SC_IDS.map(id=>scenarios[id].color),
                    borderWidth:2,borderRadius:7}]}
                  height={200}
                  opts={{plugins:{legend:{display:false}},scales:{y:{min:0,max:1}}}}/>
              )}
            </Card>
          </div>
          <GeminiBlock context={geminiContexts.overview} tabLabel="Tổng quan AIDEOM-VN"/>
        </div>
      )}

      {/* ══ TAB: M1 DỰ BÁO GDP ══════════════════════════════════════ */}
      {tab==="m1_gdp"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:D.text2,fontWeight:500}}>Kịch bản:</span>
            {SC_IDS.map(id=><ScBadge key={id} id={id} active={selSc===id} onClick={setSelSc} scenarios={scenarios}/>)}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:sc.color,fontSize:15}}>
                M1 — Cobb-Douglas mở rộng · {sc.name}
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                Y=A×{params.tfp.toFixed(2)}·K^{params.alpha}·L^β·D^{params.gamma}·AI^{params.delta}·H^{params.theta} | TFP nội sinh | 2026-2030
              </p>
              {cl&&(
                <LineChart
                  labels={[...YEARS_HIST,...YEARS_PROJ].map(String)}
                  datasets={[
                    {label:"GDP lịch sử (thực tế)",
                      data:[...GDP_HIST,...Array(5).fill(null)],
                      borderColor:D.text2,borderWidth:2,tension:0.4,pointRadius:4,borderDash:[5,3]},
                    {label:`GDP dự báo ${sc.short}`,
                      data:[...Array(6).fill(null),GDP_2026,...sc.Y],
                      borderColor:sc.color,backgroundColor:`${sc.color}15`,
                      fill:true,tension:0.4,pointRadius:5,borderWidth:2.5},
                  ]}
                  height={280}
                  opts={{scales:{y:{ticks:{callback:v=>v?`${(v/1000).toFixed(0)}K`:""}}},
                    plugins:{legend:{display:true}}}}
                />
              )}
            </Card>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {l:"GDP 2030",v:`${(sc.Y[4]/1000).toFixed(1)}K tỷ`,c:sc.color},
                {l:"CAGR 2026-2030",v:`${sc.cagr}%`,c:D.green},
                {l:"Digital Index D",v:`${sc.D[4]}%`,c:D.teal},
                {l:"AI Capacity",v:`${sc.AI[4]}K DN`,c:D.purple},
                {l:"Nhân lực H",v:`${sc.H[4]}%`,c:D.amber},
                {l:"Gini 2030",v:sc.base.gini,c:sc.base.gini<0.37?D.green:D.coral},
              ].map((k,i)=>(
                <div key={i} style={{padding:"10px 14px",background:`${k.c}0e`,
                  border:`1px solid ${k.c}33`,borderRadius:8,
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:D.text2}}>{k.l}</span>
                  <span style={{fontSize:14,fontWeight:700,color:k.c}}>{k.v}</span>
                </div>
              ))}
              <div style={{padding:"10px 12px",background:D.bg3,borderRadius:8}}>
                <p style={{fontSize:11,color:D.text3,margin:"0 0 6px",fontWeight:600}}>Phân bổ ngân sách</p>
                {["K","D","AI","H"].map((x,i)=>{
                  const v=[sc.sK,sc.sD,sc.sAI,sc.sH][i];
                  const c=[D.blue,D.teal,D.purple,D.amber][i];
                  return(
                    <div key={x} style={{marginBottom:5}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:10,color:c}}>{x}</span>
                        <span style={{fontSize:10,fontWeight:700,color:c}}>{(v*100).toFixed(0)}%</span>
                      </div>
                      <div style={{height:5,background:D.bg1,borderRadius:3}}>
                        <div style={{height:"100%",width:`${v*100}%`,background:c,borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Card>
            <h3 style={{margin:"0 0 12px",color:D.blue,fontSize:13}}>Quỹ đạo GDP 5 kịch bản 2026-2030 (α={params.alpha}, TFP×{params.tfp})</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    <th style={{padding:"6px 10px",color:D.text3,textAlign:"left",fontSize:11}}>Kịch bản</th>
                    {YEARS_PROJ.map(y=>(
                      <th key={y} style={{padding:"6px 10px",color:D.text3,textAlign:"right",fontSize:11}}>{y}</th>
                    ))}
                    <th style={{padding:"6px 10px",color:D.text3,textAlign:"right",fontSize:11}}>CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {SC_IDS.map((id,ri)=>{
                    const s=scenarios[id];
                    return(
                      <tr key={id} style={{borderBottom:`1px solid ${D.border}`,
                        background:id===selSc?`${s.color}08`:ri%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"6px 10px",fontWeight:600,color:s.color}}>{s.name}</td>
                        {s.Y.map((v,i)=>(
                          <td key={i} style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",
                            color:id===selSc?s.color:D.text2,fontWeight:id===selSc?700:400}}>
                            {(v/1000).toFixed(2)}K
                          </td>
                        ))}
                        <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,
                          color:s.cagr>=9?D.green:s.cagr>=8?D.teal:D.amber}}>
                          {s.cagr}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <GeminiBlock context={geminiContexts.m1_gdp} tabLabel="M1 Dự báo GDP Cobb-Douglas"/>
        </div>
      )}

      {/* ══ TAB: M2 TOPSIS ══════════════════════════════════════════ */}
      {tab==="m2_topsis"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.teal,fontSize:15}}>M2 — TOPSIS Sẵn sàng số 6 vùng</h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                8 tiêu chí · w_AI={params.w_ai} · w_Digital={params.w_dig} · w_FDI={params.w_fdi}
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {REGIONS.map((r,i)=>{
                  const c_=topsisScores[i];
                  const rank=topsisRanks[i];
                  const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"";
                  return(
                    <div key={r} style={{display:"flex",alignItems:"center",gap:10,
                      padding:"9px 12px",borderRadius:8,
                      background:rank<=3?`${RCOLORS[i]}0e`:D.bg1,
                      border:`1px solid ${rank<=3?RCOLORS[i]+"44":D.border}`}}>
                      <span style={{fontSize:14,minWidth:26}}>{medal||`#${rank}`}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12,fontWeight:rank<=3?600:400,
                            color:rank<=3?RCOLORS[i]:D.text2}}>{REGION_NAMES[i]}</span>
                          <span style={{fontSize:12,fontFamily:"monospace",fontWeight:600,
                            color:RCOLORS[i]}}>{c_.toFixed(4)}</span>
                        </div>
                        <div style={{height:6,background:D.bg1,borderRadius:3}}>
                          <div style={{height:"100%",width:`${c_*100}%`,background:RCOLORS[i],borderRadius:3}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 12px",color:D.teal,fontSize:14}}>Dữ liệu 6 vùng (vietnam_regions_2024.csv)</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${D.border}`}}>
                      {["Vùng","GRDP/ng","FDI","Digital","AI Ready","Rank"].map(h=>(
                        <th key={h} style={{padding:"5px 7px",color:D.text3,textAlign:"right",fontSize:10}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {REGION_RAW.map((row,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"5px 7px",color:RCOLORS[i],fontWeight:600}}>{REGIONS[i]}</td>
                        {row.map((v,j)=>(
                          <td key={j} style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",
                            color:j>=2?[D.teal,D.purple][j-2]:D.text2}}>{v}</td>
                        ))}
                        <td style={{padding:"5px 7px",textAlign:"right",fontWeight:700,
                          color:topsisRanks[i]<=3?RCOLORS[i]:D.text3}}>
                          #{topsisRanks[i]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:12,padding:"10px 12px",background:D.tealBg,
                borderLeft:`3px solid ${D.teal}`,borderRadius:6,fontSize:12,color:D.text2}}>
                Top-1: <strong style={{color:RCOLORS[topsisRanks.indexOf(1)]}}>{REGIONS[topsisRanks.indexOf(1)]}</strong> (C*={topsisScores[topsisRanks.indexOf(1)].toFixed(3)}) ·
                Thấp nhất: <strong style={{color:RCOLORS[topsisRanks.indexOf(6)]}}>{REGIONS[topsisRanks.indexOf(6)]}</strong> → cần đầu tư I và H trước.
                {params.w_ai!==DEFAULT_PARAMS.w_ai&&<span style={{color:D.amber}}> w_AI thay đổi → ranking điều chỉnh.</span>}
              </div>
            </Card>
          </div>
          <GeminiBlock context={geminiContexts.m2_topsis} tabLabel="M2 TOPSIS Sẵn sàng số"/>
        </div>
      )}

      {/* ══ TAB: M3 LP ═══════════════════════════════════════════════ */}
      {tab==="m3_lp"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.amber,fontSize:15}}>
              M3 — LP Phân bổ Ngân sách Số theo Vùng · Z*={lpZ.toLocaleString()} tỷ
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              Budget={params.budget.toLocaleString()} tỷ · 6 vùng × 4 hạng mục (I,D,AI,H) · PuLP/CBC · 14 ràng buộc
            </p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Vùng","I (Hạ tầng)","D (CĐS DN)","AI","H (Nhân lực)","Tổng","Z_vùng"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LP_REGION_KEYS.map((r,i)=>{
                    const a=lpAlloc[r];
                    const tot=Object.values(a).reduce((s,v)=>s+v,0);
                    const zr=["I","D","AI","H"].reduce((s,j)=>s+LP_BETAS[r][j]*a[j],0);
                    return(
                      <tr key={r} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 10px",fontWeight:600,color:RCOLORS[i]}}>{REGION_NAMES[i]}</td>
                        {["I","D","AI","H"].map(j=>(
                          <td key={j} style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",
                            color:a[j]>0?D.text1:D.text3}}>
                            {a[j]>0?a[j].toLocaleString():"—"}
                          </td>
                        ))}
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600}}>{tot.toLocaleString()}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:D.amber}}>
                          {Math.round(zr).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${D.amber}`}}>
                    <td style={{padding:"7px 10px",fontWeight:700,color:D.amber}}>TỔNG</td>
                    {["I","D","AI","H"].map(j=>(
                      <td key={j} style={{padding:"7px 10px",textAlign:"right",fontWeight:700,
                        color:[D.blue,D.teal,D.purple,D.amber][["I","D","AI","H"].indexOf(j)]}}>
                        {LP_REGION_KEYS.reduce((s,r)=>s+lpAlloc[r][j],0).toLocaleString()}
                      </td>
                    ))}
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>{params.budget.toLocaleString()}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:800,color:D.amber,fontSize:14}}>
                      {lpZ.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {cl&&(
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.amber,fontSize:14}}>Phân bổ theo vùng (tỷ VND)</h3>
              <BarChart
                labels={REGIONS}
                datasets={["I","D","AI","H"].map((j,ji)=>({
                  label:["Hạ tầng","CĐS DN","AI","Nhân lực"][ji],
                  data:LP_REGION_KEYS.map(r=>lpAlloc[r][j]/1000),
                  backgroundColor:[D.blue,D.teal,D.purple,D.amber][ji]+"99",
                  borderColor:[D.blue,D.teal,D.purple,D.amber][ji],
                  borderWidth:2,borderRadius:4,
                }))}
                height={220}
                opts={{scales:{x:{stacked:true},y:{stacked:true,ticks:{callback:v=>`${v}K`}}}}}
              />
            </Card>
          )}
          <GeminiBlock context={geminiContexts.m3_lp} tabLabel="M3 Phân bổ LP"/>
        </div>
      )}

      {/* ══ TAB: M4 LABOR ══════════════════════════════════════════ */}
      {tab==="m4_labor"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:15}}>M4 — Lao động AI · NetJob 8 ngành</h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                Từ Bài 9 · CVXPY · Budget=30.000 tỷ · NetJobᵢ = NewJob + Upgrade − Displaced
              </p>
              {cl&&(
                <BarChart
                  labels={SECTORS}
                  datasets={[{
                    label:"Rủi ro tự động hóa (%)",
                    data:RISK_SEC.map(v=>+(v*100).toFixed(0)),
                    backgroundColor:RISK_SEC.map(v=>v>0.45?D.coral+"aa":v>0.3?D.amber+"aa":D.green+"aa"),
                    borderColor:RISK_SEC.map(v=>v>0.45?D.coral:v>0.3?D.amber:D.green),
                    borderWidth:2,borderRadius:5},
                  ]}
                  height={200}
                  opts={{plugins:{legend:{display:false}},
                    scales:{y:{title:{display:true,text:"% rủi ro",color:D.text3}}}}}
                />
              )}
            </Card>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>NetJob theo kịch bản (triệu việc)</h3>
              {cl&&(
                <BarChart
                  labels={SC_IDS.map(id=>scenarios[id].short)}
                  datasets={[{
                    label:"NetJob ròng (triệu)",
                    data:SC_IDS.map(id=>+(scenarios[id].base.netjob/1e6).toFixed(3)),
                    backgroundColor:SC_IDS.map(id=>`${scenarios[id].color}bb`),
                    borderColor:SC_IDS.map(id=>scenarios[id].color),
                    borderWidth:2,borderRadius:8,
                  }]}
                  height={200}
                  opts={{plugins:{legend:{display:false}},
                    scales:{y:{title:{display:true,text:"Triệu việc làm ròng",color:D.text3}}}}}
                />
              )}
              <div style={{marginTop:10,padding:"8px 12px",background:D.purpleBg,
                borderLeft:`3px solid ${D.purple}`,borderRadius:6,fontSize:12,color:D.text2}}>
                S4 Bao trùm: {(scenarios["S4"].base.netjob/1e6).toFixed(2)}M việc (H=40%).
                S1 Truyền thống: {(scenarios["S1"].base.netjob/1e6).toFixed(2)}M (H=10%) — thấp nhất.
              </div>
            </Card>
          </div>
          <Card>
            <h3 style={{margin:"0 0 12px",color:D.purple,fontSize:14}}>Cơ cấu lao động 8 ngành (2024)</h3>
            <div style={{display:"flex",gap:0,height:16,borderRadius:6,overflow:"hidden",marginBottom:10}}>
              {L_SEC.map((v,i)=>(
                <div key={i} style={{flex:v,background:SCOLORS[i],opacity:0.85}} title={`${SECTORS[i]}: ${v}M`}/>
              ))}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {SECTORS.map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                  <div style={{width:10,height:10,borderRadius:2,background:SCOLORS[i]}}/>
                  <span style={{color:D.text2}}>{s}: {L_SEC[i]}M</span>
                </div>
              ))}
            </div>
          </Card>
          <GeminiBlock context={geminiContexts.m4_labor} tabLabel="M4 Lao động AI & NetJob"/>
        </div>
      )}

      {/* ══ TAB: M5 RỦI RO ══════════════════════════════════════════ */}
      {tab==="m5_risk"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.coral,fontSize:15}}>M5 — Đánh giá Rủi ro 5 Kịch bản</h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              Cyber Risk · Emission Index · Dependency Risk · Inclusion Score ·
              w_cyber={params.w_cyber} · w_incl={params.w_incl}
            </p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
              {SC_IDS.map(id=>{
                const s=scenarios[id];
                return(
                  <div key={id} style={{padding:"10px",background:s.colorBg,
                    border:`1px solid ${s.color}44`,borderRadius:10,textAlign:"center"}}>
                    <p style={{fontSize:12,fontWeight:700,color:s.color,margin:"0 0 8px"}}>{s.short}</p>
                    <RiskGauge value={s.base.cyber} label="Cyber Risk"
                      color={s.base.cyber>0.4?D.coral:s.base.cyber>0.25?D.amber:D.green}/>
                    <div style={{marginTop:6}}>
                      {[
                        {l:"Emission",v:s.base.emit_idx,good:true},
                        {l:"Depend",v:s.base.depend,good:false},
                        {l:"Inclusion",v:s.base.inclusion,good:true},
                      ].map(({l,v,good})=>(
                        <div key={l} style={{display:"flex",justifyContent:"space-between",
                          padding:"3px 0",borderBottom:`1px solid ${D.border}`,fontSize:10}}>
                          <span style={{color:D.text3}}>{l}</span>
                          <span style={{fontWeight:600,
                            color:good?(v>0.6?D.green:v>0.4?D.amber:D.coral):
                                       (v<0.25?D.green:v<0.4?D.amber:D.coral)}}>
                            {(v*100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {cl&&(
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.coral,fontSize:14}}>Radar chart — Rủi ro đa chiều</h3>
              <RadarChart
                labels={["Cyber Risk (↓)","Emission ↑","Inclusion ↑","Anti-depend ↑","Net Jobs ↑"]}
                datasets={SC_IDS.map(id=>{
                  const s=scenarios[id];
                  return{
                    label:s.short,
                    data:[1-s.base.cyber, s.base.emit_idx, s.base.inclusion,
                          1-s.base.depend, s.base.netjob/1500000],
                    backgroundColor:`${s.color}18`,borderColor:s.color,
                    borderWidth:2,pointBackgroundColor:s.color,
                  };
                })}
                height={280}
              />
            </Card>
          )}
          <GeminiBlock context={geminiContexts.m5_risk} tabLabel="M5 Đánh giá Rủi ro"/>
        </div>
      )}

      {/* ══ TAB: SO SÁNH ═════════════════════════════════════════════ */}
      {tab==="compare"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:D.text2,fontWeight:500}}>Chọn kịch bản so sánh:</span>
            {SC_IDS.map(id=><ScBadge key={id} id={id} active={cmpScs.includes(id)} onClick={toggleCmp} scenarios={scenarios}/>)}
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.green,fontSize:15}}>
              Bảng tổng hợp KPI 2030 — {cmpScs.length} kịch bản (α={params.alpha}, TFP×{params.tfp})
            </h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Chỉ tiêu","Đơn vị",...cmpScs.map(id=>scenarios[id].name)].map(h=>(
                      <th key={h} style={{padding:"8px 10px",color:D.text3,
                        textAlign:h==="Chỉ tiêu"||h==="Đơn vị"?"left":"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {label:"GDP 2030",unit:"ngh.tỷ",key:"Y",fmt:(sc)=>(sc.Y[4]/1000).toFixed(2)+"K",numFn:(sc)=>sc.Y[4],best:"max"},
                    {label:"CAGR",unit:"%/năm",key:"cagr",fmt:(sc)=>sc.cagr+"%",numFn:(sc)=>sc.cagr,best:"max"},
                    {label:"Gini 2030",unit:"hệ số",key:"gini",fmt:(sc)=>sc.base.gini,numFn:(sc)=>sc.base.gini,best:"min"},
                    {label:"Thất nghiệp",unit:"%",key:"unemp",fmt:(sc)=>sc.base.unemp+"%",numFn:(sc)=>sc.base.unemp,best:"min"},
                    {label:"Cyber Risk",unit:"0-1",key:"cyber",fmt:(sc)=>(sc.base.cyber*100).toFixed(0)+"%",numFn:(sc)=>sc.base.cyber,best:"min"},
                    {label:"Inclusion",unit:"0-1",key:"inclusion",fmt:(sc)=>(sc.base.inclusion*100).toFixed(0)+"%",numFn:(sc)=>sc.base.inclusion,best:"max"},
                    {label:"NetJob",unit:"triệu",key:"netjob",fmt:(sc)=>(sc.base.netjob/1e6).toFixed(2)+"M",numFn:(sc)=>sc.base.netjob,best:"max"},
                    {label:"Composite Score",unit:"0-1",key:"score",fmt:(sc)=>sc.score,numFn:(sc)=>sc.score,best:"max"},
                  ].map((row,ri)=>{
                    const numVals = cmpScs.map(id=>row.numFn(scenarios[id]));
                    const bestVal = row.best==="max"?Math.max(...numVals):Math.min(...numVals);
                    return(
                      <tr key={row.label} style={{borderBottom:`1px solid ${D.border}`,
                        background:ri%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"8px 10px",fontWeight:600,color:D.text2}}>{row.label}</td>
                        <td style={{padding:"8px 10px",color:D.text3,fontSize:10}}>{row.unit}</td>
                        {cmpScs.map((id,ci)=>{
                          const s=scenarios[id];
                          const num=numVals[ci];
                          const isBest=Math.abs(num-bestVal)<0.0001;
                          return(
                            <td key={id} style={{padding:"8px 10px",textAlign:"right",
                              fontFamily:"monospace",fontWeight:isBest?700:400,
                              color:isBest?s.color:D.text2}}>
                              {row.fmt(s)}{isBest&&" ★"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {cl&&(
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.green,fontSize:14}}>Quỹ đạo GDP 2026-2030</h3>
              <LineChart
                labels={[2025,...YEARS_PROJ].map(String)}
                datasets={cmpScs.map(id=>{
                  const s=scenarios[id];
                  return{label:s.name,data:[GDP_HIST[5],...s.Y],
                    borderColor:s.color,backgroundColor:`${s.color}08`,
                    borderWidth:2.5,tension:0.4,pointRadius:4};
                })}
                height={260}
                opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
              />
            </Card>
          )}

          <Card style={{border:`1px solid ${D.green}33`}}>
            <h3 style={{margin:"0 0 14px",color:D.green,fontSize:14}}>💡 Khuyến nghị chính sách từ AIDEOM-VN</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {title:"Ngắn hạn 2026-2027",color:D.blue,items:[
                  `Ưu tiên ${best}: Score=${scenarios[best].score} — cân bằng tốt nhất`,
                  "Đầu tư H (nhân lực số) ≥ 20% ngân sách số",
                  `TOPSIS Top#1: ${REGIONS[topsisRanks.indexOf(1)]} → triển khai AI trước`,
                  "Xây nền tảng D (Digital) trước khi mở rộng AI",
                ]},
                {title:"Trung hạn 2028-2030",color:D.teal,items:[
                  `LP Z*=${Math.round(lpZ/1000)}K tỷ với budget ${Math.round(params.budget/1000)}K tỷ`,
                  `Tăng dần AI capacity khi H đã vững (AI/H < 1.0)`,
                  `TOPSIS #3: ${REGIONS[topsisRanks.indexOf(3)]} — mở rộng sau khi Top-2 ổn định`,
                  "Giữ Gini < 0.40 — cảnh báo nếu S3 AI-led được áp dụng",
                ]},
                {title:"Cảnh báo rủi ro",color:D.coral,items:[
                  `S3 AI dẫn dắt: Cyber Risk ${(scenarios["S3"].base.cyber*100).toFixed(0)}% — cần SOC trước`,
                  `S1 Truyền thống: NetJob ${(scenarios["S1"].base.netjob/1e6).toFixed(2)}M — thấp nhất`,
                  `${REGIONS[topsisRanks.indexOf(6)]} (TOPSIS cuối): cần I+H trước AI`,
                  "Đảm bảo Displaced < Retrain Capacity mỗi năm",
                ]},
                {title:"Kịch bản khuyến nghị",color:D.green,items:[
                  `★ ${best}: Score=${scenarios[best].score} — cao nhất hiện tại`,
                  `★★ Hybrid S4+S5: H=25%, D=17%, AI=9%, K=26%`,
                  "Sau 2028: chuyển dần sang S5 khi nền tảng đủ vững",
                  `EVPI = 300 tỷ → tăng đầu tư dự báo kinh tế vĩ mô`,
                ]},
              ].map((sec,i)=>(
                <div key={i} style={{padding:"12px 14px",background:`${sec.color}0a`,
                  border:`1px solid ${sec.color}33`,borderRadius:9}}>
                  <p style={{fontSize:12,fontWeight:700,color:sec.color,margin:"0 0 8px"}}>{sec.title}</p>
                  {sec.items.map((it,j)=>(
                    <div key={j} style={{display:"flex",gap:6,marginBottom:5}}>
                      <span style={{color:sec.color,fontSize:11,marginTop:1}}>▸</span>
                      <span style={{fontSize:11,color:D.text2,lineHeight:1.5}}>{it}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <GeminiBlock context={geminiContexts.compare} tabLabel="So sánh 5 kịch bản"/>
        </div>
      )}

      {/* FOOTER */}
      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.text3,
        borderTop:`1px solid ${D.border}`,paddingTop:14}}>
        <p style={{margin:"0 0 4px"}}>
          Bài 12 — AIDEOM-VN Tích hợp | 6 Module · Bài 1-11 | α={params.alpha} · TFP×{params.tfp} · Budget={Math.round(params.budget/1000)}K tỷ | Best: {best}(Score={scenarios[best].score})
        </p>
        <p style={{margin:0}}>
          M1 Cobb-Douglas · M2 TOPSIS · M3 LP/PuLP · M4 CVXPY NetJob · M5 Pareto+SP · M6 Dashboard &nbsp;|&nbsp;
          Nghị quyết 57-NQ/TW · QĐ 127/QĐ-TTg · QĐ 749/QĐ-TTg
        </p>
      </div>
    </div>
  );
}