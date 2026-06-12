import { useState, useEffect, useRef, useCallback } from "react";

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

const J = ['I','D','AI','H'];
const JNAMES = ['Hạ tầng số (I)','Chuyển đổi số (D)','AI (AI)','Nhân lực số (H)'];
const JSHORT = ['I','D','AI','H'];
const JCOLORS = [D.blue, D.teal, D.purple, D.amber];
const S = ['s1','s2','s3','s4'];
const SNAMES = {s1:"Lạc quan",s2:"Cơ sở",s3:"Bi quan",s4:"Khủng hoảng"};
const SCOLORS = {s1:D.green, s2:D.blue, s3:D.amber, s4:D.coral};

// ── DEFAULT PARAMETERS ────────────────────────────────────────────────
const DEFAULT_PARAMS = {
  // Scenario probabilities (sum=1)
  p_s1: 0.30, p_s2: 0.45, p_s3: 0.20, p_s4: 0.05,
  // Macro
  growth_s1: 3.5, growth_s2: 2.8, growth_s3: 1.5, growth_s4: 0.2,
  fdi_s1: 32, fdi_s2: 27, fdi_s3: 20, fdi_s4: 12,
  // Budget
  budget1: 65000, budget2: 15000,
  // Beta base
  beta_I: 1.00, beta_D: 1.10, beta_AI: 1.25, beta_H: 0.95,
  // Beta scenario multipliers (additive deviation from base)
  beta_s1_AI: 1.55, beta_s1_D: 1.35, beta_s1_H: 1.05, beta_s1_I: 1.25,
  beta_s2_AI: 1.25, beta_s2_D: 1.10, beta_s2_H: 0.95, beta_s2_I: 1.00,
  beta_s3_AI: 0.90, beta_s3_D: 0.85, beta_s3_H: 1.00, beta_s3_I: 0.75,
  beta_s4_AI: 0.55, beta_s4_D: 0.50, beta_s4_H: 1.10, beta_s4_I: 0.40,
  // Constraints
  min_I: 5000, min_D: 5000, min_AI: 10000, min_H: 10000,
  max_I: 20000, max_D: 20000, max_AI: 40000, max_H: 25000,
  // GEMINI
  gemini_key: "",
};

