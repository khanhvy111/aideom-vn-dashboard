import { useState, useEffect, useRef, useMemo } from "react";

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

const SECTORS = [
  "Nông-Lâm-Thủy sản","CN chế biến chế tạo","Xây dựng",
  "Bán buôn-bán lẻ","Tài chính-Ngân hàng","Logistics-Vận tải",
  "CNTT-Truyền thông","Giáo dục-Đào tạo"
];
const SSHORT = ["Nông-Lâm","CN CB-CT","Xây dựng","Bán buôn","Tài chính","Logistics","CNTT","Giáo dục"];
const SCOLORS = [D.green,D.blue,D.amber,D.coral,D.purple,D.teal,D.cyan,"#fb923c"];

const BASE = {
  L:    [13.20,11.50,4.80,7.80,0.55,1.95,0.62,2.15],
  risk: [0.18,0.42,0.25,0.38,0.52,0.35,0.28,0.22],
  a1:   [8.5,32.5,12.8,22.4,45.8,28.5,62.5,18.5],
  b1:   [45.0,28.0,35.0,32.0,22.0,30.0,20.0,55.0],
  c1:   [5.2,62.4,18.5,48.2,72.5,42.8,32.5,12.5],
  d1:   [50.0,32.0,42.0,38.0,26.0,36.0,24.0,62.0],
};

function solveLPGreedy(risk, a1, b1, c1, d1, budget, minAI, minH) {
  const n = SECTORS.length;
  let xAI = Array(n).fill(minAI);
  let xH  = Array(n).fill(minH);
  xH = xH.map((h,i) => Math.max(h, Math.ceil(c1[i]*risk[i]*xAI[i]/d1[i])+1));
  let rem = budget - xAI.reduce((s,v)=>s+v,0) - xH.reduce((s,v)=>s+v,0);
  if (rem < 0) rem = 0;
  const order = [...Array(n).keys()].sort((a,b)=>b1[b]-b1[a]);
  if (order.length > 0) { xH[order[0]] += rem; }
  const results = SECTORS.map((s,i) => {
    const New = Math.round(a1[i]*xAI[i]);
    const Up  = Math.round(b1[i]*xH[i]);
    const Dis = Math.round(c1[i]*risk[i]*xAI[i]);
    const Net = Math.max(0, New + Up - Dis);
    return {s, xAI:xAI[i], xH:xH[i], New, Up, Dis, Net};
  });
  return {
    results,
    totalNet: results.reduce((s,r)=>s+r.Net,0),
    totalAI:  xAI.reduce((s,v)=>s+v,0),
    totalH:   xH.reduce((s,v)=>s+v,0),
  };
}

function useChart(ref, type, getData, deps) {
  const inst = useRef(null);
  useEffect(()=>{
    if (!window.Chart || !ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current=null; }
    const {labels, datasets, options={}} = getData();
    inst.current = new window.Chart(ref.current, {
      type,
      data: {labels, datasets},
      options: {
        responsive:true, maintainAspectRatio:false, animation:{duration:220},
        plugins:{legend:{labels:{color:D.text2,font:{size:10},boxWidth:10}}},
        scales:{
          x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:D.text3,font:{size:9}}},
          y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:D.text3,font:{size:9}}},
        },
        ...options
      },
    });
    return () => { if(inst.current){inst.current.destroy();inst.current=null;} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function GeminiPanel({ context, tabLabel }) {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!apiKey.trim()) { setError("Vui lòng nhập Gemini API Key trước!"); return; }
    setLoading(true); setResult(""); setError("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            contents:[{parts:[{
              text:`Bạn là chuyên gia kinh tế Việt Nam. Hãy phân tích kết quả sau bằng tiếng Việt, nêu nhận xét, ý nghĩa và khuyến nghị chính sách:\n\n${context}`
            }]}]
          })
        }
      );
      const data = await res.json();
      if (data.error) setError("Gemini lỗi: " + data.error.message);
      else setResult(data.candidates?.[0]?.content?.parts?.[0]?.text || "Không có kết quả.");
    } catch(err) { setError("Lỗi kết nối: " + err.message); }
    setLoading(false);
  }

  return (
    <div style={{marginTop:18,background:"#0f1829",borderRadius:14,padding:"16px 20px",border:"1px solid #2d4a7a"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span style={{fontSize:20}}>🤖</span>
        <span style={{color:"#fff",fontWeight:700,fontSize:14}}>Tác nhân Gemini AI — Phân tích {tabLabel}</span>
        <span style={{background:"#4285f4",color:"#fff",fontSize:9,padding:"2px 8px",borderRadius:99,fontWeight:600}}>
          Gemini 2.0 Flash
        </span>
        <div style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",
          background:D.green,boxShadow:`0 0 6px ${D.green}`,animation:"pulse 2s infinite"}}/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        <input type={showKey?"text":"password"} placeholder="Nhập Gemini API Key (AIzaSy...)"
          value={apiKey} onChange={e=>setApiKey(e.target.value)}
          style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1px solid #2d4a7a",
            background:"#1a2744",color:"#e2e8f0",fontSize:12,outline:"none"}}/>
        <button onClick={()=>setShowKey(v=>!v)} style={{padding:"8px 12px",borderRadius:8,
          background:"#1e3a5f",color:D.text2,border:"1px solid #2d4a7a",cursor:"pointer",fontSize:11}}>
          {showKey?"Ẩn":"Hiện"}
        </button>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
          style={{padding:"8px 12px",borderRadius:8,background:"#4285f422",color:"#4285f4",
            border:"1px solid #4285f444",fontSize:11,textDecoration:"none",whiteSpace:"nowrap"}}>
          Lấy API Key →
        </a>
      </div>
      {error && (
        <div style={{padding:"7px 10px",background:D.coralBg,border:`1px solid ${D.coral}44`,
          borderRadius:7,fontSize:12,color:D.coral,marginBottom:8}}>⚠ {error}</div>
      )}
      <details style={{marginBottom:10}}>
        <summary style={{fontSize:11,color:D.text3,cursor:"pointer",userSelect:"none"}}>
          Xem context gửi lên Gemini ▸
        </summary>
        <pre style={{fontSize:10,color:D.text3,background:D.bg3,borderRadius:6,padding:"8px",
          marginTop:6,whiteSpace:"pre-wrap",maxHeight:120,overflowY:"auto",border:`1px solid ${D.border}`}}>
          {context}
        </pre>
      </details>
      <button onClick={analyze} disabled={loading} style={{
        background:loading?"#374151":"linear-gradient(135deg,#4285f4,#0f9d58)",
        color:"#fff",border:"none",borderRadius:9,padding:"10px 22px",
        fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer",marginBottom:12,
        boxShadow:loading?"none":"0 0 16px rgba(66,133,244,.4)"
      }}>
        {loading?"⏳ Đang phân tích...":"✨ Phân tích với Gemini AI"}
      </button>
      {result && (
        <div style={{background:"#070d1a",borderRadius:10,padding:"14px 16px",color:D.text1,
          fontSize:13,lineHeight:1.75,whiteSpace:"pre-wrap",border:"1px solid #1e3a5f",
          maxHeight:480,overflowY:"auto"}}>
          <div style={{color:D.green,fontSize:11,fontWeight:600,marginBottom:8}}>✓ Phân tích hoàn thành</div>
          {result}
        </div>
      )}
    </div>
  );
}

