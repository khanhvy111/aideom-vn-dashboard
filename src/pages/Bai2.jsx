import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ── THEME ─────────────────────────────────────────────────────────────
const D = {
  bg0:"#020617", bg1:"#0f172a", bg2:"#1e293b", bg3:"#0c1a2e",
  border:"#1e3a5f",
  t1:"#e2e8f0", t2:"#94a3b8", t3:"#64748b",
  blue:"#38bdf8",   blueBg:"rgba(56,189,248,0.10)",
  teal:"#2dd4bf",   tealBg:"rgba(45,212,191,0.10)",
  amber:"#fbbf24",  amberBg:"rgba(251,191,36,0.10)",
  coral:"#f87171",  coralBg:"rgba(248,113,113,0.10)",
  purple:"#a78bfa", purpleBg:"rgba(167,139,250,0.10)",
  green:"#4ade80",  greenBg:"rgba(74,222,128,0.10)",
  cyan:"#67e8f9",
};

const COLORS = [D.blue, D.amber, D.teal, D.purple];
const NAMES  = ["Hạ tầng số", "AI & dữ liệu", "Nhân lực số", "R&D CN"];
const MINS   = [10, 5, 5, 5];

// ── LP Solver (simplex đơn giản) ──────────────────────────────────────
function solveLP({ budget, coeffs, mins, techRatio }) {
  let x = [...mins];
  let used = x.reduce((a, b) => a + b, 0);
  if (used > budget) return { feasible: false, x, Z: 0 };

  let slack = budget - used;
  const order = [0,1,2,3].sort((a,b) => coeffs[b]-coeffs[a]);
  for (const idx of order) {
    if (slack <= 0) break;
    x[idx] += slack;
    slack = 0;
  }

  const total = x.reduce((a,b)=>a+b,0);
  const techNeed = techRatio * total;
  const techHave = x[1] + x[3];
  if (techHave < techNeed) {
    const deficit = techNeed - techHave;
    const techIdx = coeffs[1] >= coeffs[3] ? 1 : 3;
    const nonTechOrder = [0,2].sort((a,b) => coeffs[a]-coeffs[b]);
    let toTransfer = deficit;
    for (const ni of nonTechOrder) {
      const canCut = x[ni] - mins[ni];
      const cut = Math.min(canCut, toTransfer);
      x[ni] -= cut;
      x[techIdx] += cut;
      toTransfer -= cut;
      if (toTransfer <= 0.001) break;
    }
  }

  const Z = x.reduce((s, v, i) => s + v * coeffs[i], 0);
  const techPct = (x[1]+x[3]) / x.reduce((a,b)=>a+b,0) * 100;
  return { feasible: true, x: x.map(v=>Math.round(v*100)/100), Z: Math.round(Z*100)/100, techPct };
}

// ── UI Components ─────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: D.bg2, border: `1px solid ${D.border}`,
    borderRadius: 12, padding: "1.2rem", ...style
  }}>{children}</div>
);

const KPI = ({ label, value, unit, color, sub }) => (
  <div style={{
    background: D.bg1, border: `1px solid ${color}33`,
    borderRadius: 10, padding: "13px 16px", flex: 1, minWidth: 130
  }}>
    <p style={{ fontSize: 11, color: D.t3, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
    <p style={{ fontSize: 21, fontWeight: 700, color, margin: 0 }}>{value}</p>
    {unit && <p style={{ fontSize: 11, color: D.t3, margin: "2px 0 0" }}>{unit}</p>}
    {sub  && <p style={{ fontSize: 10, color: D.t3, margin: "3px 0 0" }}>{sub}</p>}
  </div>
);

const TabBtn = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", border: "none", transition: "all .2s",
    background: active ? "#0ea5e9" : "rgba(30,41,59,0.7)",
    color: active ? "#fff" : D.t2,
    boxShadow: active ? "0 0 14px #0ea5e940" : "none"
  }}>{label}</button>
);