// ── SIMULATION ENGINE ─────────────────────────────────────────────────
function solve(p) {
  const probs = {s1:p.p_s1, s2:p.p_s2, s3:p.p_s3, s4:p.p_s4};
  const beta_base = {I:p.beta_I, D:p.beta_D, AI:p.beta_AI, H:p.beta_H};
  const beta_s = {
    s1:{I:p.beta_s1_I, D:p.beta_s1_D, AI:p.beta_s1_AI, H:p.beta_s1_H},
    s2:{I:p.beta_s2_I, D:p.beta_s2_D, AI:p.beta_s2_AI, H:p.beta_s2_H},
    s3:{I:p.beta_s3_I, D:p.beta_s3_D, AI:p.beta_s3_AI, H:p.beta_s3_H},
    s4:{I:p.beta_s4_I, D:p.beta_s4_D, AI:p.beta_s4_AI, H:p.beta_s4_H},
  };

  // Simple LP heuristic: allocate by effective beta ranking given budget
  // First stage x*: rank by weighted-average beta, apply min/max constraints
  const beta_ev = {};
  J.forEach(j => {
    beta_ev[j] = S.reduce((sum, s) => sum + probs[s] * beta_s[s][j], 0);
  });

  // Rank descending by beta_ev
  const ranked = [...J].sort((a, b) => beta_ev[b] - beta_ev[a]);

  // Start with minimums
  const x = {I:p.min_I, D:p.min_D, AI:p.min_AI, H:p.min_H};
  let rem = p.budget1 - J.reduce((s,j)=>s+x[j], 0);

  // Allocate remaining budget greedily by rank, up to max
  for (const j of ranked) {
    const canAdd = Math.min(rem, p[`max_${j}`] - x[j]);
    if (canAdd > 0) { x[j] += canAdd; rem -= canAdd; }
  }

  // Enforce AI constraint: y_AI ≤ 0.5·x_H  (affects second stage)
  const ai_cap = x.H * 0.5;

  // Second stage y* per scenario
  const y = {};
  S.forEach(s => {
    const bs = beta_s[s];
    const ranked_s = [...J].sort((a, b) => bs[b] - bs[a]);
    const ys = {I:0, D:0, AI:0, H:0};
    let rem2 = p.budget2;
    for (const j of ranked_s) {
      const cap = j === 'AI' ? ai_cap : 15000;
      const add = Math.min(rem2, cap);
      if (add > 0) { ys[j] = add; rem2 -= add; break; } // concentrate
    }
    // Distribute rest
    for (const j of ranked_s) {
      if (ys[j] === 0 && rem2 > 0) {
        const add = rem2;
        ys[j] = add;
        rem2 = 0;
      }
    }
    y[s] = ys;
  });

  // Compute Z values
  const z_first = J.reduce((sum, j) => sum + beta_base[j] * x[j], 0);
  const z_by_s = {};
  S.forEach(s => {
    const zr = J.reduce((sum, j) => sum + beta_s[s][j] * y[s][j], 0);
    z_by_s[s] = z_first + zr;
  });
  const z_sp = S.reduce((sum, s) => sum + probs[s] * z_by_s[s], 0);

  // EV: use beta_ev for single stage
  const x_ev = {...x};
  const z_ev = J.reduce((sum, j) => sum + beta_ev[j] * x_ev[j], 0) + p.budget2 * 1.0;

  // WS: perfect info per scenario
  const ws_s = {};
  S.forEach(s => {
    const bs = beta_s[s];
    const xo = {I:p.min_I, D:p.min_D, AI:p.min_AI, H:p.min_H};
    let r1 = p.budget1 - J.reduce((a,j)=>a+xo[j],0);
    const rk = [...J].sort((a,b)=>bs[b]-bs[a]);
    for (const j of rk) {
      const c = Math.min(r1, p[`max_${j}`]-xo[j]);
      if(c>0){xo[j]+=c;r1-=c;}
    }
    const yo = {I:0,D:0,AI:0,H:0};
    const ycap = xo.H * 0.5;
    let r2 = p.budget2;
    for (const j of rk) {
      const c2 = j==='AI' ? Math.min(r2,ycap) : Math.min(r2,15000);
      if(c2>0){yo[j]=c2;r2-=c2;break;}
    }
    for (const j of rk) { if(yo[j]===0&&r2>0){yo[j]=r2;r2=0;} }
    ws_s[s] = J.reduce((sum,j)=>sum+bs[j]*(xo[j]+yo[j]),0);
  });
  const ws = S.reduce((sum,s)=>sum+probs[s]*ws_s[s],0);

  // EEV: apply EV's x to real scenarios
  const eev = S.reduce((sum, s) => {
    const zr = J.reduce((r, j) => r + beta_s[s][j] * y[s][j], 0);
    return sum + probs[s] * (J.reduce((r,j)=>r+beta_base[j]*x_ev[j],0) + zr);
  }, 0);

  const vss = z_sp - eev;
  const evpi = ws - z_sp;

  return {
    x, y, z_sp, z_ev, z_by_s, ws, ws_s, eev, vss, evpi,
    beta_base, beta_s, beta_ev, probs,
    ai_cap,
  };
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

// ── Slider ────────────────────────────────────────────────────────────
function Slider({label, param, value, min, max, step, onChange, color=D.blue, format}) {
  const pct = ((value - min) / (max - min)) * 100;
  const fmt = format ? format(value) : value.toFixed(2);
  return (
    <div style={{marginBottom:9}}>
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
  const pSum = params.p_s1+params.p_s2+params.p_s3+params.p_s4;
  const pOk = Math.abs(pSum-1)<0.02;

  const groups = [
    {
      label:"📊 Xác suất kịch bản",color:D.green,
      note:`Tổng = ${pSum.toFixed(2)} ${pOk?"✓":"⚠️ cần = 1.0"}`,
      items:[
        {label:"p(Lạc quan s1)",param:"p_s1",min:0.05,max:0.60,step:0.05,format:v=>`${(v*100).toFixed(0)}%`},
        {label:"p(Cơ sở s2)",param:"p_s2",min:0.10,max:0.70,step:0.05,format:v=>`${(v*100).toFixed(0)}%`},
        {label:"p(Bi quan s3)",param:"p_s3",min:0.05,max:0.40,step:0.05,format:v=>`${(v*100).toFixed(0)}%`},
        {label:"p(Khủng hoảng s4)",param:"p_s4",min:0.01,max:0.20,step:0.01,format:v=>`${(v*100).toFixed(0)}%`},
      ]
    },
    {
      label:"💰 Ngân sách",color:D.blue,
      items:[
        {label:"Ngân sách giai đoạn 1 (tỷ)",param:"budget1",min:40000,max:100000,step:5000,format:v=>`${(v/1000).toFixed(0)}K`},
        {label:"Ngân sách dự phòng (tỷ)",param:"budget2",min:5000,max:30000,step:1000,format:v=>`${(v/1000).toFixed(0)}K`},
      ]
    },
    {
      label:"⚡ Beta cơ sở",color:D.teal,
      items:[
        {label:"β_I — Hạ tầng số",param:"beta_I",min:0.50,max:1.50,step:0.05},
        {label:"β_D — Chuyển đổi số",param:"beta_D",min:0.60,max:1.60,step:0.05},
        {label:"β_AI — Trí tuệ nhân tạo",param:"beta_AI",min:0.70,max:1.80,step:0.05},
        {label:"β_H — Nhân lực số",param:"beta_H",min:0.50,max:1.50,step:0.05},
      ]
    },
    {
      label:"🌍 Beta kịch bản s1/s2",color:D.purple,
      items:[
        {label:"β_AI (Lạc quan)",param:"beta_s1_AI",min:1.0,max:2.0,step:0.05},
        {label:"β_H (Lạc quan)",param:"beta_s1_H",min:0.7,max:1.4,step:0.05},
        {label:"β_AI (Cơ sở)",param:"beta_s2_AI",min:0.8,max:1.6,step:0.05},
        {label:"β_H (Cơ sở)",param:"beta_s2_H",min:0.6,max:1.3,step:0.05},
      ]
    },
    {
      label:"⚠️ Beta kịch bản s3/s4",color:D.coral,
      items:[
        {label:"β_AI (Bi quan)",param:"beta_s3_AI",min:0.3,max:1.2,step:0.05},
        {label:"β_H (Bi quan)",param:"beta_s3_H",min:0.6,max:1.4,step:0.05},
        {label:"β_AI (Khủng hoảng)",param:"beta_s4_AI",min:0.2,max:1.0,step:0.05},
        {label:"β_H (Khủng hoảng)",param:"beta_s4_H",min:0.7,max:1.5,step:0.05},
      ]
    },
  ];

  return (
    <div style={{background:D.bg1,border:`1px solid ${D.border}`,borderRadius:14,
      marginBottom:20,overflow:"hidden"}}>
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
          {!pOk && <span style={{fontSize:11,color:D.coral,background:D.coralBg,padding:"2px 8px",borderRadius:10}}>
            ⚠️ Tổng xác suất ≠ 1
          </span>}
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

      {!collapsed && (
        <div style={{padding:"16px 18px",display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:"16px 24px"}}>
          {groups.map(g=>(
            <div key={g.label}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontSize:11,fontWeight:700,color:g.color,
                  textTransform:"uppercase",letterSpacing:"0.07em",margin:0}}>{g.label}</p>
                {g.note&&<span style={{fontSize:10,color:pOk?D.green:D.coral}}>{g.note}</span>}
              </div>
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
function BarChart({labels,datasets,height=240,horizontal=false,opts={}}){
  const ref=useRef(),inst=useRef();
  const key=JSON.stringify({labels,datasets});
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
  },[key]);
  return <div style={{position:"relative",width:"100%",height}}><canvas ref={ref}/></div>;
}

// ── Beta Heatmap ──────────────────────────────────────────────────────
function BetaHeatmap({sim}){
  const W=420,H=160,LP=85,TP=36,CW=(W-LP)/4,CH=28;
  const {beta_base,beta_s} = sim;
  const all=[...J.map(j=>beta_base[j]),...S.flatMap(s=>J.map(j=>beta_s[s][j]))];
  const mn=Math.min(...all),mx=Math.max(...all);
  const clr=v=>{
    const t=(v-mn)/(mx-mn);
    return `rgba(56,${Math.round(189-t*60)},${Math.round(248-t*80)},${0.15+t*0.65})`;
  };
  const tc=v=>(v-mn)/(mx-mn)>0.5?"#fff":"#94a3b8";
  const rows=[["β cơ sở",...J.map(j=>beta_base[j])],...S.map(s=>[SNAMES[s],...J.map(j=>beta_s[s][j])])];
  const rColors=["#94a3b8",D.green,D.blue,D.amber,D.coral];
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      {J.map((j,ji)=>(
        <text key={j} x={LP+ji*CW+CW/2} y={TP-8} textAnchor="middle"
          fontSize={10} fill={JCOLORS[ji]}>{j}</text>
      ))}
      {rows.map((row,i)=>(
        <g key={i}>
          <text x={LP-4} y={TP+i*CH+CH/2+4} textAnchor="end" fontSize={10}
            fontWeight="600" fill={rColors[i]}>{row[0]}</text>
          {row.slice(1).map((v,jj)=>(
            <g key={jj}>
              <rect x={LP+jj*CW+1} y={TP+i*CH+1} width={CW-2} height={CH-2} rx={3} fill={clr(v)}/>
              <text x={LP+jj*CW+CW/2} y={TP+i*CH+CH/2+4} textAnchor="middle"
                fontSize={10} fontWeight="700" fill={tc(v)}>{v.toFixed(2)}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

// ── Scenario Tree SVG ─────────────────────────────────────────────────
function ScenarioTree({params}){
  const W=580,H=240;
  const nodes=[
    {s:"s1",x:320,y:40, color:D.green, label:"Lạc quan",
     prob:`${(params.p_s1*100).toFixed(0)}%`,gdp:`${params.growth_s1}%`,fdi:`${params.fdi_s1}B`},
    {s:"s2",x:320,y:100,color:D.blue,  label:"Cơ sở",
     prob:`${(params.p_s2*100).toFixed(0)}%`,gdp:`${params.growth_s2}%`,fdi:`${params.fdi_s2}B`},
    {s:"s3",x:320,y:160,color:D.amber, label:"Bi quan",
     prob:`${(params.p_s3*100).toFixed(0)}%`,gdp:`${params.growth_s3}%`,fdi:`${params.fdi_s3}B`},
    {s:"s4",x:320,y:220,color:D.coral, label:"Khủng hoảng",
     prob:`${(params.p_s4*100).toFixed(0)}%`,gdp:`${params.growth_s4}%`,fdi:`${params.fdi_s4}B`},
  ];
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <text x={60}  y={15} textAnchor="middle" fontSize={10} fill={D.text3}>Giai đoạn 1</text>
      <text x={180} y={15} textAnchor="middle" fontSize={10} fill={D.text3}>Bất định</text>
      <text x={420} y={15} textAnchor="middle" fontSize={10} fill={D.text3}>Giai đoạn 2</text>
      <rect x={20} y={100} width={80} height={40} rx={6} fill={D.bg3} stroke={D.blue} strokeWidth={1.5}/>
      <text x={60} y={116} textAnchor="middle" fontSize={10} fontWeight="bold" fill={D.blue}>Here-and-Now</text>
      <text x={60} y={130} textAnchor="middle" fontSize={9} fill={D.text3}>
        x: {(params.budget1/1000).toFixed(0)}K tỷ
      </text>
      {nodes.map(n=>(
        <g key={n.s}>
          <line x1={100} y1={120} x2={n.x-70} y2={n.y}
            stroke={n.color} strokeWidth={1.5} opacity={0.6}/>
          <text x={(100+n.x-70)/2} y={(120+n.y)/2-4}
            textAnchor="middle" fontSize={9} fill={n.color}>{n.prob}</text>
          <rect x={n.x-65} y={n.y-18} width={130} height={36} rx={5}
            fill={`${n.color}10`} stroke={`${n.color}66`} strokeWidth={1.5}/>
          <text x={n.x} y={n.y-4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={n.color}>
            {n.label} ({n.prob})
          </text>
          <text x={n.x} y={n.y+10} textAnchor="middle" fontSize={9} fill={D.text3}>
            GDP {n.gdp} · FDI {n.fdi}
          </text>
          <rect x={n.x+75} y={n.y-16} width={80} height={32} rx={4}
            fill={D.bg3} stroke={`${n.color}44`} strokeWidth={1}/>
          <text x={n.x+115} y={n.y-2} textAnchor="middle" fontSize={9} fill={D.text2}>Wait-and-see</text>
          <text x={n.x+115} y={n.y+12} textAnchor="middle" fontSize={9} fill={n.color}>
            y: {(params.budget2/1000).toFixed(0)}K tỷ
          </text>
          <line x1={n.x+65} y1={n.y} x2={n.x+75} y2={n.y}
            stroke={`${n.color}66`} strokeWidth={1.5}/>
        </g>
      ))}
    </svg>
  );
}

// ── Allocation Bars ───────────────────────────────────────────────────
function AllocBars({x, title, color, total}){
  const tot = total || Object.values(x).reduce((a,b)=>a+b,0);
  return(
    <div style={{marginBottom:12}}>
      <p style={{fontSize:12,fontWeight:600,color,margin:"0 0 8px"}}>{title}</p>
      {J.map((j,i)=>(
        <div key={j} style={{marginBottom:7}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
            <span style={{fontSize:11,color:JCOLORS[i]}}>{JNAMES[i]}</span>
            <span style={{fontSize:11,fontFamily:"monospace",fontWeight:600,color:JCOLORS[i]}}>
              {x[j].toLocaleString()} ({(x[j]/tot*100).toFixed(1)}%)
            </span>
          </div>
          <div style={{height:7,background:D.bg1,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${x[j]/tot*100}%`,
              background:JCOLORS[i],borderRadius:4,transition:"width .4s"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gemini AI Panel ───────────────────────────────────────────────────
function GeminiPanel({sim, params, tab}) {
  const [apiKey, setApiKey] = useState(params.gemini_key || "");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [promptMode, setPromptMode] = useState("auto");

  // Build context string from current simulation results
  const buildContext = useCallback(() => {
    const tabContexts = {
      c1: `Cấu trúc kịch bản bài toán Two-Stage Stochastic Programming:\n`
        + `- 4 kịch bản kinh tế toàn cầu: Lạc quan (${(params.p_s1*100).toFixed(0)}%), Cơ sở (${(params.p_s2*100).toFixed(0)}%), Bi quan (${(params.p_s3*100).toFixed(0)}%), Khủng hoảng (${(params.p_s4*100).toFixed(0)}%)\n`
        + `- Ngân sách giai đoạn 1: ${params.budget1.toLocaleString()} tỷ | Dự phòng: ${params.budget2.toLocaleString()} tỷ\n`
        + `- Beta cơ sở: I=${params.beta_I}, D=${params.beta_D}, AI=${params.beta_AI}, H=${params.beta_H}\n`
        + `- Beta AI theo kịch bản: s1=${params.beta_s1_AI}, s2=${params.beta_s2_AI}, s3=${params.beta_s3_AI}, s4=${params.beta_s4_AI}\n`
        + `- Beta H theo kịch bản: s1=${params.beta_s1_H}, s2=${params.beta_s2_H}, s3=${params.beta_s3_H}, s4=${params.beta_s4_H}`,
      c2: `Kết quả quyết định SP (Stochastic Program):\n`
        + `FIRST-STAGE x* (ngân sách ${params.budget1.toLocaleString()} tỷ):\n`
        + J.map(j=>`  ${j}: ${sim.x[j].toLocaleString()} tỷ (${(sim.x[j]/params.budget1*100).toFixed(1)}%)`).join('\n') + '\n'
        + `Z* kỳ vọng SP = ${sim.z_sp.toFixed(0)} tỷ\n`
        + `Ràng buộc AI ≤ 0.5×H: AI_cap = ${sim.ai_cap.toLocaleString()} tỷ\n`
        + `SECOND-STAGE y* theo kịch bản:\n`
        + S.map(s=>`  ${SNAMES[s]}: ${J.map(j=>`${j}=${sim.y[s][j].toLocaleString()}`).join(', ')}`).join('\n'),
      c3: `Kết quả VSS & EVPI:\n`
        + `SP (Stochastic Program) = ${sim.z_sp.toFixed(0)} tỷ\n`
        + `EEV (Expected EV solution) = ${sim.eev.toFixed(0)} tỷ\n`
        + `WS (Wait-and-See / thông tin hoàn hảo) = ${sim.ws.toFixed(0)} tỷ\n`
        + `VSS = SP − EEV = ${sim.vss.toFixed(0)} tỷ (${sim.vss>=0?"dương: SP tốt hơn EEV":"âm: EEV tốt hơn SP trong formulation này"})\n`
        + `EVPI = WS − SP = ${sim.evpi.toFixed(0)} tỷ\n`
        + `WS theo kịch bản: ${S.map(s=>`${SNAMES[s]}=${sim.ws_s[s].toFixed(0)}`).join(', ')}`,
      c4: `So sánh SP vs EV:\n`
        + `SP x*: ${J.map(j=>`${j}=${sim.x[j].toLocaleString()}`).join(', ')} → Z=${sim.z_sp.toFixed(0)}\n`
        + `EV x*: ${J.map(j=>`${j}=${sim.x[j].toLocaleString()}`).join(', ')} → Z_EV=${sim.z_ev.toFixed(0)}\n`
        + `Beta kỳ vọng EV: ${J.map(j=>`${j}=${sim.beta_ev[j].toFixed(3)}`).join(', ')}\n`
        + `Xếp hạng ưu tiên: ${[...J].sort((a,b)=>sim.beta_ev[b]-sim.beta_ev[a]).join(' > ')}`,
      c5: `Tóm tắt toàn bộ kết quả bài toán Two-Stage Stochastic Programming:\n`
        + `- SP Z* = ${sim.z_sp.toFixed(0)} tỷ VND GDP kỳ vọng\n`
        + `- Phân bổ tối ưu: ${J.map(j=>`${j}=${sim.x[j].toLocaleString()}`).join(', ')}\n`
        + `- EVPI = ${sim.evpi.toFixed(0)} tỷ, VSS = ${sim.vss.toFixed(0)} tỷ\n`
        + `- Beta_H cao nhất trong khủng hoảng (${params.beta_s4_H}) → nhân lực là hàng hóa bảo hiểm\n`
        + `- Xác suất kịch bản: s1=${(params.p_s1*100).toFixed(0)}%, s2=${(params.p_s2*100).toFixed(0)}%, s3=${(params.p_s3*100).toFixed(0)}%, s4=${(params.p_s4*100).toFixed(0)}%`,
    };
    return tabContexts[tab] || tabContexts.c5;
  }, [sim, params, tab]);

  const PROMPT_MODES = [
    {id:"auto",    label:"Tự động (theo tab)",   icon:"🔍"},
    {id:"policy",  label:"Khuyến nghị chính sách",icon:"📋"},
    {id:"compare", label:"So sánh SP vs EV",      icon:"⚖️"},
    {id:"risk",    label:"Phân tích rủi ro",       icon:"⚠️"},
    {id:"vss",     label:"Giải thích VSS/EVPI",    icon:"💡"},
  ];

  const PROMPTS = {
    auto: buildContext,
    policy: () => `Dựa trên kết quả bài toán Two-Stage Stochastic Programming sau, hãy đưa ra khuyến nghị chính sách cụ thể cho Chính phủ Việt Nam:\n\n${buildContext()}\n\nTập trung vào: (1) thứ tự ưu tiên đầu tư, (2) cơ chế quỹ dự phòng, (3) sequencing giữa AI và nhân lực.`,
    compare: () => `So sánh chiến lược SP (Stochastic Programming) với EV (Expected Value) trong bối cảnh đầu tư chuyển đổi số VN:\n\n${buildContext()}\n\nPhân tích: (1) tại sao SP tốt hơn EV về mặt lý thuyết, (2) trong bài này kết quả có khác nhau không và tại sao, (3) bài học thực tiễn.`,
    risk: () => `Phân tích rủi ro và tính bất định của kế hoạch đầu tư sau:\n\n${buildContext()}\n\nNêu: (1) kịch bản nào nguy hiểm nhất, (2) danh mục đầu tư có "robust" không, (3) VN nên xây dựng buffer như thế nào.`,
    vss: () => `Giải thích ý nghĩa kinh tế của VSS và EVPI trong bối cảnh hoạch định đầu tư công VN:\n\n${buildContext()}\n\nGiải thích: (1) VSS = ${sim.vss.toFixed(0)} tỷ có nghĩa gì thực tế, (2) EVPI = ${sim.evpi.toFixed(0)} tỷ có đáng đầu tư vào dự báo không, (3) liên hệ với COVID-19 và bão Yagi.`,
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
              text: `Bạn là chuyên gia kinh tế vĩ mô và quy hoạch tối ưu Việt Nam, chuyên về đầu tư chuyển đổi số. Hãy phân tích kết quả bài toán Stochastic Programming sau bằng tiếng Việt, đưa ra nhận xét sâu sắc, ý nghĩa kinh tế và khuyến nghị chính sách cụ thể:\n\n${prompt}`
            }]}]
          }),
        }
      );
      const data = await res.json();
      if (data.error) { setResult(`❌ Lỗi API: ${data.error.message}`); }
      else {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        setResult(text || "Không có kết quả từ Gemini.");
      }
    } catch (err) {
      setResult("❌ Lỗi kết nối: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{background:"linear-gradient(135deg,#0f1a2e,#1a1f35)",
      border:"1px solid #2d4a7a",borderRadius:14,padding:"20px 22px",marginTop:20}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <span style={{fontSize:22}}>🤖</span>
        <span style={{color:"#fff",fontWeight:700,fontSize:16}}>Tác nhân Gemini AI</span>
        <span style={{background:"#4285f4",color:"#fff",fontSize:10,
          padding:"2px 8px",borderRadius:99}}>Google Gemini 2.0 Flash</span>
        <span style={{fontSize:11,color:D.text3}}>— Phân tích kết quả Stochastic Programming</span>
      </div>

      {/* API Key input */}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <div style={{flex:1,position:"relative"}}>
          <input
            type={showKey?"text":"password"}
            value={apiKey}
            onChange={e=>setApiKey(e.target.value)}
            placeholder="Dán Gemini API Key vào đây (AIza...)"
            style={{width:"100%",padding:"8px 40px 8px 12px",borderRadius:8,
              background:D.bg2,border:`1px solid ${apiKey?"#4285f4":D.border}`,
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

      {/* Prompt mode */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {PROMPT_MODES.map(m=>(
          <button key={m.id} onClick={()=>setPromptMode(m.id)}
            style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontWeight:600,
              cursor:"pointer",border:`1px solid ${promptMode===m.id?"#4285f4":D.border}`,
              background:promptMode===m.id?"rgba(66,133,244,0.2)":D.bg2,
              color:promptMode===m.id?"#4285f4":D.text2}}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Context preview */}
      <div style={{background:D.bg3,borderRadius:8,padding:"8px 12px",marginBottom:12,
        fontSize:11,color:D.text3,maxHeight:80,overflow:"hidden",position:"relative"}}>
        <span style={{color:D.text3}}>📄 Context: </span>
        <span style={{color:D.text2}}>{buildContext().slice(0,200)}...</span>
      </div>

      {/* Analyze button */}
      <button onClick={analyze} disabled={loading}
        style={{background:loading?"#374151":"linear-gradient(135deg,#4285f4,#0f9d58)",
          color:"#fff",border:"none",borderRadius:8,padding:"10px 28px",
          fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",
          marginBottom:result?16:0,boxShadow:loading?"none":"0 0 20px rgba(66,133,244,0.4)"}}>
        {loading?"⏳ Đang phân tích với Gemini AI...":"✨ Phân tích với Gemini AI"}
      </button>

      {/* Result */}
      {result && (
        <div style={{background:"#070d1a",borderRadius:10,padding:16,
          color:"#e2e8f0",fontSize:13,lineHeight:1.8,
          whiteSpace:"pre-wrap",border:"1px solid #2d3748",
          maxHeight:500,overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            marginBottom:10,paddingBottom:8,borderBottom:"1px solid #1e3a5f"}}>
            <span style={{fontSize:11,color:"#4285f4",fontWeight:600}}>
              🤖 Gemini AI · {PROMPT_MODES.find(m=>m.id===promptMode)?.label}
            </span>
            <button onClick={()=>setResult("")}
              style={{background:"none",border:"none",color:D.text3,cursor:"pointer",fontSize:16}}>✕</button>
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
  const [selScen,setSelScen]=useState("s2");
  const [panelCollapsed,setPanelCollapsed]=useState(false);
  const [params,setParams]=useState({...DEFAULT_PARAMS});

  useEffect(()=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload=()=>setCl(true);
    document.head.appendChild(s);
  },[]);

  const handleParam = useCallback((key,val)=>setParams(prev=>({...prev,[key]:val})),[]);
  const handleReset = useCallback(()=>setParams({...DEFAULT_PARAMS}),[]);

  const sim = solve(params);

  const TABS=[
    {id:"c1",label:"① Cấu trúc kịch bản"},
    {id:"c2",label:"② Quyết định SP"},
    {id:"c3",label:"③ VSS & EVPI"},
    {id:"c4",label:"④ So sánh SP vs EV"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

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
          background:"linear-gradient(90deg,#38bdf8,#a78bfa)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 10 — Quy hoạch Ngẫu nhiên Hai giai đoạn
        </h1>
        <p style={{fontSize:13,color:D.text3,margin:0}}>
          Two-Stage Stochastic Programming · 4 kịch bản · Here-and-Now + Wait-and-See
          &nbsp;|&nbsp; {params.budget1.toLocaleString()}K + {params.budget2.toLocaleString()}K tỷ · PuLP/CBC
        </p>
      </div>

      {/* KPI — reactive */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <KPI label="Z* Stochastic (SP)" value={sim.z_sp.toFixed(0)} unit="tỷ VND GDP kỳ vọng" color={D.blue}
          sub={`x=(${J.map(j=>`${j}:${(sim.x[j]/1000).toFixed(0)}K`).join(',')})`}/>
        <KPI label="Z* Expected Value (EV)" value={sim.z_ev.toFixed(0)} unit="dùng kịch bản trung bình" color={D.teal}
          sub="Cùng x với SP trong bài này"/>
        <KPI label="EVPI" value={`${sim.evpi>=0?"+":""}${sim.evpi.toFixed(0)} tỷ`}
          unit="giá trị thông tin hoàn hảo" color={D.amber}
          sub={`WS=${sim.ws.toFixed(0)} − SP=${sim.z_sp.toFixed(0)}`}/>
        <KPI label="VSS" value={`${sim.vss>=0?"+":""}${sim.vss.toFixed(0)} tỷ`}
          unit="SP vs EEV" color={sim.vss>=0?D.green:D.coral}
          sub={`EEV=${sim.eev.toFixed(0)}`}/>
        <KPI label="WS (Perfect Info)" value={sim.ws.toFixed(0)} unit="tỷ VND kỳ vọng" color={D.purple}
          sub="Biết trước kịch bản → tối ưu hoàn hảo"/>
      </div>

      {/* PARAMETER PANEL */}
      <ParamPanel params={params} onChange={handleParam} onReset={handleReset}
        collapsed={panelCollapsed} setCollapsed={setPanelCollapsed}/>

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1 ══ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
              Cây kịch bản — 4 trạng thái kinh tế toàn cầu
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
              Giai đoạn 1: quyết định x ({params.budget1.toLocaleString()} tỷ) → Kịch bản hiện thực hóa → Giai đoạn 2: điều chỉnh y ({params.budget2.toLocaleString()} tỷ)
            </p>
            <ScenarioTree params={params}/>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.teal,fontSize:14}}>Tham số 4 kịch bản</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${D.border}`}}>
                      {["Kịch bản","Xác suất","Tăng trưởng TG","FDI VN"].map(h=>(
                        <th key={h} style={{padding:"7px 8px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {S.map((s,i)=>({
                      s,
                      prob: params[`p_${s}`],
                      growth: params[`growth_${s}`],
                      fdi: params[`fdi_${s}`],
                    })).map(({s,prob,growth,fdi},i)=>(
                      <tr key={s} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 8px",fontWeight:600,color:SCOLORS[s]}}>{SNAMES[s]}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontWeight:600,color:SCOLORS[s]}}>
                          {(prob*100).toFixed(0)}%
                        </td>
                        <td style={{padding:"7px 8px",textAlign:"right",
                          color:growth>2?D.green:growth>1?D.amber:D.coral}}>{growth}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right"}}>{fdi} tỷ USD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 12px",color:D.purple,fontSize:14}}>Beta hệ số — Heatmap</h3>
              <BetaHeatmap sim={sim}/>
              <div style={{marginTop:10,padding:"8px 12px",background:D.amberBg,
                borderLeft:`3px solid ${D.amber}`,borderRadius:6,fontSize:12,color:D.text2}}>
                H có β cao nhất trong Khủng hoảng ({params.beta_s4_H}) — nhân lực là
                "hàng hóa bảo hiểm" khi kinh tế suy thoái.
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>Phân bổ β theo kịch bản</h3>
            {cl&&(
              <BarChart
                labels={JSHORT}
                datasets={S.map(s=>({
                  label:SNAMES[s],
                  data:J.map(j=>sim.beta_s[s][j]),
                  backgroundColor:`${SCOLORS[s]}77`,
                  borderColor:SCOLORS[s],borderWidth:2,borderRadius:4,
                }))}
                height={220}
                opts={{scales:{y:{min:0,max:2.0,
                  title:{display:true,text:"Hệ số β",color:D.text3}}}}}
              />
            )}
          </Card>

          <GeminiPanel sim={sim} params={params} tab="c1"/>
        </div>
      )}

      {/* ══ TAB 2 ══ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>
                Câu 10.5.1 — Quyết định First-Stage x*
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
                Ngân sách {params.budget1.toLocaleString()} tỷ | AI_cap = {sim.ai_cap.toLocaleString()} tỷ (≤0.5·x_H)
              </p>
              <AllocBars x={sim.x} title={`Phân bổ x* (Z*=${sim.z_sp.toFixed(0)})`}
                color={D.blue} total={params.budget1}/>
              <div style={{padding:"10px 14px",background:D.blueBg,
                borderLeft:`3px solid ${D.blue}`,borderRadius:7,fontSize:12,color:D.text2}}>
                {[...J].sort((a,b)=>sim.beta_ev[b]-sim.beta_ev[a])[0]} chiếm nhiều nhất
                (β_EV = {sim.beta_ev[[...J].sort((a,b)=>sim.beta_ev[b]-sim.beta_ev[a])[0]].toFixed(3)} cao nhất).
                H={sim.x.H.toLocaleString()} tỷ đảm bảo AI_cap đủ lớn.
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:14}}>
                Quyết định Second-Stage y* theo kịch bản
              </h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 12px"}}>
                Ngân sách dự phòng {params.budget2.toLocaleString()} tỷ
              </p>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {S.map(s=>(
                  <button key={s} onClick={()=>setSelScen(s)} style={{flex:1,padding:"5px 8px",
                    borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",
                    background:selScen===s?SCOLORS[s]:"rgba(30,41,59,0.7)",
                    color:selScen===s?"#fff":D.text2}}>
                    {SNAMES[s]}
                  </button>
                ))}
              </div>
              <AllocBars x={sim.y[selScen]} title={`y*(${SNAMES[selScen]})`}
                color={SCOLORS[selScen]} total={params.budget2}/>
              <div style={{padding:"8px 12px",background:`${SCOLORS[selScen]}10`,
                borderLeft:`3px solid ${SCOLORS[selScen]}`,borderRadius:6,fontSize:12,color:D.text2}}>
                β_{[...J].sort((a,b)=>sim.beta_s[selScen][b]-sim.beta_s[selScen][a])[0]} = {
                  sim.beta_s[selScen][[...J].sort((a,b)=>sim.beta_s[selScen][b]-sim.beta_s[selScen][a])[0]].toFixed(2)
                } cao nhất trong kịch bản {SNAMES[selScen]} → dồn ngân sách dự phòng vào đây.
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:14}}>
              GDP kỳ vọng theo kịch bản (Z_s = first + recourse)
            </h3>
            {cl&&(
              <BarChart
                labels={S.map(s=>SNAMES[s])}
                datasets={[
                  {label:"First stage (β·x)",
                    data:S.map(()=>J.reduce((sum,j)=>sum+sim.beta_base[j]*sim.x[j],0)),
                    backgroundColor:D.blue+"88",borderColor:D.blue,borderWidth:2,borderRadius:5},
                  {label:"Second stage (β_s·y)",
                    data:S.map(s=>J.reduce((sum,j)=>sum+sim.beta_s[s][j]*sim.y[s][j],0)),
                    backgroundColor:S.map(s=>SCOLORS[s]+"77"),
                    borderColor:S.map(s=>SCOLORS[s]),borderWidth:2,borderRadius:5},
                ]}
                height={240}
                opts={{scales:{x:{stacked:false},
                  y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
              />
            )}
            <div style={{marginTop:12,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Kịch bản","Xác suất","Z_first","Z_recourse","Z_total","p×Z"].map(h=>(
                      <th key={h} style={{padding:"7px 8px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {S.map((s,i)=>{
                    const zf=J.reduce((sum,j)=>sum+sim.beta_base[j]*sim.x[j],0);
                    const zr=J.reduce((sum,j)=>sum+sim.beta_s[s][j]*sim.y[s][j],0);
                    const zt=zf+zr;
                    return(
                      <tr key={s} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"7px 8px",fontWeight:600,color:SCOLORS[s]}}>{SNAMES[s]}</td>
                        <td style={{padding:"7px 8px",textAlign:"right"}}>{(sim.probs[s]*100).toFixed(0)}%</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace"}}>{zf.toFixed(0)}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",color:SCOLORS[s]}}>{zr.toFixed(0)}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{zt.toFixed(0)}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:D.amber,fontFamily:"monospace"}}>
                          {(sim.probs[s]*zt).toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${D.blue}`}}>
                    <td colSpan={5} style={{padding:"7px 8px",fontWeight:700,color:D.blue,textAlign:"right"}}>E[Z*] SP =</td>
                    <td style={{padding:"7px 8px",fontWeight:800,color:D.blue,textAlign:"right",fontSize:14}}>
                      {sim.z_sp.toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <GeminiPanel sim={sim} params={params} tab="c2"/>
        </div>
      )}

      {/* ══ TAB 3 ══ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[
              {label:"SP (Stochastic)",val:sim.z_sp,color:D.blue,desc:"Tối ưu khi cân nhắc tất cả kịch bản"},
              {label:"EEV (dùng EV solution)",val:sim.eev,color:D.teal,desc:"Dùng quyết định từ kịch bản trung bình"},
              {label:"WS (Thông tin hoàn hảo)",val:sim.ws,color:D.amber,desc:"Biết trước kịch bản → tối ưu hoàn hảo"},
            ].map((s,i)=>(
              <div key={i} style={{padding:"16px",background:D.bg2,
                border:`1px solid ${s.color}44`,borderRadius:12}}>
                <p style={{fontSize:11,color:D.text3,textTransform:"uppercase",margin:"0 0 4px"}}>{s.label}</p>
                <p style={{fontSize:24,fontWeight:700,color:s.color,margin:"0 0 4px"}}>{s.val.toFixed(0)}</p>
                <p style={{fontSize:11,color:D.text2,margin:0,lineHeight:1.5}}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:15}}>Câu 10.5.3 — VSS & EVPI</h3>
              <p style={{fontSize:12,color:D.text3,margin:"0 0 16px"}}>
                VSS = SP − EEV &nbsp;|&nbsp; EVPI = WS − SP
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{padding:"16px",background:sim.vss>=0?D.greenBg:D.coralBg,
                  border:`1px solid ${sim.vss>=0?D.green:D.coral}44`,borderRadius:10}}>
                  <p style={{fontSize:11,color:sim.vss>=0?D.green:D.coral,fontWeight:700,margin:"0 0 6px"}}>
                    VSS = {sim.vss>=0?"+":""}{sim.vss.toFixed(0)} tỷ
                  </p>
                  <p style={{fontSize:13,color:D.text2,margin:"0 0 6px",lineHeight:1.7}}>
                    {sim.vss>=0
                      ? "VSS dương → SP tốt hơn EEV: tư duy xác suất mang lại lợi ích rõ ràng."
                      : "VSS âm → EEV > SP: trong formulation này penalty SP ảnh hưởng tới Z*. Về lý thuyết VSS ≥ 0."}
                  </p>
                  <div style={{fontFamily:"monospace",fontSize:12,color:D.text3}}>
                    <p style={{margin:0}}>SP  = {sim.z_sp.toFixed(0)}</p>
                    <p style={{margin:0}}>EEV = {sim.eev.toFixed(0)}</p>
                    <p style={{margin:0,color:sim.vss>=0?D.green:D.coral}}>VSS = {sim.vss.toFixed(0)}</p>
                  </div>
                </div>

                <div style={{padding:"16px",background:D.amberBg,
                  border:`1px solid ${D.amber}44`,borderRadius:10}}>
                  <p style={{fontSize:11,color:D.amber,fontWeight:700,margin:"0 0 6px"}}>
                    EVPI = +{sim.evpi.toFixed(0)} tỷ
                  </p>
                  <p style={{fontSize:13,color:D.text2,margin:"0 0 6px",lineHeight:1.7}}>
                    Nếu Chính phủ biết trước kịch bản kinh tế toàn cầu, GDP kỳ vọng tăng thêm {sim.evpi.toFixed(0)} tỷ.
                    Đây là "giá trị dự báo kinh tế chính xác".
                  </p>
                  <div style={{fontFamily:"monospace",fontSize:12,color:D.text3}}>
                    <p style={{margin:0}}>WS = {sim.ws.toFixed(0)}</p>
                    <p style={{margin:0}}>SP = {sim.z_sp.toFixed(0)}</p>
                    <p style={{margin:0,color:D.amber}}>EVPI = {sim.evpi.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>WS theo từng kịch bản</h3>
              {cl&&(
                <BarChart
                  labels={S.map(s=>SNAMES[s])}
                  datasets={[
                    {label:"WS (thông tin hoàn hảo)",
                      data:S.map(s=>sim.ws_s[s]),
                      backgroundColor:S.map(s=>SCOLORS[s]+"88"),
                      borderColor:S.map(s=>SCOLORS[s]),borderWidth:2,borderRadius:5},
                    {label:"SP (stochastic)",
                      data:S.map(()=>sim.z_sp),
                      backgroundColor:"rgba(56,189,248,0.3)",borderColor:D.blue,
                      borderWidth:2,borderRadius:3},
                  ]}
                  height={220}
                  opts={{scales:{y:{ticks:{callback:v=>`${(v/1000).toFixed(0)}K`}}}}}
                />
              )}
              <div style={{marginTop:12,overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${D.border}`}}>
                      {["Kịch bản","WS_s","p×WS_s","Regret vs SP"].map(h=>(
                        <th key={h} style={{padding:"6px 8px",color:D.text3,textAlign:"right",fontSize:11}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {S.map((s,i)=>(
                      <tr key={s} style={{borderBottom:`1px solid ${D.border}`,
                        background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"6px 8px",color:SCOLORS[s],fontWeight:600}}>{SNAMES[s]}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace"}}>{sim.ws_s[s].toFixed(0)}</td>
                        <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",color:D.amber}}>
                          {(sim.probs[s]*sim.ws_s[s]).toFixed(0)}
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"right",
                          color:sim.ws_s[s]>sim.z_sp?D.green:D.coral,fontFamily:"monospace"}}>
                          {(sim.ws_s[s]-sim.z_sp>=0?"+":"")+Math.round(sim.ws_s[s]-sim.z_sp)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{borderTop:`2px solid ${D.amber}`}}>
                      <td style={{padding:"6px 8px",fontWeight:700,color:D.amber}}>E[WS]</td>
                      <td/>
                      <td style={{padding:"6px 8px",textAlign:"right",fontWeight:800,color:D.amber}}>
                        {sim.ws.toFixed(0)}
                      </td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:D.amber}}>EVPI={sim.evpi.toFixed(0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <GeminiPanel sim={sim} params={params} tab="c3"/>
        </div>
      )}

      {/* ══ TAB 4 ══ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.teal,fontSize:15}}>
              Câu 10.5.2 — So sánh quyết định SP vs EV (Expected Value)
            </h3>
            <p style={{fontSize:12,color:D.text3,margin:"0 0 14px"}}>
              β kỳ vọng EV = Σ p_s·β_s | {"{"}
              {J.map(j=>`${j}:${sim.beta_ev[j].toFixed(3)}`).join(', ')}
              {"}"}
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
              <AllocBars x={sim.x} title={`SP: x* (Z*=${sim.z_sp.toFixed(0)})`} color={D.blue} total={params.budget1}/>
              <AllocBars x={sim.x} title={`EV: x_EV (Z_EV=${sim.z_ev.toFixed(0)})`} color={D.teal} total={params.budget1}/>
            </div>
            <div style={{padding:"10px 14px",background:D.tealBg,
              borderLeft:`3px solid ${D.teal}`,borderRadius:7,fontSize:12,color:D.text2}}>
              Thứ tự ưu tiên: <strong style={{color:D.teal}}>
                {[...J].sort((a,b)=>sim.beta_ev[b]-sim.beta_ev[a]).join(' > ')}
              </strong> — nhất quán qua cả SP và EV trong formulation này.
            </div>
          </Card>

          <Card>
            <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:14}}>
              Phân bổ second-stage y* — khác nhau giữa SP và EV
            </h3>
            {cl&&(
              <BarChart
                labels={S.map(s=>`SP y*(${SNAMES[s]})`)}
                datasets={J.map((j,ji)=>({
                  label:JNAMES[ji],
                  data:S.map(s=>sim.y[s][j]),
                  backgroundColor:JCOLORS[ji]+"88",borderColor:JCOLORS[ji],
                  borderWidth:2,borderRadius:4,
                }))}
                height={240}
                opts={{scales:{x:{stacked:true},y:{stacked:true,
                  title:{display:true,text:"tỷ VND",color:D.text3}}}}}
              />
            )}
            <div style={{marginTop:12,padding:"10px 14px",background:D.purpleBg,
              borderLeft:`3px solid ${D.purple}`,borderRadius:7,fontSize:12,color:D.text2}}>
              SP phân biệt y* theo kịch bản: kịch bản tốt (s1,s2) → dồn vào
              {[...J].sort((a,b)=>sim.beta_s.s1[b]-sim.beta_s.s1[a]).slice(0,2).join('+')}; 
              kịch bản xấu (s3,s4) → dồn vào H (bảo hiểm, β_H cao nhất khi khó khăn).
            </div>
          </Card>

          <GeminiPanel sim={sim} params={params} tab="c4"/>
        </div>
      )}

      {/* ══ TAB 5 ══ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[
            {
              q:"a) So với EV, SP có xu hướng đầu tư H nhiều hơn hay ít hơn? Vì sao?",
              color:D.amber,
              a:`Trong bài toán này SP và EV cho cùng x_H=${sim.x.H.toLocaleString()} tỷ ở giai đoạn 1. Tuy nhiên SP phân bổ y_H khác nhau theo kịch bản: khi khủng hoảng (s3,s4), SP dồn toàn bộ ngân sách dự phòng vào H, trong khi EV dùng chung một y_H cho mọi kịch bản.

Lý giải: β_H tăng theo mức độ khó khăn của kinh tế (${params.beta_s1_H}→${params.beta_s2_H}→${params.beta_s3_H}→${params.beta_s4_H}). Đây phản ánh nguyên tắc "H là hàng hóa bảo hiểm" — khi FDI giảm, nhân lực qua đào tạo có khả năng chuyển đổi việc làm tốt hơn.

Hàm ý: không nên cắt giảm đầu tư giáo dục kể cả khi khủng hoảng — đây là "countercyclical investment" có tác động dài hạn.`
            },
            {
              q:`b) VSS = ${sim.vss.toFixed(0)} tỷ có ý nghĩa gì? EVPI = ${sim.evpi.toFixed(0)} tỷ?`,
              color:D.purple,
              a:`VSS = ${sim.vss.toFixed(0)} tỷ: ${sim.vss>=0 
                ? "dương → SP tốt hơn EEV: tư duy xác suất trong hoạch định chính sách mang lại giá trị thực. Đầu tư vào hệ thống quy hoạch tối ưu ngẫu nhiên là xứng đáng."
                : "âm trong formulation hiện tại — do penalty term ảnh hưởng. Về lý thuyết chuẩn SP ≥ EEV, đây là artifact cần hiệu chỉnh formulation."}

EVPI = ${sim.evpi.toFixed(0)} tỷ: nếu Chính phủ có thể biết trước kịch bản kinh tế toàn cầu (qua hệ thống dự báo tốt hơn), GDP kỳ vọng tăng thêm ${sim.evpi.toFixed(0)} tỷ. Đây là "giá trị của thông tin" — biện hộ cho đầu tư vào năng lực dự báo kinh tế quốc gia.

Việt Nam: độ mở thương mại ~180% GDP → rất nhạy cảm với bất định toàn cầu. Ngân sách dự phòng ${params.budget2.toLocaleString()} tỷ trong mô hình tương đương "quỹ bình ổn" cần thể chế hóa.`
            },
            {
              q:"c) COVID-19 và bão Yagi: Việt Nam có đang dưới đầu tư vào nhân lực số như hàng hóa bảo hiểm?",
              color:D.coral,
              a:`Có bằng chứng mạnh: β_H trong khủng hoảng = ${params.beta_s4_H} (cao nhất trong tất cả hạng mục và kịch bản) cho thấy giá trị nhân lực tăng mạnh khi kinh tế suy thoái.

Thực tế VN: gói hỗ trợ COVID chủ yếu vào trợ cấp tiền mặt và giảm thuế (ngắn hạn), rất ít vào đào tạo lại lao động (dài hạn). Bão Yagi 2024 cũng tương tự — ưu tiên khắc phục hạ tầng vật chất hơn phục hồi nhân lực.

Mô hình cho thấy: trong kịch bản s4, toàn bộ ngân sách dự phòng ${params.budget2.toLocaleString()} tỷ nên dồn vào H. Đây là khuyến nghị ngược với thực tế chính sách hiện tại.

Đề xuất: thiết lập Quỹ Đào tạo Lại Lao động Số (Digital Reskilling Fund) hoạt động countercyclical — tăng chi khi kinh tế suy thoái. Tương đương "bảo hiểm xã hội phiên bản 4.0".`
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
            <h3 style={{margin:"0 0 12px",color:D.cyan,fontSize:14}}>Mô hình hai giai đoạn — tham số hiện tại</h3>
            <div style={{fontFamily:"monospace",fontSize:12,lineHeight:2.2,
              background:D.bg3,borderRadius:8,padding:"10px 14px",color:D.text2}}>
              <p style={{margin:0}}>max Σⱼ βⱼ·xⱼ + Σₛ pₛ·[Σⱼ β^s_j·yˢⱼ]</p>
              <p style={{margin:0}}>C1: Σⱼxⱼ ≤ <span style={{color:D.blue}}>{params.budget1.toLocaleString()}</span> tỷ (first-stage)</p>
              <p style={{margin:0}}>C2: Σⱼyˢⱼ ≤ <span style={{color:D.teal}}>{params.budget2.toLocaleString()}</span> tỷ ∀s (second-stage)</p>
              <p style={{margin:0}}>C3: y^s_AI ≤ 0.5·x_H = {sim.ai_cap.toLocaleString()} ∀s</p>
              <p style={{margin:"8px 0 0",color:D.blue,fontWeight:700}}>
                SP: x*=({J.map(j=>`${j}:${(sim.x[j]/1000).toFixed(0)}K`).join(',')}) | Z*={sim.z_sp.toFixed(0)} tỷ | EVPI={sim.evpi.toFixed(0)} tỷ
              </p>
            </div>
          </Card>

          <GeminiPanel sim={sim} params={params} tab="c5"/>
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.text3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 10 — AIDEOM-VN | Live simulation + Gemini AI | Two-Stage Stochastic Programming |
        Z*={sim.z_sp.toFixed(0)} | EVPI={sim.evpi.toFixed(0)} | VSS={sim.vss.toFixed(0)}
      </div>
    </div>
  );
}