function Card({children,style={}}){
  return <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,padding:"14px 16px",...style}}>{children}</div>;
}
function STitle({text,color=D.text3}){
  return <p style={{fontSize:10,color,textTransform:"uppercase",letterSpacing:".07em",fontWeight:600,margin:"0 0 10px"}}>{text}</p>;
}
function KPI({label,value,unit,color,sub}){
  return (
    <div style={{background:D.bg1,border:`1px solid ${color}33`,borderRadius:10,padding:"11px 14px",flex:1,minWidth:130}}>
      <p style={{fontSize:10,color:D.text3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:".06em"}}>{label}</p>
      <p style={{fontSize:18,fontWeight:700,color,margin:0}}>{value}</p>
      {unit&&<p style={{fontSize:10,color:D.text3,margin:"2px 0 0"}}>{unit}</p>}
      {sub&&<p style={{fontSize:10,color:D.text3,margin:"3px 0 0"}}>{sub}</p>}
    </div>
  );
}
function TabBtn({label,active,color="#0ea5e9",onClick}){
  return (
    <button onClick={onClick} style={{padding:"6px 13px",borderRadius:8,fontSize:12,fontWeight:600,
      cursor:"pointer",border:"none",transition:"all .15s",
      background:active?color:"rgba(30,41,59,.8)",color:active?"#fff":D.text2,
      boxShadow:active?`0 0 12px ${color}50`:"none"}}>
      {label}
    </button>
  );
}
function Slider({label,value,min,max,step,format,color,onChange}){
  const pct=((value-min)/(max-min))*100;
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:11,color:D.text2}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color}}>{format(value)}</span>
      </div>
      <div style={{position:"relative",height:5,borderRadius:3,background:D.bg1,border:`1px solid ${D.border}`}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,borderRadius:3,background:color}}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e=>onChange(Number(e.target.value))}
          style={{position:"absolute",top:"50%",left:0,width:"100%",height:18,
            transform:"translateY(-50%)",opacity:0,cursor:"pointer",margin:0}}/>
        <div style={{position:"absolute",top:"50%",left:`${pct}%`,width:14,height:14,
          borderRadius:"50%",background:color,border:"2px solid #020617",
          transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>
      </div>
    </div>
  );
}

function ModelDiagram(){
  const boxes=[
    {x:20,y:20,w:130,h:48,color:D.blue,  label:"x_AI", sub:"Đầu tư AI (tỷ VND)"},
    {x:20,y:95,w:130,h:48,color:D.amber, label:"x_H",  sub:"Đầu tư nhân lực (tỷ)"},
    {x:195,y:10,w:140,h:48,color:D.green, label:"NewJob",     sub:"a₁·xAI"},
    {x:195,y:68,w:140,h:48,color:D.teal,  label:"UpgradeJob", sub:"b₁·xH"},
    {x:195,y:126,w:140,h:48,color:D.coral,label:"Displaced",  sub:"c₁·risk·xAI"},
    {x:385,y:58,w:150,h:58,color:D.purple,label:"NetJob ≥ 0", sub:"New+Upgrade−Displaced"},
  ];
  return (
    <svg viewBox="0 0 560 185" width="100%" style={{fontFamily:"sans-serif"}}>
      <defs><marker id="arr9" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill={D.border}/>
      </marker></defs>
      {[[150,44,195,34],[150,44,195,92],[150,119,195,150],[335,34,385,80],[335,92,385,80],[335,150,385,100]].map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={D.border} strokeWidth={1.5} markerEnd="url(#arr9)"/>
      ))}
      {boxes.map((b,i)=>(
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={7}
            fill={`${b.color}12`} stroke={`${b.color}55`} strokeWidth={1.5}/>
          <text x={b.x+b.w/2} y={b.y+18} textAnchor="middle" fontSize={11} fontWeight="700" fill={b.color}>{b.label}</text>
          <text x={b.x+b.w/2} y={b.y+34} textAnchor="middle" fontSize={8.5} fill={D.text3}>{b.sub}</text>
        </g>
      ))}
      <rect x={385} y={130} width={150} height={32} rx={5} fill={`${D.coral}0e`} stroke={`${D.coral}44`} strokeWidth={1}/>
      <text x={460} y={144} textAnchor="middle" fontSize={9} fill={D.coral}>Displaced ≤ RetrainCap</text>
      <text x={460} y={156} textAnchor="middle" fontSize={8.5} fill={D.text3}>c₁·risk·xAI ≤ d₁·xH</text>
    </svg>
  );
}

function EfficiencyBubble({cNet,bArr}){
  const W=540,H=210,LP=52,RP=18,TP=18,BP=42;
  const px=v=>LP+(v/60)*(W-LP-RP);
  const py=v=>TP+(1-(v-18)/40)*(H-TP-BP);
  const pSize=v=>6+v*2.2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{fontFamily:"sans-serif"}}>
      <line x1={LP} y1={TP} x2={LP} y2={H-BP} stroke={D.border} strokeWidth={1}/>
      <line x1={LP} y1={H-BP} x2={W-RP} y2={H-BP} stroke={D.border} strokeWidth={1}/>
      <line x1={px(15)} y1={TP} x2={px(15)} y2={H-BP} stroke="rgba(248,113,113,.3)" strokeWidth={1} strokeDasharray="4,3"/>
      <line x1={LP} y1={py(35)} x2={W-RP} y2={py(35)} stroke="rgba(251,191,36,.3)" strokeWidth={1} strokeDasharray="4,3"/>
      {SSHORT.map((s,i)=>(
        <g key={i}>
          <circle cx={px(Math.max(0,Math.min(58,cNet[i])))} cy={py(Math.max(19,Math.min(57,bArr[i])))}
            r={pSize(BASE.L[i])} fill={`${SCOLORS[i]}55`} stroke={SCOLORS[i]} strokeWidth={1.5}/>
          <text x={px(Math.max(0,Math.min(58,cNet[i])))+pSize(BASE.L[i])+2}
            y={py(Math.max(19,Math.min(57,bArr[i])))+4} fontSize={9} fill={SCOLORS[i]}>{s}</text>
        </g>
      ))}
      <text x={(LP+W-RP)/2} y={H-5} textAnchor="middle" fontSize={10} fill={D.text3}>Hiệu quả AI (việc/tỷ net)</text>
      <text x={10} y={(TP+H-BP)/2} textAnchor="middle" fontSize={10} fill={D.text3}
        transform={`rotate(-90,10,${(TP+H-BP)/2})`}>Hiệu quả H (việc/tỷ)</text>
      {[0,15,30,45,60].map(v=>(
        <text key={v} x={px(v)} y={H-BP+14} textAnchor="middle" fontSize={8} fill={D.text3}>{v}</text>
      ))}
      {[20,30,40,50].map(v=>(
        <text key={v} x={LP-4} y={py(v)+4} textAnchor="end" fontSize={8} fill={D.text3}>{v}</text>
      ))}
    </svg>
  );
}

