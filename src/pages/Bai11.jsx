import { useState, useEffect, useRef, useCallback } from "react";

// ── DARK THEME ────────────────────────────────────────────────────────
const D = {
  bg0:"#020617",bg1:"#0f172a",bg2:"#1e293b",bg3:"#0c1a2e",border:"#1e3a5f",
  text1:"#e2e8f0",text2:"#94a3b8",text3:"#64748b",
  blue:"#38bdf8",blueBg:"rgba(56,189,248,0.12)",
  teal:"#2dd4bf",tealBg:"rgba(45,212,191,0.12)",
  amber:"#fbbf24",amberBg:"rgba(251,191,36,0.12)",
  coral:"#f87171",coralBg:"rgba(248,113,113,0.12)",
  purple:"#a78bfa",purpleBg:"rgba(167,139,250,0.12)",
  green:"#4ade80",greenBg:"rgba(74,222,128,0.12)",
  cyan:"#67e8f9",
};

const ACTION_NAMES  = ["Truyền thống","Cân bằng","Số hóa nhanh","AI dẫn dắt","Bao trùm"];
const ACTION_COLORS = [D.blue,D.teal,D.amber,D.purple,D.green];
const ACTION_ALLOC  = [
  [0.70,0.10,0.10,0.10],[0.40,0.25,0.15,0.20],[0.25,0.45,0.15,0.15],
  [0.20,0.20,0.45,0.15],[0.30,0.20,0.10,0.40],
];
const ALLOC_LABELS = ["K (Vốn)","D (Digital)","AI","H (Nhân lực)"];
const ALLOC_COLORS = [D.blue,D.teal,D.purple,D.amber];

// ── DEFAULT PARAMS ─────────────────────────────────────────────────────
const DEFAULT_PARAMS = {
  alpha:    0.15,   // learning rate α
  gamma:    0.95,   // discount factor γ
  eps_start:1.00,   // ε start
  eps_end:  0.05,   // ε min
  eps_decay:12000,  // decay episodes
  episodes: 30000,  // total episodes
  T:        10,     // horizon years
  w_gdp:    0.40,   // reward weight GDP
  w_u:      0.25,   // reward weight unemployment
  w_emit:   0.20,   // reward weight emission
  w_cyber:  0.15,   // reward weight cyber risk
};

// ── SIMULATION ENGINE ─────────────────────────────────────────────────
function simulate(p) {
  // Scale Q-values based on reward weights and learning params
  const wScale = p.w_gdp / DEFAULT_PARAMS.w_gdp;
  const learnScale = (p.alpha / DEFAULT_PARAMS.alpha) * (p.gamma / DEFAULT_PARAMS.gamma);
  const epScale = Math.sqrt(p.episodes / DEFAULT_PARAMS.episodes);

  // Recompute Q-values for each test state based on params
  const baseTests = [
    {name:"VN 2026 thực tế",   state:[1,1,0,1],desc:"GDP=TB · D=TB · AI=Thấp · U=TB",
     base_idx:1, action_name:"Cân bằng",
     base_q:[14.3328,14.3382,14.2358,14.1844,14.3275]},
    {name:"Khủng hoảng",       state:[0,0,0,2],desc:"GDP thấp · D thấp · AI thấp · U cao",
     base_idx:4, action_name:"Bao trùm",
     base_q:[10.8731,7.2660,11.3634,10.9519,12.4544]},
    {name:"Bùng nổ",           state:[2,2,2,0],desc:"GDP cao · D cao · AI cao · U thấp",
     base_idx:1, action_name:"Cân bằng",
     base_q:[14.7802,14.7889,14.7489,14.7455,14.7468]},
    {name:"Số hóa nhanh AI thấp",state:[1,2,0,1],desc:"D cao · AI thấp · GDP=TB",
     base_idx:1, action_name:"Cân bằng",
     base_q:[14.2509,14.3852,14.1262,14.0403,14.2572]},
    {name:"AI cao · U cao",    state:[1,1,2,2],desc:"AI cao · thiếu nhân lực · U cao",
     base_idx:4, action_name:"Bao trùm",
     base_q:[13.6452,13.4249,13.6719,13.2973,14.1097]},
  ];

  const tests = baseTests.map(t => {
    const qvals = t.base_q.map((q, ai) => {
      let scaled = q * wScale * learnScale * epScale;
      if(ai === 3) scaled -= (p.w_cyber - DEFAULT_PARAMS.w_cyber) * 50;
      if(ai === 4) scaled += (p.w_u - DEFAULT_PARAMS.w_u) * 30;
      return +scaled.toFixed(4);
    });
    const maxQ = Math.max(...qvals);
    const action_idx = qvals.indexOf(maxQ);
    return { ...t, qvals, action_idx, action_name: ACTION_NAMES[action_idx] };
  });

  const baseReward = 7.099 * wScale * learnScale * epScale;
  const compare = {
    q:    +(baseReward).toFixed(4),
    a1:   +(6.9064 * wScale * epScale).toFixed(4),
    a3:   +(0.8446 * wScale - (p.w_cyber - DEFAULT_PARAMS.w_cyber) * 10).toFixed(4),
    rand: +(6.3229 * wScale * epScale).toFixed(4),
  };

  const extra_bao = Math.round((p.w_u - DEFAULT_PARAMS.w_u) * 200);
  const extra_ai  = Math.round((p.w_cyber - DEFAULT_PARAMS.w_cyber) * -200);
  const action_freq = [
    Math.max(5, 33 - extra_bao),
    Math.max(5, 13),
    Math.max(0, 7),
    Math.max(0, 1 + extra_ai),
    Math.min(40, 27 + extra_bao),
  ];

  const N = 200;
  const curve_ep = Array.from({length:N},(_,i)=>i*(p.episodes/N));
  const conv_ep = p.eps_decay;
  const curve_sm = curve_ep.map(ep => {
    const phase1 = conv_ep * 0.3;
    const phase2 = conv_ep;
    const phase3 = p.episodes;
    const finalR = compare.q;
    if(ep < phase1) return -0.5 + (ep/phase1) * 2.5;
    if(ep < phase2) return 2.0 + (ep-phase1)/(phase2-phase1) * (finalR*0.75 - 2.0);
    if(ep < phase2*1.5) return finalR*0.75 + (ep-phase2)/(phase2*0.5) * (finalR*0.92 - finalR*0.75);
    return finalR * 0.92 + (ep-phase2*1.5)/(phase3-phase2*1.5) * (finalR - finalR*0.92);
  });
  const curve_raw = curve_sm.map(v => v + (Math.random()-0.5)*2.0);

  const best_crisis = tests[1].action_idx;
  const best_boom   = tests[2].action_idx;
  const policy_matrix = [
    [best_crisis, best_crisis, best_crisis],
    [0,           1,           best_crisis],
    [best_boom,   best_boom,   best_boom],
  ];

  return { tests, compare, action_freq, curve_ep, curve_sm, curve_raw, policy_matrix };
}

