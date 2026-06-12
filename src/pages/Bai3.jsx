import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend, LineChart, Line
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
  cyan:"#67e8f9",   pink:"#f472b6",
};

const SECTOR_COLORS = [
  D.green, D.blue, D.amber, D.t3,
  D.coral, D.teal, D.purple, D.pink, "#fb923c", "#34d399"
];

// ── DỮ LIỆU GỐC (có thể chỉnh qua slider) ──────────────────────────
const SECTORS_FULL = [
  "Nông-Lâm-Thủy sản","CN chế biến chế tạo","Xây dựng","Khai khoáng",
  "Bán buôn-bán lẻ","Tài chính-Ngân hàng","Logistics-Vận tải",
  "CNTT-Truyền thông","Giáo dục-Đào tạo","Y tế",
];
const SHORT = [
  "Nông-Lâm","CN chế biến","Xây dựng","Khai khoáng",
  "Bán buôn-lẻ","Tài chính-NH","Logistics","CNTT","Giáo dục","Y tế"
];

const DATA_DEFAULT = {
  growth:   [3.27, 9.64, 7.45,-1.20, 7.10, 7.36, 9.93, 7.85, 6.42, 6.85],
  gdp:      [11.86,24.10, 7.04, 3.36, 9.85, 5.12, 5.45, 3.85, 3.85, 2.85],
  spillover:[0.35, 0.78, 0.42, 0.30, 0.55, 0.85, 0.72, 0.92, 0.65, 0.60],
  export:   [40.5,290.9,  2.5,  8.2,  5.5,  1.2,  3.1,178.0,  0.0,  0.0],
  labor:    [13.20,11.50, 4.80, 0.30, 7.80, 0.55, 1.95, 0.62, 2.15, 0.75],
  ai:       [15,   55,   20,   30,   48,   72,   42,   88,   38,   45],
  risk:     [18,   42,   25,   55,   38,   52,   35,   28,   22,   18],
};

// ── Helpers ──────────────────────────────────────────────────────────
const normGood = arr => { const mn=Math.min(...arr),mx=Math.max(...arr); return arr.map(v=>mx===mn?0.5:(v-mn)/(mx-mn)); };
const normBad  = arr => { const mn=Math.min(...arr),mx=Math.max(...arr); return arr.map(v=>mx===mn?0.5:(mx-v)/(mx-mn)); };

