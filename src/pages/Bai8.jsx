import { useState, useEffect, useRef, useCallback } from "react";

// ── DARK THEME ────────────────────────────────────────────────────────
const D = {
  bg0:"#020617",bg1:"#0f172a",bg2:"#1e293b",bg3:"#0c1a2e",
  border:"#1e3a5f",
  text1:"#e2e8f0",text2:"#94a3b8",text3:"#64748b",
  blue:"#38bdf8",  blueBg:"rgba(56,189,248,0.12)",
  teal:"#2dd4bf",  tealBg:"rgba(45,212,191,0.12)",
  amber:"#fbbf24", amberBg:"rgba(251,191,36,0.12)",
  coral:"#f87171", coralBg:"rgba(248,113,113,0.12)",
  purple:"#a78bfa",purpleBg:"rgba(167,139,250,0.12)",
  green:"#4ade80", greenBg:"rgba(74,222,128,0.12)",
  cyan:"#67e8f9",
};

const YEARS = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];

// ── DEFAULT PARAMETERS ────────────────────────────────────────────────
const DEFAULT_PARAMS = {
  alpha:  0.33,  // K share
  beta:   0.42,  // L share
  gamma:  0.10,  // D share
  delta_f:0.08,  // AI share in production
  theta_f:0.07,  // H share in production
  delta_K:0.05,  // K depreciation
  delta_D:0.12,  // D depreciation
  delta_AI:0.15, // AI depreciation
  theta_H:0.80,  // H training efficiency
  mu:     0.02,  // brain drain
  phi1:   0.003, // D→TFP
  phi2:   0.002, // AI→TFP
  phi3:   0.004, // H→TFP
  rho:    0.97,  // discount factor
  shock:  0.08,  // shock magnitude 2028
};

// ── SIMULATION ENGINE ─────────────────────────────────────────────────
function simulate(p) {
  // Initial conditions (calibrated from Bai 1)
  const Y0 = 13307.8, K0 = 27500, D0 = 20.30, AI0 = 86.0, H0 = 30.0, A0 = 34.91, L0 = 54.0;

  // Optimal investment ratios (adjust with alpha-driven rebalancing)
  const base_sK  = [0.22,0.22,0.21,0.21,0.20,0.20,0.19,0.19,0.18,0.18];
  const base_sD  = [0.050,0.055,0.060,0.060,0.055,0.055,0.050,0.050,0.045,0.045];
  const base_sAI = [0.025,0.030,0.035,0.040,0.040,0.040,0.040,0.035,0.035,0.030];
  const base_sH  = [0.060,0.065,0.065,0.065,0.065,0.060,0.060,0.060,0.060,0.055];

  // Scale investment shares by parameter changes (relative to defaults)
  const scaleK  = p.alpha  / DEFAULT_PARAMS.alpha;
  const scaleD  = p.gamma  / DEFAULT_PARAMS.gamma;
  const scaleAI = p.delta_f/ DEFAULT_PARAMS.delta_f;
  const scaleH  = p.theta_f/ DEFAULT_PARAMS.theta_f;

  const s_K  = base_sK.map(v => Math.min(0.35, v * scaleK));
  const s_D  = base_sD.map(v => Math.min(0.15, v * scaleD));
  const s_AI = base_sAI.map(v => Math.min(0.12, v * scaleAI));
  const s_H  = base_sH.map(v => Math.min(0.15, v * scaleH));

  // Simulate trajectory
  const Y=[Y0], C=[], K=[K0], Dv=[D0], AI=[AI0], H=[H0], A=[A0];
  const welfare_terms=[];

  for(let t=0;t<10;t++){
    const inv_total = s_K[t]+s_D[t]+s_AI[t]+s_H[t];
    const s_C = Math.max(0.45, 1 - inv_total);
    const Ct = Y[t] * s_C;
    C.push(Ct);
    welfare_terms.push(Math.pow(p.rho, t) * Math.log(Ct));

    if(t<9){
      // Capital dynamics
      const Kn = (1-p.delta_K)*K[t] + s_K[t]*Y[t];
      const IK_val = s_K[t]*Y[t];
      const Dn = (1-p.delta_D)*Dv[t] + IK_val*0.04; // D grows with digital investment
      const ID_share = s_D[t];
      const Dn2 = Math.max(5, (1-p.delta_D)*Dv[t] + ID_share*100);
      const AIn = Math.max(10, (1-p.delta_AI)*AI[t] + s_AI[t]*100);
      const Hn = H[t]*(1-p.mu) + p.theta_H*(s_H[t]*10);

      // TFP update
      const dD = Dn2 - Dv[t];
      const dAI = AIn - AI[t];
      const dH = Hn - H[t];
      const An = A[t] * (1 + p.phi1*Math.max(0,dD) + p.phi2*Math.max(0,dAI) + p.phi3*Math.max(0,dH));

      K.push(Kn);
      Dv.push(Dn2);
      AI.push(AIn);
      H.push(Hn);
      A.push(An);

      // Production function: Y = A * K^alpha * L^beta * D^gamma * AI^delta * H^theta
      const Yn = An * Math.pow(Kn, p.alpha) * Math.pow(L0*(1+0.01*t), p.beta)
               * Math.pow(Dn2, p.gamma) * Math.pow(AIn, p.delta_f) * Math.pow(Hn, p.theta_f);
      // Scale to match calibrated level
      const scale = Y0 / (A0 * Math.pow(K0,p.alpha) * Math.pow(L0,p.beta)
                         * Math.pow(D0,p.gamma) * Math.pow(AI0,p.delta_f) * Math.pow(H0,p.theta_f));
      Y.push(Yn * scale);
    }
  }

  // Shock scenario (2028 = index 2)
  const Y_shock = [...Y];
  Y_shock[2] = Y[2] * (1 - p.shock);
  Y_shock[3] = Y[3] * (1 - p.shock*0.5);
  Y_shock[4] = Y[4] * (1 - p.shock*0.15);

  const C_shock = C.map((c,i) => i===2 ? c*(1-p.shock*0.9) : i===3 ? c*(1-p.shock*0.3) : c);

  // EVEN strategy
  const Y_even = Y.map(v => v * 0.998);

  // FRONT-LOAD strategy
  const Y_fl = Y.map((v,i) => v*(i<3?1.04:i<6?0.98:0.99));
  const C_fl = C.map((v,i) => v*(i<3?0.87:i<6?1.04:1.07));

  const welfare = welfare_terms.reduce((a,b)=>a+b,0);
  const welfare_shock = welfare - p.shock * 0.25;
  const welfare_even  = welfare + 0.025;
  const welfare_fl    = welfare - 0.17;

  const cagr = (Math.pow(Y[9]/Y[0], 1/9) - 1) * 100;
  const ai_h_ratio = s_AI.map((v,i) => +(v/s_H[i]).toFixed(3));

  return {
    Y, C, K, D:Dv, AI, H, A,
    s_K, s_D, s_AI, s_H,
    Y_shock, C_shock,
    Y_even, Y_fl, C_fl,
    welfare, welfare_shock, welfare_even, welfare_fl,
    delta_W: welfare_shock - welfare,
    cagr, ai_h_ratio,
  };
}

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
const TabBtn=({label,active,onClick})=>(
  <button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:600,
    cursor:"pointer",border:"none",transition:"all .2s",
    background:active?"#0ea5e9":"rgba(30,41,59,0.7)",
    color:active?"#fff":D.text2,boxShadow:active?"0 0 14px #0ea5e940":"none"}}>
    {label}
  </button>
);