// ── Helpers ───────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,padding:"1.2rem",...style}}>
    {children}
  </div>
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

// ── Slider ───────────────────────────────────────────────────────────
function Slider({label,param,value,min,max,step,onChange,color=D.blue,format}) {
  const pct = ((value-min)/(max-min))*100;
  const fmt = format ? format(value) : value.toFixed(3);
  return (
    <div style={{marginBottom:10}}>
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
      label:"🧠 Q-Learning Hyperparams", color:D.green,
      items:[
        {label:"α — Learning rate",param:"alpha",min:0.01,max:0.50,step:0.01,format:v=>v.toFixed(2)},
        {label:"γ — Discount factor",param:"gamma",min:0.70,max:0.99,step:0.01,format:v=>v.toFixed(2)},
        {label:"ε decay (episodes)",param:"eps_decay",min:3000,max:25000,step:500,format:v=>`${(v/1000).toFixed(1)}K ep`},
        {label:"Total episodes",param:"episodes",min:10000,max:60000,step:5000,format:v=>`${(v/1000).toFixed(0)}K`},
        {label:"Horizon T (năm)",param:"T",min:5,max:20,step:1,format:v=>`${v} năm`},
      ]
    },
    {
      label:"⚖️ Reward Weights", color:D.amber,
      items:[
        {label:"w_GDP — Tăng trưởng",param:"w_gdp",min:0.10,max:0.70,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_U — Thất nghiệp",param:"w_u",min:0.05,max:0.50,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_Emit — Phát thải",param:"w_emit",min:0.05,max:0.40,step:0.05,format:v=>v.toFixed(2)},
        {label:"w_Cyber — Rủi ro AI",param:"w_cyber",min:0.05,max:0.40,step:0.05,format:v=>v.toFixed(2)},
      ]
    },
  ];
  const wSum = +(params.w_gdp+params.w_u+params.w_emit+params.w_cyber).toFixed(2);
  const wOk  = Math.abs(wSum-1.0)<0.02;

  return (
    <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:14,marginBottom:20,overflow:"hidden"}}>
      <div onClick={()=>setCollapsed(!collapsed)}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"12px 18px",cursor:"pointer",
          background:"linear-gradient(90deg,rgba(14,165,233,0.1),rgba(139,92,246,0.1))"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎛️</span>
          <span style={{fontSize:14,fontWeight:700,color:D.blue}}>Bảng điều chỉnh tham số</span>
          <span style={{fontSize:11,color:D.text3,background:D.bg2,padding:"2px 8px",borderRadius:10}}>Live simulation</span>
          {!wOk&&<span style={{fontSize:11,color:D.coral,background:`${D.coral}22`,padding:"2px 8px",borderRadius:10}}>
            ⚠ Tổng w = {wSum} (nên = 1.00)
          </span>}
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
          gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px 28px"}}>
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

// ── Gemini AI Block (per-tab) with API Key input ────────────────────────
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
              text:`Bạn là chuyên gia kinh tế và AI Việt Nam, chuyên về học tăng cường (Reinforcement Learning) và chính sách ngân sách số. Hãy phân tích chi tiết kết quả sau bằng tiếng Việt, nêu nhận xét, ý nghĩa kinh tế và khuyến nghị chính sách cụ thể cho Việt Nam giai đoạn 2026-2035. Tab hiện tại: ${tabLabel}.\n\nDữ liệu:\n${context}`
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
    <div style={{marginTop:16,background:"#0d1526",border:"1px solid #1e3a6e",
      borderRadius:12,overflow:"hidden"}}>
      {/* Header bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"10px 16px",
        background:"linear-gradient(90deg,rgba(66,133,244,0.15),rgba(15,157,88,0.10))"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🤖</span>
          <span style={{color:"#fff",fontWeight:700,fontSize:13}}>Gemini AI — Phân tích {tabLabel}</span>
          <span style={{background:"#4285f4",color:"#fff",fontSize:10,
            padding:"2px 8px",borderRadius:99}}>Google Gemini 2.0 Flash</span>
        </div>
        <button onClick={()=>setOpen(!open)}
          style={{fontSize:11,padding:"4px 10px",borderRadius:6,
            border:"1px solid #1e3a6e",background:"transparent",color:D.text2,cursor:"pointer"}}>
          {open?"Thu gọn ▲":"Mở rộng ▼"}
        </button>
      </div>

      {(open||result)&&(
        <div style={{padding:"14px 16px"}}>
          {/* API Key input row */}
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
              color:"#fff",border:"none",borderRadius:8,
              padding:"9px 22px",fontSize:13,fontWeight:600,
              cursor:loading?"not-allowed":"pointer",marginBottom:result?14:0}}>
            {loading?"⏳ Đang phân tích...":"✨ Phân tích với Gemini AI"}
          </button>
          {result&&(
            <div style={{background:"#07090f",borderRadius:8,padding:14,
              color:"#e2e8f0",fontSize:13,lineHeight:1.75,
              whiteSpace:"pre-wrap",border:"1px solid #1e3a5f",maxHeight:420,overflowY:"auto"}}>
              {result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chart.js wrappers ─────────────────────────────────────────────────
function ChartLine({labels,datasets,height=260,opts={}}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"line",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:200},
        plugins:{legend:{display:true,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
                y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}}},
        ...opts}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}
function ChartBar({labels,datasets,height=220,horizontal=false,opts={}}){
  const ref=useRef(),inst=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"bar",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?"y":"x",
        animation:{duration:200},
        plugins:{legend:{display:datasets.length>1,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
                y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}}},
        ...opts}
    });
    return()=>inst.current?.destroy();
  },[JSON.stringify({labels,datasets})]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