const SliderRow = ({ label, value, min, max, step=1, onChange, color, unit="tỷ", fmt }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: D.t2 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>
        {fmt ? fmt(value) : value} {unit}
      </span>
    </div>
    <div style={{ position: "relative" }}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{
          width: "100%", height: 6, borderRadius: 3, outline: "none", cursor: "pointer",
          appearance: "none", WebkitAppearance: "none",
          background: `linear-gradient(to right, ${color} 0%, ${color} ${(value-min)/(max-min)*100}%, #1e3a5f ${(value-min)/(max-min)*100}%, #1e3a5f 100%)`
        }}
      />
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: D.t3, marginTop: 2 }}>
      <span>{min}{unit}</span><span>{max}{unit}</span>
    </div>
  </div>
);

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
export default function Bai2() {
  // ── State tham số (slider) ─────────────────────────────────────────
  const [budget,    setBudget]    = useState(100);
  const [c1,        setC1]        = useState(0.85);
  const [c2,        setC2]        = useState(1.20);
  const [c3,        setC3]        = useState(0.95);
  const [c4,        setC4]        = useState(1.35);
  const [min1,      setMin1]      = useState(25);
  const [min2,      setMin2]      = useState(15);
  const [min3,      setMin3]      = useState(20);
  const [min4,      setMin4]      = useState(10);
  const [techRatio, setTechRatio] = useState(0.35);

  // ── State UI ───────────────────────────────────────────────────────
  const [tab,       setTab]       = useState("c1");
  const [aiResult,  setAiResult]  = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ── Tính LP mỗi khi tham số thay đổi ─────────────────────────────
  const sol = solveLP({
    budget,
    coeffs: [c1, c2, c3, c4],
    mins:   [min1, min2, min3, min4],
    techRatio,
  });

  // Sensitivity curve
  const sensData = Array.from({ length: 11 }, (_, i) => {
    const B = budget + i * 10;
    const s = solveLP({ budget: B, coeffs: [c1,c2,c3,c4], mins: [min1,min2,min3,min4], techRatio });
    return { budget: `${B}K`, Z: s.Z };
  });

  const solPlus = solveLP({ budget: budget+1, coeffs:[c1,c2,c3,c4], mins:[min1,min2,min3,min4], techRatio });
  const shadowPrice = sol.feasible ? (solPlus.Z - sol.Z).toFixed(3) : "—";
  const allocData = NAMES.map((n, i) => ({
    name: n, value: sol.x[i], color: COLORS[i],
    contrib: sol.x[i] * [c1,c2,c3,c4][i],
  }));

  // Gemini analyze (nhận API key từ component)
  const handleAnalyze = async (apiKey) => {
    setAiLoading(true);
    setAiResult("");
    try {
      const context = `
Bài 2 — LP Phân bổ Ngân sách Số Hóa Quốc gia (Việt Nam)
Mô hình: max Z = ${c1}x₁ + ${c2}x₂ + ${c3}x₃ + ${c4}x₄
Ràng buộc: x₁+x₂+x₃+x₄ ≤ ${budget} (ngân sách tổng K tỷ VND)
Sàn tối thiểu: x₁≥${min1}, x₂≥${min2}, x₃≥${min3}, x₄≥${min4}
Công nghệ chiến lược: (x₂+x₄) ≥ ${(techRatio*100).toFixed(0)}% tổng

KẾT QUẢ TỐI ƯU:
- Hạ tầng số (x₁): ${sol.x[0]} tỷ (hệ số ${c1})
- AI & dữ liệu (x₂): ${sol.x[1]} tỷ (hệ số ${c2})
- Nhân lực số (x₃): ${sol.x[2]} tỷ (hệ số ${c3})
- R&D CN (x₄): ${sol.x[3]} tỷ (hệ số ${c4})
- Z* = ${sol.Z} tỷ VND GDP tăng kỳ vọng
- Tỷ lệ CN chiến lược: ${sol.techPct?.toFixed(1)}%
- Shadow price ngân sách: ${shadowPrice} tỷ GDP / 1 tỷ ngân sách tăng
- Bài toán ${sol.feasible ? "KHẢ THI" : "KHÔNG KHẢ THI"}
      `;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text:
              `Bạn là chuyên gia kinh tế Việt Nam. Phân tích kết quả LP sau bằng tiếng Việt, nêu: (1) nhận xét phân bổ tối ưu, (2) ý nghĩa shadow price, (3) khuyến nghị chính sách cụ thể:\n\n${context}`
            }]}]
          }),
        }
      );
      const data = await res.json();
      if (data.error) {
        setAiResult(`❌ Lỗi API: ${data.error.message}`);
      } else {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        setAiResult(text || "Không có kết quả từ Gemini.");
      }
    } catch (err) {
      setAiResult("❌ Lỗi kết nối: " + err.message);
    }
    setAiLoading(false);
  };

  const TABS = [
    { id: "c1", label: "① Kết quả & Phân bổ" },
    { id: "c2", label: "② Shadow Price" },
    { id: "c3", label: "③ Độ nhạy" },
    { id: "c4", label: "④ Thảo luận" },
  ];

  return (
    <div style={{
      minHeight: "100vh", fontFamily: "'Segoe UI',sans-serif",
      color: D.t1, padding: "24px 20px",
      background: `linear-gradient(135deg,${D.bg0} 0%,${D.bg1} 50%,${D.bg3} 100%)`
    }}>
      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          display: "inline-block", background: "linear-gradient(90deg,#0ea5e9,#8b5cf6)",
          borderRadius: 6, padding: "3px 14px", fontSize: 11, fontWeight: 700,
          letterSpacing: 2, marginBottom: 10, color: "#fff"
        }}>AIDEOM-VN • PHẦN B – CẤP ĐỘ DỄ</div>
        <h1 style={{
          fontSize: 24, fontWeight: 900, margin: "0 0 6px",
          background: "linear-gradient(90deg,#38bdf8,#818cf8)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
        }}>Bài 2 — LP Phân bổ Ngân sách 4 Hạng mục Đầu tư Số</h1>
        <p style={{ fontSize: 13, color: D.t3, margin: 0 }}>
          max Z = c₁x₁ + c₂x₂ + c₃x₃ + c₄x₄ &nbsp;|&nbsp; Kéo slider để thay đổi tham số — kết quả cập nhật ngay
        </p>
      </div>

      {/* ══ CONTROL PANEL ════════════════════════════════════════════ */}
      <Card style={{ marginBottom: 20, border: `1px solid #0ea5e955` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>🎛️</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: D.cyan }}>Bảng điều khiển tham số</span>
          <span style={{ fontSize: 11, color: D.t3, marginLeft: 4 }}>— kéo slider, biểu đồ tự động cập nhật</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 32px" }}>
          {/* Cột 1 */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: D.cyan, marginBottom: 10, margin: "0 0 10px" }}>
              📊 Ngân sách & Ràng buộc
            </p>
            <SliderRow label="Ngân sách tổng (B)" value={budget} min={60} max={200} onChange={setBudget} color={D.cyan} unit="K tỷ" />
            <SliderRow label="Tỷ lệ CN chiến lược tối thiểu" value={Math.round(techRatio*100)} min={10} max={60} onChange={v=>setTechRatio(v/100)} color={D.teal} unit="%" />
          </div>
          {/* Cột 2 */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: D.amber, margin: "0 0 10px" }}>
              📈 Hệ số tác động GDP (cᵢ)
            </p>
            <SliderRow label="c₁ Hạ tầng số" value={c1} min={0.3} max={2.0} step={0.05} onChange={setC1} color={D.blue} unit="" fmt={v=>v.toFixed(2)} />
            <SliderRow label="c₂ AI & dữ liệu" value={c2} min={0.3} max={2.0} step={0.05} onChange={setC2} color={D.amber} unit="" fmt={v=>v.toFixed(2)} />
            <SliderRow label="c₃ Nhân lực số" value={c3} min={0.3} max={2.0} step={0.05} onChange={setC3} color={D.teal} unit="" fmt={v=>v.toFixed(2)} />
            <SliderRow label="c₄ R&D CN" value={c4} min={0.3} max={2.0} step={0.05} onChange={setC4} color={D.purple} unit="" fmt={v=>v.toFixed(2)} />
          </div>
          {/* Cột 3 */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: D.coral, margin: "0 0 10px" }}>
              🔒 Sàn tối thiểu (xᵢ ≥)
            </p>
            <SliderRow label="min₁ Hạ tầng số" value={min1} min={MINS[0]} max={Math.floor(budget*0.5)} onChange={setMin1} color={D.blue} />
            <SliderRow label="min₂ AI & dữ liệu" value={min2} min={MINS[1]} max={Math.floor(budget*0.4)} onChange={setMin2} color={D.amber} />
            <SliderRow label="min₃ Nhân lực số" value={min3} min={MINS[2]} max={Math.floor(budget*0.4)} onChange={setMin3} color={D.teal} />
            <SliderRow label="min₄ R&D CN" value={min4} min={MINS[3]} max={Math.floor(budget*0.4)} onChange={setMin4} color={D.purple} />
          </div>
        </div>

        <div style={{
          marginTop: 12, padding: "8px 16px", borderRadius: 8,
          background: sol.feasible ? D.greenBg : D.coralBg,
          border: `1px solid ${sol.feasible ? D.green : D.coral}44`,
          display: "flex", alignItems: "center", gap: 8
        }}>
          <span style={{ fontSize: 16 }}>{sol.feasible ? "✅" : "❌"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: sol.feasible ? D.green : D.coral }}>
            {sol.feasible
              ? `Bài toán KHẢ THI — Z* = ${sol.Z} tỷ VND | Phân bổ: (${sol.x.join(", ")}) tỷ`
              : "Bài toán KHÔNG KHẢ THI — tổng sàn tối thiểu vượt ngân sách!"}
          </span>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <KPI label="Z* tối ưu" value={sol.Z} unit="tỷ VND GDP tăng kỳ vọng" color={D.green}
          sub={`x*=(${sol.x.join(",")})`} />
        <KPI label="Ngân sách" value={`${budget}K tỷ`} unit="VND tổng" color={D.cyan}
          sub="Toàn bộ được phân bổ" />
        <KPI label="Shadow Price" value={shadowPrice} unit="GDP / 1 tỷ ngân sách tăng" color={D.amber}
          sub="Giá trị biên ngân sách" />
        <KPI label="CN chiến lược" value={`${sol.techPct?.toFixed(1)}%`} unit={`AI+R&D / tổng (yêu cầu ≥${(techRatio*100).toFixed(0)}%)`}
          color={sol.techPct >= techRatio*100 ? D.teal : D.coral}
          sub={sol.techPct >= techRatio*100 ? "✓ Đạt yêu cầu" : "✗ Chưa đạt"} />
        <KPI label="Hạng mục ưu tiên" value={NAMES[[c1,c2,c3,c4].indexOf(Math.max(c1,c2,c3,c4))]}
          unit={`hệ số ${Math.max(c1,c2,c3,c4).toFixed(2)} cao nhất`} color={D.purple}
          sub="Mô hình dồn vào đây" />
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map(t => <TabBtn key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </div>

      {/* ══ TAB 1: KẾT QUẢ ═══════════════════════════════════════════ */}
      {tab === "c1" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card>
              <h3 style={{ margin: "0 0 14px", color: D.green, fontSize: 14 }}>
                Phân bổ tối ưu x* — tự cập nhật theo slider
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={allocData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="name" tick={{ fill: D.t2, fontSize: 11 }} />
                  <YAxis tick={{ fill: D.t2, fontSize: 10 }} label={{ value: "Tỷ VND", angle: -90, position: "insideLeft", fill: D.t3, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 8 }}
                    formatter={(v, n) => [`${v} tỷ`, n]} />
                  <Bar dataKey="value" name="Phân bổ (tỷ)" radius={[6,6,0,0]}>
                    {allocData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 14 }}>
                {NAMES.map((n, i) => (
                  <div key={n} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: COLORS[i], fontWeight: 500 }}>{n}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS[i], fontFamily: "monospace" }}>
                        {sol.x[i]} tỷ ({(sol.x[i] / budget * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ height: 8, background: D.bg1, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${sol.x[i] / budget * 100}%`, background: COLORS[i], borderRadius: 4, transition: "width .4s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 style={{ margin: "0 0 14px", color: D.amber, fontSize: 14 }}>
                Hệ số tác động & Đóng góp GDP
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={allocData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="name" tick={{ fill: D.t2, fontSize: 11 }} />
                  <YAxis tick={{ fill: D.t2, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ color: D.t2, fontSize: 11 }} />
                  <Bar dataKey="contrib" name="Đóng góp GDP (tỷ)" radius={[6,6,0,0]}>
                    {allocData.map((e, i) => <Cell key={i} fill={COLORS[i]+"cc"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                      {["Hạng mục", "x*", "cᵢ", "Đóng góp"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", color: D.t3, textAlign: "right", fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NAMES.map((n, i) => (
                      <tr key={n} style={{ borderBottom: `1px solid ${D.border}22` }}>
                        <td style={{ padding: "6px 8px", color: COLORS[i], fontWeight: 600 }}>{n}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", color: COLORS[i] }}>{sol.x[i]}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{[c1,c2,c3,c4][i].toFixed(2)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", color: D.amber, fontWeight: 600 }}>
                          {(sol.x[i] * [c1,c2,c3,c4][i]).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${D.green}` }}>
                      <td colSpan={2} style={{ padding: "6px 8px", fontWeight: 700, color: D.green }}>TỔNG</td>
                      <td />
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800, color: D.green, fontSize: 14 }}>{sol.Z}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <GeminiPanel result={aiResult} loading={aiLoading} onAnalyze={handleAnalyze} />
        </div>
      )}

      {/* ══ TAB 2: SHADOW PRICE ══════════════════════════════════════ */}
      {tab === "c2" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ margin: "0 0 4px", color: D.amber, fontSize: 15 }}>
              Shadow Price — tính theo tham số hiện tại
            </h3>
            <p style={{ fontSize: 12, color: D.t3, margin: "0 0 16px" }}>
              Shadow price = mức tăng Z* khi tăng ngân sách thêm 1 tỷ. Thay đổi slider → shadow price cập nhật ngay.
            </p>
            <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "Shadow Price ngân sách", val: shadowPrice, unit: "tỷ GDP / 1 tỷ thêm", color: D.amber },
                { label: "Ngân sách hiện tại", val: `${budget}K tỷ`, unit: "VND", color: D.cyan },
                { label: "Z* hiện tại", val: sol.Z, unit: "tỷ VND", color: D.green },
                { label: "Z* nếu +10 tỷ ngân sách", val: (sol.Z + +shadowPrice * 10).toFixed(2), unit: "tỷ VND", color: D.purple },
              ].map((k, i) => (
                <div key={i} style={{
                  flex: 1, minWidth: 140, padding: 14,
                  background: `${k.color}0e`, border: `1px solid ${k.color}33`,
                  borderRadius: 9, textAlign: "center"
                }}>
                  <p style={{ fontSize: 11, color: D.t3, margin: "0 0 4px" }}>{k.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: k.color, margin: "0 0 2px" }}>{k.val}</p>
                  <p style={{ fontSize: 10, color: D.t3, margin: 0 }}>{k.unit}</p>
                </div>
              ))}
            </div>
            <h4 style={{ color: D.t2, fontSize: 13, margin: "0 0 12px" }}>Trạng thái ràng buộc (theo tham số hiện tại)</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {NAMES.map((n, i) => {
                const isBinding = Math.abs(sol.x[i] - [min1,min2,min3,min4][i]) < 0.01;
                return (
                  <div key={n} style={{
                    padding: "10px 14px", borderRadius: 8,
                    background: isBinding ? D.amberBg : D.greenBg,
                    border: `1px solid ${isBinding ? D.amber : D.green}44`,
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isBinding ? D.amber : D.green }}>{n}</span>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: D.t3, fontFamily: "monospace" }}>
                        x*={sol.x[i]} | min={[min1,min2,min3,min4][i]}
                      </span>
                      <span style={{
                        padding: "2px 10px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                        background: isBinding ? D.amberBg : D.greenBg,
                        color: isBinding ? D.amber : D.green,
                        border: `1px solid ${isBinding ? D.amber : D.green}55`
                      }}>
                        {isBinding ? "BINDING" : "Non-binding"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <GeminiPanel result={aiResult} loading={aiLoading} onAnalyze={handleAnalyze} />
        </div>
      )}

      {/* ══ TAB 3: ĐỘ NHẠY ══════════════════════════════════════════ */}
      {tab === "c3" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ margin: "0 0 4px", color: D.purple, fontSize: 15 }}>
              Đường cong Z*(B) — từ ngân sách hiện tại +100K tỷ
            </h3>
            <p style={{ fontSize: 12, color: D.t3, margin: "0 0 14px" }}>
              Kéo slider ngân sách bên trên → đường cong dịch chuyển theo thời gian thực
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={sensData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="budget" tick={{ fill: D.t2, fontSize: 11 }} label={{ value: "Ngân sách", position: "insideBottom", fill: D.t3, fontSize: 11 }} />
                <YAxis tick={{ fill: D.t2, fontSize: 10 }} label={{ value: "Z* (tỷ VND)", angle: -90, position: "insideLeft", fill: D.t3, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 8 }} />
                <Line type="monotone" dataKey="Z" stroke={D.purple} strokeWidth={2.5}
                  dot={{ fill: D.purple, r: 5 }} activeDot={{ r: 7 }} name="Z* (tỷ VND)" />
                <ReferenceLine x={`${budget}K`} stroke={D.amber} strokeDasharray="4 4" label={{ value: "Base", fill: D.amber, fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 14px", color: D.teal, fontSize: 14 }}>
              So sánh kịch bản: Base vs +20% ngân sách vs Ưu tiên Nhân lực (x₃ tăng)
            </h3>
            {(() => {
              const s1 = sol;
              const s2 = solveLP({ budget: Math.round(budget*1.2), coeffs:[c1,c2,c3,c4], mins:[min1,min2,min3,min4], techRatio });
              const s3 = solveLP({ budget, coeffs:[c1,c2,c3,c4], mins:[min1,min2,Math.min(min3+10,budget*0.4),min4], techRatio });
              const cmpData = NAMES.map((n, i) => ({
                name: n, Base: s1.x[i], "B+20%": s2.x[i], "x₃+10": s3.x[i]
              }));
              return (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cmpData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                      <XAxis dataKey="name" tick={{ fill: D.t2, fontSize: 11 }} />
                      <YAxis tick={{ fill: D.t2, fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ color: D.t2, fontSize: 11 }} />
                      <Bar dataKey="Base" fill={D.blue+"bb"} radius={[4,4,0,0]} />
                      <Bar dataKey="B+20%" fill={D.green+"bb"} radius={[4,4,0,0]} />
                      <Bar dataKey="x₃+10" fill={D.teal+"bb"} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
                    {[
                      { label: "Z* Base", val: s1.Z, color: D.blue },
                      { label: `Z* B+20% (${Math.round(budget*1.2)}K)`, val: s2.Z, color: D.green },
                      { label: "Z* x₃+10 tỷ", val: s3.Z, color: D.teal },
                    ].map((k, i) => (
                      <div key={i} style={{ padding: 12, background: `${k.color}0e`, border: `1px solid ${k.color}33`, borderRadius: 8, textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: D.t3, margin: "0 0 4px" }}>{k.label}</p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: k.color, margin: 0 }}>{k.val}</p>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </Card>
          <GeminiPanel result={aiResult} loading={aiLoading} onAnalyze={handleAnalyze} />
        </div>
      )}

      {/* ══ TAB 4: THẢO LUẬN ═════════════════════════════════════════ */}
      {tab === "c4" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            {
              q: "a) Mỗi tỷ tăng ngân sách, GDP kỳ vọng tăng thêm bao nhiêu?",
              color: D.amber,
              a: `Shadow price C1 hiện tại = ${shadowPrice} tỷ VND GDP / 1 tỷ VND ngân sách.
              
Tức là mỗi đồng ngân sách công tạo ra đòn bẩy GDP ${shadowPrice} lần — so sánh với lãi suất trái phiếu chính phủ VN (~3,5-4%/năm). Giá trị này thay đổi theo hệ số cᵢ và sàn tối thiểu mà bạn cài đặt ở bảng điều khiển bên trên.

Khi bạn tăng hệ số c₄ (R&D) → shadow price tăng vì mô hình dồn nhiều hơn vào R&D.
Khi bạn tăng sàn tối thiểu → shadow price có thể tăng (ràng buộc chặt hơn = giá trị biên cao hơn).`
            },
            {
              q: "b) Vì sao mô hình dồn toàn bộ slack vào 1 hạng mục?",
              color: D.purple,
              a: `LP tuyến tính luôn có nghiệm tại đỉnh (vertex) của feasible polytope. Với hàm mục tiêu tuyến tính, nghiệm tối ưu là dồn toàn bộ ngân sách còn lại (sau sàn tối thiểu) vào biến có hệ số cao nhất.

Hiện tại hệ số cao nhất là ${Math.max(c1,c2,c3,c4).toFixed(2)} (${NAMES[[c1,c2,c3,c4].indexOf(Math.max(c1,c2,c3,c4))]}) → mô hình tối đa hóa x đó.

Hãy thử kéo slider hệ số để thay đổi thứ tự ưu tiên — bạn sẽ thấy phân bổ x* thay đổi ngay lập tức.`
            },
            {
              q: "c) Ràng buộc công nghệ chiến lược có ý nghĩa gì?",
              color: D.teal,
              a: `Ràng buộc: (x₂+x₄) ≥ ${(techRatio*100).toFixed(0)}% tổng ngân sách — đảm bảo AI & R&D nhận ít nhất ${(techRatio*100).toFixed(0)}% đầu tư.

Hiện tại CN chiến lược = ${sol.techPct?.toFixed(1)}% (${sol.techPct >= techRatio*100 ? "✅ ĐẠT" : "❌ CHƯA ĐẠT"}).

Nếu tỷ lệ này không binding → mô hình tự nhiên muốn đầu tư nhiều hơn ngưỡng yêu cầu (slack dương).
Nếu binding → ràng buộc đang kìm hãm: nới lỏng 1% → Z* tăng thêm.

Thử kéo slider "Tỷ lệ CN chiến lược" lên cao → bạn sẽ thấy khi nào ràng buộc bắt đầu binding.`
            },
          ].map((item, i) => (
            <Card key={i}>
              <div style={{
                padding: "8px 12px", background: `${item.color}10`,
                borderLeft: `3px solid ${item.color}`, borderRadius: 6, marginBottom: 10
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: item.color, margin: 0 }}>{item.q}</p>
              </div>
              <p style={{ fontSize: 13, color: D.t2, lineHeight: 1.85, margin: 0, whiteSpace: "pre-line" }}>
                {item.a}
              </p>
            </Card>
          ))}
          <GeminiPanel result={aiResult} loading={aiLoading} onAnalyze={handleAnalyze} />
        </div>
      )}

      <div style={{
        marginTop: 28, textAlign: "center", fontSize: 11, color: D.t3,
        borderTop: `1px solid ${D.border}`, paddingTop: 12
      }}>
        Bài 2 — AIDEOM-VN | LP Solver (in-browser) | Dữ liệu: QĐ 749/QĐ-TTg, World Bank Vietnam Digital Economy 2024
      </div>
    </div>
  );
}