function LaborFlow({sector,L,Displaced,NewAI,Upgraded,color}){
  const labPool=Math.round(L*1e6);
  const pctDis=(Displaced/labPool*100).toFixed(3);
  return (
    <div style={{padding:"12px 14px",background:`${color}0a`,border:`1px solid ${color}33`,borderRadius:9,marginBottom:8}}>
      <p style={{fontSize:12,fontWeight:600,color,margin:"0 0 8px"}}>{sector}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
        <div>
          <p style={{color:D.text3,margin:"0 0 3px"}}>Lao động hiện tại</p>
          <p style={{fontSize:15,fontWeight:700,color,margin:0}}>{L.toFixed(2)}M người</p>
        </div>
        <div>
          <p style={{color:D.coral,margin:"0 0 3px"}}>Bị dịch chuyển</p>
          <p style={{fontSize:15,fontWeight:700,color:D.coral,margin:0}}>{Displaced.toLocaleString()}</p>
          <p style={{fontSize:10,color:D.text3}}>{pctDis}% tổng LĐ</p>
        </div>
        <div>
          <p style={{color:D.green,margin:"0 0 3px"}}>Việc mới (AI+Upgrade)</p>
          <p style={{fontSize:15,fontWeight:700,color:D.green,margin:0}}>{(NewAI+Upgraded).toLocaleString()}</p>
          <p style={{fontSize:10,color:D.text3}}>Net: +{(NewAI+Upgraded-Displaced).toLocaleString()}</p>
        </div>
      </div>
      <div style={{marginTop:8,height:8,borderRadius:4,overflow:"hidden",background:D.bg1,display:"flex"}}>
        <div style={{width:`${Math.min(NewAI/(NewAI+Upgraded+1)*100,100)}%`,background:D.blue,opacity:.9}}/>
        <div style={{width:`${Math.min(Upgraded/(NewAI+Upgraded+1)*100,100)}%`,background:D.green,opacity:.9}}/>
      </div>
    </div>
  );
}