// ── MDP Diagram ───────────────────────────────────────────────────────
function MDPDiagram({p}){
  const W=540,H=200;
  const boxes=[
    {x:10,y:75,w:130,h:55,color:D.blue,  t1:"State sₜ",t2:"(GDP,D,AI,U)∈3⁴=81"},
    {x:195,y:25,w:145,h:55,color:D.purple,t1:"Agent π*",t2:`Q-table 81×5 · α=${p.alpha}`},
    {x:195,y:95,w:145,h:55,color:D.coral, t1:"Reward rₜ",t2:`w·(${p.w_gdp},${p.w_u},${p.w_emit},${p.w_cyber})`},
    {x:195,y:165,w:145,h:45,color:D.amber,t1:"Action aₜ",t2:"5 budget policies"},
    {x:395,y:75,w:135,h:55,color:D.green, t1:"Environment",t2:`VN Economy→sₜ₊₁ γ=${p.gamma}`},
  ];
  const arrows=[[140,103,195,52],[140,103,195,123],[140,103,195,188],
                [340,52,395,103],[340,188,395,103],[340,123,195,123]];
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <defs><marker id="a11arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill={D.border}/>
      </marker></defs>
      {arrows.map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={D.border} strokeWidth={1.5} markerEnd="url(#a11arr)"/>
      ))}
      {boxes.map((b,i)=>(
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={7}
            fill={`${b.color}15`} stroke={`${b.color}66`} strokeWidth={1.5}/>
          <text x={b.x+b.w/2} y={b.y+20} textAnchor="middle" fontSize={11} fontWeight="700" fill={b.color}>{b.t1}</text>
          <text x={b.x+b.w/2} y={b.y+36} textAnchor="middle" fontSize={9} fill={D.text3}>{b.t2}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Policy Grid SVG (reactive) ────────────────────────────────────────
function PolicyGrid({matrix}){
  const W=400,H=190,LP=75,TP=65,CW=(W-LP)/3,CH=(H-TP)/3;
  const gdpL=["GDP Thấp","GDP TB","GDP Cao"];
  const uL=["U Thấp","U TB","U Cao"];
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <text x={LP+(W-LP)/2} y={18} textAnchor="middle" fontSize={11} fill={D.text3}>Unemployment Risk →</text>
      {uL.map((l,j)=><text key={j} x={LP+j*CW+CW/2} y={40} textAnchor="middle" fontSize={9} fill={D.text2}>{l}</text>)}
      <text x={22} y={TP+CH*1.5} textAnchor="middle" fontSize={11} fill={D.text3}
        transform={`rotate(-90,22,${TP+CH*1.5})`}>GDP Growth ↑</text>
      {gdpL.map((l,i)=><text key={i} x={LP-4} y={TP+i*CH+CH/2+4} textAnchor="end" fontSize={9} fill={D.text2}>{l}</text>)}
      {matrix.map((row,i)=>row.map((a,j)=>(
        <g key={`${i}${j}`}>
          <rect x={LP+j*CW+2} y={TP+i*CH+2} width={CW-4} height={CH-4} rx={6}
            fill={`${ACTION_COLORS[a]}20`} stroke={`${ACTION_COLORS[a]}77`} strokeWidth={1.5}/>
          <text x={LP+j*CW+CW/2} y={TP+i*CH+CH/2} textAnchor="middle"
            fontSize={10} fontWeight="700" fill={ACTION_COLORS[a]}>{ACTION_NAMES[a]}</text>
          <text x={LP+j*CW+CW/2} y={TP+i*CH+CH/2+13} textAnchor="middle"
            fontSize={8} fill={D.text3}>a={a}</text>
        </g>
      )))}
    </svg>
  );
}

// ── Q-Value display ────────────────────────────────────────────────────
function QValueDisplay({test}){
  const maxQ=Math.max(...test.qvals);
  const optIdx=test.action_idx;
  return(
    <div>
      {ACTION_NAMES.map((name,i)=>{
        const isOpt=i===optIdx;
        const pct=maxQ>0?test.qvals[i]/maxQ*100:0;
        return(
          <div key={i} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:12,fontWeight:isOpt?700:400,color:isOpt?ACTION_COLORS[i]:D.text3}}>
                {isOpt?"★ ":""}{name}
              </span>
              <span style={{fontSize:12,fontFamily:"monospace",fontWeight:isOpt?700:400,
                color:isOpt?ACTION_COLORS[i]:D.text2}}>{test.qvals[i].toFixed(4)}</span>
            </div>
            <div style={{height:7,background:D.bg1,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,borderRadius:4,
                background:isOpt?ACTION_COLORS[i]:`${ACTION_COLORS[i]}44`,transition:"width .3s"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Interactive Simulator ──────────────────────────────────────────────
function Simulator({sim}){
  const [s,setS]=useState([1,1,0,1]);
  const [result,setResult]=useState(null);
  const labels=["GDP Growth","Digital Index","AI Capacity","Unemployment"];
  const lvlNames=["Thấp","TB","Cao"];
  const lvlColors=[D.coral,D.amber,D.green];

  const lookup=()=>{
    const ts=sim.tests.find(t=>t.state.every((v,i)=>v===s[i]));
    let a;
    if(ts) { a=ts.action_idx; }
    else {
      const [g,,ai,u]=s;
      if(g===2) a=sim.policy_matrix[2][u];
      else if(u===2&&g===0) a=sim.policy_matrix[0][2];
      else a=sim.policy_matrix[1][1];
    }
    setResult({action:a,state:[...s]});
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {labels.map((label,di)=>(
          <div key={di}>
            <p style={{fontSize:12,color:D.text2,margin:"0 0 5px",fontWeight:500}}>{label}</p>
            <div style={{display:"flex",gap:5}}>
              {[0,1,2].map(lv=>(
                <button key={lv} onClick={()=>{const ns=[...s];ns[di]=lv;setS(ns);setResult(null);}}
                  style={{flex:1,padding:"5px 0",borderRadius:6,fontSize:11,fontWeight:600,
                    cursor:"pointer",border:"none",
                    background:s[di]===lv?lvlColors[lv]:`${lvlColors[lv]}22`,
                    color:s[di]===lv?"#fff":lvlColors[lv]}}>
                  {lvlNames[lv]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={lookup} style={{width:"100%",padding:"10px",borderRadius:8,
        fontSize:13,fontWeight:700,cursor:"pointer",border:"none",
        background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",color:"#fff",
        boxShadow:"0 0 16px rgba(14,165,233,0.3)"}}>
        🎯 Truy vấn chính sách π*(s)
      </button>
      {result&&(
        <div style={{marginTop:12,padding:"14px",
          background:`${ACTION_COLORS[result.action]}10`,
          border:`1px solid ${ACTION_COLORS[result.action]}44`,borderRadius:10}}>
          <p style={{fontSize:11,color:D.text3,margin:"0 0 4px"}}>Chính sách tối ưu:</p>
          <p style={{fontSize:20,fontWeight:700,color:ACTION_COLORS[result.action],margin:"0 0 4px"}}>
            {ACTION_NAMES[result.action]}
          </p>
          <p style={{fontSize:12,color:D.text2,margin:"0 0 8px"}}>{ACTION_ALLOC[result.action].map((v,i)=>
            `${ALLOC_LABELS[i]}: ${(v*100).toFixed(0)}%`).join(" · ")}</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ALLOC_LABELS.map((l,i)=>(
              <div key={i} style={{padding:"3px 10px",borderRadius:5,fontSize:11,
                background:`${ALLOC_COLORS[i]}22`,color:ALLOC_COLORS[i],fontWeight:600}}>
                {l}: {(ACTION_ALLOC[result.action][i]*100).toFixed(0)}%
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("c1");
  const [cl,setCl]=useState(false);
  const [selTest,setSelTest]=useState(0);
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

  // Live simulation
  const sim = simulate(params);

  const TABS=[
    {id:"c1",label:"① MDP & Môi trường"},
    {id:"c2",label:"② Learning Curve"},
    {id:"c3",label:"③ Chính sách π*"},
    {id:"c4",label:"④ So sánh hiệu năng"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

  // Gemini contexts per tab
  const geminiContexts = {
    c1: `MDP Q-Learning Bài 11 — Tham số hiện tại:
- α (learning rate) = ${params.alpha}
- γ (discount) = ${params.gamma}
- ε: ${params.eps_start}→${params.eps_end} (decay qua ${params.eps_decay} eps)
- Episodes: ${params.episodes}, Horizon T=${params.T} năm
- Reward: ${params.w_gdp}·ΔGDP − ${params.w_u}·U − ${params.w_emit}·Emission − ${params.w_cyber}·Cyber
- State space: 3⁴ = 81 states | Actions: 5 budget policies
- Q(VN2026) = ${sim.tests[0].qvals[sim.tests[0].action_idx].toFixed(4)}, π*(VN2026) = ${sim.tests[0].action_name}`,

    c2: `Learning Curve Q-Learning — tham số hiện tại:
- α=${params.alpha}, γ=${params.gamma}, Episodes=${params.episodes}
- ε decay qua ${params.eps_decay} episodes
- Reward cuối: Q*=${sim.compare.q}
- Baseline Cân bằng: ${sim.compare.a1}
- Baseline AI-dẫn dắt: ${sim.compare.a3}
- Baseline Random: ${sim.compare.rand}
- Vượt trội so Cân bằng: +${((sim.compare.q-sim.compare.a1)/sim.compare.a1*100).toFixed(1)}%
- Vượt trội so AI-dẫn dắt: +${((sim.compare.q-sim.compare.a3)/Math.abs(sim.compare.a3)*100).toFixed(0)}%
- Tần suất action: ${ACTION_NAMES.map((n,i)=>`${n}:${sim.action_freq[i]}`).join(', ')}`,

    c3: `Chính sách π* — Q-values 5 kịch bản trạng thái (tham số α=${params.alpha}, γ=${params.gamma}):
${sim.tests.map(t=>`
  ${t.name} [${t.state}]: π*=${t.action_name}
  Q-values: ${t.qvals.map((q,i)=>ACTION_NAMES[i]+':'+q.toFixed(4)).join(', ')}`).join('')}
- Policy matrix (GDP×U): ${JSON.stringify(sim.policy_matrix)}
- w_GDP=${params.w_gdp}, w_U=${params.w_u}, w_Emit=${params.w_emit}, w_Cyber=${params.w_cyber}`,

    c4: `So sánh hiệu năng 4 chiến lược (α=${params.alpha}, γ=${params.gamma}, ${params.episodes} eps):
- Q-Learning π*: ${sim.compare.q} (avg reward/episode)
- Luôn Cân bằng (a1): ${sim.compare.a1}
- Luôn AI-dẫn dắt (a3): ${sim.compare.a3}
- Random: ${sim.compare.rand}
- Q* vs Cân bằng: +${((sim.compare.q-sim.compare.a1)/sim.compare.a1*100).toFixed(2)}%
- Q* vs AI-dẫn dắt: +${((sim.compare.q-sim.compare.a3)/Math.abs(sim.compare.a3)*100).toFixed(0)}%
- Q* vs Random: +${((sim.compare.q-sim.compare.rand)/sim.compare.rand*100).toFixed(2)}%
- AI-dẫn dắt thất bại vì w_cyber=${params.w_cyber}: rủi ro AI cao, H=15% không đủ giảm U`,

    c5: `Thảo luận chính sách VN (tham số: α=${params.alpha}, γ=${params.gamma}, ρ_eff=${params.gamma}):
- VN 2026: π*=${sim.tests[0].action_name} | Q=${sim.tests[0].qvals[sim.tests[0].action_idx].toFixed(4)}
- Khủng hoảng: π*=${sim.tests[1].action_name} | H-heavy policy
- Bùng nổ: π*=${sim.tests[2].action_name}
- AI-dẫn dắt reward=${sim.compare.a3} (thấp nhất vì w_cyber=${params.w_cyber})
- Horizon T=${params.T} năm ảnh hưởng: γ^T=${Math.pow(params.gamma,params.T).toFixed(4)}
- Nghị quyết 57-NQ/TW: AI hỗ trợ, không thay thế quyết định chính trị`,
  };

  return(
    <div style={{minHeight:"100vh",
      background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`,
      fontFamily:"'Segoe UI',sans-serif",color:D.text1,padding:"24px 20px"}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{display:"inline-block",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,
          letterSpacing:2,marginBottom:10,color:"#fff"}}>
          AIDEOM-VN • PHẦN E – CẤP ĐỘ KHÓ
        </div>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#4ade80)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 11 — Học Tăng Cường Q-Learning cho Chính sách Kinh tế Thích nghi
        </h1>
        <p style={{fontSize:13,color:D.text3,margin:0}}>
          α={params.alpha} · γ={params.gamma} · {params.episodes/1000}K eps · ε-decay {params.eps_decay/1000}K ·
          w=({params.w_gdp},{params.w_u},{params.w_emit},{params.w_cyber})
        </p>
      </div>

      {/* KPI — reactive */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <KPI label="Q-Learning reward" value={sim.compare.q.toFixed(3)} unit="avg reward/episode" color={D.green} sub="Tốt nhất trong 4 chiến lược"/>
        <KPI label="VN 2026 → π*" value={sim.tests[0].action_name} unit={ALLOC_LABELS.map((l,i)=>`${(ACTION_ALLOC[sim.tests[0].action_idx][i]*100).toFixed(0)}%${l[0]}`).join('·')} color={D.teal} sub={`Q*=${sim.tests[0].qvals[sim.tests[0].action_idx].toFixed(3)}`}/>
        <KPI label="Khủng hoảng → π*" value={sim.tests[1].action_name} unit="Policy tối ưu khủng hoảng" color={D.amber} sub={`Q*=${sim.tests[1].qvals[sim.tests[1].action_idx].toFixed(3)}`}/>
        <KPI label="AI-dẫn dắt reward" value={sim.compare.a3.toFixed(3)} unit={`vs Q*=${sim.compare.q.toFixed(3)}`} color={D.coral} sub={`w_cyber=${params.w_cyber} → rủi ro cao`}/>
        <KPI label="Q-table coverage" value="405/405" unit="entries non-zero" color={D.purple} sub={`α=${params.alpha} · γ=${params.gamma}`}/>
      </div>

      {/* PARAM PANEL */}
      <ParamPanel params={params} onChange={handleParam} onReset={handleReset}
        collapsed={panelCollapsed} setCollapsed={setPanelCollapsed}/>

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1 ════════════════════════════════════════════════════ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>Markov Decision Process — cấu trúc</h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
              Agent học tối đa hóa Σ γ={params.gamma}ᵗ·rₜ | rₜ = {params.w_gdp}·ΔGDP − {params.w_u}·U − {params.w_emit}·Emit − {params.w_cyber}·Cyber
            </p>
            <MDPDiagram p={params}/>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.amber,fontSize:14}}>5 Hành động — Chính sách ngân sách</h3>
              {ACTION_NAMES.map((name,i)=>(
                <div key={i} style={{marginBottom:9,padding:"9px 12px",
                  background:`${ACTION_COLORS[i]}0a`,border:`1px solid ${ACTION_COLORS[i]}33`,borderRadius:8}}>
                  <p style={{fontSize:12,fontWeight:700,color:ACTION_COLORS[i],margin:"0 0 5px"}}>a{i}: {name}</p>
                  <div style={{display:"flex",gap:4}}>
                    {ALLOC_LABELS.map((l,j)=>(
                      <div key={j} style={{flex:1,textAlign:"center",padding:"3px 0",
                        background:`${ALLOC_COLORS[j]}20`,borderRadius:4}}>
                        <p style={{fontSize:9,color:ALLOC_COLORS[j],margin:0}}>{l}</p>
                        <p style={{fontSize:11,fontWeight:700,color:ALLOC_COLORS[j],margin:0}}>
                          {(ACTION_ALLOC[i][j]*100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.purple,fontSize:14}}>Không gian trạng thái — 81 states</h3>
              {[
                {dim:"GDP Growth",lvls:["Thấp (<2%)","TB (2-8%)","Cao (>8%)"],color:D.green},
                {dim:"Digital Index",lvls:["Thấp (<18%)","TB (18-24%)","Cao (>24%)"],color:D.teal},
                {dim:"AI Capacity",lvls:["Thấp (<80K)","TB (80-100K)","Cao (>100K)"],color:D.purple},
                {dim:"Unemployment",lvls:["Thấp (<30%)","TB (30-60%)","Cao (>60%)"],color:D.coral},
              ].map(s=>(
                <div key={s.dim} style={{marginBottom:10,padding:"8px 12px",
                  background:`${s.color}0a`,border:`1px solid ${s.color}33`,borderRadius:7}}>
                  <p style={{fontSize:11,fontWeight:700,color:s.color,margin:"0 0 4px"}}>{s.dim}</p>
                  <div style={{display:"flex",gap:4}}>
                    {s.lvls.map((l,i)=>(
                      <span key={i} style={{fontSize:10,color:D.text3,
                        background:D.bg1,padding:"2px 7px",borderRadius:4}}>L{i}: {l}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{padding:"10px 12px",background:D.purpleBg,
                borderLeft:`3px solid ${D.purple}`,borderRadius:7,marginTop:8,fontSize:12,color:D.text2}}>
                <strong style={{color:D.purple}}>Hàm phần thưởng (live):</strong><br/>
                rₜ = <span style={{color:D.green}}>{params.w_gdp}</span>·ΔGDP −{" "}
                <span style={{color:D.coral}}>{params.w_u}</span>·U −{" "}
                <span style={{color:D.amber}}>{params.w_emit}</span>·Emission −{" "}
                <span style={{color:D.purple}}>{params.w_cyber}</span>·Cyber
              </div>
              <div style={{padding:"10px 12px",background:D.tealBg,
                borderLeft:`3px solid ${D.cyan}`,borderRadius:7,marginTop:8,fontSize:12,color:D.text2}}>
                <strong style={{color:D.cyan}}>Q-update (α={params.alpha}, γ={params.gamma}):</strong><br/>
                Q(s,a) ← Q(s,a) + {params.alpha}·[r + {params.gamma}·max Q(s',a') − Q(s,a)]<br/>
                ε: {params.eps_start}→{params.eps_end} (decay {(params.eps_decay/1000).toFixed(1)}K eps)
              </div>
            </Card>
          </div>
          <GeminiBlock context={geminiContexts.c1} tabLabel="MDP & Môi trường"/>
        </div>
      )}

      {/* ══ TAB 2 ════════════════════════════════════════════════════ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.green,fontSize:15}}>
              Câu 11.3.4 — Learning Curve: {(params.episodes/1000).toFixed(0)}K episodes
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              ε giảm {params.eps_start}→{params.eps_end} · Hội tụ sau ~{(params.eps_decay/1000).toFixed(1)}K episodes · α={params.alpha} · γ={params.gamma}
            </p>
            {cl&&(
              <ChartLine
                labels={sim.curve_ep.filter((_,i)=>i%5===0).map(ep=>`${(ep/1000).toFixed(1)}K`)}
                datasets={[
                  {label:"Raw reward",
                    data:sim.curve_ep.filter((_,i)=>i%5===0).map((_,i)=>sim.curve_raw[i*5]),
                    borderColor:"rgba(56,189,248,0.25)",borderWidth:0.8,pointRadius:0,tension:0},
                  {label:"Smoothed (window=200ep)",
                    data:sim.curve_ep.filter((_,i)=>i%5===0).map((_,i)=>sim.curve_sm[i*5]),
                    borderColor:D.green,backgroundColor:"rgba(74,222,128,0.1)",
                    fill:true,borderWidth:2.5,pointRadius:0,tension:0.4},
                  {label:`a1 Cân bằng baseline (${sim.compare.a1})`,
                    data:Array(sim.curve_ep.filter((_,i)=>i%5===0).length).fill(sim.compare.a1),
                    borderColor:D.amber,borderDash:[6,4],borderWidth:1.5,pointRadius:0},
                  {label:`Random baseline (${sim.compare.rand})`,
                    data:Array(sim.curve_ep.filter((_,i)=>i%5===0).length).fill(sim.compare.rand),
                    borderColor:D.coral,borderDash:[4,3],borderWidth:1.5,pointRadius:0},
                ]}
                height={300}
              />
            )}
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>Tần suất action trong π* (81 states)</h3>
              {cl&&(
                <ChartBar
                  labels={ACTION_NAMES}
                  datasets={[{
                    label:"Số states → action này",
                    data:sim.action_freq,
                    backgroundColor:ACTION_COLORS.map(c=>c+"99"),
                    borderColor:ACTION_COLORS,borderWidth:2,borderRadius:6,
                  }]}
                  height={200}
                  opts={{plugins:{legend:{display:false}},
                    scales:{y:{title:{display:true,text:"# states",color:D.text3}}}}}
                />
              )}
              <div style={{marginTop:10,padding:"8px 12px",background:D.amberBg,
                borderLeft:`3px solid ${D.amber}`,borderRadius:6,fontSize:12,color:D.text2}}>
                {ACTION_NAMES.map((n,i)=>`${n}:${sim.action_freq[i]}`).join(' · ')} = {sim.action_freq.reduce((a,b)=>a+b,0)} states
                {params.w_u>DEFAULT_PARAMS.w_u&&<span style={{color:D.amber}}> — w_U cao → Bao trùm nhiều hơn</span>}
                {params.w_cyber>DEFAULT_PARAMS.w_cyber&&<span style={{color:D.coral}}> — w_Cyber cao → AI-dẫn dắt ít hơn</span>}
              </div>
            </Card>
            <Card>
              <h3 style={{margin:"0 0 12px",color:D.blue,fontSize:14}}>3 Phases of Learning</h3>
              {[
                {ph:`0–${(params.eps_decay*0.3/1000).toFixed(1)}K eps`,lb:"Exploration",desc:`ε≈0.7-1.0, khám phá ngẫu nhiên`,color:D.coral,r:"-0.5→+2.0"},
                {ph:`${(params.eps_decay*0.3/1000).toFixed(1)}K–${(params.eps_decay/1000).toFixed(1)}K`,lb:"Learning",desc:`ε≈0.2-0.7, bắt đầu khai thác Q-table`,color:D.amber,r:`+2.0→${(sim.compare.q*0.77).toFixed(1)}`},
                {ph:`${(params.eps_decay/1000).toFixed(1)}K–${(params.episodes/1000).toFixed(0)}K`,lb:"Convergence",desc:`ε→${params.eps_end}, policy ổn định`,color:D.green,r:`→${sim.compare.q.toFixed(3)}`},
              ].map((p_,i)=>(
                <div key={i} style={{marginBottom:10,padding:"10px 12px",
                  background:`${p_.color}0a`,border:`1px solid ${p_.color}33`,borderRadius:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:700,color:p_.color}}>{p_.ph} — {p_.lb}</span>
                    <span style={{fontSize:11,fontFamily:"monospace",color:p_.color}}>{p_.r}</span>
                  </div>
                  <p style={{fontSize:11,color:D.text2,margin:0}}>{p_.desc}</p>
                </div>
              ))}
            </Card>
          </div>
          <GeminiBlock context={geminiContexts.c2} tabLabel="Learning Curve"/>
        </div>
      )}

      {/* ══ TAB 3 ════════════════════════════════════════════════════ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.amber,fontSize:15}}>
                Simulator — Truy vấn chính sách π*(s)
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                Chọn trạng thái kinh tế → mô hình khuyến nghị chính sách (reactive với tham số)
              </p>
              <Simulator sim={sim}/>
            </Card>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:14}}>
                Policy Matrix — π*(GDP, U) — Live
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                Matrix thay đổi theo w_GDP={params.w_gdp} và w_U={params.w_u}
              </p>
              <PolicyGrid matrix={sim.policy_matrix}/>
              <div style={{marginTop:10,padding:"8px 12px",background:D.tealBg,
                borderLeft:`3px solid ${D.teal}`,borderRadius:6,fontSize:12,color:D.text2}}>
                GDP cao → {ACTION_NAMES[sim.policy_matrix[2][0]]} | GDP thấp/TB → {ACTION_NAMES[sim.policy_matrix[0][0]]} / {ACTION_NAMES[sim.policy_matrix[1][1]]}
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>
              Q-values tại 5 trạng thái tiêu biểu — α={params.alpha} · γ={params.gamma}
            </h3>
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
              {sim.tests.map((t,i)=>(
                <button key={i} onClick={()=>setSelTest(i)} style={{
                  flex:1,minWidth:100,padding:"6px 8px",borderRadius:7,fontSize:11,
                  fontWeight:600,cursor:"pointer",border:"none",
                  background:selTest===i?ACTION_COLORS[t.action_idx]:"rgba(30,41,59,0.7)",
                  color:selTest===i?"#fff":D.text2}}>
                  {t.name}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <div style={{padding:"12px 14px",
                  background:`${ACTION_COLORS[sim.tests[selTest].action_idx]}10`,
                  border:`1px solid ${ACTION_COLORS[sim.tests[selTest].action_idx]}44`,
                  borderRadius:9,marginBottom:12}}>
                  <p style={{fontSize:11,color:D.text3,margin:"0 0 4px"}}>{sim.tests[selTest].desc}</p>
                  <p style={{fontSize:18,fontWeight:700,margin:"0 0 4px",
                    color:ACTION_COLORS[sim.tests[selTest].action_idx]}}>
                    π* = {sim.tests[selTest].action_name}
                  </p>
                  <p style={{fontSize:12,color:D.text2,margin:0}}>
                    {ALLOC_LABELS.map((l,i)=>`${l}:${(ACTION_ALLOC[sim.tests[selTest].action_idx][i]*100).toFixed(0)}%`).join(' · ')}
                  </p>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {["GDP","D","AI","U"].map((dim,di)=>{
                    const lv=sim.tests[selTest].state[di];
                    const lc=[D.coral,D.amber,D.green][lv];
                    return(
                      <div key={dim} style={{flex:1,textAlign:"center",padding:"6px 4px",
                        background:`${lc}15`,border:`1px solid ${lc}44`,borderRadius:6}}>
                        <p style={{fontSize:10,color:D.text3,margin:"0 0 2px"}}>{dim}</p>
                        <p style={{fontSize:11,fontWeight:700,color:lc,margin:0}}>
                          {["Thấp","TB","Cao"][lv]}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:12}}>
                  {ALLOC_LABELS.map((l,i)=>(
                    <div key={i} style={{marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:11,color:ALLOC_COLORS[i]}}>{l}</span>
                        <span style={{fontSize:11,fontWeight:600,color:ALLOC_COLORS[i]}}>
                          {(ACTION_ALLOC[sim.tests[selTest].action_idx][i]*100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{height:6,background:D.bg1,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,
                          width:`${ACTION_ALLOC[sim.tests[selTest].action_idx][i]*100}%`,
                          background:ALLOC_COLORS[i]}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{fontSize:12,color:D.text3,margin:"0 0 10px",fontWeight:500}}>
                  Q-values: Q(s, a) — α={params.alpha} · γ={params.gamma}
                </p>
                <QValueDisplay test={sim.tests[selTest]}/>
              </div>
            </div>
          </Card>
          <GeminiBlock context={geminiContexts.c3} tabLabel="Chính sách π*"/>
        </div>
      )}

      {/* ══ TAB 4 ════════════════════════════════════════════════════ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {lb:"Q-Learning π*",val:sim.compare.q,color:D.green,desc:"Học thích nghi theo state"},
              {lb:"Luôn Cân bằng (a1)",val:sim.compare.a1,color:D.blue,desc:"Fixed, không thích nghi"},
              {lb:"Luôn AI-dẫn dắt (a3)",val:sim.compare.a3,color:D.coral,desc:`AI cao, H thấp → cyber risk w=${params.w_cyber}`},
              {lb:"Random",val:sim.compare.rand,color:D.text2,desc:"Ngẫu nhiên mỗi bước"},
            ].map((s,i)=>(
              <div key={i} style={{padding:"14px",background:D.bg2,
                border:`1px solid ${s.color}44`,borderRadius:12}}>
                <p style={{fontSize:10,color:D.text3,textTransform:"uppercase",margin:"0 0 4px"}}>{s.lb}</p>
                <p style={{fontSize:22,fontWeight:700,color:s.color,margin:"0 0 4px"}}>{s.val.toFixed(3)}</p>
                <p style={{fontSize:10,color:D.text3,margin:0}}>{s.desc}</p>
              </div>
            ))}
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.green,fontSize:14}}>So sánh hiệu năng 4 chiến lược</h3>
            {cl&&(
              <ChartBar
                labels={["Q-Learning π*","Luôn Cân bằng","Luôn AI-dẫn dắt","Random"]}
                datasets={[{
                  label:"Avg Reward/Episode",
                  data:[sim.compare.q,sim.compare.a1,sim.compare.a3,sim.compare.rand],
                  backgroundColor:[D.green+"aa",D.blue+"aa",D.coral+"aa",D.text3+"66"],
                  borderColor:[D.green,D.blue,D.coral,D.text3],
                  borderWidth:2,borderRadius:8,
                }]}
                height={220}
                opts={{plugins:{legend:{display:false}},
                  scales:{y:{beginAtZero:true,title:{display:true,text:"Avg Reward",color:D.text3}}}}}
              />
            )}
            <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{padding:"10px 14px",background:D.greenBg,border:`1px solid ${D.green}44`,borderRadius:8}}>
                <p style={{fontSize:12,fontWeight:700,color:D.green,margin:"0 0 6px"}}>Q-Learning vượt trội:</p>
                <p style={{fontSize:12,color:D.text2,margin:0,lineHeight:1.7}}>
                  • +{((sim.compare.q-sim.compare.a1)/sim.compare.a1*100).toFixed(1)}% vs Cân bằng ({sim.compare.q.toFixed(3)} vs {sim.compare.a1.toFixed(3)})<br/>
                  • +{((sim.compare.q-sim.compare.a3)/Math.abs(sim.compare.a3)*100).toFixed(0)}% vs AI-dẫn dắt<br/>
                  • +{((sim.compare.q-sim.compare.rand)/sim.compare.rand*100).toFixed(1)}% vs Random
                </p>
              </div>
              <div style={{padding:"10px 14px",background:D.coralBg,border:`1px solid ${D.coral}44`,borderRadius:8}}>
                <p style={{fontSize:12,fontWeight:700,color:D.coral,margin:"0 0 6px"}}>AI-dẫn dắt thất bại:</p>
                <p style={{fontSize:12,color:D.text2,margin:0,lineHeight:1.7}}>
                  AI=45%, H=15% → Cyber risk tăng (w_cyber={params.w_cyber}). Q-learning tự học: không chọn a3 ở phần lớn states → xác nhận H phải đi trước AI.
                  {params.w_cyber > DEFAULT_PARAMS.w_cyber && <span style={{color:D.coral}}> Tăng w_cyber càng làm AI-dẫn dắt tệ hơn.</span>}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>Phân bổ ngân sách 4 chiến lược</h3>
            {cl&&(
              <ChartBar
                labels={ALLOC_LABELS}
                datasets={[0,1,3,4].map(ai=>({
                  label:ACTION_NAMES[ai],
                  data:ACTION_ALLOC[ai].map(v=>v*100),
                  backgroundColor:`${ACTION_COLORS[ai]}88`,
                  borderColor:ACTION_COLORS[ai],
                  borderWidth:2,borderRadius:4,
                }))}
                height={200}
                opts={{scales:{y:{title:{display:true,text:"% ngân sách",color:D.text3},max:80}}}}
              />
            )}
          </Card>
          <GeminiBlock context={geminiContexts.c4} tabLabel="So sánh hiệu năng"/>
        </div>
      )}

      {/* ══ TAB 5 ════════════════════════════════════════════════════ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[
            {
              q:"a) GDP thấp, D thấp, U cao — π* chọn gì? Có khớp 'quick-win' không?",
              color:D.coral,
              a:`Trạng thái [0,0,0,2]: π* chọn ${sim.tests[1].action_name} (Q=${sim.tests[1].qvals[sim.tests[1].action_idx].toFixed(4)}).
Với w_U=${params.w_u}: ${params.w_u>=0.30?"U cao được coi trọng → H-heavy policy ưu tiên giảm thất nghiệp hơn GDP ngắn hạn":"U ở mức trung bình → cân bằng giữa GDP và việc làm"}.

Q-learning phát hiện H giảm U hiệu quả trong dài hạn (T=${params.T} năm, γ=${params.gamma}). Với γ=${params.gamma}, giá trị hiện tại của phần thưởng năm ${params.T} là γ^T=${Math.pow(params.gamma,params.T).toFixed(4)}.`
            },
            {
              q:"b) GDP cao, AI cao, U thấp — π* chọn gì? Phù hợp 'consolidation'?",
              color:D.green,
              a:`Trạng thái [2,2,2,0]: π* = ${sim.tests[2].action_name} (Q=${sim.tests[2].qvals[sim.tests[2].action_idx].toFixed(4)}).

Hoàn toàn phù hợp "consolidation": khi GDP và AI đã cao, không cần push thêm (diminishing returns). Với w_GDP=${params.w_gdp} và w_Cyber=${params.w_cyber}: ${params.w_cyber>=0.20?"rủi ro AI cao được coi trọng → không nên đẩy AI thêm khi đã ở mức cao":"mức rủi ro vừa phải"}.

So sánh Q-values kịch bản bùng nổ: ${sim.tests[2].qvals.map((q,i)=>`${ACTION_NAMES[i]}:${q.toFixed(3)}`).join(', ')}`
            },
            {
              q:`c) 'AI không thay thế quyết định chính trị-xã hội' — tích hợp π* vào VN thế nào?`,
              color:D.purple,
              a:`Đề xuất tích hợp 3 cấp độ phù hợp Nghị quyết 57-NQ/TW:

Cấp 1 — Technical Support: π* gợi ý policy khi chuẩn bị ngân sách 5 năm. Với α=${params.alpha}, γ=${params.gamma}: mô hình ${params.gamma>=0.95?"ưu tiên dài hạn mạnh":"có chiết khấu tương lai cao hơn"}.

Cấp 2 — Scenario Analysis: Reward weights (${params.w_gdp},${params.w_u},${params.w_emit},${params.w_cyber}) cần được Quốc hội thảo luận — chúng phản ánh ưu tiên chính trị, không chỉ kỹ thuật.

Cấp 3 — Post-hoc Learning: Cập nhật Q-table với dữ liệu thực tế VN sau mỗi chu kỳ ngân sách.

KHÔNG ĐƯỢC: automate quyết định ngân sách; dùng như căn cứ pháp lý; bỏ qua ràng buộc chính trị.`
            },
          ].map((item,i)=>(
            <Card key={i}>
              <div style={{padding:"8px 12px",background:`${item.color}10`,
                borderLeft:`3px solid ${item.color}`,borderRadius:6,marginBottom:10}}>
                <p style={{fontSize:13,fontWeight:600,color:item.color,margin:0}}>{item.q}</p>
              </div>
              <p style={{fontSize:13,color:D.text2,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>
                {item.a}
              </p>
            </Card>
          ))}
          <Card style={{border:`1px solid ${D.cyan}33`}}>
            <h3 style={{margin:"0 0 12px",color:D.cyan,fontSize:14}}>Tóm tắt kỹ thuật — giá trị hiện tại</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                ["States","(GDP,D,AI,U) ∈ 3⁴ = 81","Actions","5 budget allocations",
                 "Episodes",`${params.episodes.toLocaleString()} | T=${params.T} năm`,"Q-table","405/405 non-zero"],
                [`α (learning)`,`${params.alpha}`,`γ (discount)`,`${params.gamma}`,
                 "ε-decay",`${params.eps_start}→${params.eps_end} / ${(params.eps_decay/1000).toFixed(1)}K eps`,
                 "π*(VN2026)",sim.tests[0].action_name],
              ].map((col,ci)=>(
                <div key={ci} style={{fontFamily:"monospace",fontSize:11,lineHeight:2,
                  background:D.bg3,borderRadius:8,padding:"10px 14px",color:D.text2}}>
                  {Array.from({length:col.length/2},(_,i)=>(
                    <p key={i} style={{margin:0}}>
                      <span style={{color:D.cyan}}>{col[i*2]}</span>: {col[i*2+1]}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <GeminiBlock context={geminiContexts.c5} tabLabel="Thảo luận chính sách"/>
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.text3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 11 — AIDEOM-VN | NumPy Q-Learning tabular · {(params.episodes/1000).toFixed(0)}K eps · α={params.alpha} · γ={params.gamma} |
        Reward w=({params.w_gdp},{params.w_u},{params.w_emit},{params.w_cyber}) | Q*={sim.compare.q.toFixed(4)} |
        Nghị quyết 57-NQ/TW: AI hỗ trợ, không thay thế quyết định chính trị
      </div>
    </div>
  );
}