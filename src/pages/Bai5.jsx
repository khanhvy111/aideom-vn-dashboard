import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, ScatterChart, Scatter,
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
  cyan:"#67e8f9",   yellow:"#facc15",
};

// ── DỮ LIỆU 15 DỰ ÁN ────────────────────────────────────────────────
const PROJ_DEFAULT = {
  1: {name:"TTDL Hòa Lạc",        field:"Hạ tầng",      C:12000,C1:8500, B:21500,pi:0.85},
  2: {name:"TTDL phía Nam",        field:"Hạ tầng",      C:11500,C1:7500, B:20800,pi:0.85},
  3: {name:"5G phủ sóng toàn quốc",field:"Hạ tầng",      C:18000,C1:12000,B:32500,pi:0.85},
  4: {name:"VNeID 2.0",            field:"CP số",        C:4500, C1:3500, B:9200, pi:0.75},
  5: {name:"Cổng DVC v3",          field:"CP số",        C:3200, C1:2500, B:6800, pi:0.75},
  6: {name:"Y tế số QG",           field:"Y tế",         C:5800, C1:4000, B:11400,pi:0.80},
  7: {name:"Giáo dục số K-12",     field:"Giáo dục",     C:6500, C1:4500, B:12200,pi:0.80},
  8: {name:"Trung tâm AI+HPC",     field:"AI",           C:15000,C1:9000, B:28500,pi:0.65},
  9: {name:"Fintech Sandbox",      field:"Tài chính",    C:2500, C1:1800, B:5800, pi:0.80},
 10: {name:"Logistics thông minh", field:"Logistics",    C:7200, C1:5000, B:13800,pi:0.80},
 11: {name:"Nông nghiệp số ĐBSCL", field:"Nông nghiệp", C:4800, C1:3500, B:8500, pi:0.80},
 12: {name:"Đào tạo 50K kỹ sư AI", field:"Nhân lực",    C:8500, C1:5500, B:16200,pi:0.80},
 13: {name:"KCN Bán dẫn BN-BG",    field:"Bán dẫn",     C:20000,C1:13000,B:35000,pi:0.65},
 14: {name:"An ninh mạng SOC",     field:"An ninh",      C:3800, C1:2800, B:7500, pi:0.80},
 15: {name:"Open Data QG",         field:"Dữ liệu",      C:1500, C1:1200, B:3800, pi:0.80},
};
const IDS = Object.keys(PROJ_DEFAULT).map(Number);

const FIELD_COLORS = {
  "Hạ tầng":D.blue,"CP số":D.teal,"Y tế":D.green,"Giáo dục":D.amber,
  "AI":D.purple,"Tài chính":D.cyan,"Logistics":D.coral,"Nông nghiệp":D.green,
  "Nhân lực":D.yellow,"Bán dẫn":D.blue,"An ninh":D.coral,"Dữ liệu":D.teal,
};

// ── MIP Solver (greedy + constraint enforcement) ──────────────────────
function solveMIP({ proj, budget5y, budget1y, minP, maxP, forced, excluded, useExpected, bonusP8P13 }) {
  const score = i => {
    const b = useExpected ? proj[i].pi * proj[i].B : proj[i].B;
    return b + (bonusP8P13 && i === 8 ? 8000 * proj[i].pi : 0)
             + (bonusP8P13 && i === 13 ? 8000 * proj[i].pi : 0);
  };

  const sorted = [...IDS].sort((a, b) => score(b)/proj[b].C - score(a)/proj[a].C);

  let selected = new Set();
  selected.add(14);
  if (!excluded.has(4) && !excluded.has(5)) {
    selected.add(excluded.has(4) ? 5 : excluded.has(5) ? 4 : 4);
  }
  forced.forEach(i => { if (!excluded.has(i)) selected.add(i); });

  for (const i of sorted) {
    if (selected.has(i) || excluded.has(i)) continue;
    if (selected.size >= maxP) break;

    const trial = new Set([...selected, i]);
    const tc  = [...trial].reduce((s,j) => s + proj[j].C, 0);
    const tc1 = [...trial].reduce((s,j) => s + proj[j].C1, 0);
    if (tc > budget5y || tc1 > budget1y) continue;
    if (trial.has(1) && trial.has(2)) continue;

    selected.add(i);
  }

  if (selected.has(8) && !selected.has(12) && !excluded.has(12)) selected.add(12);
  if (selected.has(13) && !selected.has(12) && !excluded.has(12)) selected.add(12);

  const sel = [...selected];
  const totalC  = sel.reduce((s,i) => s + proj[i].C, 0);
  const totalC1 = sel.reduce((s,i) => s + proj[i].C1, 0);
  const Z = sel.reduce((s,i) => s + (useExpected ? proj[i].pi*proj[i].B : proj[i].B), 0);
  const Zbase = sel.reduce((s,i) => s + proj[i].B, 0);
  const bcr = Zbase / Math.max(totalC, 1);

  const feasible = totalC <= budget5y && totalC1 <= budget1y
    && !(selected.has(1) && selected.has(2))
    && (!selected.has(8) || selected.has(12))
    && (!selected.has(13) || selected.has(12))
    && (selected.has(4) || selected.has(5))
    && selected.has(14)
    && sel.length >= minP && sel.length <= maxP;

  return { selected: sel, Z: Math.round(Z), Zbase: Math.round(Zbase), totalC, totalC1, bcr: +bcr.toFixed(3), feasible };
}