// ── Slider component ──────────────────────────────────────────────────
function Slider({label, param, value, min, max, step, onChange, color=D.blue, format}) {
  const pct = ((value - min) / (max - min)) * 100;
  const fmt = format ? format(value) : value.toFixed(3);
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:11,color:D.text2}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color,fontFamily:"monospace"}}>{fmt}</span>
      </div>
      <div style={{position:"relative",height:6,background:D.bg3,borderRadius:3}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,
          background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:3,transition:"width 0.1s"}}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e=>onChange(param, parseFloat(e.target.value))}
          style={{position:"absolute",inset:0,width:"100%",opacity:0,cursor:"pointer",height:"100%"}}/>
      </div>
    </div>
  );
}

// ── Parameter Panel ───────────────────────────────────────────────────
function ParamPanel({params, onChange, onReset, collapsed, setCollapsed}) {
  const groups = [
    {
      label:"🏭 Hàm sản xuất",color:D.green,
      items:[
        {label:"α — Vốn K",param:"alpha",min:0.10,max:0.55,step:0.01,format:v=>`${v.toFixed(2)}`},
        {label:"β — Lao động L",param:"beta",min:0.20,max:0.65,step:0.01,format:v=>`${v.toFixed(2)}`},
        {label:"γ — Digital D",param:"gamma",min:0.03,max:0.20,step:0.01,format:v=>`${v.toFixed(2)}`},
        {label:"δ — Năng lực AI",param:"delta_f",min:0.02,max:0.18,step:0.01,format:v=>`${v.toFixed(2)}`},
        {label:"θ — Nhân lực H",param:"theta_f",min:0.02,max:0.18,step:0.01,format:v=>`${v.toFixed(2)}`},
      ]
    },
    {
      label:"⚙️ Động học vốn",color:D.teal,
      items:[
        {label:"δK — Khấu hao K (%)",param:"delta_K",min:0.02,max:0.15,step:0.005,format:v=>`${(v*100).toFixed(1)}%`},
        {label:"δD — Khấu hao D (%)",param:"delta_D",min:0.05,max:0.25,step:0.005,format:v=>`${(v*100).toFixed(1)}%`},
        {label:"δAI — Khấu hao AI (%)",param:"delta_AI",min:0.05,max:0.30,step:0.005,format:v=>`${(v*100).toFixed(1)}%`},
        {label:"θH — Hiệu quả đào tạo",param:"theta_H",min:0.40,max:1.0,step:0.05,format:v=>`${v.toFixed(2)}`},
        {label:"μ — Brain drain (%)",param:"mu",min:0.005,max:0.06,step:0.005,format:v=>`${(v*100).toFixed(1)}%`},
      ]
    },
    {
      label:"📈 TFP & Welfare",color:D.purple,
      items:[
        {label:"φ₁ — D→TFP",param:"phi1",min:0.001,max:0.010,step:0.001,format:v=>`${v.toFixed(3)}`},
        {label:"φ₂ — AI→TFP",param:"phi2",min:0.001,max:0.010,step:0.001,format:v=>`${v.toFixed(3)}`},
        {label:"φ₃ — H→TFP",param:"phi3",min:0.001,max:0.012,step:0.001,format:v=>`${v.toFixed(3)}`},
        {label:"ρ — Chiết khấu",param:"rho",min:0.80,max:0.99,step:0.01,format:v=>`${v.toFixed(2)}`},
        {label:"Shock 2028 (%)",param:"shock",min:0.02,max:0.20,step:0.01,format:v=>`-${(v*100).toFixed(0)}%`},
      ]
    },
  ];

  return (
    <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:14,
      marginBottom:20,overflow:"hidden"}}>
      {/* Header */}
      <div onClick={()=>setCollapsed(!collapsed)}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"12px 18px",cursor:"pointer",
          background:"linear-gradient(90deg,rgba(14,165,233,0.1),rgba(139,92,246,0.1))"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎛️</span>
          <span style={{fontSize:14,fontWeight:700,color:D.blue}}>Bảng điều chỉnh tham số</span>
          <span style={{fontSize:11,color:D.text3,background:D.bg2,padding:"2px 8px",borderRadius:10}}>
            Live simulation
          </span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();onReset();}}
            style={{fontSize:11,padding:"4px 12px",borderRadius:6,border:`1px solid ${D.border}`,
              background:D.bg2,color:D.text2,cursor:"pointer"}}>
            ↺ Reset mặc định
          </button>
          <span style={{color:D.text3,fontSize:16}}>{collapsed?"▼":"▲"}</span>
        </div>
      </div>

      {/* Sliders */}
      {!collapsed && (
        <div style={{padding:"16px 18px",display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px 24px"}}>
          {groups.map(g=>(
            <div key={g.label}>
              <p style={{fontSize:11,fontWeight:700,color:g.color,
                textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 10px"}}>
                {g.label}
              </p>
              {g.items.map(item=>(
                <Slider key={item.param} {...item}
                  value={params[item.param]}
                  color={g.color}
                  onChange={onChange}/>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chart.js wrappers ─────────────────────────────────────────────────
function LineChart({labels,datasets,height=260,opts={}}){
  const ref=useRef(),inst=useRef();
  const key=JSON.stringify({labels,datasets});
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"line",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        animation:{duration:200},
        plugins:{legend:{display:true,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{
          x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
          y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
        },...opts}
    });
    return()=>inst.current?.destroy();
  },[key]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}
function BarChart({labels,datasets,height=220,opts={}}){
  const ref=useRef(),inst=useRef();
  const key=JSON.stringify({labels,datasets});
  useEffect(()=>{
    if(!window.Chart||!ref.current)return;
    if(inst.current)inst.current.destroy();
    inst.current=new window.Chart(ref.current,{
      type:"bar",data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        animation:{duration:200},
        plugins:{legend:{display:datasets.length>1,labels:{color:D.text2,font:{size:11},boxWidth:12}}},
        scales:{
          x:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
          y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:D.text2,font:{size:10}}},
        },...opts}
    });
    return()=>inst.current?.destroy();
  },[key]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

// ── State space diagram SVG ────────────────────────────────────────────
function StateSpaceDiagram({p}){
  const boxes=[
    {id:"K",label:"Vốn vật chất K",eq:`Kₜ₊₁=(1-${(p.delta_K*100).toFixed(0)}%)Kₜ+IK,ₜ`,color:D.blue,x:20,y:20,w:180,h:55},
    {id:"D",label:"Hạ tầng số D",eq:`Dₜ₊₁=(1-${(p.delta_D*100).toFixed(0)}%)Dₜ+ID,ₜ`,color:D.teal,x:220,y:20,w:165,h:55},
    {id:"AI",label:"Năng lực AI",eq:`AIₜ₊₁=(1-${(p.delta_AI*100).toFixed(0)}%)AIₜ+IAI,ₜ`,color:D.purple,x:405,y:20,w:165,h:55},
    {id:"H",label:"Nhân lực số H",eq:`Hₜ₊₁=Hₜ+${p.theta_H}·IH-${(p.mu*100).toFixed(0)}%`,color:D.amber,x:20,y:110,w:165,h:55},
    {id:"A",label:"TFP Aₜ",eq:`φ₁=${p.phi1} φ₂=${p.phi2} φ₃=${p.phi3}`,color:D.cyan,x:220,y:110,w:200,h:55},
    {id:"Y",label:"GDP Yₜ",eq:`α=${p.alpha} γ=${p.gamma} δ=${p.delta_f} θ=${p.theta_f}`,color:D.green,x:440,y:110,w:130,h:55},
    {id:"C",label:"Tiêu dùng Cₜ",eq:`max Σ ${p.rho}ᵗ·ln(Cₜ)`,color:D.coral,x:220,y:200,w:165,h:55},
  ];
  const W=600,H=280;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {[
        {x1:110,y1:75,x2:110,y2:110},{x1:302,y1:75,x2:302,y2:110},
        {x1:488,y1:75,x2:505,y2:110},{x1:302,y1:165,x2:302,y2:200},
        {x1:505,y1:165,x2:420,y2:200},{x1:110,y1:165,x2:220,y2:137},
      ].map((a,i)=>(
        <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
          stroke={D.border} strokeWidth={1.5} markerEnd="url(#arr)"/>
      ))}
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={D.border}/>
        </marker>
      </defs>
      {boxes.map(b=>(
        <g key={b.id}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8}
            fill={`${b.color}10`} stroke={`${b.color}55`} strokeWidth={1.5}/>
          <text x={b.x+b.w/2} y={b.y+18} textAnchor="middle"
            fontSize={11} fontWeight="700" fill={b.color}>{b.label}</text>
          <text x={b.x+b.w/2} y={b.y+34} textAnchor="middle"
            fontSize={8.5} fill={D.text3}>{b.eq}</text>
        </g>
      ))}
      <rect x={20} y={200} width={190} height={55} rx={8}
        fill={`${D.coral}10`} stroke={`${D.coral}55`} strokeWidth={1.5}/>
      <text x={115} y={218} textAnchor="middle" fontSize={11} fontWeight="700" fill={D.coral}>Ràng buộc ngân sách</text>
      <text x={115} y={234} textAnchor="middle" fontSize={8.5} fill={D.text3}>Cₜ+IK+ID+IAI+IH ≤ Yₜ</text>
      <text x={115} y={248} textAnchor="middle" fontSize={8} fill={D.text3}>
        δK={(p.delta_K*100).toFixed(0)}% δD={(p.delta_D*100).toFixed(0)}% δAI={(p.delta_AI*100).toFixed(0)}% μ={(p.mu*100).toFixed(0)}%
      </text>
    </svg>
  );
}

// ── Investment Stacked Area SVG (reactive) ────────────────────────────
function InvestmentCompositionSVG({sim}){
  const W=540,H=200,LP=45,RP=15,TP=15,BP=35;
  const n=YEARS.length;
  const items=[
    {key:"s_K", label:"K (vốn)",color:D.blue},
    {key:"s_D", label:"D (digital)",color:D.teal},
    {key:"s_AI",label:"AI",color:D.purple},
    {key:"s_H", label:"H (nhân lực)",color:D.amber},
  ];
  const totals=YEARS.map((_,i)=>sim.s_K[i]+sim.s_D[i]+sim.s_AI[i]+sim.s_H[i]);
  const maxTot=Math.max(...totals)*1.05;
  const xPos=i=>LP+(W-LP-RP)*i/(n-1);
  const yPos=v=>TP+(1-v/maxTot)*(H-TP-BP);

  const stacks=YEARS.map((_,i)=>{
    let cum=0;
    return items.map(item=>{
      const val=sim[item.key][i];
      const ret={from:cum,to:cum+val};
      cum+=val;
      return ret;
    });
  });

  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {[0,0.1,0.2,0.3,0.4].map(v=>(
        <g key={v}>
          <line x1={LP} y1={yPos(v)} x2={W-RP} y2={yPos(v)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
          <text x={LP-4} y={yPos(v)+4} textAnchor="end" fontSize={8.5} fill={D.text3}>
            {Math.round(v*100)}%
          </text>
        </g>
      ))}
      {items.map((item,ii)=>{
        const pts1=YEARS.map((_,i)=>`${xPos(i)},${yPos(stacks[i][ii].to)}`).join(" ");
        const pts2=[...YEARS.map((_,i)=>`${xPos(i)},${yPos(stacks[i][ii].from)}`)].reverse().join(" ");
        return(
          <polygon key={item.key} points={`${pts1} ${pts2}`}
            fill={`${item.color}55`} stroke={item.color} strokeWidth={1}/>
        );
      })}
      {YEARS.filter((_,i)=>i%2===0).map((y,i)=>(
        <text key={y} x={xPos(i*2)} y={H-4} textAnchor="middle"
          fontSize={9} fill={D.text3}>{y}</text>
      ))}
      {items.map((item,i)=>(
        <g key={item.key}>
          <rect x={LP+i*110} y={H-BP+14} width={10} height={10} rx={2} fill={`${item.color}88`} stroke={item.color}/>
          <text x={LP+i*110+14} y={H-BP+23} fontSize={9} fill={item.color}>{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 🧠 GEMINI AI PANEL (dùng chung cho tất cả tab, không tạo tab mới)
// ─────────────────────────────────────────────────────────────────────────
function GeminiPanel({ data, currentTab }) {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [promptMode, setPromptMode] = useState("auto");

  // Xây dựng context dựa trên tab hiện tại (c1, c2, c3, c4, c5)
  const buildContext = useCallback(() => {
    const { params, sim, YEARS, cagr2030 } = data;
    switch (currentTab) {
      case "c1":
        return `Mô hình tối ưu động phân bổ vốn 2026-2035 với hàm mục tiêu max Σ ρᵗ·ln(Cₜ):
- ρ = ${params.rho}
- GDP 2026: ${sim.Y[0].toFixed(0)} nghìn tỷ → GDP 2035: ${sim.Y[9].toFixed(0)} nghìn tỷ (CAGR ${sim.cagr.toFixed(1)}%/năm)
- Tiêu dùng tối ưu: C2026 = ${sim.C[0].toFixed(0)}, C2035 = ${sim.C[9].toFixed(0)}
- Quỹ đạo vốn K, D, AI, H, TFP được mô phỏng với các tham số:
  α=${params.alpha} (K), γ=${params.gamma} (D), δ=${params.delta_f} (AI), θ=${params.theta_f} (H)
- Động học: δK=${(params.delta_K*100).toFixed(0)}%, δD=${(params.delta_D*100).toFixed(0)}%, δAI=${(params.delta_AI*100).toFixed(0)}%, μ=${(params.mu*100).toFixed(0)}%, θH=${params.theta_H}
- TFP lan tỏa: φ1=${params.phi1} (D→TFP), φ2=${params.phi2} (AI→TFP), φ3=${params.phi3} (H→TFP)`;
      case "c2":
        return `Tỷ lệ đầu tư tối ưu theo % GDP (2026-2035):
- s_K (vốn vật chất): ${sim.s_K.map(v=>(v*100).toFixed(0)+'%').join(' → ')}
- s_D (digital): ${sim.s_D.map(v=>(v*100).toFixed(1)+'%').join(' → ')}
- s_AI: ${sim.s_AI.map(v=>(v*100).toFixed(1)+'%').join(' → ')}
- s_H (nhân lực số): ${sim.s_H.map(v=>(v*100).toFixed(1)+'%').join(' → ')}
- Tỷ lệ AI/H ratio: ${sim.ai_h_ratio.map(v=>v.toFixed(2)).join(' → ')} (trung bình ${(sim.ai_h_ratio.reduce((a,b)=>a+b,0)/10).toFixed(2)})
- Nhận xét: vốn K giảm dần, H ổn định, AI tăng rồi ổn định – phù hợp với lý thuyết tăng trưởng mới.`;
      case "c3":
        return `Cú sốc kinh tế năm 2028 (giả định bão Yagi hoặc khủng hoảng tương tự) với độ lớn shock = -${(params.shock*100).toFixed(0)}% GDP:
- GDP baseline 2028: ${sim.Y[2].toFixed(0)} nghìn tỷ
- GDP sau shock 2028: ${sim.Y_shock[2].toFixed(0)} nghìn tỷ
- GDP 2030 (phục hồi): baseline ${sim.Y[4].toFixed(0)} vs shock ${sim.Y_shock[4].toFixed(0)}
- Tác động welfare: baseline W = ${sim.welfare.toFixed(3)} → shock W = ${sim.welfare_shock.toFixed(3)} → ΔW = ${sim.delta_W.toFixed(3)}
- Phản ứng chính sách tối ưu: cắt giảm IK, IAI, duy trì IH (nhân lực là "hàng hóa bảo hiểm")`;
      case "c4":
        return `So sánh ba chiến lược đầu tư:
- Chiến lược TỐI ƯU (SLSQP): W = ${sim.welfare.toFixed(3)}, GDP2035 = ${sim.Y[9].toFixed(0)} nghìn tỷ
- Chiến lược TRẢI ĐỀU (mỗi năm đầu tư bằng nhau): W = ${sim.welfare_even.toFixed(3)}, GDP2035 = ${sim.Y_even[9].toFixed(0)} nghìn tỷ
- Chiến lược FRONT-LOAD (tập trung 3 năm đầu): W = ${sim.welfare_fl.toFixed(3)}, GDP2035 = ${sim.Y_fl[9].toFixed(0)} nghìn tỷ
- Kết luận: Trải đều có welfare cao nhất vì hàm ln(C) ưa thích consumption smoothing.`;
      case "c5":
        return `Thảo luận chính sách dựa trên mô hình động:
- a) Quỹ đạo tối ưu: K giảm dần (back-loaded) do hiệu suất cận biên giảm; H ổn định (cần đầu tư đều đặn).
- b) AI/H ratio trung bình ${(sim.ai_h_ratio.reduce((a,b)=>a+b,0)/10).toFixed(2)} < 1 → nhân lực được ưu tiên trước AI.
- c) ρ = ${params.rho} → chính phủ ${params.rho>=0.95?"quan tâm nhiều đến dài hạn":"có xu hướng ưu tiên hiện tại"}. Nếu ρ giảm, đầu tư dài hạn giảm. Giải thích dưới đầu tư R&D: ρ cao do áp lực nhiệm kỳ, ngoại tác lan tỏa, bất định.`;
      default:
        return `Mô hình tối ưu động với các tham số hiện tại: α=${params.alpha}, γ=${params.gamma}, δAI=${params.delta_f}, θH=${params.theta_f}, ρ=${params.rho}. GDP2035 dự báo ${sim.Y[9].toFixed(0)} nghìn tỷ.`;
    }
  }, [data, currentTab]);

  const PROMPT_MODES = [
    {id:"auto",    label:"Tự động (theo tab)",   icon:"🔍"},
    {id:"policy",  label:"Khuyến nghị chính sách",icon:"📋"},
    {id:"compare", label:"So sánh quỹ đạo",      icon:"⚖️"},
    {id:"risk",    label:"Phân tích rủi ro sốc",  icon:"⚠️"},
    {id:"vss",     label:"Giải thích welfare",    icon:"💡"},
  ];

  const PROMPTS = {
    auto: buildContext,
    policy: () => `Dựa trên kết quả mô hình tối ưu động, hãy đưa ra khuyến nghị chính sách cho Việt Nam giai đoạn 2026-2035, tập trung vào phân bổ vốn K, D, AI, H và vai trò của nhân lực số:\n\n${buildContext()}`,
    compare: () => `So sánh các quỹ đạo đầu tư (K, D, AI, H) trong mô hình. Tại sao vốn K giảm dần trong khi H cần duy trì? Liên hệ với Nghị quyết 57 và chiến lược chuyển đổi số:\n\n${buildContext()}`,
    risk: () => `Phân tích cú sốc 2028 (-${(data.params.shock*100).toFixed(0)}% GDP) và khả năng phục hồi. Đề xuất cơ chế "quỹ bình ổn" và chính sách bảo hiểm nhân lực:\n\n${buildContext()}`,
    vss: () => `Giải thích ý nghĩa của hệ số chiết khấu ρ = ${data.params.rho} và tác động đến quyết định đầu tư dài hạn. Tại sao chính phủ thường dưới đầu tư vào R&D và đào tạo nhân lực?\n\n${buildContext()}`,
  };

  const analyze = async () => {
    if (!apiKey.trim()) { setResult("⚠️ Vui lòng nhập API Key Gemini trước."); return; }
    setLoading(true);
    setResult("");
    try {
      const prompt = typeof PROMPTS[promptMode] === "function" ? PROMPTS[promptMode]() : buildContext();
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            contents:[{parts:[{
              text: `Bạn là chuyên gia kinh tế vĩ mô và tối ưu động, chuyên về mô hình tăng trưởng dài hạn. Hãy phân tích kết quả bài toán tối ưu động phân bổ liên thời gian bằng tiếng Việt, đưa ra nhận xét sâu sắc, ý nghĩa chính sách và khuyến nghị cụ thể:\n\n${prompt}`
            }]}]
          }),
        }
      );
      const dataRes = await res.json();
      if (dataRes.error) { setResult(`❌ Lỗi API: ${dataRes.error.message}`); }
      else {
        const text = dataRes.candidates?.[0]?.content?.parts?.[0]?.text;
        setResult(text || "Không có kết quả từ Gemini.");
      }
    } catch (err) {
      setResult("❌ Lỗi kết nối: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "linear-gradient(135deg,#0f1a2e,#1a1f35)", border: "1px solid #2d4a7a", borderRadius: 14, padding: "20px 22px", marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 22 }}>🤖</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Tác nhân Gemini AI</span>
        <span style={{ background: "#4285f4", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 99 }}>Google Gemini 2.0 Flash</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>— Phân tích mô hình động</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Dán Gemini API Key vào đây (AIza...)"
            style={{ width: "100%", padding: "8px 40px 8px 12px", borderRadius: 8, background: "#1e293b", border: `1px solid ${apiKey ? "#4285f4" : "#1e3a5f"}`, color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }}
          />
          <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>{showKey ? "🙈" : "👁"}</button>
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#4285f4", textDecoration: "none", whiteSpace: "nowrap" }}>Lấy API Key →</a>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {PROMPT_MODES.map(m => (
          <button key={m.id} onClick={() => setPromptMode(m.id)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${promptMode === m.id ? "#4285f4" : "#1e3a5f"}`, background: promptMode === m.id ? "rgba(66,133,244,0.2)" : "#1e293b", color: promptMode === m.id ? "#4285f4" : "#94a3b8" }}>{m.icon} {m.label}</button>
        ))}
      </div>

      <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#64748b", maxHeight: 80, overflow: "hidden", position: "relative" }}>
        <span style={{ color: "#94a3b8" }}>📄 Context: </span>
        <span style={{ color: "#cbd5e1" }}>{buildContext().slice(0, 200)}...</span>
      </div>

      <button onClick={analyze} disabled={loading} style={{ background: loading ? "#374151" : "linear-gradient(135deg,#4285f4,#0f9d58)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginBottom: result ? 16 : 0, boxShadow: loading ? "none" : "0 0 20px rgba(66,133,244,0.4)" }}>
        {loading ? "⏳ Đang phân tích với Gemini AI..." : "✨ Phân tích với Gemini AI"}
      </button>

      {result && (
        <div style={{ background: "#070d1a", borderRadius: 10, padding: 16, color: "#e2e8f0", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", border: "1px solid #2d3748", maxHeight: 500, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #1e3a5f" }}>
            <span style={{ fontSize: 11, color: "#4285f4", fontWeight: 600 }}>🤖 Gemini AI · {PROMPT_MODES.find(m => m.id === promptMode)?.label}</span>
            <button onClick={() => setResult("")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {result}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("c1");
  const [cl,setCl]=useState(false);
  const [panelCollapsed,setPanelCollapsed]=useState(false);
  const [params,setParams]=useState({...DEFAULT_PARAMS});

  useEffect(()=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload=()=>setCl(true);
    document.head.appendChild(s);
  },[]);

  const handleParam = useCallback((key,val)=>{
    setParams(prev=>({...prev,[key]:val}));
  },[]);

  const handleReset = useCallback(()=>{
    setParams({...DEFAULT_PARAMS});
  },[]);

  const sim = simulate(params);

  // Gom dữ liệu để truyền vào GeminiPanel
  const geminiData = {
    params,
    sim,
    YEARS,
    cagr2030: (Math.pow(sim.Y[9]/sim.Y[0], 1/9) - 1) * 100,
  };

  const TABS=[
    {id:"c1",label:"① Mô hình & Quỹ đạo"},
    {id:"c2",label:"② Tỷ lệ đầu tư"},
    {id:"c3",label:"③ Cú sốc 2028"},
    {id:"c4",label:"④ So sánh chiến lược"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

  const ylabels=YEARS.map(String);

  return(
    <div style={{minHeight:"100vh",
      background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`,
      fontFamily:"'Segoe UI',sans-serif",color:D.text1,padding:"24px 20px"}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{display:"inline-block",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,
          letterSpacing:2,marginBottom:10,color:"#fff"}}>
          AIDEOM-VN • PHẦN D – CẤP ĐỘ KHÁ KHÓ
        </div>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#4ade80)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 8 — Tối ưu Động Phân bổ Liên thời gian 2026–2035
        </h1>
        <p style={{fontSize:13,color:D.text3,margin:0}}>
          max Σ ρᵗ·ln(Cₜ) &nbsp;|&nbsp; Hàm sản xuất Cobb-Douglas mở rộng &nbsp;|&nbsp;
          Động học vốn K, D, AI, H &nbsp;|&nbsp; SLSQP · ρ={params.rho}
        </p>
      </div>

      {/* KPI — reactive */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <KPI label="GDP 2026" value={`${(sim.Y[0]/1000).toFixed(3)}`} unit="nghìn tỷ VND" color={D.blue} sub="Điểm xuất phát"/>
        <KPI label="GDP 2035" value={`${(sim.Y[9]/1000).toFixed(3)}`} unit="nghìn tỷ VND" color={D.green} sub={`CAGR = ${sim.cagr.toFixed(1)}%/năm`}/>
        <KPI label="Welfare tối ưu" value={sim.welfare.toFixed(2)} unit="Σ ρᵗ·ln(C)" color={D.amber} sub={`ρ=${params.rho}, T=10 năm`}/>
        <KPI label={`Cú sốc 2028 -${(params.shock*100).toFixed(0)}%`} value={`ΔW = ${sim.delta_W.toFixed(3)}`} unit="phúc lợi" color={D.coral} sub="Phục hồi 2030"/>
        <KPI label="AI/H ratio TB" value={(sim.ai_h_ratio.reduce((a,b)=>a+b,0)/10).toFixed(2)} unit="đầu tư AI/nhân lực" color={D.purple} sub="H dẫn trước AI"/>
      </div>

      {/* PARAMETER PANEL */}
      <ParamPanel
        params={params}
        onChange={handleParam}
        onReset={handleReset}
        collapsed={panelCollapsed}
        setCollapsed={setPanelCollapsed}
      />

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1: MÔ HÌNH & QUỸ ĐẠO ════════════════════════════════ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
                Mô hình tối ưu động — cấu trúc hệ thống
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                Hàm mục tiêu: max Σₜ {params.rho}ᵗ·ln(Cₜ) với 5 phương trình trạng thái
              </p>
              <StateSpaceDiagram p={params}/>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 4px",color:D.green,fontSize:15}}>
                Câu 8.3.2 — Quỹ đạo GDP & Tiêu dùng tối ưu
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                CAGR GDP = {sim.cagr.toFixed(1)}%/năm | GDP tăng gấp {(sim.Y[9]/sim.Y[0]).toFixed(2)}× trong 10 năm
              </p>
              {cl&&(
                <LineChart
                  labels={ylabels}
                  datasets={[
                    {label:"GDP Yₜ (ngh.tỷ)",data:sim.Y,
                      borderColor:D.green,backgroundColor:"rgba(74,222,128,0.15)",
                      fill:true,tension:0.4,pointRadius:4,borderWidth:2.5},
                    {label:"Tiêu dùng Cₜ (ngh.tỷ)",data:sim.C,
                      borderColor:D.blue,backgroundColor:"rgba(56,189,248,0.10)",
                      fill:true,tension:0.4,pointRadius:4,borderWidth:2,borderDash:[5,3]},
                  ]}
                  height={240}
                  opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
                />
              )}
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>
              Quỹ đạo K, D, AI, H, A theo thời gian
            </h3>
            {cl&&(
              <LineChart
                labels={ylabels}
                datasets={[
                  {label:"K / 1000 (nghìn tỷ)",data:sim.K.map(v=>v/1000),
                    borderColor:D.blue,borderWidth:2,tension:0.4,pointRadius:3,yAxisID:"yK"},
                  {label:"D (% GDP)",data:sim.D,
                    borderColor:D.teal,borderWidth:2,tension:0.4,pointRadius:3,yAxisID:"yD"},
                  {label:"AI (nghìn DN)",data:sim.AI,
                    borderColor:D.purple,borderWidth:2,tension:0.4,pointRadius:3,yAxisID:"yD"},
                  {label:"H (% LĐ)",data:sim.H,
                    borderColor:D.amber,borderWidth:2,tension:0.4,pointRadius:3,yAxisID:"yD"},
                  {label:"TFP A×100",data:sim.A.map(v=>v*100),
                    borderColor:D.coral,borderWidth:1.5,tension:0.4,pointRadius:2,
                    borderDash:[4,3],yAxisID:"yA"},
                ]}
                height={280}
                opts={{scales:{
                  yK:{type:"linear",position:"left",
                    grid:{color:"rgba(255,255,255,0.04)"},
                    ticks:{color:D.blue,font:{size:9}}},
                  yD:{type:"linear",position:"right",
                    grid:{display:false},
                    ticks:{color:D.teal,font:{size:9}}},
                  yA:{type:"linear",position:"right",display:false},
                }}}
              />
            )}
          </Card>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>Bảng quỹ đạo đầy đủ</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Năm","GDP Yₜ","Tiêu dùng C","Vốn K","Digital D","AI cap.","Nhân lực H","TFP A","Tăng trưởng"].map(h=>(
                      <th key={h} style={{padding:"7px 8px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {YEARS.map((yr,i)=>{
                    const gr=i>0?((sim.Y[i]-sim.Y[i-1])/sim.Y[i-1]*100):null;
                    return(
                      <tr key={yr} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 8px",fontWeight:700,color:D.blue,textAlign:"right"}}>{yr}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.green,fontWeight:600,fontFamily:"monospace"}}>
                          {sim.Y[i].toLocaleString("vi-VN",{maximumFractionDigits:1})}
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace"}}>
                          {sim.C[i].toLocaleString("vi-VN",{maximumFractionDigits:1})}
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",color:D.blue}}>
                          {sim.K[i].toLocaleString("vi-VN",{maximumFractionDigits:0})}
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",color:D.teal}}>
                          {sim.D[i].toFixed(2)}%
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",color:D.purple}}>
                          {sim.AI[i].toFixed(1)}
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",color:D.amber}}>
                          {sim.H[i].toFixed(2)}%
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",color:D.coral}}>
                          {sim.A[i].toFixed(4)}
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",
                          color:gr&&gr>7?D.green:D.text3,fontWeight:gr&&gr>7?600:400}}>
                          {gr?`+${gr.toFixed(1)}%`:"—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          {/* Thêm AI Gemini vào cuối tab c1 */}
          <GeminiPanel data={geminiData} currentTab="c1" />
        </div>
      )}

      {/* ══ TAB 2: TỶ LỆ ĐẦU TƯ ════════════════════════════════════ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.amber,fontSize:15}}>
                Tỷ lệ đầu tư tối ưu theo năm (% GDP)
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                Cơ cấu: K giảm dần, D/AI/H ổn định — chuyển dịch từ vốn vật chất sang vốn số
              </p>
              {cl&&(
                <LineChart
                  labels={ylabels}
                  datasets={[
                    {label:"s_K Vốn vật chất",data:sim.s_K.map(v=>v*100),borderColor:D.blue,borderWidth:2.5,tension:0.3,pointRadius:4},
                    {label:"s_H Nhân lực số",data:sim.s_H.map(v=>v*100),borderColor:D.amber,borderWidth:2.5,tension:0.3,pointRadius:4},
                    {label:"s_D Digital infra",data:sim.s_D.map(v=>v*100),borderColor:D.teal,borderWidth:2,tension:0.3,pointRadius:3},
                    {label:"s_AI Năng lực AI",data:sim.s_AI.map(v=>v*100),borderColor:D.purple,borderWidth:2,tension:0.3,pointRadius:3},
                  ]}
                  height={260}
                  opts={{scales:{y:{ticks:{callback:v=>`${v}%`},
                    title:{display:true,text:"% GDP",color:D.text3}}}}}
                />
              )}
            </Card>

            <Card>
              <h3 style={{margin:"0 0 12px",color:D.purple,fontSize:14}}>
                AI/H ratio theo thời gian
              </h3>
              {cl&&(
                <LineChart
                  labels={ylabels}
                  datasets={[
                    {label:"AI/H ratio (s_AI/s_H)",data:sim.ai_h_ratio,
                      borderColor:D.purple,backgroundColor:"rgba(167,139,250,0.15)",
                      fill:true,tension:0.3,pointRadius:5,borderWidth:2.5},
                    {label:"Ngưỡng cân bằng (=0.50)",
                      data:Array(10).fill(0.50),
                      borderColor:D.coral,borderWidth:1.5,borderDash:[5,4],pointRadius:0},
                  ]}
                  height={220}
                  opts={{scales:{y:{min:0.2,max:1.0,
                    title:{display:true,text:"Tỷ lệ AI/H",color:D.text3}}}}}
                />
              )}
              <div style={{marginTop:10,padding:"10px 14px",background:D.purpleBg,
                borderLeft:`3px solid ${D.purple}`,borderRadius:7,fontSize:12,color:D.text2}}>
                AI/H ratio TB = <strong style={{color:D.purple}}>
                  {(sim.ai_h_ratio.reduce((a,b)=>a+b,0)/10).toFixed(2)}
                </strong> — {(sim.ai_h_ratio.reduce((a,b)=>a+b,0)/10) < 1
                  ? <><strong style={{color:D.amber}}>nhân lực được đầu tư nhiều hơn AI</strong></>
                  : <><strong style={{color:D.coral}}>AI vượt qua nhân lực — cần cân nhắc lại</strong></>
                }
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 12px",color:D.teal,fontSize:14}}>
              Cơ cấu đầu tư tích lũy (stacked area, % GDP)
            </h3>
            <InvestmentCompositionSVG sim={sim}/>
          </Card>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:14}}>Tỷ lệ đầu tư chi tiết từng năm</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Năm","s_K (Vốn)","s_D (Digital)","s_AI (AI)","s_H (Nhân lực)","s_C (Tiêu dùng)","Tổng đầu tư","AI/H"].map(h=>(
                      <th key={h} style={{padding:"7px 8px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {YEARS.map((yr,i)=>{
                    const totInv=(sim.s_K[i]+sim.s_D[i]+sim.s_AI[i]+sim.s_H[i])*100;
                    return(
                      <tr key={yr} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 8px",fontWeight:700,color:D.blue,textAlign:"right"}}>{yr}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.blue,fontFamily:"monospace"}}>{(sim.s_K[i]*100).toFixed(1)}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.teal,fontFamily:"monospace"}}>{(sim.s_D[i]*100).toFixed(1)}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.purple,fontFamily:"monospace"}}>{(sim.s_AI[i]*100).toFixed(1)}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.amber,fontFamily:"monospace",fontWeight:600}}>{(sim.s_H[i]*100).toFixed(1)}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.green,fontFamily:"monospace"}}>
                          {((1-sim.s_K[i]-sim.s_D[i]-sim.s_AI[i]-sim.s_H[i])*100).toFixed(1)}%
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace"}}>{totInv.toFixed(1)}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.purple,fontFamily:"monospace"}}>{sim.ai_h_ratio[i].toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="c2" />
        </div>
      )}

      {/* ══ TAB 3: CÚ SỐC 2028 ═══════════════════════════════════════ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.coral,fontSize:15}}>
                Câu 8.3.3 — Cú sốc 2028: GDP giảm {(params.shock*100).toFixed(0)}% (bão Yagi 2028 giả định)
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                Dùng slider "Shock 2028" để thay đổi độ lớn cú sốc — biểu đồ cập nhật tức thì
              </p>
              {cl&&(
                <LineChart
                  labels={ylabels}
                  datasets={[
                    {label:"Baseline (không cú sốc)",data:sim.Y,
                      borderColor:D.green,borderWidth:2.5,tension:0.3,pointRadius:4},
                    {label:`Sau cú sốc 2028 (-${(params.shock*100).toFixed(0)}%)`,data:sim.Y_shock,
                      borderColor:D.coral,backgroundColor:"rgba(248,113,113,0.10)",
                      fill:false,tension:0.3,pointRadius:4,borderWidth:2,borderDash:[5,3]},
                  ]}
                  height={280}
                  opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
                />
              )}
            </Card>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Card>
                <h3 style={{margin:"0 0 12px",color:D.coral,fontSize:14}}>Phản ứng chính sách tối ưu</h3>
                {[
                  {label:"Năm 2028 (shock year)",items:[
                    {k:"GDP",v:`−${(params.shock*100).toFixed(0)}%`,c:D.coral},
                    {k:"I_K",v:"−25% (tiết kiệm ngân sách)",c:D.blue},
                    {k:"I_AI",v:"−30% (ưu tiên thấp hơn)",c:D.purple},
                    {k:"I_H",v:"+10% (bảo hiểm nhân lực)",c:D.amber},
                    {k:"C",v:`−${(params.shock*100*0.9).toFixed(0)}%`,c:D.coral},
                  ]},
                  {label:"Năm 2029-2030 (phục hồi)",items:[
                    {k:"GDP",v:"Phục hồi dần",c:D.green},
                    {k:"ΔWelfare",v:`${sim.delta_W.toFixed(3)}`,c:D.coral},
                  ]},
                ].map((sec,si)=>(
                  <div key={si} style={{marginBottom:14}}>
                    <p style={{fontSize:11,color:D.text3,fontWeight:600,margin:"0 0 6px",
                      textTransform:"uppercase",letterSpacing:"0.05em"}}>{sec.label}</p>
                    {sec.items.map(item=>(
                      <div key={item.k} style={{display:"flex",justifyContent:"space-between",
                        padding:"4px 0",borderBottom:`1px solid ${D.border}`}}>
                        <span style={{fontSize:12,color:D.text2}}>{item.k}</span>
                        <span style={{fontSize:12,fontWeight:600,color:item.c}}>{item.v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </Card>

              <div style={{padding:"14px",background:D.coralBg,
                border:`1px solid ${D.coral}44`,borderRadius:12}}>
                <p style={{fontSize:11,color:D.coral,fontWeight:700,margin:"0 0 8px"}}>Tác động welfare</p>
                <p style={{fontSize:28,fontWeight:800,color:D.coral,margin:"0 0 4px"}}>
                  ΔW = {sim.delta_W.toFixed(3)}
                </p>
                <p style={{fontSize:12,color:D.text2,margin:0}}>
                  Baseline W = {sim.welfare.toFixed(3)} → Shock W = {sim.welfare_shock.toFixed(3)}.
                  H là "hàng hóa bảo hiểm" — không nên cắt khi khủng hoảng.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.coral,fontSize:14}}>
              GDP baseline vs shock — từng năm
            </h3>
            {cl&&(
              <BarChart
                labels={ylabels}
                datasets={[
                  {label:"Baseline GDP",data:sim.Y.map(v=>Math.round(v)),
                    backgroundColor:D.green+"88",borderColor:D.green,borderWidth:2,borderRadius:4},
                  {label:`Sau cú sốc -${(params.shock*100).toFixed(0)}%`,data:sim.Y_shock.map(v=>Math.round(v)),
                    backgroundColor:D.coral+"66",borderColor:D.coral,borderWidth:2,borderRadius:4},
                ]}
                height={220}
                opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
              />
            )}
            <div style={{marginTop:10,padding:"10px 14px",background:D.tealBg,
              borderLeft:`3px solid ${D.teal}`,borderRadius:7,fontSize:12,color:D.text2}}>
              GDP 2028 sau shock: <strong style={{color:D.coral}}>{sim.Y_shock[2].toLocaleString("vi-VN",{maximumFractionDigits:0})}</strong> ngh.tỷ
              (giảm {((1-sim.Y_shock[2]/sim.Y[2])*100).toFixed(1)}%). Khoảng cách thu hẹp dần nhờ H được duy trì.
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="c3" />
        </div>
      )}

      {/* ══ TAB 4: SO SÁNH CHIẾN LƯỢC ════════════════════════════════ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[
              {label:"Chiến lược TỐI ƯU",W:sim.welfare,gdp35:sim.Y[9],color:D.green,
               desc:"SLSQP optimization — s_K giảm dần, s_H ổn định"},
              {label:"Chiến lược TRẢI ĐỀU",W:sim.welfare_even,gdp35:sim.Y_even[9],color:D.blue,
               desc:"Mỗi năm đầu tư bằng nhau — đơn giản, ổn định"},
              {label:"Chiến lược FRONT-LOAD",W:sim.welfare_fl,gdp35:sim.Y_fl[9],color:D.amber,
               desc:"Đầu tư mạnh 3 năm đầu (×1.5), giảm dần sau"},
            ].map((s,i)=>(
              <div key={i} style={{padding:"16px",background:D.bg2,
                border:`1px solid ${s.color}44`,borderRadius:12}}>
                <p style={{fontSize:11,color:D.text3,textTransform:"uppercase",margin:"0 0 6px"}}>{s.label}</p>
                <p style={{fontSize:22,fontWeight:700,color:s.color,margin:"0 0 2px"}}>W = {s.W.toFixed(2)}</p>
                <p style={{fontSize:12,color:D.text2,margin:"0 0 6px"}}>GDP 2035: {Math.round(s.gdp35).toLocaleString()} ngh.tỷ</p>
                <p style={{fontSize:11,color:D.text3,margin:0,lineHeight:1.5}}>{s.desc}</p>
              </div>
            ))}
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>
              Câu 8.3.4 — So sánh GDP 3 chiến lược
            </h3>
            {cl&&(
              <LineChart
                labels={ylabels}
                datasets={[
                  {label:"Tối ưu (SLSQP)",data:sim.Y,
                    borderColor:D.green,borderWidth:2.5,tension:0.4,pointRadius:4},
                  {label:"Trải đều (Even)",data:sim.Y_even,
                    borderColor:D.blue,borderWidth:2,tension:0.4,pointRadius:3,borderDash:[5,3]},
                  {label:"Front-load",data:sim.Y_fl,
                    borderColor:D.amber,borderWidth:2,tension:0.4,pointRadius:3,borderDash:[8,4]},
                ]}
                height={280}
                opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
              />
            )}
            <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[
                {k:"Welfare trải đều",v:sim.welfare_even.toFixed(2),note:"Cao nhất — consumption smoothing tốt hơn",color:D.blue},
                {k:"Welfare tối ưu",v:sim.welfare.toFixed(2),note:"SLSQP — tối ưu hóa đa mục tiêu",color:D.green},
                {k:"Welfare front-load",v:sim.welfare_fl.toFixed(2),note:"Thấp nhất — tiêu dùng đầu thấp",color:D.amber},
              ].map(s=>(
                <div key={s.k} style={{padding:"12px",background:`${s.color}0e`,
                  border:`1px solid ${s.color}33`,borderRadius:8}}>
                  <p style={{fontSize:11,color:D.text3,margin:"0 0 4px"}}>{s.k}</p>
                  <p style={{fontSize:18,fontWeight:700,color:s.color,margin:"0 0 4px"}}>W = {s.v}</p>
                  <p style={{fontSize:11,color:D.text2,margin:0,lineHeight:1.5}}>{s.note}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{padding:"12px 16px",background:"rgba(56,189,248,0.06)",
              borderLeft:`3px solid ${D.blue}`,borderRadius:7,fontSize:13,color:D.text2,lineHeight:1.8}}>
              <strong style={{color:D.blue}}>📊 Kết luận câu 8.3.4:</strong> Chiến lược "Trải đều" có welfare cao nhất vì
              hàm U(C)=ln(C) ưa thích <strong style={{color:D.amber}}>"consumption smoothing"</strong> — tiêu dùng ổn định theo thời gian
              tốt hơn tiêu dùng dao động. Front-load hi sinh tiêu dùng đầu nhưng do ρ={params.rho},
              mất mát đầu không được bù đủ → welfare thấp hơn.
              Đây lý giải vì sao ρ là "tham số chính sách" quan trọng nhất trong mô hình động.
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="c4" />
        </div>
      )}

      {/* ══ TAB 5: THẢO LUẬN ══════════════════════════════════════════ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[
            {
              q:"a) Quỹ đạo tối ưu K, D, AI, H có front-loaded hay back-loaded? Vì sao?",
              color:D.blue,
              a:`Quỹ đạo trong mô hình cho thấy sự khác biệt rõ giữa các hạng mục:

• Vốn K: giảm tỷ lệ đầu tư từ ${(sim.s_K[0]*100).toFixed(0)}% → ${(sim.s_K[9]*100).toFixed(0)}% GDP (back-load) — khi K đã tích lũy đủ lớn, hiệu suất cận biên giảm dần theo luật Cobb-Douglas (α=${params.alpha}). Đây là bẫy "over-invest in physical capital" mà VN cần tránh.

• Digital D & AI: tỷ lệ đầu tư tăng rồi ổn định — front-load nhẹ vì TFP lan tỏa đòi hỏi "critical mass" ban đầu.

• Nhân lực H: tỷ lệ đầu tư ổn định ${(sim.s_H.reduce((a,b)=>a+b,0)/10*100).toFixed(1)}% GDP trung bình — cần ĐẦU TƯ ĐỀU ĐẶN vì tích lũy nhân lực là quá trình dài, không thể "bù đắp" sau.`
            },
            {
              q:"b) Tỷ lệ AI/H có ổn định? Mô hình ngụ ý nhân lực nên đi trước hay đồng thời AI?",
              color:D.amber,
              a:`AI/H ratio tăng dần từ ${sim.ai_h_ratio[0].toFixed(2)} → ${sim.ai_h_ratio[9].toFixed(2)} nhưng luôn ${sim.ai_h_ratio.every(v=>v<1)?"nhỏ hơn 1":"biến động"} — tức nhân lực H ${sim.ai_h_ratio.reduce((a,b)=>a+b,0)/10 < 1 ? "luôn được đầu tư nhiều hơn AI" : "và AI có mức đầu tư tương đương"}. Điều này phản ánh cần xây dựng nền tảng nhân lực trước khi mở rộng AI.

Khuyến nghị chính sách: giai đoạn 2026-2028 ưu tiên đào tạo kỹ sư AI (φ₃=${params.phi3}) trước khi triển khai hệ thống AI quốc gia — "sequencing" đúng đắn mà mô hình động xác nhận.`
            },
            {
              q:`c) ρ=${params.rho} ngụ ý gì? Nếu ρ=0.90 thì thay đổi thế nào? Tại sao chính phủ thường dưới đầu tư R&D?`,
              color:D.purple,
              a:`ρ=${params.rho} nghĩa là phúc lợi năm sau được chiết khấu ${((1-params.rho)*100).toFixed(0)}%/năm so với năm hiện tại — chính phủ ${params.rho>=0.95?"CÒN QUAN TÂM NHIỀU":"quan tâm vừa phải"} đến dài hạn.

• TFP lan tỏa từ D→TFP: φ₁=${params.phi1}, từ AI→TFP: φ₂=${params.phi2}, từ H→TFP: φ₃=${params.phi3}
• Welfare hiện tại: W = ${sim.welfare.toFixed(4)}
• Nếu ρ giảm → tiêu dùng hiện tại được ưu tiên hơn, đầu tư K/D/AI/H đều giảm

Lý do chính phủ dưới đầu tư R&D: (1) ρ thực tế thường cao (0.80-0.90) do áp lực nhiệm kỳ; (2) Lợi ích R&D lan tỏa ra ngoài (externality) nên tư nhân không đầu tư đủ; (3) Bất định: kết quả R&D không chắc.`
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
            <h3 style={{margin:"0 0 12px",color:D.cyan,fontSize:14}}>Thông số mô hình — giá trị hiện tại</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[
                {g:"Hàm sản xuất",items:[
                  `α=${params.alpha} (vốn K)`,`β=${params.beta} (lao động L)`,
                  `γ=${params.gamma} (Digital D)`,`δ=${params.delta_f} (AI)`,`θ=${params.theta_f} (nhân lực H)`,
                ]},
                {g:"Động học vốn",items:[
                  `δK=${(params.delta_K*100).toFixed(0)}% (K khấu hao)`,`δD=${(params.delta_D*100).toFixed(0)}% (D khấu hao)`,
                  `δAI=${(params.delta_AI*100).toFixed(0)}% (AI khấu hao)`,`θH=${params.theta_H} (hiệu quả H)`,`μ=${(params.mu*100).toFixed(0)}% (brain drain)`,
                ]},
                {g:"TFP & Welfare",items:[
                  `φ1=${params.phi1} (D→TFP)`,`φ2=${params.phi2} (AI→TFP)`,
                  `φ3=${params.phi3} (H→TFP)`,`ρ=${params.rho} (chiết khấu)`,`T=10 (2026-2035)`,
                ]},
              ].map(g=>(
                <div key={g.g} style={{padding:"10px 12px",background:D.bg3,borderRadius:8}}>
                  <p style={{fontSize:11,color:D.cyan,fontWeight:700,margin:"0 0 6px"}}>{g.g}</p>
                  {g.items.map(item=>(
                    <p key={item} style={{fontSize:11,color:D.text2,margin:"2px 0",fontFamily:"monospace"}}>{item}</p>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="c5" />
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.text3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 8 — AIDEOM-VN | Live simulation | Mô hình: Cobb-Douglas mở rộng + Capital Dynamics |
        Dữ liệu calibrate từ Bài 1 (TFP A₀=34.91) | 2026-2035 | ρ={params.rho} | W={sim.welfare.toFixed(4)} | Tích hợp Gemini AI
      </div>
    </div>
  );
}