export default function App(){
  const [tab, setTab] = useState("c1");
  const [chartReady, setChartReady] = useState(false);

  const [risk,  setRisk]  = useState([...BASE.risk]);
  const [a1,    setA1]    = useState([...BASE.a1]);
  const [b1,    setB1]    = useState([...BASE.b1]);
  const [c1,    setC1]    = useState([...BASE.c1]);
  const [d1,    setD1]    = useState([...BASE.d1]);
  const [budget,setBudget]= useState(30000);
  const [minAI, setMinAI] = useState(100);
  const [minH,  setMinH]  = useState(200);

  const {results,totalNet,totalAI,totalH} = useMemo(
    ()=>solveLPGreedy(risk,a1,b1,c1,d1,budget,minAI,minH),
    [risk,a1,b1,c1,d1,budget,minAI,minH]
  );

  const cNet = useMemo(()=>a1.map((a,i)=>+(a-c1[i]*risk[i]).toFixed(3)),[a1,c1,risk]);

  const ax = {
    x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:D.text3,font:{size:9}}},
    y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:D.text3,font:{size:9}}},
  };

  const cEff=useRef(), cAlloc=useRef(), cNetJob=useRef(),
        cDisNet=useRef(), cDisPct=useRef(), cThresh=useRef();

  useChart(cEff,"bar",()=>({
    labels:SSHORT,
    datasets:[{label:"Net việc/tỷ AI",data:cNet,
      backgroundColor:SCOLORS.map(c=>c+"aa"),borderColor:SCOLORS,borderWidth:2,borderRadius:5}],
    options:{plugins:{legend:{display:false}},scales:{x:ax.x,y:ax.y}},
  }),[chartReady,tab,JSON.stringify(cNet)]);

  useChart(cAlloc,"bar",()=>({
    labels:SSHORT,
    datasets:[
      {label:"x_AI (tỷ)",data:results.map(r=>r.xAI),
        backgroundColor:D.blue+"99",borderColor:D.blue,borderWidth:1,borderRadius:4},
      {label:"x_H ÷1000",data:results.map(r=>r.xH/1000),
        backgroundColor:D.amber+"99",borderColor:D.amber,borderWidth:1,borderRadius:4},
    ],
    options:{scales:{x:ax.x,y:ax.y}},
  }),[chartReady,tab,JSON.stringify(results)]);

  useChart(cNetJob,"bar",()=>({
    labels:SSHORT,
    datasets:[
      {label:"NewJob",data:results.map(r=>r.New),backgroundColor:D.blue+"88",borderColor:D.blue,borderWidth:1,borderRadius:3},
      {label:"UpgradeJob",data:results.map((r,i)=>i<7?r.Up:0),backgroundColor:D.teal+"88",borderColor:D.teal,borderWidth:1,borderRadius:3},
      {label:"Displaced (−)",data:results.map(r=>-r.Dis),backgroundColor:D.coral+"88",borderColor:D.coral,borderWidth:1,borderRadius:3},
    ],
    options:{scales:{x:{...ax.x,stacked:true},y:{...ax.y,stacked:true}}},
  }),[chartReady,tab,JSON.stringify(results)]);

  useChart(cDisNet,"bar",()=>({
    labels:SSHORT,
    datasets:[
      {label:"Displaced",data:results.map(r=>r.Dis),backgroundColor:D.coral+"88",borderColor:D.coral,borderWidth:1,borderRadius:3},
      {label:"Net ÷1000",data:results.map(r=>+(r.Net/1000).toFixed(1)),backgroundColor:D.green+"77",borderColor:D.green,borderWidth:1,borderRadius:3},
    ],
    options:{scales:{x:ax.x,y:ax.y}},
  }),[chartReady,tab,JSON.stringify(results)]);

  useChart(cDisPct,"bar",()=>({
    labels:SSHORT,
    datasets:[{label:"Displaced/Tổng LĐ (%)",data:results.map((r,i)=>+(r.Dis/(BASE.L[i]*1e6)*100).toFixed(4)),
      backgroundColor:SCOLORS.map(c=>c+"88"),borderColor:SCOLORS,borderWidth:1,borderRadius:5}],
    options:{plugins:{legend:{display:false}},scales:{x:ax.x,y:ax.y}},
  }),[chartReady,tab,JSON.stringify(results)]);

  const thX=[1000,3000,5000,8000,10000,12000,15000];
  useChart(cThresh,"line",()=>({
    labels:thX.map(v=>`${v/1000}K`),
    datasets:[
      {label:"x_H tối thiểu để retrain",data:thX.map(xai=>Math.round(c1[1]*risk[1]*xai/d1[1])),
        borderColor:D.coral,backgroundColor:"rgba(248,113,113,.15)",fill:true,tension:.3,pointRadius:5,borderWidth:2.5},
      {label:"Ngân sách còn lại",data:thX.map(xai=>budget-xai),
        borderColor:D.blue,borderDash:[5,4],borderWidth:1.5,pointRadius:0},
    ],
    options:{scales:{x:ax.x,y:ax.y}},
  }),[chartReady,tab,JSON.stringify([c1[1],risk[1],d1[1],budget])]);

  useEffect(()=>{
    if(window.Chart){setChartReady(true);return;}
    const sc=document.createElement("script");
    sc.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    sc.onload=()=>setChartReady(true);
    document.head.appendChild(sc);
  },[]);

  function resetAll(){
    setRisk([...BASE.risk]);setA1([...BASE.a1]);setB1([...BASE.b1]);
    setC1([...BASE.c1]);setD1([...BASE.d1]);
    setBudget(30000);setMinAI(100);setMinH(200);
  }

  const gemCtx = {
    c1:`Bài 9 — Mô hình NetJob tác động AI thị trường lao động Việt Nam
8 ngành, ngân sách ${budget.toLocaleString()} tỷ VND
Tổng NetJob tối ưu: ${totalNet.toLocaleString()} việc
c_net: ${SSHORT.map((s,i)=>s+": "+cNet[i]).join(" | ")}
Hiệu quả nhất: CNTT ${cNet[6].toFixed(1)} việc/tỷ
Risk cao nhất: Tài chính-NH ${(risk[4]*100).toFixed(0)}%`,
    c2:`Kết quả phân bổ tối ưu Bài 9 (ngân sách ${budget.toLocaleString()} tỷ):
${results.map(r=>`${r.s}: xAI=${r.xAI}tỷ xH=${r.xH}tỷ New=${r.New} Up=${r.Up} Dis=${r.Dis} Net=${r.Net}`).join("\n")}
Tổng: NetJob=${totalNet.toLocaleString()} | x_H chiếm ${(totalH/budget*100).toFixed(1)}% ngân sách`,
    c3:`Phân tích ngưỡng đào tạo lại — CN chế biến chế tạo:
c1=${c1[1]} risk=${(risk[1]*100).toFixed(0)}% d1=${d1[1]}
Với x_AI=15000 tỷ: Displaced=${Math.round(c1[1]*risk[1]*15000).toLocaleString()} việc
Cần x_H tối thiểu: ${Math.round(c1[1]*risk[1]*15000/d1[1]).toLocaleString()} tỷ
Ràng buộc 5%·L cho Tài chính-NH: cap=${Math.round(BASE.L[4]*1e6*0.05).toLocaleString()} việc → INFEASIBLE`,
    c4:`Dịch chuyển lao động 3 ngành dễ tổn thương:
Nông-Lâm (${BASE.L[0]}M LĐ): Displaced=${results[0]?.Dis||0} Net=+${results[0]?.Net||0}
Xây dựng (${BASE.L[2]}M LĐ): Displaced=${results[2]?.Dis||0} Net=+${results[2]?.Net||0}
Bán buôn (${BASE.L[3]}M LĐ): Displaced=${results[3]?.Dis||0} Net=+${results[3]?.Net||0}
Nguyên tắc: tốc độ tự động hóa không vượt năng lực đào tạo lại`,
    c5:`Tóm tắt toàn bộ Bài 9:
Ngân sách: ${budget.toLocaleString()} tỷ | Tổng NetJob: ${totalNet.toLocaleString()} việc
x_H chiếm ${(totalH/budget*100).toFixed(1)}% ngân sách — nhân lực là ưu tiên tuyệt đối
Risk Tài chính-NH: ${(risk[4]*100).toFixed(0)}% — cần chiến lược AI-augmentation
Khuyến nghị: đầu tư nhân lực đi trước AI, kiểm soát tốc độ tự động hóa`,
  };

  const TABS=[
    {id:"c1",label:"① Mô hình & Hiệu quả",color:"#0ea5e9"},
    {id:"c2",label:"② Kết quả tối ưu",    color:"#14b8a6"},
    {id:"c3",label:"③ Ngưỡng đào tạo",    color:"#f59e0b"},
    {id:"c4",label:"④ Dịch chuyển LĐ",   color:"#8b5cf6"},
    {id:"c5",label:"⑤ Thảo luận",          color:"#4ade80"},
    {id:"p0",label:"⚙ Tham số",            color:"#f87171"},
  ];

  function ParamSidebar(){
    return (
      <div style={{display:"flex",flexDirection:"column",gap:10,position:"sticky",top:12,maxHeight:"calc(100vh - 40px)",overflowY:"auto"}}>
        <Card style={{borderColor:"#f8717144"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <STitle text="Tham số mô hình" color="#f87171"/>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:D.green,animation:"pulse 2s infinite",boxShadow:`0 0 6px ${D.green}`}}/>
              <span style={{fontSize:9,color:D.text3}}>realtime</span>
            </div>
          </div>
          <Slider label="Ngân sách tổng (tỷ)" value={budget} min={10000} max={100000} step={1000}
            format={v=>`${(v/1000).toFixed(0)}K`} color={D.blue} onChange={setBudget}/>
          <Slider label="Đầu tư AI tối thiểu/ngành" value={minAI} min={50} max={500} step={50}
            format={v=>v+"tỷ"} color={D.blue} onChange={setMinAI}/>
          <Slider label="Đầu tư H tối thiểu/ngành" value={minH} min={100} max={1000} step={50}
            format={v=>v+"tỷ"} color={D.amber} onChange={setMinH}/>

          <p style={{fontSize:10,color:D.coral,margin:"8px 0 6px",fontWeight:600}}>Risk tự động hóa (%)</p>
          {SECTORS.map((s,i)=>(
            <Slider key={i} label={SSHORT[i]} value={risk[i]} min={0.05} max={0.80} step={0.01}
              format={v=>(v*100).toFixed(0)+"%"} color={SCOLORS[i]}
              onChange={v=>setRisk(r=>{const n=[...r];n[i]=v;return n;})}/>
          ))}

          <p style={{fontSize:10,color:D.blue,margin:"8px 0 6px",fontWeight:600}}>Hệ số a₁ (New việc/tỷ AI)</p>
          {SECTORS.map((s,i)=>(
            <Slider key={i} label={SSHORT[i]} value={a1[i]} min={1} max={100} step={0.5}
              format={v=>v.toFixed(1)} color={SCOLORS[i]}
              onChange={v=>setA1(r=>{const n=[...r];n[i]=v;return n;})}/>
          ))}

          <p style={{fontSize:10,color:D.amber,margin:"8px 0 6px",fontWeight:600}}>Hệ số b₁ (Upgrade việc/tỷ H)</p>
          {SECTORS.map((s,i)=>(
            <Slider key={i} label={SSHORT[i]} value={b1[i]} min={5} max={80} step={0.5}
              format={v=>v.toFixed(1)} color={SCOLORS[i]}
              onChange={v=>setB1(r=>{const n=[...r];n[i]=v;return n;})}/>
          ))}

          <button onClick={resetAll} style={{width:"100%",marginTop:10,padding:"7px",borderRadius:7,
            fontSize:11,fontWeight:600,background:"rgba(248,113,113,.12)",color:D.coral,
            border:"1px solid #f8717133",cursor:"pointer"}}>
            ↺ Reset về gốc
          </button>
        </Card>

        <Card>
          <STitle text="Kết quả hiện tại"/>
          {[
            {l:"Tổng NetJob",v:totalNet.toLocaleString(),c:D.green},
            {l:"x_AI tổng",  v:totalAI.toLocaleString()+" tỷ",c:D.blue},
            {l:"x_H tổng",   v:totalH.toLocaleString()+" tỷ", c:D.amber},
            {l:"CNTT c_net", v:cNet[6].toFixed(2)+" việc/tỷ", c:D.cyan},
            {l:"Tài chính risk",v:(risk[4]*100).toFixed(0)+"%",c:D.coral},
          ].map(k=>(
            <div key={k.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"5px 8px",borderRadius:6,background:D.bg1,marginBottom:4}}>
              <span style={{fontSize:11,color:D.text2}}>{k.l}</span>
              <span style={{fontSize:12,fontWeight:700,color:k.c}}>{k.v}</span>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",
      background:`linear-gradient(135deg,${D.bg0},${D.bg1},${D.bg3})`,
      fontFamily:"'Segoe UI',sans-serif",color:D.text1,padding:"16px"}}>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}"}</style>

      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{display:"inline-block",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,letterSpacing:2,marginBottom:8,color:"#fff"}}>
          AIDEOM-VN · PHẦN D · INTERACTIVE + AI
        </div>
        <h1 style={{fontSize:20,fontWeight:900,margin:"0 0 4px",
          background:"linear-gradient(90deg,#38bdf8,#4ade80)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 9 — Tác động AI tới Thị trường Lao động Việt Nam
        </h1>
        <p style={{fontSize:11,color:D.text3,margin:0}}>
          max Σ NetJob · 8 ngành · x_AI + x_H · Ngân sách {(budget/1000).toFixed(0)}K tỷ · Kéo slider → realtime · Gemini AI phân tích
        </p>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <KPI label="Tổng NetJob tối ưu" value={totalNet.toLocaleString()} unit="việc làm ròng" color={D.green} sub="Giáo dục chiếm phần lớn"/>
        <KPI label="Ngân sách" value={`${(budget/1000).toFixed(0)}K tỷ`} unit={`AI ${totalAI.toLocaleString()} + H ${totalH.toLocaleString()}`} color={D.blue} sub="100% được phân bổ"/>
        <KPI label="CNTT — Hiệu quả nhất" value={`${cNet[6].toFixed(1)} việc/tỷ`} unit="net từ AI" color={D.cyan} sub="Cao nhất trong 8 ngành"/>
        <KPI label="Tài chính — Risk cao" value={`${(risk[4]*100).toFixed(0)}%`} unit="tự động hóa" color={D.coral} sub="c₁·risk cao nhất"/>
        <KPI label="Giáo dục — H ưu tiên" value={`${(results[7]?.xH||0).toLocaleString()} tỷ`} unit="x_H" color={D.amber} sub="b₁=55 cao nhất"/>
      </div>

      <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} color={t.color} onClick={()=>setTab(t.id)}/>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:tab==="p0"?"1fr":"260px 1fr",gap:14,alignItems:"start"}}>
        {tab!=="p0" && <ParamSidebar/>}

        <div style={{minWidth:0}}>

          {tab==="c1" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Card>
                <h3 style={{margin:"0 0 6px",color:D.blue,fontSize:14}}>Mô hình NetJob — cơ chế hoạt động</h3>
                <p style={{fontSize:11,color:D.text3,margin:"0 0 10px"}}>
                  NetJobᵢ = NewJobᵢ + UpgradeJobᵢ − DisplacedJobᵢ &nbsp;|&nbsp; Ràng buộc: Displacedᵢ ≤ RetrainCapᵢ
                </p>
                <ModelDiagram/>
              </Card>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Card>
                  <STitle text="Hiệu quả AI — c_net = a₁ − c₁·risk" color={D.teal}/>
                  <div style={{position:"relative",height:200}}><canvas ref={cEff}/></div>
                </Card>
                <Card>
                  <STitle text="Bubble: AI vs H efficiency (kích thước = số LĐ)" color={D.amber}/>
                  <EfficiencyBubble cNet={cNet} bArr={b1}/>
                </Card>
              </div>
              <Card>
                <STitle text="Bảng thông số 8 ngành — dữ liệu đầu vào" color={D.blue}/>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${D.border}`}}>
                        {["Ngành","LĐ (tr.)","Risk %","a₁","b₁","c₁","d₁","c_net"].map(h=>(
                          <th key={h} style={{padding:"5px 7px",color:D.text3,textAlign:"right",fontSize:10,fontWeight:600}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SECTORS.map((s,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${D.border}`,background:i%2===0?D.bg3:"transparent"}}>
                          <td style={{padding:"5px 7px",fontWeight:600,color:SCOLORS[i]}}>{s}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace"}}>{BASE.L[i].toFixed(2)}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",
                            color:risk[i]>=0.5?D.coral:risk[i]>=0.35?D.amber:D.text2,fontWeight:risk[i]>=0.5?700:400}}>
                            {(risk[i]*100).toFixed(0)}%
                          </td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.blue}}>{a1[i]}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.amber}}>{b1[i]}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.coral}}>{c1[i]}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.teal}}>{d1[i]}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",fontWeight:700,
                            color:cNet[i]>20?D.green:cNet[i]>10?D.teal:D.text2}}>{cNet[i].toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <GeminiPanel context={gemCtx.c1} tabLabel="Mô hình & Hiệu quả AI"/>
            </div>
          )}

          {tab==="c2" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Card>
                  <STitle text="Câu 9.4.1 — Phân bổ tối ưu (x_AI, x_H)" color={D.green}/>
                  <div style={{position:"relative",height:230}}><canvas ref={cAlloc}/></div>
                  <div style={{marginTop:8,padding:"7px 10px",background:D.amberBg,
                    borderLeft:`3px solid ${D.amber}`,borderRadius:6,fontSize:11,color:D.text2}}>
                    Giáo dục nhận nhiều x_H nhất vì b₁=55 việc/tỷ cao nhất.
                  </div>
                </Card>
                <Card>
                  <STitle text="NetJob theo ngành — stacked" color={D.green}/>
                  <div style={{position:"relative",height:230}}><canvas ref={cNetJob}/></div>
                  <p style={{fontSize:10,color:D.text3,margin:"6px 0 0"}}>*Giáo dục bị cắt để dễ đọc các ngành khác</p>
                </Card>
              </div>
              <Card>
                <STitle text="Bảng kết quả đầy đủ — NetJob từng ngành" color={D.green}/>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${D.border}`}}>
                        {["Ngành","x_AI (tỷ)","x_H (tỷ)","NewJob","UpgradeJob","Displaced","NetJob","% tổng"].map(h=>(
                          <th key={h} style={{padding:"5px 7px",color:D.text3,textAlign:"right",fontSize:10,fontWeight:600}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${D.border}`,background:i%2===0?D.bg3:"transparent"}}>
                          <td style={{padding:"5px 7px",fontWeight:600,color:SCOLORS[i]}}>{r.s}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.blue}}>{r.xAI.toLocaleString()}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.amber,fontWeight:r.xH>1000?700:400}}>{r.xH.toLocaleString()}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.blue}}>{r.New.toLocaleString()}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.teal}}>{r.Up.toLocaleString()}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.coral}}>{r.Dis.toLocaleString()}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",fontFamily:"monospace",color:D.green,fontWeight:600}}>{r.Net.toLocaleString()}</td>
                          <td style={{padding:"5px 7px",textAlign:"right",color:D.text3}}>{totalNet>0?(r.Net/totalNet*100).toFixed(2)+"%":"—"}</td>
                        </tr>
                      ))}
                      <tr style={{borderTop:`2px solid ${D.green}`}}>
                        <td style={{padding:"6px 7px",fontWeight:700,color:D.green}}>TỔNG</td>
                        <td style={{padding:"6px 7px",textAlign:"right",fontWeight:700,color:D.blue}}>{totalAI.toLocaleString()}</td>
                        <td style={{padding:"6px 7px",textAlign:"right",fontWeight:700,color:D.amber}}>{totalH.toLocaleString()}</td>
                        <td colSpan={3} style={{padding:"6px 7px",textAlign:"right",color:D.text3}}>—</td>
                        <td style={{padding:"6px 7px",textAlign:"right",fontWeight:800,color:D.green,fontSize:13}}>{totalNet.toLocaleString()}</td>
                        <td style={{padding:"6px 7px",textAlign:"right",color:D.green}}>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
              <GeminiPanel context={gemCtx.c2} tabLabel="Kết quả phân bổ tối ưu"/>
            </div>
          )}

          {tab==="c3" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Card>
                  <STitle text="Câu 9.4.2 — Ngưỡng x_H tối thiểu: CN chế biến" color={D.blue}/>
                  <div style={{padding:"12px 14px",background:D.blueBg,border:`1px solid ${D.blue}44`,borderRadius:9,marginBottom:10}}>
                    <p style={{fontSize:12,color:D.text2,margin:"0 0 6px"}}>
                      c_net[1] = {a1[1]} − {c1[1]}×{risk[1].toFixed(2)} = <strong style={{color:D.green}}>{cNet[1].toFixed(3)}</strong>
                    </p>
                    <p style={{fontSize:12,color:D.green,fontWeight:600,margin:"0 0 4px"}}>
                      ✓ Mỗi tỷ AI tạo {cNet[1].toFixed(2)} việc ròng
                    </p>
                    <p style={{fontSize:11,color:D.text3,margin:0}}>→ Retrain Capacity là ràng buộc quan trọng hơn</p>
                  </div>
                  <div style={{padding:"12px 14px",background:D.amberBg,border:`1px solid ${D.amber}44`,borderRadius:9}}>
                    <p style={{fontSize:12,color:D.amber,fontWeight:700,margin:"0 0 6px"}}>Với x_AI = 15.000 tỷ:</p>
                    <p style={{fontSize:12,color:D.text2,margin:"0 0 4px"}}>
                      Displaced = {c1[1]}×{risk[1].toFixed(2)}×15000 = <strong style={{color:D.coral}}>{Math.round(c1[1]*risk[1]*15000).toLocaleString()} việc</strong>
                    </p>
                    <p style={{fontSize:12,color:D.amber,fontWeight:700,margin:"0 0 4px"}}>
                      Cần x_H ≥ {Math.round(c1[1]*risk[1]*15000/d1[1]).toLocaleString()} tỷ
                    </p>
                    <p style={{fontSize:11,color:D.text3,margin:0}}>
                      (để d₁·xH = {d1[1]}×... ≥ Displaced)
                    </p>
                  </div>
                </Card>
                <Card>
                  <STitle text="Đường ngưỡng x_H tối thiểu (CN chế biến)" color={D.purple}/>
                  <div style={{position:"relative",height:230}}><canvas ref={cThresh}/></div>
                  <div style={{marginTop:8,padding:"7px 10px",background:D.tealBg,borderLeft:`3px solid ${D.teal}`,borderRadius:6,fontSize:11,color:D.text2}}>
                    Đường đỏ (x_H min) vs đường xanh (x_H còn lại): giao nhau = điểm cân bằng ~14.700 tỷ.
                  </div>
                </Card>
              </div>
              <Card>
                <STitle text="Câu 9.4.4 — Ràng buộc Displaced ≤ 5%·L — KHÔNG KHẢ THI" color={D.coral}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div style={{padding:"12px 14px",background:D.coralBg,border:`1px solid ${D.coral}44`,borderRadius:9}}>
                    <p style={{fontSize:13,fontWeight:700,color:D.coral,margin:"0 0 8px"}}>⛔ INFEASIBLE</p>
                    <p style={{fontSize:12,color:D.text2,margin:"0 0 8px"}}>Ràng buộc 5%·L làm bài toán vô nghiệm vì:</p>
                    {[4,1,0].map(i=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${D.border}`}}>
                        <span style={{fontSize:11,color:D.text2}}>{SSHORT[i]}</span>
                        <span style={{fontSize:11,color:D.coral,fontFamily:"monospace"}}>
                          Cap = {Math.round(BASE.L[i]*1e6*0.05).toLocaleString()} việc
                        </span>
                      </div>
                    ))}
                    <p style={{fontSize:11,color:D.text3,margin:"8px 0 0"}}>
                      Tài chính-NH: c₁·risk={c1[4]}×{risk[4].toFixed(2)}={+(c1[4]*risk[4]).toFixed(1)}/tỷ → x_AI={Math.round(BASE.L[4]*1e6*0.05/(c1[4]*risk[4])).toLocaleString()} tỷ đã phá cap!
                    </p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[4,3,1].map(i=>(
                      <div key={i} style={{padding:"10px 12px",background:`${SCOLORS[i]}0a`,border:`1px solid ${SCOLORS[i]}33`,borderRadius:7}}>
                        <p style={{fontSize:11,fontWeight:600,color:SCOLORS[i],margin:"0 0 4px"}}>{SECTORS[i]}</p>
                        <div style={{display:"flex",gap:12,fontSize:10,color:D.text2}}>
                          <span>L={BASE.L[i]}M | Risk={(risk[i]*100).toFixed(0)}%</span>
                          <span style={{color:SCOLORS[i]}}>Cap 5% = {(BASE.L[i]*1e6*0.05/1000).toFixed(0)}K</span>
                        </div>
                        <p style={{fontSize:10,color:D.text3,margin:"3px 0 0"}}>
                          x_AI phá cap: <strong style={{color:SCOLORS[i]}}>{Math.round(BASE.L[i]*1e6*0.05/(c1[i]*risk[i])).toLocaleString()} tỷ</strong>
                        </p>
                      </div>
                    ))}
                    <div style={{padding:"9px 12px",background:D.tealBg,borderLeft:`3px solid ${D.teal}`,borderRadius:6,fontSize:11,color:D.text2}}>
                      Giải pháp: tăng budget hoặc nới cap lên 10-15%·L.
                    </div>
                  </div>
                </div>
              </Card>
              <GeminiPanel context={gemCtx.c3} tabLabel="Ngưỡng đào tạo lại"/>
            </div>
          )}

          {tab==="c4" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Card>
                <STitle text="Câu 9.4.3 — Luồng dịch chuyển: 3 ngành dễ bị tổn thương" color={D.purple}/>
                {[0,2,3].map(i=>(
                  <LaborFlow key={i} sector={SECTORS[i]} L={BASE.L[i]}
                    Displaced={results[i]?.Dis||0} NewAI={results[i]?.New||0}
                    Upgraded={results[i]?.Up||0} color={SCOLORS[i]}/>
                ))}
              </Card>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Card>
                  <STitle text="So sánh Displaced vs NetJob" color={D.purple}/>
                  <div style={{position:"relative",height:220}}><canvas ref={cDisNet}/></div>
                </Card>
                <Card>
                  <STitle text="Tỷ lệ Displaced / Tổng LĐ (%)" color={D.amber}/>
                  <div style={{position:"relative",height:220}}><canvas ref={cDisPct}/></div>
                  <div style={{marginTop:8,padding:"7px 10px",background:D.greenBg,borderLeft:`3px solid ${D.green}`,borderRadius:6,fontSize:11,color:D.text2}}>
                    Tỷ lệ Displaced rất nhỏ (&lt;0.05%) vì x_AI chỉ {minAI} tỷ/ngành.
                    Tăng x_AI → Displaced tăng → cần đầu tư H tương ứng. "Tốc độ tự động hóa không vượt năng lực đào tạo lại."
                  </div>
                </Card>
              </div>
              <GeminiPanel context={gemCtx.c4} tabLabel="Dịch chuyển lao động"/>
            </div>
          )}

          {tab==="c5" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                {q:"a) Ngành nào cần đầu tư đào tạo lại nhiều nhất? Có khớp thực tế Việt Nam?",color:D.amber,
                 a:`Mô hình tối ưu dồn phần lớn ngân sách vào x_H của Giáo dục-Đào tạo vì b₁=55 việc/tỷ cao nhất — mỗi tỷ đầu tư nhân lực ngành giáo dục tạo 55 việc làm nâng cấp.

Nếu phân bổ hợp lý hơn: CN chế biến chế tạo (${BASE.L[1]}M LĐ, risk ${(risk[1]*100).toFixed(0)}%) cần đào tạo lại nhiều nhất về số lượng tuyệt đối.

Thực tế Việt Nam 2024-2025: chương trình "50.000 kỹ sư AI" (P12 Bài 5) và đào tạo nghề cho LĐ sản xuất ở Bình Dương/Đồng Nai — khớp với mô hình. Logistics-Vận tải (c_net=${cNet[5].toFixed(2)}) cũng cần ưu tiên do tự động hóa cảng biển và kho vận đang diễn ra nhanh tại TP.HCM, Hải Phòng.`},
                {q:"b) Tài chính-NH: risk cao nhưng hệ số tạo việc mới cao — chiến lược gì?",color:D.purple,
                 a:`Tài chính-NH: c_net = ${a1[4]} − ${c1[4]}×${risk[4].toFixed(2)} = ${cNet[4].toFixed(3)} việc/tỷ AI — vẫn dương nhưng thấp hơn CNTT và Logistics. Đặc biệt: a₁=${a1[4]} (tạo nhiều việc AI mới) nhưng c₁=${c1[4]} (displacement lớn).

Chiến lược tối ưu: "AI-augmentation thay vì AI-replacement" — đầu tư AI hỗ trợ nhân viên (AI copilot) thay vì thay thế hoàn toàn.
(1) x_AI tập trung vào AI phân tích rủi ro, phát hiện gian lận — không thay người mà tăng năng suất;
(2) x_H đầu tư vào đào tạo "AI literacy" cho nhân viên ngân hàng;
(3) d₁=${d1[4]} thấp → cần cải thiện chương trình đào tạo lại.`},
                {q:"c) Có nên đầu tư x_AI vào Nông-Lâm-Thủy sản? Mô hình nói gì?",color:D.green,
                 a:`Mô hình cho x_AI=${results[0]?.xAI||100} tỷ (tối thiểu) vào Nông-Lâm vì c_net = ${cNet[0].toFixed(3)} việc/tỷ — trung bình. b₁=${b1[0]} tốt → nên dùng x_H nhiều hơn.

Tuy nhiên từ góc độ chính sách xã hội: ${BASE.L[0]}M LĐ (26.5% tổng) — nếu AI nông nghiệp thay thế 1% → 132.000 người cần chuyển đổi.

Khuyến nghị: đầu tư AI nông nghiệp ĐBSCL (P11 Bài 5) song hành với "nông dân số" đào tạo vận hành thiết bị thông minh. Tốc độ tự động hóa phải được kiểm soát không vượt tốc độ đô thị hóa hấp thụ lao động dư thừa.`},
                {q:"d) Ràng buộc 'tốc độ TĐH ≤ năng lực đào tạo lại' được biểu diễn bằng ràng buộc nào?",color:D.teal,
                 a:`Ràng buộc trong mô hình: Displaced_i ≤ RetrainCap_i ↔ c₁ᵢ·riskᵢ·xAI_i ≤ d₁ᵢ·xH_i

Đây là biểu diễn toán học của nguyên tắc "tốc độ tự động hóa không vượt năng lực đào tạo lại".

Đề xuất bổ sung ràng buộc an sinh xã hội:
(1) Tốc độ hàng năm: Displaced_i,t ≤ 0.05·L_i (quá chặt → nên nới lên 8-10%);
(2) Thời gian delay: RetCap_i,t ≥ Displaced_i,t+lag (lag = 2-3 năm);
(3) Hỗ trợ thu nhập: chi phí trợ cấp 6-12 tháng cho người bị displaced;
(4) Bất bình đẳng vùng: nông thôn ít lựa chọn chuyển đổi hơn đô thị → hệ số điều chỉnh regional.`},
              ].map((item,i)=>(
                <Card key={i}>
                  <div style={{padding:"7px 10px",background:`${item.color}10`,borderLeft:`3px solid ${item.color}`,borderRadius:6,marginBottom:8}}>
                    <p style={{fontSize:13,fontWeight:600,color:item.color,margin:0}}>{item.q}</p>
                  </div>
                  <p style={{fontSize:12,color:D.text2,lineHeight:1.85,margin:0,whiteSpace:"pre-line"}}>{item.a}</p>
                </Card>
              ))}
              <Card style={{border:`1px solid ${D.cyan}33`}}>
                <STitle text="Công thức mô hình — tóm tắt" color={D.cyan}/>
                <div style={{fontFamily:"monospace",fontSize:12,lineHeight:2.1,background:D.bg3,borderRadius:8,padding:"10px 14px",color:D.text2}}>
                  <p style={{margin:0}}>max Σᵢ NetJobᵢ = Σᵢ [a₁ᵢ·xAI + b₁ᵢ·xH − c₁ᵢ·riskᵢ·xAI]</p>
                  <p style={{margin:0}}>s.t. Σᵢ(xAI_i + xH_i) ≤ <span style={{color:D.blue}}>{budget.toLocaleString()}</span></p>
                  <p style={{margin:0}}>     NetJobᵢ ≥ 0 &nbsp; ∀i</p>
                  <p style={{margin:0}}>     Displaced_i ≤ RetrainCap_i = d₁ᵢ·xH_i &nbsp; ∀i</p>
                  <p style={{margin:"8px 0 0",color:D.green,fontWeight:700}}>
                    → Tổng NetJob* = {totalNet.toLocaleString()} việc | x_H chiếm {(totalH/budget*100).toFixed(1)}% ngân sách
                  </p>
                </div>
              </Card>
              <GeminiPanel context={gemCtx.c5} tabLabel="Thảo luận & Chính sách"/>
            </div>
          )}

          {tab==="p0" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <ParamSidebar/>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Card>
                  <STitle text="Preview — c_net sau khi điều chỉnh" color={D.teal}/>
                  <div style={{position:"relative",height:220}}><canvas ref={cEff}/></div>
                </Card>
                <Card>
                  <STitle text="Preview — Phân bổ x_AI / x_H" color={D.amber}/>
                  <div style={{position:"relative",height:220}}><canvas ref={cAlloc}/></div>
                </Card>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                  {[
                    {l:"Tổng NetJob",    v:totalNet.toLocaleString(),            c:D.green},
                    {l:"x_H / ngân sách",v:(totalH/budget*100).toFixed(1)+"%",  c:D.amber},
                    {l:"c_net CNTT",     v:cNet[6].toFixed(2),                  c:D.cyan},
                    {l:"c_net Nông-Lâm", v:cNet[0].toFixed(2),                  c:D.green},
                    {l:"Risk Tài chính", v:(risk[4]*100).toFixed(0)+"%",        c:D.coral},
                    {l:"Ngân sách",      v:(budget/1000).toFixed(0)+"K tỷ",     c:D.blue},
                  ].map(k=>(
                    <div key={k.l} style={{padding:"10px 12px",background:D.bg3,borderRadius:8,border:`1px solid ${k.c}33`}}>
                      <p style={{fontSize:10,color:D.text3,margin:"0 0 2px",textTransform:"uppercase"}}>{k.l}</p>
                      <p style={{fontSize:17,fontWeight:700,color:k.c,margin:0}}>{k.v}</p>
                    </div>
                  ))}
                </div>
                <GeminiPanel context={gemCtx.c5} tabLabel="Kết quả hiện tại"/>
              </div>
            </div>
          )}

          <div style={{marginTop:20,textAlign:"center",fontSize:10,color:D.text3,borderTop:`1px solid ${D.border}`,paddingTop:10}}>
            Bài 9 — AIDEOM-VN | Solver: Greedy LP | Dữ liệu: ILO Vietnam 2024 | Gemini 2.0 Flash
          </div>
        </div>
      </div>
    </div>
  );
}