// ── UI Components ─────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:12, padding:"1.2rem", ...style }}>
    {children}
  </div>
);
const TabBtn = ({ label, active, onClick, color=D.blue }) => (
  <button onClick={onClick} style={{
    padding:"7px 14px", borderRadius:8, fontSize:13, fontWeight:600,
    cursor:"pointer", border:"none", transition:"all .2s",
    background: active ? color : "rgba(30,41,59,0.7)",
    color: active ? "#fff" : D.t2,
    boxShadow: active ? `0 0 14px ${color}40` : "none"
  }}>{label}</button>
);
const Badge = ({ label, color }) => (
  <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:600,
    background:`${color}22`, color, border:`1px solid ${color}44` }}>{label}</span>
);
const SliderRow = ({ label, value, min, max, step=1, onChange, color, unit="", fmt }) => (
  <div style={{ marginBottom:11 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
      <span style={{ fontSize:12, color:D.t2 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color, fontFamily:"monospace" }}>
        {fmt ? fmt(value) : value}{unit}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)}
      style={{
        width:"100%", height:6, borderRadius:3, outline:"none", cursor:"pointer",
        appearance:"none", WebkitAppearance:"none",
        background:`linear-gradient(to right,${color} 0%,${color} ${(value-min)/(max-min)*100}%,#1e3a5f ${(value-min)/(max-min)*100}%,#1e3a5f 100%)`
      }}
    />
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:D.t3, marginTop:1 }}>
      <span>{min}{unit}</span><span>{max}{unit}</span>
    </div>
  </div>
);