function calcPriority(data, w) {
  const ng = {
    growth:   normGood(data.growth),
    gdp:      normGood(data.gdp),
    spillover:normGood(data.spillover),
    export:   normGood(data.export),
    labor:    normGood(data.labor),
    ai:       normGood(data.ai),
    risk:     normBad(data.risk),
  };
  const wSum = w.reduce((a,b)=>a+b,0);
  const wn = w.map(x=>x/wSum);
  return SECTORS_FULL.map((_,i)=>
    wn[0]*ng.growth[i] + wn[1]*ng.gdp[i] + wn[2]*ng.spillover[i] +
    wn[3]*ng.export[i] + wn[4]*ng.labor[i] + wn[5]*ng.ai[i] - wn[6]*ng.risk[i]
  );
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
  <div style={{marginBottom:12}}>
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

const rankBadge = r => ["🥇","🥈","🥉"][r]||null;

// ── Gemini AI panel (đã sửa: có ô nhập API key) ───────────────────────
function GeminiPanel({ result, loading, onAnalyze }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleAnalyze = () => {
    if (!apiKey.trim()) {
      alert("⚠️ Vui lòng nhập Gemini API Key trước khi phân tích.");
      return;
    }
    onAnalyze(apiKey.trim());
  };

  return (
    <Card style={{ border: `1px solid #4285f433`, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <span style={{ color: D.t1, fontWeight: 700, fontSize: 15 }}>Tác nhân Gemini AI — Phân tích kết quả</span>
        <span style={{
          background: "#4285f4", color: "#fff", fontSize: 10,
          padding: "2px 8px", borderRadius: 99
        }}>Google Gemini</span>
      </div>

      {/* API Key input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Dán Gemini API Key vào đây (AIza...)"
            style={{
              width: "100%", padding: "8px 40px 8px 12px", borderRadius: 8,
              background: D.bg3, border: `1px solid ${apiKey ? "#4285f4" : D.border}`,
              color: D.t1, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box"
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: D.t3, cursor: "pointer", fontSize: 14
            }}
          >
            {showKey ? "🙈" : "👁"}
          </button>
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#4285f4", textDecoration: "none", whiteSpace: "nowrap" }}>
          Lấy API Key →
        </a>
      </div>

      <button onClick={handleAnalyze} disabled={loading} style={{
        background: loading ? "#374151" : "linear-gradient(135deg,#4285f4,#0f9d58)",
        color: "#fff", border: "none", borderRadius: 8,
        padding: "10px 24px", fontSize: 14, fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer", marginBottom: 14
      }}>
        {loading ? "⏳ Đang phân tích..." : "✨ Phân tích với Gemini AI"}
      </button>

      {result && (
        <div style={{
          background: D.bg3, borderRadius: 8, padding: 16,
          color: D.t2, fontSize: 13, lineHeight: 1.8,
          whiteSpace: "pre-wrap", border: `1px solid ${D.border}`
        }}>{result}</div>
      )}
    </Card>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function Bai3() {
  // ── Trọng số (7 sliders) ──────────────────────────────────────────
  const [wGrowth,   setWGrowth]   = useState(0.15);
  const [wGdp,      setWGdp]      = useState(0.15);
  const [wSpillover,setWSpillover]= useState(0.20);
  const [wExport,   setWExport]   = useState(0.15);
  const [wLabor,    setWLabor]    = useState(0.10);
  const [wAI,       setWAI]       = useState(0.20);
  const [wRisk,     setWRisk]     = useState(0.15);

  // ── Dữ liệu ngành (chỉnh AI Readiness & Risk cho 3 ngành top) ────
  const [aiCN,      setAiCN]      = useState(55);
  const [aiCNTT,    setAiCNTT]    = useState(88);
  const [aiTaiChinh,setAiTaiChinh]= useState(72);
  const [riskCN,    setRiskCN]    = useState(42);
  const [riskCNTT,  setRiskCNTT]  = useState(28);

  const [tab,    setTab]    = useState("c2");
  const [aiRes,  setAiRes]  = useState("");
  const [aiLoad, setAiLoad] = useState(false);

  // ── Tính toán realtime ────────────────────────────────────────────
  const data = useMemo(() => ({
    ...DATA_DEFAULT,
    ai:   DATA_DEFAULT.ai.map((v,i)=>i===1?aiCN:i===7?aiCNTT:i===5?aiTaiChinh:v),
    risk: DATA_DEFAULT.risk.map((v,i)=>i===1?riskCN:i===7?riskCNTT:v),
  }), [aiCN, aiCNTT, aiTaiChinh, riskCN, riskCNTT]);

  const weights = [wGrowth, wGdp, wSpillover, wExport, wLabor, wAI, wRisk];
  const wSum = weights.reduce((a,b)=>a+b,0);
  const wNorm = weights.map(w=>w/wSum);

  const scores = useMemo(() => calcPriority(data, weights), 
    [wGrowth,wGdp,wSpillover,wExport,wLabor,wAI,wRisk,data]);

  const ranked = useMemo(() =>
    SECTORS_FULL.map((s,i)=>({s,p:scores[i],i,short:SHORT[i]}))
      .sort((a,b)=>b.p-a.p),
    [scores]
  );

  const top3 = ranked.slice(0,3);
  const worst = ranked[ranked.length-1];

  // Sensitivity: vary a₆ (AI weight)
  const A6_VALS = [0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40];
  const sensData = A6_VALS.map(a6=>{
    const w = [wGrowth,wGdp,wSpillover,wExport,wLabor,a6,wRisk];
    const sc = calcPriority(data, w);
    const obj = {a6: `${(a6*100).toFixed(0)}%`};
    SECTORS_FULL.forEach((s,i)=>{ obj[SHORT[i]] = +sc[i].toFixed(4); });
    return obj;
  });

  // Radar data cho top 3 ngành
  const radarKeys = ["Growth","GDP","Spillover","Export","Labor","AI","Risk(inv)"];
  const ng = {
    growth:   normGood(data.growth),
    gdp:      normGood(data.gdp),
    spillover:normGood(data.spillover),
    export:   normGood(data.export),
    labor:    normGood(data.labor),
    ai:       normGood(data.ai),
    risk:     normBad(data.risk),
  };
  const radarData = radarKeys.map((key,ki)=>({
    subject: key,
    ...top3.reduce((acc,{s,i})=>({...acc,[SHORT[i]]:[ng.growth,ng.gdp,ng.spillover,ng.export,ng.labor,ng.ai,ng.risk][ki][i]}),{})
  }));

  // Gemini analyze (nhận API key từ component)
  const handleAnalyze = async (apiKey) => {
    setAiLoad(true); setAiRes("");
    try {
      const ctx = `
Bài 3 — Chỉ số Ưu tiên Ngành (Priority Scoring) cho 10 ngành Việt Nam
Công thức: Priority_i = ${wNorm.map((w,j)=>['a₁·Growth','a₂·GDP','a₃·Spillover','a₄·Export','a₅·Labor','a₆·AI','-a₇·Risk'][j]+`(${(w*100).toFixed(1)}%)`).join(' + ')}

KẾT QUẢ XẾP HẠNG (trọng số hiện tại):
${ranked.map(({s,p},rank)=>`#${rank+1} ${s}: ${p.toFixed(4)}`).join('\n')}

TOP 3 NGÀNH ƯU TIÊN:
1. ${ranked[0].s} (${ranked[0].p.toFixed(4)})
2. ${ranked[1].s} (${ranked[1].p.toFixed(4)})
3. ${ranked[2].s} (${ranked[2].p.toFixed(4)})

NGÀNH CUỐI: ${worst.s} (${worst.p.toFixed(4)})

Trọng số đang dùng (chuẩn hóa):
- Tăng trưởng: ${(wNorm[0]*100).toFixed(1)}%
- GDP share: ${(wNorm[1]*100).toFixed(1)}%
- Spillover: ${(wNorm[2]*100).toFixed(1)}%
- Xuất khẩu: ${(wNorm[3]*100).toFixed(1)}%
- Việc làm: ${(wNorm[4]*100).toFixed(1)}%
- AI Readiness: ${(wNorm[5]*100).toFixed(1)}%
- Rủi ro TĐH: ${(wNorm[6]*100).toFixed(1)}%
      `;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text:
              `Bạn là chuyên gia kinh tế Việt Nam. Phân tích kết quả xếp hạng ngành sau bằng tiếng Việt: (1) nhận xét về Top-3 ngành ưu tiên, (2) lý giải ngành xếp cuối, (3) khuyến nghị chính sách chuyển đổi số phù hợp Nghị quyết 57-NQ/TW:\n\n${ctx}`
            }]}]
          }),
        }
      );
      const d = await res.json();
      if (d.error) {
        setAiRes(`❌ Lỗi API: ${d.error.message}`);
      } else {
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        setAiRes(text || "Không có kết quả từ Gemini.");
      }
    } catch(e){ setAiRes("❌ Lỗi kết nối: "+e.message); }
    setAiLoad(false);
  };

  const TABS = [
    {id:"c1",label:"① Chuẩn hóa"},
    {id:"c2",label:"② Priority"},
    {id:"c3",label:"③ Độ nhạy a₆"},
    {id:"c4",label:"④ So sánh kịch bản"},
    {id:"c5",label:"⑤ Thảo luận"},
  ];

  return (
    <div style={{minHeight:"100vh",fontFamily:"'Segoe UI',sans-serif",color:D.t1,
      padding:"24px 20px",background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{display:"inline-block",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6,padding:"3px 14px",fontSize:11,fontWeight:700,
          letterSpacing:2,marginBottom:10,color:"#fff"}}>
          AIDEOM-VN • PHẦN B – CẤP ĐỘ DỄ
        </div>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#818cf8)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Bài 3 — Chỉ số Ưu tiên Ngành Priority<sub style={{fontSize:18}}>i</sub> · 10 ngành Việt Nam
        </h1>
        <p style={{fontSize:13,color:D.t3,margin:0}}>
          Priority = a₁·Growth + a₂·GDP + a₃·Spillover + a₄·Export + a₅·Labor + a₆·AI − a₇·Risk &nbsp;|&nbsp;
          Kéo slider → kết quả cập nhật ngay
        </p>
      </div>

      {/* ══ CONTROL PANEL ════════════════════════════════════════════ */}
      <Card style={{marginBottom:20,border:`1px solid #0ea5e955`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <span style={{fontSize:16}}>🎛️</span>
          <span style={{fontWeight:700,fontSize:15,color:D.cyan}}>Bảng điều khiển tham số</span>
          <span style={{fontSize:11,color:D.t3,marginLeft:4}}>— kéo slider, xếp hạng tự cập nhật</span>
          <span style={{marginLeft:"auto",fontSize:12,color:D.amber,fontFamily:"monospace"}}>
            Tổng trọng số: {(wSum).toFixed(2)} → chuẩn hóa = 1.00
          </span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 40px"}}>
          {/* Cột 1: 7 trọng số */}
          <div>
            <p style={{fontSize:12,fontWeight:700,color:D.amber,margin:"0 0 12px"}}>
              ⚖️ Trọng số aᵢ (tự chuẩn hóa tổng=1)
            </p>
            <SliderRow label="a₁ Tăng trưởng GDP" value={wGrowth} min={0.05} max={0.40} onChange={setWGrowth} color={D.green} />
            <SliderRow label="a₂ GDP share" value={wGdp} min={0.05} max={0.40} onChange={setWGdp} color={D.blue} />
            <SliderRow label="a₃ Spillover (lan tỏa)" value={wSpillover} min={0.05} max={0.40} onChange={setWSpillover} color={D.teal} />
            <SliderRow label="a₄ Xuất khẩu" value={wExport} min={0.05} max={0.40} onChange={setWExport} color={D.amber} />
            <SliderRow label="a₅ Việc làm (triệu LĐ)" value={wLabor} min={0.05} max={0.40} onChange={setWLabor} color={D.coral} />
            <SliderRow label="a₆ AI Readiness" value={wAI} min={0.05} max={0.40} onChange={setWAI} color={D.purple} />
            <SliderRow label="a₇ Rủi ro tự động hóa (−)" value={wRisk} min={0.05} max={0.40} onChange={setWRisk} color={D.cyan} />
          </div>

          {/* Cột 2: Dữ liệu ngành */}
          <div>
            <p style={{fontSize:12,fontWeight:700,color:D.purple,margin:"0 0 12px"}}>
              📊 Điều chỉnh dữ liệu ngành (AI Readiness & Rủi ro)
            </p>
            <SliderRow label="AI Readiness — CN chế biến" value={aiCN} min={10} max={100} step={1} onChange={setAiCN} color={D.blue} unit="%" fmt={v=>`${v}`} />
            <SliderRow label="AI Readiness — CNTT-Truyền thông" value={aiCNTT} min={10} max={100} step={1} onChange={setAiCNTT} color={D.purple} unit="%" fmt={v=>`${v}`} />
            <SliderRow label="AI Readiness — Tài chính-NH" value={aiTaiChinh} min={10} max={100} step={1} onChange={setAiTaiChinh} color={D.teal} unit="%" fmt={v=>`${v}`} />
            <SliderRow label="Rủi ro TĐH — CN chế biến" value={riskCN} min={10} max={80} step={1} onChange={setRiskCN} color={D.coral} unit="%" fmt={v=>`${v}`} />
            <SliderRow label="Rủi ro TĐH — CNTT" value={riskCNTT} min={5} max={60} step={1} onChange={setRiskCNTT} color={D.pink} unit="%" fmt={v=>`${v}`} />

            {/* Top 3 live preview */}
            <div style={{marginTop:16,padding:"10px 14px",background:D.bg3,borderRadius:8}}>
              <p style={{fontSize:11,color:D.t3,margin:"0 0 8px",fontWeight:600}}>🏆 TOP 3 hiện tại</p>
              {ranked.slice(0,3).map(({s,p},rank)=>(
                <div key={s} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12,color:SECTOR_COLORS[SECTORS_FULL.indexOf(s)],fontWeight:600}}>
                    {rankBadge(rank)||`#${rank+1}`} {SHORT[SECTORS_FULL.indexOf(s)]}
                  </span>
                  <span style={{fontSize:12,fontFamily:"monospace",color:D.t2}}>{p.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {ranked.slice(0,3).map(({s,p},rank)=>(
          <div key={s} style={{background:D.bg1,border:`1px solid ${SECTOR_COLORS[SECTORS_FULL.indexOf(s)]}33`,
            borderRadius:10,padding:"13px 16px",flex:1,minWidth:130}}>
            <p style={{fontSize:11,color:D.t3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>
              #{rank+1} Ưu tiên
            </p>
            <p style={{fontSize:17,fontWeight:700,color:SECTOR_COLORS[SECTORS_FULL.indexOf(s)],margin:0}}>
              {SHORT[SECTORS_FULL.indexOf(s)]}
            </p>
            <p style={{fontSize:11,color:D.t3,margin:"2px 0 0"}}>Priority = {p.toFixed(4)}</p>
          </div>
        ))}
        <div style={{background:D.bg1,border:`1px solid ${D.t3}33`,borderRadius:10,padding:"13px 16px",flex:1,minWidth:130}}>
          <p style={{fontSize:11,color:D.t3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Xếp hạng cuối</p>
          <p style={{fontSize:17,fontWeight:700,color:D.t3,margin:0}}>{SHORT[SECTORS_FULL.indexOf(worst.s)]}</p>
          <p style={{fontSize:11,color:D.t3,margin:"2px 0 0"}}>Priority = {worst.p.toFixed(4)}</p>
        </div>
        <div style={{background:D.bg1,border:`1px solid ${D.amber}33`,borderRadius:10,padding:"13px 16px",flex:1,minWidth:130}}>
          <p style={{fontSize:11,color:D.t3,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Khoảng cách #1–#10</p>
          <p style={{fontSize:17,fontWeight:700,color:D.amber,margin:0}}>
            {(ranked[0].p - ranked[9].p).toFixed(4)}
          </p>
          <p style={{fontSize:11,color:D.t3,margin:"2px 0 0"}}>Spread toàn bộ ngành</p>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)}/>)}
      </div>

      {/* ══ TAB 1: CHUẨN HÓA ══════════════════════════════════════════ */}
      {tab==="c1"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>Ma trận chuẩn hóa Min-Max</h3>
            <p style={{fontSize:12,color:D.t3,margin:"0 0 14px"}}>
              Cột Risk đã đảo dấu · Giá trị thay đổi theo slider dữ liệu
            </p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${D.border}`}}>
                    {["Ngành","Growth","GDP","Spillover","Export","Labor","AI Ready","Risk(inv)"].map(h=>(
                      <th key={h} style={{padding:"6px 8px",textAlign:"right",color:D.t3,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTORS_FULL.map((s,i)=>{
                    const vals=[ng.growth[i],ng.gdp[i],ng.spillover[i],ng.export[i],ng.labor[i],ng.ai[i],ng.risk[i]];
                    return(
                      <tr key={i} style={{borderBottom:`1px solid ${D.border}22`,background:i%2===0?D.bg3:"transparent"}}>
                        <td style={{padding:"6px 8px",fontWeight:600,color:SECTOR_COLORS[i],fontSize:11,whiteSpace:"nowrap"}}>{s}</td>
                        {vals.map((v,j)=>(
                          <td key={j} style={{padding:"6px 8px",textAlign:"right",fontFamily:"monospace",fontSize:10,
                            background:`rgba(56,189,248,${v*0.18})`,
                            color:v>0.7?D.blue:v>0.3?D.t1:D.t3}}>
                            {v.toFixed(3)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 2: PRIORITY ════════════════════════════════════════════ */}
      {tab==="c2"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {/* Ranking list */}
            <Card>
              <h3 style={{margin:"0 0 4px",color:D.blue,fontSize:15}}>Xếp hạng Priority — cập nhật realtime</h3>
              <p style={{fontSize:12,color:D.t3,margin:"0 0 14px"}}>
                Trọng số chuẩn hóa: [{wNorm.map(w=>(w*100).toFixed(0)+'%').join(', ')}]
              </p>
              {ranked.map(({s,p},rank)=>{
                const ci = SECTORS_FULL.indexOf(s);
                const color = SECTOR_COLORS[ci];
                const pct = p / ranked[0].p * 100;
                return(
                  <div key={s} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:12,display:"flex",alignItems:"center",gap:4}}>
                        <span>{rankBadge(rank)||`#${rank+1}`}</span>
                        <span style={{fontWeight:rank<3?600:400,color:rank<3?color:D.t2}}>{s}</span>
                      </span>
                      <span style={{fontSize:13,fontWeight:600,color,fontFamily:"monospace"}}>{p.toFixed(4)}</span>
                    </div>
                    <div style={{height:7,background:D.bg1,borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.max(0,pct)}%`,background:color,
                        borderRadius:4,transition:"width .4s"}}/>
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* Bar chart */}
            <Card>
              <h3 style={{margin:"0 0 14px",color:D.blue,fontSize:14}}>Biểu đồ Priority (ngang)</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={[...ranked].reverse().map(({s,p})=>({name:SHORT[SECTORS_FULL.indexOf(s)],p:+p.toFixed(4),ci:SECTORS_FULL.indexOf(s)}))}
                  layout="vertical" margin={{top:5,right:20,bottom:5,left:70}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis type="number" tick={{fill:D.t2,fontSize:10}} domain={[0,'auto']}/>
                  <YAxis type="category" dataKey="name" tick={{fill:D.t2,fontSize:11}} width={70}/>
                  <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}
                    formatter={(v)=>[v.toFixed(4),'Priority']}/>
                  <Bar dataKey="p" name="Priority" radius={[0,6,6,0]}>
                    {[...ranked].reverse().map(({s},i)=>(
                      <Cell key={i} fill={SECTOR_COLORS[SECTORS_FULL.indexOf(s)]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Radar cho top 3 */}
          <Card>
            <h3 style={{margin:"0 0 14px",color:D.purple,fontSize:14}}>Radar — Top 3 ngành theo từng tiêu chí</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e3a5f"/>
                <PolarAngleAxis dataKey="subject" tick={{fill:D.t2,fontSize:11}}/>
                <PolarRadiusAxis domain={[0,1]} tick={{fill:D.t3,fontSize:9}}/>
                {top3.map(({s,i},ri)=>(
                  <Radar key={s} name={SHORT[i]} dataKey={SHORT[i]}
                    stroke={SECTOR_COLORS[i]} fill={SECTOR_COLORS[i]} fillOpacity={0.15}
                    strokeWidth={2}/>
                ))}
                <Legend wrapperStyle={{color:D.t2,fontSize:12}}/>
                <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
              </RadarChart>
            </ResponsiveContainer>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 3: ĐỘ NHẠY ════════════════════════════════════════════ */}
      {tab==="c3"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <h3 style={{margin:"0 0 4px",color:D.purple,fontSize:15}}>
              Độ nhạy a₆ (AI Readiness) — Priority thay đổi theo trọng số AI
            </h3>
            <p style={{fontSize:12,color:D.t3,margin:"0 0 14px"}}>
              Giữ nguyên các trọng số khác, thay đổi a₆ từ 5%→40% và chuẩn hóa lại
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sensData} margin={{top:5,right:20,bottom:5,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                <XAxis dataKey="a6" tick={{fill:D.t2,fontSize:11}} label={{value:"Trọng số a₆",position:"insideBottom",fill:D.t3,fontSize:11}}/>
                <YAxis tick={{fill:D.t2,fontSize:10}} domain={[-0.1,0.9]}/>
                <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
                <Legend wrapperStyle={{color:D.t2,fontSize:11}}/>
                {SHORT.map((s,i)=>(
                  <Line key={s} type="monotone" dataKey={s}
                    stroke={SECTOR_COLORS[i]} strokeWidth={i<3?2.5:1}
                    dot={i<3} strokeDasharray={i<3?"":"4 4"}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{marginTop:12,padding:"10px 14px",background:D.purpleBg,
              borderLeft:`3px solid ${D.purple}`,borderRadius:7,fontSize:12,color:D.t2}}>
              Đường đậm = Top 3 ngành. CNTT (tím) tăng mạnh nhất khi a₆ tăng vì AI Readiness={aiCNTT} cao nhất.
              Khai khoáng luôn ở đáy bất kể trọng số AI.
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 4: SO SÁNH KỊCH BẢN ═════════════════════════════════ */}
      {tab==="c4"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {(()=>{
            const wTT=[0.25,0.25,0.10,0.25,0.05,0.05,0.05];
            const wBT=[0.10,0.05,0.25,0.05,0.25,0.10,0.20];
            const pTT=calcPriority(data,wTT);
            const pBT=calcPriority(data,wBT);
            const rTT=[...SECTORS_FULL.map((s,i)=>({s,p:pTT[i],i}))].sort((a,b)=>b.p-a.p);
            const rBT=[...SECTORS_FULL.map((s,i)=>({s,p:pBT[i],i}))].sort((a,b)=>b.p-a.p);
            const rCurrent=[...ranked];

            const cmpData = SECTORS_FULL.map((s,i)=>({
              name:SHORT[i],
              "Hiện tại":+scores[i].toFixed(4),
              "Tăng trưởng":+pTT[i].toFixed(4),
              "Bao trùm":+pBT[i].toFixed(4),
            }));

            return(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                  {[
                    {title:"Trọng số hiện tại",r:rCurrent,color:D.blue,label:"Tùy chỉnh"},
                    {title:"Định hướng Tăng trưởng",r:rTT,color:D.amber,label:"growth+export ưu tiên"},
                    {title:"Định hướng Bao trùm",r:rBT,color:D.teal,label:"labor+spillover ưu tiên"},
                  ].map(({title,r,color,label})=>(
                    <Card key={title}>
                      <h3 style={{margin:"0 0 4px",color,fontSize:13}}>{title}</h3>
                      <p style={{fontSize:10,color:D.t3,margin:"0 0 12px"}}>{label}</p>
                      {r.slice(0,5).map(({s,p},rank)=>{
                        const ci=SECTORS_FULL.indexOf(s);
                        const pct=p/r[0].p*100;
                        return(
                          <div key={s} style={{marginBottom:8}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                              <span style={{fontSize:11,color:rank<3?SECTOR_COLORS[ci]:D.t2,fontWeight:rank<3?600:400}}>
                                {rankBadge(rank)||`#${rank+1}`} {SHORT[ci]}
                              </span>
                              <span style={{fontSize:11,fontFamily:"monospace",color:SECTOR_COLORS[ci]}}>{p.toFixed(3)}</span>
                            </div>
                            <div style={{height:5,background:D.bg1,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${pct}%`,background:SECTOR_COLORS[ci],borderRadius:3,transition:"width .4s"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  ))}
                </div>

                <Card>
                  <h3 style={{margin:"0 0 14px",color:D.amber,fontSize:14}}>So sánh 3 bộ trọng số — tất cả ngành</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cmpData} margin={{top:5,right:10,bottom:5,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                      <XAxis dataKey="name" tick={{fill:D.t2,fontSize:10}}/>
                      <YAxis tick={{fill:D.t2,fontSize:10}}/>
                      <Tooltip contentStyle={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:8}}/>
                      <Legend wrapperStyle={{color:D.t2,fontSize:11}}/>
                      <Bar dataKey="Hiện tại"    fill={D.blue+"bb"}   radius={[4,4,0,0]}/>
                      <Bar dataKey="Tăng trưởng" fill={D.amber+"bb"}  radius={[4,4,0,0]}/>
                      <Bar dataKey="Bao trùm"    fill={D.teal+"bb"}   radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </>
            );
          })()}
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 5: THẢO LUẬN ════════════════════════════════════════ */}
      {tab==="c5"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[
            {
              q:"a) Ba ngành nên được ưu tiên đẩy mạnh chuyển đổi số và AI trước? Có phù hợp với Nghị quyết 57-NQ/TW?",
              color:D.blue,
              a:`Theo trọng số hiện tại, Top-3 là: ${ranked.slice(0,3).map(({s,p},r)=>`(${r+1}) ${s} (${p.toFixed(4)})`).join(', ')}.

Kết quả phụ thuộc vào bộ trọng số bạn chọn. Với trọng số mặc định (a₁=a₂=0.15, a₃=a₆=0.20), CN chế biến thường dẫn đầu nhờ xuất khẩu và lao động lớn; CNTT dẫn đầu nếu tăng a₆.

Nghị quyết 57-NQ/TW (12/2024) ưu tiên: công nghiệp chế biến (nền tảng sản xuất), kinh tế số (CNTT) và tài chính số — phù hợp với kết quả mô hình trong đa số kịch bản trọng số.`
            },
            {
              q:"b) Tại sao Khai khoáng có năng suất cao nhưng vẫn không nằm trong nhóm ưu tiên?",
              color:D.amber,
              a:`Khai khoáng xếp hạng thấp vì: (1) Tăng trưởng âm (−1.20%) → điểm Growth=0.000; (2) Spillover thấp nhất (0.30) → ít lan tỏa; (3) Rủi ro tự động hóa cao nhất (55%) → risk_inv thấp; (4) Lao động ít (0.30 triệu).

Năng suất cao theo đầu lao động không đủ bù cho 4 yếu tố trên. Đây là ví dụ kinh điển: chỉ số tổng hợp phản ánh toàn diện hơn năng suất đơn thuần.

Thử kéo slider a₇ (Risk) xuống thấp → Khai khoáng sẽ tăng hạng, cho thấy kết quả nhạy cảm với giả định về rủi ro.`
            },
            {
              q:"c) Bộ trọng số nên do ai quyết định?",
              color:D.teal,
              a:`Trọng số phản ánh "ưu tiên giá trị" xã hội — không có câu trả lời kỹ thuật thuần túy:

(1) Chuyên gia kỹ thuật: dùng AHP, Entropy, Delphi → khách quan nhưng phụ thuộc panel được chọn
(2) Hội đồng chính sách: gắn với Nghị quyết 57-NQ/TW → có trách nhiệm giải trình nhưng dễ bị lợi ích nhóm
(3) Tham vấn công khai: tính chính danh cao nhưng khó đồng thuận

Khuyến nghị: kết hợp cả 3 → chuyên gia đề xuất phương án kỹ thuật → hội đồng thẩm định → tham vấn → rà soát mỗi 3 năm.

Dùng slider bên trên để test sensitivity: nếu Top-3 không đổi khi thay đổi trọng số → kết quả robust; nếu thay đổi mạnh → cần tranh luận chính sách thêm.`
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

          <Card style={{border:`1px solid ${D.cyan}33`}}>
            <h3 style={{margin:"0 0 12px",color:D.cyan,fontSize:14}}>Công thức (trọng số chuẩn hóa hiện tại)</h3>
            <div style={{fontFamily:"monospace",fontSize:12,lineHeight:2.2,
              background:D.bg3,borderRadius:8,padding:"12px 16px",color:D.t2}}>
              <p style={{margin:0}}>
                Priority_i = {wNorm.map((w,j)=>`${(w*100).toFixed(1)}%·${['Growth','GDP','Spillover','Export','Labor','AI'][j]}`).slice(0,6).join(' + ')}
              </p>
              <p style={{margin:0}}>  − {(wNorm[6]*100).toFixed(1)}%·Risk</p>
              <p style={{margin:"6px 0 0",color:D.teal}}>
                → Top-3: {ranked.slice(0,3).map(({s,p})=>`${SHORT[SECTORS_FULL.indexOf(s)]} (${p.toFixed(4)})`).join(' · ')}
              </p>
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:D.t3,
        borderTop:`1px solid ${D.border}`,paddingTop:12}}>
        Bài 3 — AIDEOM-VN | Dữ liệu: vietnam_sectors_2024.csv (GSO 2024) | Recharts + React state
      </div>
    </div>
  );
}