function ConstraintPanel({ selected, proj, budget5y, budget1y, minP, maxP }) {
  const sel = new Set(selected);
  const totalC  = selected.reduce((s,i) => s + proj[i].C, 0);
  const totalC1 = selected.reduce((s,i) => s + proj[i].C1, 0);
  const checks = [
    { label:`C1 Ngân sách 5 năm ≤ ${budget5y.toLocaleString()}`, ok:totalC<=budget5y, val:`${totalC.toLocaleString()} / ${budget5y.toLocaleString()}` },
    { label:`C2 Năm 1-2 ≤ ${budget1y.toLocaleString()}`,          ok:totalC1<=budget1y,val:`${totalC1.toLocaleString()} / ${budget1y.toLocaleString()}` },
    { label:"C3 TTDL: chỉ chọn 1 (P1 hoặc P2)",                   ok:!(sel.has(1)&&sel.has(2)), val:sel.has(1)&&sel.has(2)?"P1+P2 vi phạm":"Đạt" },
    { label:"C4 P8 (AI) → cần P12 (nhân lực)",                    ok:!sel.has(8)||sel.has(12),  val:!sel.has(8)||sel.has(12)?"Đạt":"Vi phạm" },
    { label:"C5 P13 (bán dẫn) → cần P12",                         ok:!sel.has(13)||sel.has(12), val:!sel.has(13)||sel.has(12)?"Đạt":"Vi phạm" },
    { label:"C6a ≥1 dự án chính phủ số (P4 hoặc P5)",             ok:sel.has(4)||sel.has(5),    val:sel.has(4)||sel.has(5)?"Đạt":"Vi phạm" },
    { label:"C6b P14 an ninh mạng bắt buộc",                      ok:sel.has(14),               val:sel.has(14)?"Có P14":"Thiếu P14" },
    { label:`C7 ${minP} ≤ số dự án ≤ ${maxP}`,                    ok:selected.length>=minP&&selected.length<=maxP, val:`${selected.length} dự án` },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {checks.map((c,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"7px 12px", borderRadius:7,
          background:c.ok?"rgba(74,222,128,0.05)":"rgba(248,113,113,0.08)",
          border:`1px solid ${c.ok?D.green:D.coral}33` }}>
          <span style={{ fontSize:12, color:c.ok?D.t2:D.coral }}>{c.label}</span>
          <span style={{ fontSize:12, fontWeight:600, color:c.ok?D.green:D.coral }}>
            {c.ok?"✓ ":""}{c.val}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Gemini AI panel (có ô nhập API key) ───────────────────────────────
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
            onChange={e => setApiKey(e.target.value)}
            placeholder="Dán Gemini API Key vào đây (AIza...)"
            style={{
              width:"100%", padding:"8px 40px 8px 12px", borderRadius:8,
              background:D.bg3, border:`1px solid ${apiKey ? "#4285f4" : D.border}`,
              color:D.t1, fontSize:12, fontFamily:"monospace", boxSizing:"border-box"
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
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
        color:"#fff", border:"none", borderRadius:8, padding:"10px 24px",
        fontSize:14, fontWeight:600, cursor:loading?"not-allowed":"pointer", marginBottom:14
      }}>
        {loading?"⏳ Đang phân tích...":"✨ Phân tích với Gemini AI"}
      </button>
      {result && (
        <div style={{ background:D.bg3, borderRadius:8, padding:16, color:D.t2,
          fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", border:`1px solid ${D.border}` }}>
          {result}
        </div>
      )}
    </Card>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function Bai5() {
  // ── Tham số slider ────────────────────────────────────────────────
  const [budget5y,   setBudget5y]   = useState(80000);
  const [budget1y,   setBudget1y]   = useState(40000);
  const [minP,       setMinP]       = useState(7);
  const [maxP,       setMaxP]       = useState(11);
  const [useExpected,setUseExpected]= useState(false);
  const [bonusP8P13, setBonusP8P13] = useState(false);

  // ── Toggle từng dự án: forced / excluded / neutral ────────────────
  const [projState, setProjState] = useState({});
  const toggleProj = (id) => {
    setProjState(prev => {
      const cur = prev[id];
      const next = cur === 'forced' ? 'excluded' : cur === 'excluded' ? undefined : 'forced';
      return { ...prev, [id]: next };
    });
  };

  // ── Chỉnh NPV từng dự án (2 dự án quan trọng) ───────────────────
  const [bAI,  setBAI]  = useState(28500); // P8
  const [bSemi,setBSemi]= useState(35000); // P13
  const [piAI, setPiAI] = useState(0.65);  // P8 pi
  const [piSemi,setPiSemi]=useState(0.65); // P13 pi

  const proj = useMemo(() => ({
    ...PROJ_DEFAULT,
    8:  { ...PROJ_DEFAULT[8],  B:bAI,   pi:piAI },
    13: { ...PROJ_DEFAULT[13], B:bSemi, pi:piSemi },
  }), [bAI, bSemi, piAI, piSemi]);

  const forced   = useMemo(() => new Set(IDS.filter(i => projState[i]==='forced')),   [projState]);
  const excluded = useMemo(() => new Set(IDS.filter(i => projState[i]==='excluded')), [projState]);

  // ── Giải MIP ──────────────────────────────────────────────────────
  const sol = useMemo(() =>
    solveMIP({ proj, budget5y, budget1y, minP, maxP, forced, excluded, useExpected, bonusP8P13 }),
    [proj, budget5y, budget1y, minP, maxP, forced, excluded, useExpected, bonusP8P13]
  );

  // Kịch bản so sánh (cố định tham số hiện tại, chỉ thay budget)
  const solB100 = useMemo(() =>
    solveMIP({ proj, budget5y:100000, budget1y:50000, minP, maxP, forced, excluded, useExpected:false, bonusP8P13 }),
    [proj, minP, maxP, forced, excluded, bonusP8P13]
  );
  const solForce12 = useMemo(() =>
    solveMIP({ proj, budget5y, budget1y, minP, maxP, forced:new Set([...forced,1,2]), excluded:new Set([...excluded].filter(i=>i!==1&&i!==2)), useExpected, bonusP8P13 }),
    [proj, budget5y, budget1y, minP, maxP, forced, excluded, useExpected, bonusP8P13]
  );
  const solExpected = useMemo(() =>
    solveMIP({ proj, budget5y, budget1y, minP, maxP, forced, excluded, useExpected:true, bonusP8P13 }),
    [proj, budget5y, budget1y, minP, maxP, forced, excluded, bonusP8P13]
  );

  const [tab,    setTab]    = useState("c1");
  const [aiRes,  setAiRes]  = useState("");
  const [aiLoad, setAiLoad] = useState(false);

  // Sensitivity: Z* vs budget5y
  const sensData = useMemo(() =>
    [50,60,70,80,90,100,110,120].map(k => {
      const B = k * 1000;
      const s = solveMIP({ proj, budget5y:B, budget1y:B*0.5, minP, maxP, forced, excluded, useExpected, bonusP8P13 });
      return { budget:`${k}K`, Z:s.Z, n:s.selected.length };
    }),
    [proj, minP, maxP, forced, excluded, useExpected, bonusP8P13]
  );

  // Gemini analyze (nhận API key từ component)
  const handleAnalyze = async (apiKey) => {
    setAiLoad(true); setAiRes("");
    try {
      const ctx = `
Bài 5 — MIP Lựa chọn 15 Dự án CĐS Quốc gia
Mô hình: max Σ Bᵢ·yᵢ, yᵢ∈{0,1}, i=1..15
Ngân sách: ${budget5y.toLocaleString()} tỷ (5 năm), ${budget1y.toLocaleString()} tỷ (năm 1-2)
Số dự án: ${minP}–${maxP}
Mục tiêu: ${useExpected?"E[Z] = Σ pᵢ·Bᵢ·yᵢ (có rủi ro)":"Z = Σ Bᵢ·yᵢ (không rủi ro)"}
Cộng hưởng P8×P13: ${bonusP8P13?"CÓ (+8.000 tỷ)":"KHÔNG"}

DANH MỤC TỐI ƯU (${sol.selected.length} dự án):
${sol.selected.map(i=>`P${i} ${proj[i].name} (C=${proj[i].C.toLocaleString()}, B=${proj[i].B.toLocaleString()}, pi=${proj[i].pi*100}%)`).join('\n')}

KẾT QUẢ:
Z* = ${sol.Z.toLocaleString()} tỷ | Tổng chi phí = ${sol.totalC.toLocaleString()} tỷ | BCR = ${sol.bcr}
Dư ngân sách = ${(budget5y-sol.totalC).toLocaleString()} tỷ
Khả thi: ${sol.feasible?"CÓ":"KHÔNG — vi phạm ràng buộc"}

SO SÁNH KỊCH BẢN:
- Base (${budget5y.toLocaleString()} tỷ): Z*=${sol.Z.toLocaleString()}
- Budget 100K: Z*=${solB100.Z.toLocaleString()} (${solB100.selected.length} dự án)
- E[Z] (rủi ro): Z*=${solExpected.Z.toLocaleString()}
      `;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{parts:[{text:
            `Bạn là chuyên gia đầu tư công Việt Nam. Phân tích kết quả MIP chọn dự án CĐS sau bằng tiếng Việt: (1) nhận xét danh mục tối ưu, (2) dự án nào bị loại và tại sao, (3) khuyến nghị chính sách đầu tư số:\n\n${ctx}`
          }]}]}) }
      );
      const d = await res.json();
      if (d.error) {
        setAiRes(`❌ Lỗi API: ${d.error.message}`);
      } else {
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        setAiRes(text || "Không có kết quả từ Gemini.");
      }
    } catch(e) { setAiRes("❌ Lỗi kết nối: "+e.message); }
    setAiLoad(false);
  };

  const TABS = [
    {id:"c1",label:"① Tổng quan 15 DA",  color:D.blue},
    {id:"c2",label:"② Kết quả MIP",      color:D.teal},
    {id:"c3",label:"③ So sánh kịch bản", color:D.purple},
    {id:"c4",label:"④ E[Z] rủi ro",      color:D.amber},
    {id:"c5",label:"⑤ Thảo luận",        color:D.coral},
  ];

  const bcrSorted = [...IDS].sort((a,b) => proj[b].B/proj[b].C - proj[a].B/proj[a].C);

  return (
    <div style={{ minHeight:"100vh", fontFamily:"'Segoe UI',sans-serif", color:D.t1,
      padding:"24px 20px",
      background:`linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)` }}>

      {/* HEADER */}
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ display:"inline-block", background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius:6, padding:"3px 14px", fontSize:11, fontWeight:700,
          letterSpacing:2, marginBottom:10, color:"#fff" }}>
          AIDEOM-VN • PHẦN C – CẤP ĐỘ TRUNG BÌNH
        </div>
        <h1 style={{ fontSize:24, fontWeight:900, margin:"0 0 6px",
          background:"linear-gradient(90deg,#38bdf8,#818cf8)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Bài 5 — MIP Lựa chọn Danh mục Dự án CĐS Quốc gia
        </h1>
        <p style={{ fontSize:13, color:D.t3, margin:0 }}>
          max Σ Bᵢ·yᵢ &nbsp;|&nbsp; 15 dự án · 7 ràng buộc · yᵢ∈{"{"} 0,1 {"}"} &nbsp;|&nbsp;
          Kéo slider & toggle dự án → MIP giải lại ngay
        </p>
      </div>

      {/* ══ CONTROL PANEL ════════════════════════════════════════════ */}
      <Card style={{ marginBottom:20, border:`1px solid #0ea5e955` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <span style={{ fontSize:16 }}>🎛️</span>
          <span style={{ fontWeight:700, fontSize:15, color:D.cyan }}>Bảng điều khiển tham số</span>
          <span style={{ fontSize:11, color:D.t3, marginLeft:4 }}>— thay đổi → MIP giải lại realtime</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 32px" }}>

          {/* Cột 1: Ngân sách & ràng buộc số lượng */}
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:D.amber, margin:"0 0 12px" }}>
              💰 Ngân sách & Số lượng dự án
            </p>
            <SliderRow label="Ngân sách 5 năm (C1)" value={budget5y} min={50000} max={130000} step={1000}
              onChange={setBudget5y} color={D.cyan} unit=" tỷ" fmt={v=>v.toLocaleString()} />
            <SliderRow label="Ngân sách năm 1-2 (C2)" value={budget1y} min={20000} max={70000} step={1000}
              onChange={setBudget1y} color={D.blue} unit=" tỷ" fmt={v=>v.toLocaleString()} />
            <SliderRow label="Số dự án tối thiểu (C7)" value={minP} min={3} max={10}
              onChange={setMinP} color={D.green} unit=" DA" fmt={v=>`${v}`} />
            <SliderRow label="Số dự án tối đa (C7)" value={maxP} min={8} max={15}
              onChange={setMaxP} color={D.coral} unit=" DA" fmt={v=>`${v}`} />

            {/* Toggle options */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:4 }}>
              {[
                { label:"Tối đa E[Z] (dùng pᵢ·Bᵢ)", val:useExpected, set:setUseExpected, color:D.amber },
                { label:"Bonus cộng hưởng P8×P13 (+8K tỷ)", val:bonusP8P13, set:setBonusP8P13, color:D.purple },
              ].map(({label,val,set,color})=>(
                <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"7px 12px", background:D.bg3, borderRadius:7 }}>
                  <span style={{ fontSize:12, color:D.t2 }}>{label}</span>
                  <div style={{ display:"flex", gap:6 }}>
                    {["BẬT","TẮT"].map((v,vi)=>(
                      <button key={v} onClick={()=>set(vi===0)} style={{
                        padding:"3px 10px", borderRadius:5, fontSize:11, border:"none", cursor:"pointer",
                        background:(vi===0)===val?color:"rgba(30,41,59,0.7)",
                        color:(vi===0)===val?"#fff":D.t2, fontWeight:600
                      }}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cột 2: Chỉnh NPV/Pi P8 & P13 + toggle dự án */}
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:D.purple, margin:"0 0 12px" }}>
              📐 Điều chỉnh P8 (AI) & P13 (Bán dẫn)
            </p>
            <SliderRow label="NPV P8 — AI+HPC (tỷ)" value={bAI} min={15000} max={45000} step={500}
              onChange={setBAI} color={D.purple} unit=" tỷ" fmt={v=>v.toLocaleString()} />
            <SliderRow label="Pi P8 — xác suất thành công" value={piAI} min={0.3} max={1.0} step={0.05}
              onChange={setPiAI} color={D.purple} unit="" fmt={v=>v.toFixed(2)} />
            <SliderRow label="NPV P13 — Bán dẫn (tỷ)" value={bSemi} min={20000} max={55000} step={500}
              onChange={setBSemi} color={D.blue} unit=" tỷ" fmt={v=>v.toLocaleString()} />
            <SliderRow label="Pi P13 — xác suất thành công" value={piSemi} min={0.3} max={1.0} step={0.05}
              onChange={setPiSemi} color={D.blue} unit="" fmt={v=>v.toFixed(2)} />
            <p style={{ fontSize:11, color:D.t3, margin:"6px 0 0" }}>
              BCR P8={((proj[8].B)/proj[8].C).toFixed(3)} · BCR P13={(proj[13].B/proj[13].C).toFixed(3)}
            </p>
          </div>

          {/* Cột 3: Toggle từng dự án */}
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:D.coral, margin:"0 0 8px" }}>
              🔘 Force / Exclude từng dự án
            </p>
            <p style={{ fontSize:10, color:D.t3, margin:"0 0 10px" }}>
              Click 1 lần = 🔒 bắt buộc · Click 2 lần = ❌ loại bỏ · Click 3 lần = ↩ tự do
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, maxHeight:280, overflowY:"auto" }}>
              {IDS.map(i => {
                const st = projState[i];
                const color = FIELD_COLORS[proj[i].field] || D.t2;
                const isSel = sol.selected.includes(i);
                return (
                  <button key={i} onClick={() => toggleProj(i)} style={{
                    padding:"5px 8px", borderRadius:7, border:`1px solid ${
                      st==='forced'?D.green:st==='excluded'?D.coral:isSel?D.blue:D.border}`,
                    background: st==='forced'?D.greenBg:st==='excluded'?D.coralBg:isSel?D.blueBg:"transparent",
                    cursor:"pointer", textAlign:"left", transition:"all .2s"
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:
                        st==='forced'?D.green:st==='excluded'?D.coral:isSel?D.blue:D.t3 }}>P{i}</span>
                      <span style={{ fontSize:9, color }}>
                        {st==='forced'?"🔒":st==='excluded'?"❌":isSel?"✓":""}
                      </span>
                    </div>
                    <div style={{ fontSize:9.5, color:D.t3, marginTop:1, whiteSpace:"nowrap",
                      overflow:"hidden", textOverflow:"ellipsis", maxWidth:90 }}>
                      {proj[i].name}
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setProjState({})} style={{
              marginTop:8, width:"100%", padding:"5px", borderRadius:6, border:`1px solid ${D.border}`,
              background:"transparent", color:D.t3, fontSize:11, cursor:"pointer"
            }}>↩ Reset tất cả</button>
          </div>
        </div>

        {/* Feasibility */}
        <div style={{ marginTop:14, padding:"8px 16px", borderRadius:8,
          background:sol.feasible?D.greenBg:D.coralBg,
          border:`1px solid ${sol.feasible?D.green:D.coral}44`,
          display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>{sol.feasible?"✅":"❌"}</span>
          <span style={{ fontSize:13, fontWeight:600, color:sol.feasible?D.green:D.coral }}>
            {sol.feasible
              ? `KHẢ THI — Z*=${sol.Z.toLocaleString()} tỷ | ${sol.selected.length} DA | Chi phí ${sol.totalC.toLocaleString()} tỷ | BCR ${sol.bcr}`
              : `KHÔNG KHẢ THI — Vi phạm ràng buộc. Thử nới ngân sách hoặc thay đổi forced/excluded.`}
          </span>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { label:"Z* tối ưu",      val:sol.Z.toLocaleString(),         unit:`tỷ (${sol.selected.length} DA)`,         color:D.blue },
          { label:"Tổng chi phí",   val:sol.totalC.toLocaleString(),    unit:`tỷ / ${budget5y.toLocaleString()} tỷ`,   color:D.teal },
          { label:"BCR tổng hợp",   val:sol.bcr,                        unit:"lợi ích / chi phí",                      color:D.amber },
          { label:"Dư ngân sách",   val:(budget5y-sol.totalC).toLocaleString(), unit:"tỷ còn lại",                     color:D.green },
          { label:"B=100K → Z*",    val:solB100.Z.toLocaleString(),     unit:`tỷ (${solB100.selected.length} DA)`,     color:D.purple },
        ].map((k,i)=>(
          <div key={i} style={{ background:D.bg1, border:`1px solid ${k.color}33`,
            borderRadius:10, padding:"12px 16px", flex:1, minWidth:120 }}>
            <p style={{ fontSize:11, color:D.t3, margin:"0 0 3px", textTransform:"uppercase", letterSpacing:"0.06em" }}>{k.label}</p>
            <p style={{ fontSize:19, fontWeight:700, color:k.color, margin:0 }}>{k.val}</p>
            <p style={{ fontSize:11, color:D.t3, margin:"2px 0 0" }}>{k.unit}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
        {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} onClick={()=>setTab(t.id)} color={t.color}/>)}
      </div>

      {/* ══ TAB 1: TỔNG QUAN ═════════════════════════════════════════ */}
      {tab==="c1" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Card>
              <h3 style={{ margin:"0 0 14px", color:D.blue, fontSize:14 }}>NPV theo dự án (tỷ VND)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={IDS.map(i=>({ name:`P${i}`, B:proj[i].B, sel:sol.selected.includes(i) }))}
                  margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis dataKey="name" tick={{ fill:D.t2, fontSize:10 }}/>
                  <YAxis tick={{ fill:D.t2, fontSize:10 }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
                  <Tooltip contentStyle={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8 }}
                    formatter={v=>[v.toLocaleString()+" tỷ","NPV"]}/>
                  <Bar dataKey="B" radius={[4,4,0,0]}>
                    {IDS.map(i=><Cell key={i} fill={sol.selected.includes(i)?D.blue+"cc":D.t3+"44"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize:11, color:D.t3, margin:"6px 0 0" }}>Cột sáng = dự án được chọn</p>
            </Card>

            <Card>
              <h3 style={{ margin:"0 0 14px", color:D.amber, fontSize:14 }}>BCR xếp hạng (Bᵢ/Cᵢ)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={bcrSorted.map(i=>({ name:`P${i}`, bcr:+(proj[i].B/proj[i].C).toFixed(3) }))}
                  margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis dataKey="name" tick={{ fill:D.t2, fontSize:10 }}/>
                  <YAxis tick={{ fill:D.t2, fontSize:10 }} domain={[0,'auto']}/>
                  <Tooltip contentStyle={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8 }}/>
                  <ReferenceLine y={1.5} stroke={D.amber} strokeDasharray="4 4" label={{ value:"BCR≥1.5", fill:D.amber, fontSize:10 }}/>
                  <Bar dataKey="bcr" radius={[4,4,0,0]}>
                    {bcrSorted.map(i=>{
                      const b = proj[i].B/proj[i].C;
                      return <Cell key={i} fill={b>=2.5?D.green:b>=2?D.teal:b>=1.5?D.amber+"cc":D.coral+"cc"}/>;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Scatter: Chi phí vs NPV */}
          <Card>
            <h3 style={{ margin:"0 0 4px", color:D.purple, fontSize:14 }}>Chi phí vs NPV — bong bóng BCR</h3>
            <p style={{ fontSize:12, color:D.t3, margin:"0 0 14px" }}>Kích thước = BCR. Dự án được chọn = màu sáng</p>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top:5, right:20, bottom:20, left:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                <XAxis dataKey="C" type="number" name="Chi phí" tick={{ fill:D.t2, fontSize:10 }}
                  label={{ value:"Chi phí (tỷ)", position:"insideBottom", fill:D.t3, fontSize:11 }}
                  tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
                <YAxis dataKey="B" type="number" name="NPV" tick={{ fill:D.t2, fontSize:10 }}
                  tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
                <Tooltip cursor={{ strokeDasharray:"3 3" }}
                  contentStyle={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8 }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8, padding:"8px 12px" }}>
                        <p style={{ margin:0, fontWeight:700, color:D.t1 }}>{d.name}</p>
                        <p style={{ margin:0, color:D.t2, fontSize:12 }}>C={d.C.toLocaleString()} | B={d.B.toLocaleString()}</p>
                        <p style={{ margin:0, color:D.amber, fontSize:12 }}>BCR={(d.B/d.C).toFixed(3)}</p>
                      </div>
                    );
                  }}/>
                <Scatter
                  data={IDS.map(i=>({ ...proj[i], id:i, name:`P${i} ${proj[i].name}`, sel:sol.selected.includes(i) }))}
                  fill={D.blue}>
                  {IDS.map(i=>(
                    <Cell key={i}
                      fill={sol.selected.includes(i)?FIELD_COLORS[proj[i].field]||D.blue:D.t3+"55"}
                      r={Math.max(4, (proj[i].B/proj[i].C)*5)}/>
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 2: KẾT QUẢ MIP ══════════════════════════════════════ */}
      {tab==="c2" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 0.8fr", gap:16 }}>
            <Card>
              <h3 style={{ margin:"0 0 14px", color:D.teal, fontSize:14 }}>
                Danh mục tối ưu — {sol.selected.length} dự án được chọn
              </h3>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {sol.selected.sort((a,b)=>a-b).map(i=>{
                  const p = proj[i];
                  const color = FIELD_COLORS[p.field] || D.blue;
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                      padding:"9px 12px", borderRadius:8,
                      background:`${color}0d`, border:`1px solid ${color}33` }}>
                      <span style={{ fontSize:12, fontWeight:700, color, minWidth:28 }}>P{i}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:12, fontWeight:600, color:D.t1, margin:0 }}>{p.name}</p>
                        <p style={{ fontSize:10, color:D.t3, margin:0 }}>
                          C={p.C.toLocaleString()} | B={p.B.toLocaleString()} | BCR={(p.B/p.C).toFixed(3)}
                        </p>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <Badge label={p.field} color={color}/>
                        <p style={{ fontSize:10, color:D.t3, margin:"2px 0 0" }}>pi={p.pi*100}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Gantt mini */}
              <h4 style={{ color:D.t2, fontSize:13, margin:"16px 0 8px" }}>Timeline giải ngân</h4>
              {sol.selected.sort((a,b)=>a-b).map(i=>{
                const p = proj[i];
                const color = FIELD_COLORS[p.field]||D.blue;
                const w1pct = (p.C1/p.C)*40;
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:10, color, minWidth:26, fontWeight:600 }}>P{i}</span>
                    <div style={{ flex:1, height:10, background:D.bg1, borderRadius:3, overflow:"hidden", display:"flex" }}>
                      <div style={{ width:`${w1pct}%`, background:color, opacity:0.9 }}/>
                      <div style={{ flex:1, background:`${color}44` }}/>
                    </div>
                    <span style={{ fontSize:9, color:D.t3, minWidth:60, textAlign:"right" }}>
                      N1-2:{p.C1.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </Card>

            <Card>
              <h3 style={{ margin:"0 0 14px", color:D.teal, fontSize:14 }}>Kiểm tra ràng buộc</h3>
              <ConstraintPanel selected={sol.selected} proj={proj}
                budget5y={budget5y} budget1y={budget1y} minP={minP} maxP={maxP}/>
              <div style={{ marginTop:16, padding:"12px 14px", background:D.bg3, borderRadius:8 }}>
                <p style={{ fontSize:12, fontWeight:700, color:D.cyan, margin:"0 0 8px" }}>Thống kê danh mục</p>
                {[
                  { label:"Tổng NPV", val:sol.Zbase.toLocaleString()+" tỷ", color:D.amber },
                  { label:"E[NPV] (rủi ro)", val:solExpected.Z.toLocaleString()+" tỷ", color:D.yellow },
                  { label:"Chi phí năm 1-2", val:sol.totalC1.toLocaleString()+" tỷ", color:D.blue },
                  { label:"BCR tổng", val:sol.bcr, color:D.green },
                ].map((k,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:12, color:D.t2 }}>{k.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:k.color, fontFamily:"monospace" }}>{k.val}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 3: SO SÁNH KỊCH BẢN ════════════════════════════════ */}
      {tab==="c3" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
            {[
              { label:`Base (${(budget5y/1000).toFixed(0)}K tỷ)`, s:sol,       color:D.blue   },
              { label:"Budget 100K tỷ",                            s:solB100,   color:D.green  },
              { label:"Force P1+P2 (2 TTDL)",                      s:solForce12,color:D.purple },
            ].map(({label,s,color})=>(
              <Card key={label} style={{ border:`1px solid ${color}33` }}>
                <h3 style={{ margin:"0 0 4px", color, fontSize:13 }}>{label}</h3>
                <p style={{ fontSize:22, fontWeight:800, color, margin:"0 0 12px" }}>
                  {s.Z.toLocaleString()} tỷ
                </p>
                <p style={{ fontSize:12, color:D.t3, margin:"0 0 8px" }}>{s.selected.length} dự án | BCR {s.bcr}</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {s.selected.sort((a,b)=>a-b).map(i=>(
                    <span key={i} style={{ padding:"2px 7px", borderRadius:4, fontSize:11, fontWeight:600,
                      background:`${FIELD_COLORS[proj[i].field]||D.blue}22`,
                      color:FIELD_COLORS[proj[i].field]||D.blue }}>P{i}</span>
                  ))}
                </div>
                <p style={{ fontSize:11, color:D.t3, margin:"8px 0 0" }}>
                  Chi phí {s.totalC.toLocaleString()} | Dư {(Math.max(budget5y,100000)-s.totalC).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <h3 style={{ margin:"0 0 14px", color:D.amber, fontSize:14 }}>Z*(B) — độ nhạy theo ngân sách</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sensData} margin={{ top:5, right:20, bottom:5, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                <XAxis dataKey="budget" tick={{ fill:D.t2, fontSize:11 }}/>
                <YAxis tick={{ fill:D.t2, fontSize:10 }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
                <Tooltip contentStyle={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8 }}
                  formatter={v=>[v.toLocaleString()+" tỷ",""]}/>
                <ReferenceLine x={`${(budget5y/1000).toFixed(0)}K`} stroke={D.amber} strokeDasharray="4 4"
                  label={{ value:"Base", fill:D.amber, fontSize:11 }}/>
                <Line type="monotone" dataKey="Z" stroke={D.purple} strokeWidth={2.5}
                  dot={{ fill:D.purple, r:5 }} name="Z* (tỷ)"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 4: E[Z] RỦI RO ══════════════════════════════════════ */}
      {tab==="c4" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Card>
              <h3 style={{ margin:"0 0 14px", color:D.amber, fontSize:14 }}>
                Xác suất thành công pᵢ theo dự án
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={IDS.map(i=>({ name:`P${i}`, pi:proj[i].pi*100, sel:sol.selected.includes(i) }))}
                  margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis dataKey="name" tick={{ fill:D.t2, fontSize:10 }}/>
                  <YAxis domain={[0,100]} tick={{ fill:D.t2, fontSize:10 }} tickFormatter={v=>`${v}%`}/>
                  <Tooltip formatter={v=>[`${v}%`,"Pi"]}
                    contentStyle={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8 }}/>
                  <ReferenceLine y={80} stroke={D.green} strokeDasharray="4 4" label={{ value:"80%", fill:D.green, fontSize:10 }}/>
                  <Bar dataKey="pi" radius={[4,4,0,0]}>
                    {IDS.map(i=><Cell key={i} fill={proj[i].pi>=0.8?D.teal+"cc":proj[i].pi>=0.7?D.amber+"cc":D.coral+"cc"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ margin:"0 0 14px", color:D.amber, fontSize:14 }}>NPV vs E[NPV] = pᵢ·Bᵢ</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={sol.selected.sort((a,b)=>a-b).map(i=>({
                    name:`P${i}`, NPV:proj[i].B, ENPV:Math.round(proj[i].pi*proj[i].B)
                  }))}
                  margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
                  <XAxis dataKey="name" tick={{ fill:D.t2, fontSize:10 }}/>
                  <YAxis tick={{ fill:D.t2, fontSize:10 }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
                  <Tooltip contentStyle={{ background:D.bg2, border:`1px solid ${D.border}`, borderRadius:8 }}
                    formatter={v=>[v.toLocaleString()+" tỷ",""]}/>
                  <Legend wrapperStyle={{ color:D.t2, fontSize:11 }}/>
                  <Bar dataKey="NPV"  name="NPV (Bᵢ)"     fill={D.blue+"bb"}  radius={[4,4,0,0]}/>
                  <Bar dataKey="ENPV" name="E[NPV]=pᵢ·Bᵢ" fill={D.amber+"bb"} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <h3 style={{ margin:"0 0 14px", color:D.amber, fontSize:14 }}>
              So sánh: tối đa Z vs tối đa E[Z] (bật tắt qua slider bên trên)
            </h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
              {[
                { label:"Tối đa Z (không rủi ro)", s:sol,         color:D.blue,  obj:"Bᵢ" },
                { label:"Tối đa E[Z] (có rủi ro)", s:solExpected, color:D.amber, obj:"pᵢ·Bᵢ" },
              ].map(({label,s,color,obj})=>(
                <div key={label} style={{ padding:"12px 14px", background:`${color}0e`,
                  border:`1px solid ${color}44`, borderRadius:8 }}>
                  <p style={{ fontSize:12, color, fontWeight:700, margin:"0 0 4px" }}>{label}</p>
                  <p style={{ fontSize:22, fontWeight:800, color, margin:"0 0 6px" }}>{s.Z.toLocaleString()} tỷ</p>
                  <p style={{ fontSize:11, color:D.t3, margin:"0 0 4px" }}>Hàm mục tiêu: Σ {obj}·yᵢ</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                    {s.selected.sort((a,b)=>a-b).map(i=>(
                      <span key={i} style={{ fontSize:10, padding:"1px 5px", borderRadius:3,
                        background:`${color}22`, color }}>P{i}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:"10px 14px", background:D.amberBg,
              borderLeft:`3px solid ${D.amber}`, borderRadius:7, fontSize:13, color:D.t2, lineHeight:1.7 }}>
              Khi tính rủi ro (pᵢ), danh mục thay đổi: mô hình <strong style={{ color:D.amber }}>
              tránh P8 (AI, pi={piAI.toFixed(2)})</strong> nếu pi thấp, và ưu tiên dự án có pi cao ≥ 0.80.
              Thử kéo slider Pi P8 lên → P8 sẽ xuất hiện lại trong E[Z].
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      {/* ══ TAB 5: THẢO LUẬN ════════════════════════════════════════ */}
      {tab==="c5" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {[
            {
              q:"a) Vì sao P15 (Open Data, BCR=2.533 cao nhất) luôn được chọn?",
              color:D.coral,
              a:`P15 (Open Data, C=1.500 tỷ — thấp nhất, BCR=${(proj[15].B/proj[15].C).toFixed(3)}) là "free rider" của danh mục: chi phí quá nhỏ, BCR cao nhất, không vi phạm bất kỳ ràng buộc nào.

Về chính sách: Open Data là nền tảng số dùng chung (digital public goods), tạo ngoại tác tích cực cho toàn bộ hệ sinh thái. Phù hợp Nghị quyết 57-NQ/TW về dữ liệu mở quốc gia.

→ Bất kể bạn thay đổi ngân sách hay ràng buộc, P15 gần như luôn được chọn vì quá "rẻ" so với lợi ích.`
            },
            {
              q:"b) Ràng buộc bắt buộc P14 (an ninh mạng) có làm giảm Z*?",
              color:D.amber,
              a:`P14 (BCR=${(proj[14].B/proj[14].C).toFixed(3)} > 1) được chọn trong mọi kịch bản — KHÔNG làm giảm Z* vì BCR > 1 và không cạnh tranh ngân sách với dự án tốt hơn.

Về tính hợp lý: bắt buộc P14 là đúng vì (1) An ninh mạng là điều kiện cần cho các DA khác hoạt động an toàn — P8 (AI), TTDL đều cần SOC; (2) Chi phí an ninh = "bảo hiểm" — không có SOC, rủi ro hệ thống có thể phủ nhận toàn bộ NPV; (3) Phù hợp Luật An ninh mạng 2018.`
            },
            {
              q:`c) P8 (AI, NPV=${proj[8].B.toLocaleString()} tỷ) và P13 (Bán dẫn, NPV=${proj[13].B.toLocaleString()} tỷ) có cộng hưởng — làm thế nào mô hình hóa?`,
              color:D.purple,
              a:`Mô hình hiện tại giả định dự án độc lập. Để mô hình hóa cộng hưởng P8×P13, có 3 cách:

(1) Biến tương tác: z₈₁₃ = y₈·y₁₃, thêm ΔB·z₈₁₃ vào hàm mục tiêu với ràng buộc:
    z₈₁₃ ≤ y₈, z₈₁₃ ≤ y₁₃, z₈₁₃ ≥ y₈+y₁₃−1

(2) Thay đổi hệ số: khi cả P8 và P13 được chọn, NPV₁₃ tăng thêm ~8.000 tỷ nhờ nhu cầu AI từ ngành bán dẫn.

(3) Portfolio approach: dùng ma trận hiệp phương sai lợi ích thay vì cộng tuyến tính.

→ Bật "Bonus cộng hưởng P8×P13" ở bảng điều khiển để xem tác động. Với ΔB=8.000 tỷ, mô hình có xu hướng chọn cả 2.`
            },
          ].map((item,i)=>(
            <Card key={i}>
              <div style={{ padding:"8px 12px", background:`${item.color}10`,
                borderLeft:`3px solid ${item.color}`, borderRadius:6, marginBottom:10 }}>
                <p style={{ fontSize:13, fontWeight:600, color:item.color, margin:0 }}>{item.q}</p>
              </div>
              <p style={{ fontSize:13, color:D.t2, lineHeight:1.85, margin:0, whiteSpace:"pre-line" }}>{item.a}</p>
            </Card>
          ))}

          <Card style={{ border:`1px solid ${D.cyan}33` }}>
            <h3 style={{ margin:"0 0 12px", color:D.cyan, fontSize:14 }}>Mô hình MIP (tham số hiện tại)</h3>
            <div style={{ fontFamily:"monospace", fontSize:12, lineHeight:2.2,
              background:D.bg3, borderRadius:8, padding:"12px 16px", color:D.t2 }}>
              <p style={{ margin:0 }}>max Z = Σᵢ {useExpected?"pᵢ·":""}Bᵢ·yᵢ{bonusP8P13?" + 8.000·z₈₁₃":""}, yᵢ∈{"{"} 0,1 {"}"}</p>
              <p style={{ margin:0 }}>C1: Σ Cᵢyᵢ ≤ <span style={{ color:D.amber }}>{budget5y.toLocaleString()}</span></p>
              <p style={{ margin:0 }}>C2: Σ C1ᵢyᵢ ≤ <span style={{ color:D.blue }}>{budget1y.toLocaleString()}</span></p>
              <p style={{ margin:0 }}>C3: y₁+y₂ ≤ 1 | C4: y₈≤y₁₂ | C5: y₁₃≤y₁₂</p>
              <p style={{ margin:0 }}>C6: y₄+y₅≥1, y₁₄=1 | C7: {minP}≤Σyᵢ≤{maxP}</p>
              <p style={{ margin:"8px 0 0", color:D.blue, fontWeight:700 }}>
                → Z* = {sol.Z.toLocaleString()} tỷ | Chọn {sol.selected.sort((a,b)=>a-b).map(i=>`P${i}`).join(",")}
              </p>
            </div>
          </Card>
          <GeminiPanel result={aiRes} loading={aiLoad} onAnalyze={handleAnalyze}/>
        </div>
      )}

      <div style={{ marginTop:28, textAlign:"center", fontSize:11, color:D.t3,
        borderTop:`1px solid ${D.border}`, paddingTop:12 }}>
        Bài 5 — AIDEOM-VN | MIP Solver (in-browser greedy) | Dữ liệu: QĐ 749/QĐ-TTg, QĐ 127/QĐ-TTg
      </div>
    </div>
  );
}