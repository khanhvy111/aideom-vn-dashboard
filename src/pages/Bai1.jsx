/* eslint-disable */
import React, { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
  ComposedChart, Area
} from "recharts";

// DỮ LIỆU GỐC 2020-2025
const years = [2020, 2021, 2022, 2023, 2024, 2025];
const Y_actual = [8044.4, 8487.5, 9513.3, 10221.8, 11511.9, 12847.6];
const K_input = [16500, 17800, 19600, 21300, 23500, 25900];
const L_input = [53.6, 50.5, 51.7, 52.4, 52.9, 53.4];
const D_input = [12.0, 12.7, 14.3, 16.5, 18.3, 19.5];
const AI_input = [55.6, 60.2, 65.4, 67.0, 73.8, 80.1];
const H_input = [24.1, 26.1, 26.2, 27.0, 28.4, 29.2];

// HÀM TÍNH TOÁN
function computeTFP(Y, K, L, D, AI, H, a, b, g, d, t) {
  const prod = Math.pow(K, a) * Math.pow(L, b) * Math.pow(D, g) *
               Math.pow(AI, d) * Math.pow(H, t);
  return Y / prod;
}

function avgGrowthRate(arr) {
  if (arr.length < 2) return 0;
  return (Math.pow(arr[arr.length-1] / arr[0], 1 / (arr.length-1)) - 1) * 100;
}

function growthAccounting(K, L, D, AI, H, Y, a, b, g, d, t) {
  const gK = avgGrowthRate(K), gL = avgGrowthRate(L), gD = avgGrowthRate(D);
  const gAI = avgGrowthRate(AI), gH = avgGrowthRate(H), gY = avgGrowthRate(Y);
  const cK = a * gK, cL = b * gL, cD = g * gD, cAI = d * gAI, cH = t * gH;
  const cTFP = gY - (cK + cL + cD + cAI + cH);
  const shares = {
    K: (cK/gY)*100, L: (cL/gY)*100, D: (cD/gY)*100,
    AI: (cAI/gY)*100, H: (cH/gY)*100, TFP: (cTFP/gY)*100
  };
  return { gY, cK, cL, cD, cAI, cH, cTFP, shares };
}

function forecastGDPwithFixedA(A_avg, K, L, D, AI, H, a, b, g, d, t) {
  return K.map((k, i) => A_avg * Math.pow(k, a) * Math.pow(L[i], b) *
    Math.pow(D[i], g) * Math.pow(AI[i], d) * Math.pow(H[i], t));
}

function forecastGDP2030(base, sc, a, b, g, d, t) {
  const K2030 = base.K * Math.pow(1 + sc.K_growth/100, 5);
  const L2030 = base.L * Math.pow(1 + sc.L_growth/100, 5);
  const D2030 = sc.D_target;
  const AI2030 = sc.AI_target;
  const H2030 = sc.H_target;
  const TFP2030 = base.TFP * Math.pow(1 + sc.TFP_growth/100, 5);
  const prod = Math.pow(K2030, a) * Math.pow(L2030, b) * Math.pow(D2030, g) *
               Math.pow(AI2030, d) * Math.pow(H2030, t);
  return { GDP2030: TFP2030 * prod, K2030, L2030, D2030, AI2030, H2030, TFP2030 };
}

// SLIDER COMPONENT
const SliderControl = ({ label, value, min, max, step, onChange, color, unit = "" }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value.toFixed(2)} {unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           style={{ width: "100%", background: "#1e293b", accentColor: color }} />
  </div>
);

// TOOLTIP, CARD, KPI
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#e2e8f0" }}>
        <p style={{ fontWeight: 700, marginBottom: 6, color: "#94a3b8" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #1e3a5f", borderRadius: 12, padding: "20px 24px", backdropFilter: "blur(6px)", ...style }}>{children}</div>
);

const KPI = ({ label, value, unit, sub, color = "#38bdf8" }) => (
  <div style={{ background: "rgba(15,23,42,0.8)", border: `1px solid ${color}33`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 140 }}>
    <p style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>{label}</p>
    <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0 }}>{value}</p>
    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{unit}</p>
    {sub && <p style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{sub}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// 🧠 GEMINI AI PANEL (dùng chung cho tất cả tab, không tạo tab mới)
// ─────────────────────────────────────────────────────────────────────────
function GeminiPanel({ data, currentTab }) {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [promptMode, setPromptMode] = useState("auto");

  // Xây dựng context dựa trên tab hiện tại (tfp, forecast, growth, 2030, discuss)
  const buildContext = useCallback(() => {
    const { 
      elasticities, scenario, historicalTFP, avgTFP, mapeDetails, 
      growthAnalysis, forecast2030, base2025, cagr2030, years, Y_actual 
    } = data;
    const { alpha, beta, gamma, delta, theta } = elasticities;

    switch (currentTab) {
      case "tfp":
        return `Phân tích TFP (năng suất nhân tố tổng hợp) giai đoạn 2020-2025:
- Hệ số co giãn: α(vốn)=${alpha}, β(lao động)=${beta}, γ(số hóa)=${gamma}, δ(AI)=${delta}, θ(nhân lực số)=${theta}
- TFP từng năm: ${years.map((y,i)=>`${y}: ${historicalTFP[i].toFixed(2)}`).join(', ')}
- TFP trung bình: ${avgTFP.toFixed(2)}
- Tăng trưởng TFP bình quân: ${((Math.pow(historicalTFP[5]/historicalTFP[0], 1/5)-1)*100).toFixed(2)}%/năm
- Nhận xét: TFP có xu hướng tăng dần, cho thấy chất lượng tăng trưởng được cải thiện.`;
      case "forecast":
        return `Dự báo GDP với hệ số A cố định (Ā = ${avgTFP.toFixed(2)}):
- MAPE = ${mapeDetails.MAPE.toFixed(2)}%
- GDP thực tế 2025: ${Y_actual[5].toFixed(0)} nghìn tỷ
- GDP dự báo 2025: ${mapeDetails.details.find(d=>d.year===2025).pred.toFixed(0)} nghìn tỷ
- Sai số dự báo qua các năm: ${mapeDetails.details.map(d=>`${d.year}: ${d.error.toFixed(2)}%`).join(', ')}`;
      case "growth":
        return `Phân rã tăng trưởng GDP bình quân 2020-2025:
- Tổng tăng trưởng: ${growthAnalysis.gY.toFixed(2)}%/năm
- Đóng góp của vốn (K): ${growthAnalysis.cK.toFixed(2)}%/năm (${growthAnalysis.shares.K.toFixed(1)}%)
- Đóng góp của lao động (L): ${growthAnalysis.cL.toFixed(2)}%/năm (${growthAnalysis.shares.L.toFixed(1)}%)
- Đóng góp của số hóa (D): ${growthAnalysis.cD.toFixed(2)}%/năm (${growthAnalysis.shares.D.toFixed(1)}%)
- Đóng góp của AI: ${growthAnalysis.cAI.toFixed(2)}%/năm (${growthAnalysis.shares.AI.toFixed(1)}%)
- Đóng góp của nhân lực số (H): ${growthAnalysis.cH.toFixed(2)}%/năm (${growthAnalysis.shares.H.toFixed(1)}%)
- Đóng góp của TFP: ${growthAnalysis.cTFP.toFixed(2)}%/năm (${growthAnalysis.shares.TFP.toFixed(1)}%)`;
      case "2030":
        return `Kịch bản dự báo GDP 2030:
- Tăng vốn (K): ${scenario.K_growth}%/năm → K2030 = ${forecast2030.K2030.toFixed(0)} nghìn tỷ
- Tăng lao động (L): ${scenario.L_growth}%/năm → L2030 = ${forecast2030.L2030.toFixed(1)} triệu người
- Số hóa D: ${scenario.D_target}% GDP
- AI: ${scenario.AI_target} nghìn DN
- Nhân lực số H: ${scenario.H_target}%
- Tăng TFP: ${scenario.TFP_growth}%/năm → TFP2030 = ${forecast2030.TFP2030.toFixed(2)}
- GDP2030 dự báo: ${forecast2030.GDP2030.toFixed(0)} nghìn tỷ (CAGR 2025-2030: ${cagr2030.toFixed(2)}%/năm)`;
      case "discuss":
        return `Các câu hỏi thảo luận chính sách dựa trên mô hình:
1. TFP có xu hướng tăng (${((Math.pow(historicalTFP[5]/historicalTFP[0], 1/5)-1)*100).toFixed(2)}%/năm) → chất lượng tăng trưởng được cải thiện.
2. Yếu tố D (số hóa) đóng góp nhiều nhất (${growthAnalysis.cD.toFixed(2)}%/năm) nhờ tăng nhanh từ 12% lên 19,5% GDP.
3. Mục tiêu 30% kinh tế số/GDP 2030: cần đầu tư hạ tầng, nhân lực, thể chế (Nghị quyết 57).`;
      default:
        return `Tổng quan mô hình Cobb-Douglas mở rộng:
Y = A·K^${alpha}·L^${beta}·D^${gamma}·AI^${delta}·H^${theta}
TFP trung bình = ${avgTFP.toFixed(2)}, MAPE = ${mapeDetails.MAPE.toFixed(2)}%
GDP 2030 dự báo = ${forecast2030.GDP2030.toFixed(0)} nghìn tỷ.`;
    }
  }, [data, currentTab]);

  const PROMPT_MODES = [
    {id:"auto",    label:"Tự động (theo tab)",   icon:"🔍"},
    {id:"policy",  label:"Khuyến nghị chính sách",icon:"📋"},
    {id:"compare", label:"So sánh đóng góp các yếu tố", icon:"⚖️"},
    {id:"risk",    label:"Phân tích rủi ro kịch bản", icon:"⚠️"},
    {id:"vss",     label:"Giải thích ý nghĩa TFP", icon:"💡"},
  ];

  const PROMPTS = {
    auto: buildContext,
    policy: () => `Dựa trên kết quả phân tích tăng trưởng và dự báo GDP 2030 sau, hãy đưa ra khuyến nghị chính sách cho Việt Nam về ưu tiên đầu tư vào số hóa (D), AI, và nhân lực số (H):\n\n${buildContext()}`,
    compare: () => `So sánh đóng góp của các yếu tố mới (D, AI, H) với vốn và lao động truyền thống trong mô hình Cobb-Douglas. Yếu tố nào quan trọng nhất? Giải thích nguyên nhân:\n\n${buildContext()}`,
    risk: () => `Phân tích độ nhạy của GDP 2030 với các giả định về tăng trưởng TFP và mục tiêu D, AI, H. Rủi ro lớn nhất đối với mục tiêu tăng trưởng là gì?\n\n${buildContext()}`,
    vss: () => `Giải thích ý nghĩa của TFP trong bối cảnh Việt Nam. Tại sao TFP tăng lại quan trọng hơn tăng vốn? Liên hệ với Nghị quyết 57 và chiến lược phát triển kinh tế số:\n\n${buildContext()}`,
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
              text: `Bạn là chuyên gia kinh tế vĩ mô Việt Nam, chuyên về mô hình tăng trưởng và chuyển đổi số. Hãy phân tích kết quả bài toán hàm sản xuất Cobb-Douglas mở rộng bằng tiếng Việt, đưa ra nhận xét sâu sắc, ý nghĩa chính sách và khuyến nghị cụ thể:\n\n${prompt}`
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
        <span style={{ fontSize: 11, color: "#94a3b8" }}>— Phân tích mô hình tăng trưởng</span>
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

// ─────────────────────────────────────────────────────────────────────────
// COMPONENT CHÍNH
// ─────────────────────────────────────────────────────────────────────────
export default function App() {
  const [elasticities, setElasticities] = useState({
    alpha: 0.33, beta: 0.42, gamma: 0.10, delta: 0.08, theta: 0.07
  });
  const [scenario, setScenario] = useState({
    K_growth: 6.0, L_growth: 6.0, D_target: 30.0, AI_target: 100.0, H_target: 35.0, TFP_growth: 1.2
  });
  const [tab, setTab] = useState("tfp");

  const { alpha, beta, gamma, delta, theta } = elasticities;

  const historicalTFP = useMemo(() => years.map((_, i) =>
    computeTFP(Y_actual[i], K_input[i], L_input[i], D_input[i], AI_input[i], H_input[i],
               alpha, beta, gamma, delta, theta)), [alpha, beta, gamma, delta, theta]);

  const avgTFP = useMemo(() => historicalTFP.reduce((a,b) => a+b,0) / historicalTFP.length, [historicalTFP]);

  const forecastGDP = useMemo(() => forecastGDPwithFixedA(avgTFP, K_input, L_input, D_input, AI_input, H_input,
                                                          alpha, beta, gamma, delta, theta),
                             [avgTFP, alpha, beta, gamma, delta, theta]);

  const mapeDetails = useMemo(() => {
    let sumAPE = 0;
    const details = years.map((year, i) => {
      const actual = Y_actual[i], pred = forecastGDP[i], ape = Math.abs(actual - pred) / actual * 100;
      sumAPE += ape;
      return { year, actual, pred, error: ape, diff: actual - pred };
    });
    return { MAPE: sumAPE / years.length, details };
  }, [forecastGDP]);

  const growthAnalysis = useMemo(() => growthAccounting(K_input, L_input, D_input, AI_input, H_input, Y_actual,
                                                        alpha, beta, gamma, delta, theta),
                                 [alpha, beta, gamma, delta, theta]);

  const growthDataForChart = useMemo(() => {
    const { cK, cL, cD, cAI, cH, cTFP, shares } = growthAnalysis;
    return [
      { name: "Vốn (K)", value: cK, share: shares.K, color: "#3b82f6" },
      { name: "Lao động (L)", value: cL, share: shares.L, color: "#ef4444" },
      { name: "Số hóa (D)", value: cD, share: shares.D, color: "#10b981" },
      { name: "AI", value: cAI, share: shares.AI, color: "#f59e0b" },
      { name: "Nhân lực số (H)", value: cH, share: shares.H, color: "#8b5cf6" },
      { name: "TFP", value: cTFP, share: shares.TFP, color: "#06b6d4" },
    ];
  }, [growthAnalysis]);

  const base2025 = useMemo(() => ({
    K: K_input[5], L: L_input[5], D: D_input[5], AI: AI_input[5], H: H_input[5], TFP: historicalTFP[5]
  }), [historicalTFP]);

  const forecast2030 = useMemo(() => forecastGDP2030(base2025, scenario, alpha, beta, gamma, delta, theta),
                               [base2025, scenario, alpha, beta, gamma, delta, theta]);

  const cagr2030 = useMemo(() => (Math.pow(forecast2030.GDP2030 / Y_actual[5], 1/5) - 1) * 100, [forecast2030]);

  const tfpChartData = useMemo(() => years.map((year, i) => ({
    year, tfp: historicalTFP[i],
    growth: i > 0 ? ((historicalTFP[i] / historicalTFP[i-1] - 1) * 100) : null,
  })), [historicalTFP]);

  const gdpChartData = mapeDetails.details;
  const timelineData = useMemo(() => [
    ...years.map((yr, i) => ({ year: yr, gdp: Y_actual[i], type: "actual" })),
    { year: 2030, gdp: forecast2030.GDP2030, type: "forecast" }
  ], [forecast2030]);

  const updateElasticity = (key, val) => setElasticities(prev => ({ ...prev, [key]: val }));
  const updateScenario = (key, val) => setScenario(prev => ({ ...prev, [key]: val }));

  const tabStyle = (id) => ({
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
    background: tab === id ? "#0ea5e9" : "rgba(30,41,59,0.6)", color: tab === id ? "#fff" : "#94a3b8",
    boxShadow: tab === id ? "0 0 12px #0ea5e940" : "none",
  });

  // Gom tất cả dữ liệu để truyền vào GeminiPanel
  const geminiData = {
    elasticities, scenario, historicalTFP, avgTFP, mapeDetails,
    growthAnalysis, forecast2030, base2025, cagr2030, years, Y_actual
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#020617 0%,#0f172a 50%,#0c1a2e 100%)", fontFamily: "'Segoe UI', sans-serif", color: "#e2e8f0", padding: "24px 20px" }}>
      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-block", background: "linear-gradient(90deg,#0ea5e9,#8b5cf6)", borderRadius: 6, padding: "4px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 10, color: "#fff" }}>AIDEOM-VN • PHẦN B – CẤP ĐỘ DỄ</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px", background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Bài 1 – Hàm Sản Xuất Cobb-Douglas Mở Rộng (Tương tác)</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Điều chỉnh hệ số co giãn và kịch bản 2030 – Mọi biểu đồ cập nhật tự động</p>
      </div>

      {/* SLIDER PANELS */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
        <Card style={{ flex: 2, minWidth: 260 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#38bdf8" }}>📊 Hệ số co giãn (α, β, γ, δ, θ)</h3>
          <SliderControl label="α (Vốn)" value={alpha} min={0.1} max={0.6} step={0.01} onChange={(v) => updateElasticity("alpha", v)} color="#3b82f6" />
          <SliderControl label="β (Lao động)" value={beta} min={0.1} max={0.6} step={0.01} onChange={(v) => updateElasticity("beta", v)} color="#ef4444" />
          <SliderControl label="γ (Số hóa D)" value={gamma} min={0} max={0.3} step={0.01} onChange={(v) => updateElasticity("gamma", v)} color="#10b981" />
          <SliderControl label="δ (AI)" value={delta} min={0} max={0.3} step={0.01} onChange={(v) => updateElasticity("delta", v)} color="#f59e0b" />
          <SliderControl label="θ (Nhân lực số H)" value={theta} min={0} max={0.3} step={0.01} onChange={(v) => updateElasticity("theta", v)} color="#8b5cf6" />
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>Tổng hệ số: {(alpha+beta+gamma+delta+theta).toFixed(3)} (≈1)</div>
        </Card>
        <Card style={{ flex: 2, minWidth: 260 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#a78bfa" }}>🎯 Kịch bản 2030 (tăng trưởng & mục tiêu)</h3>
          <SliderControl label="Tăng vốn (K) 2025→2030" value={scenario.K_growth} min={0} max={12} step={0.5} onChange={(v) => updateScenario("K_growth", v)} color="#3b82f6" unit="%/năm" />
          <SliderControl label="Tăng lao động (L) 2025→2030" value={scenario.L_growth} min={0} max={8} step={0.5} onChange={(v) => updateScenario("L_growth", v)} color="#10b981" unit="%/năm" />
          <SliderControl label="Chỉ số số hóa D (2030)" value={scenario.D_target} min={20} max={45} step={1} onChange={(v) => updateScenario("D_target", v)} color="#f59e0b" unit="% GDP" />
          <SliderControl label="Chỉ số AI (2030)" value={scenario.AI_target} min={80} max={150} step={1} onChange={(v) => updateScenario("AI_target", v)} color="#f59e0b" unit="nghìn DN" />
          <SliderControl label="Chỉ số nhân lực số H (2030)" value={scenario.H_target} min={25} max={50} step={0.5} onChange={(v) => updateScenario("H_target", v)} color="#8b5cf6" unit="%" />
          <SliderControl label="Tăng TFP 2025→2030" value={scenario.TFP_growth} min={0} max={3} step={0.1} onChange={(v) => updateScenario("TFP_growth", v)} color="#06b6d4" unit="%/năm" />
        </Card>
      </div>

      {/* KPI ROW */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <KPI label="TFP trung bình" value={avgTFP.toFixed(2)} unit="A̅ (2020–2025)" color="#38bdf8" />
        <KPI label="TFP 2025" value={historicalTFP[5].toFixed(2)} unit="cuối giai đoạn" color="#22d3ee" sub="Tùy theo hệ số co giãn" />
        <KPI label="MAPE dự báo" value={`${mapeDetails.MAPE.toFixed(2)}%`} unit="với A̅ cố định" color="#f59e0b" sub="Sai số trung bình tuyệt đối" />
        <KPI label="GDP dự báo 2030" value={forecast2030.GDP2030.toFixed(0)} unit="nghìn tỷ VND" color="#a78bfa" sub={`CAGR ${cagr2030.toFixed(2)}%/năm`} />
        <KPI label="GDP 2030 (USD)" value={`${(forecast2030.GDP2030 / 24.25).toFixed(0)} tỷ`} unit="USD (~24,250 VND)" color="#34d399" />
      </div>

      {/* TABS BUTTONS - giữ nguyên 5 tab, không thêm tab AI */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "tfp", label: "① TFP (A_t)" }, { id: "forecast", label: "② Dự báo GDP" },
          { id: "growth", label: "③ Phân rã tăng trưởng" }, { id: "2030", label: "④ Kịch bản 2030" },
          { id: "discuss", label: "⑤ Thảo luận chính sách" }
        ].map(t => <button key={t.id} style={tabStyle(t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {/* TAB 1 - TFP (có thêm GeminiPanel ở cuối) */}
      {tab === "tfp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <h3 style={{ margin: "0 0 4px", color: "#38bdf8" }}>Năng suất nhân tố tổng hợp A<sub>t</sub> theo năm</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>A<sub>t</sub> = Y<sub>t</sub> / (K<sup>α</sup>·L<sup>β</sup>·D<sup>γ</sup>·AI<sup>δ</sup>·H<sup>θ</sup>) với hệ số hiện tại.</p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={tfpChartData}>
                <defs><linearGradient id="tfpGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} /><stop offset="95%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="year" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => v.toFixed(1)} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 12]} stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" dataKey="tfp" name="TFP (A_t)" fill="url(#tfpGrad)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 5, fill: "#38bdf8" }} />
                <Bar yAxisId="right" dataKey="growth" name="Tăng trưởng TFP (%/năm)" fill="#818cf8" opacity={0.7} radius={[3,3,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 16px", color: "#38bdf8" }}>Bảng chi tiết TFP từng năm</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr><th>Năm</th><th>Y thực tế (ngh.tỷ)</th><th>K^α·L^β·D^γ·AI^δ·H^θ</th><th>TFP (A_t)</th><th>Tăng trưởng TFP</th></tr></thead>
                <tbody>
                  {years.map((yr, i) => {
                    const prod = Math.pow(K_input[i], alpha) * Math.pow(L_input[i], beta) *
                                 Math.pow(D_input[i], gamma) * Math.pow(AI_input[i], delta) *
                                 Math.pow(H_input[i], theta);
                    return (
                      <tr key={yr}>
                        <td style={{ padding: "8px", textAlign: "right", color: "#38bdf8" }}>{yr}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{Y_actual[i].toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{prod.toFixed(4)}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#22d3ee" }}>{historicalTFP[i].toFixed(4)}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{i>0 ? `+${((historicalTFP[i]/historicalTFP[i-1]-1)*100).toFixed(2)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          {/* Thêm AI Gemini vào cuối tab TFP */}
          <GeminiPanel data={geminiData} currentTab="tfp" />
        </div>
      )}

      {/* TAB 2 - DỰ BÁO GDP (có thêm GeminiPanel) */}
      {tab === "forecast" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <h3 style={{ margin: "0 0 4px", color: "#f59e0b" }}>GDP thực tế vs. dự báo (A̅ cố định)</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>Ā = {avgTFP.toFixed(4)} | MAPE = {mapeDetails.MAPE.toFixed(2)}%</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gdpChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="year" stroke="#475569" />
                <YAxis stroke="#475569" tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line dataKey="actual" name="GDP Thực tế" stroke="#34d399" strokeWidth={2.5} dot={{ r: 5 }} />
                <Line dataKey="pred" name="GDP Dự báo (Ā)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 16px", color: "#f59e0b" }}>Bảng so sánh & sai số APE</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr><th>Năm</th><th>Y thực tế</th><th>Ŷ dự báo</th><th>Chênh lệch</th><th>APE (%)</th></tr></thead>
                <tbody>
                  {gdpChartData.map((row, i) => (
                    <tr key={row.year}>
                      <td style={{ padding: "8px", textAlign: "right" }}>{row.year}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{row.actual.toLocaleString("vi-VN", {maximumFractionDigits:1})}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{row.pred.toLocaleString("vi-VN", {maximumFractionDigits:1})}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: row.diff>=0 ? "#34d399" : "#f87171" }}>{row.diff>=0 ? "+" : ""}{row.diff.toFixed(1)}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{row.error.toFixed(2)}%</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #f59e0b" }}><td colSpan={4} style={{ textAlign: "right" }}>MAPE =</td><td style={{ fontWeight: 800 }}>{mapeDetails.MAPE.toFixed(2)}%</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="forecast" />
        </div>
      )}

      {/* TAB 3 - PHÂN RÃ TĂNG TRƯỞNG (có thêm GeminiPanel) */}
      {tab === "growth" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <h3 style={{ margin: "0 0 4px", color: "#10b981" }}>Phân rã tăng trưởng GDP bình quân 2020–2025</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>Tổng tăng trưởng: <strong>{growthAnalysis.gY.toFixed(2)}%/năm</strong></p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 300 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={growthDataForChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `${v.toFixed(1)}%`} />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x={0} stroke="#475569" />
                    <Bar dataKey="value" radius={[0,4,4,0]}>{growthDataForChart.map((e,i)=> <Cell key={i} fill={e.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1 }}>
                {growthDataForChart.map(d => (
                  <div key={d.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>{d.name}</span><span style={{ color: d.color }}>{d.share.toFixed(1)}%</span></div>
                    <div style={{ height: 6, background: "#1e3a5f", borderRadius: 3 }}><div style={{ width: `${Math.abs(d.share)}%`, height: "100%", background: d.color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {growthDataForChart.map(d => (
              <div key={d.name} style={{ flex: 1, minWidth: 130, background: "rgba(15,23,42,0.8)", borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#64748b" }}>{d.name}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: d.color }}>{d.value>=0 ? "+" : ""}{d.value.toFixed(3)}%</p>
                <p style={{ fontSize: 11 }}>/ năm</p>
                <p style={{ fontSize: 13, color: d.color }}>{d.share.toFixed(1)}% tỷ trọng</p>
              </div>
            ))}
          </div>
          <GeminiPanel data={geminiData} currentTab="growth" />
        </div>
      )}

      {/* TAB 4 - KỊCH BẢN 2030 (có thêm GeminiPanel) */}
      {tab === "2030" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <h3 style={{ margin: "0 0 4px", color: "#a78bfa" }}>Dự báo GDP Việt Nam năm 2030</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <KPI label="GDP 2030" value={forecast2030.GDP2030.toFixed(0)} unit="nghìn tỷ VND" color="#a78bfa" />
              <KPI label="GDP 2030 (USD)" value={`${(forecast2030.GDP2030 / 24.25).toFixed(0)} tỷ`} unit="USD (~24,250 VND)" color="#818cf8" />
              <KPI label="CAGR 2025→2030" value={`${cagr2030.toFixed(2)}%`} unit="/ năm" color="#34d399" />
              <KPI label="Tăng so với 2025" value={`+${((forecast2030.GDP2030 / Y_actual[5] - 1) * 100).toFixed(0)}%`} unit="so với 12,848 ngh.tỷ" color="#f59e0b" />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={timelineData}>
                <defs><linearGradient id="gdpGrad2030" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={2025} stroke="#64748b" strokeDasharray="4 4" label={{ value: "Dự báo →", fill: "#64748b", fontSize: 11 }} />
                <Area type="monotone" dataKey="gdp" fill="url(#gdpGrad2030)" stroke="#a78bfa" strokeWidth={2.5}
                  dot={({ cx, cy, payload }) => <circle key={payload.year} cx={cx} cy={cy} r={payload.type === "forecast" ? 8 : 5} fill={payload.type === "forecast" ? "#f59e0b" : "#a78bfa"} stroke={payload.type === "forecast" ? "#fbbf24" : "#7c3aed"} strokeWidth={2} />} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 16px", color: "#a78bfa" }}>Chi tiết đầu vào 2030 (kèm đơn vị)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
              {[
                { label: "TFP (A₂₀₃₀)", base: base2025.TFP.toFixed(2), unit: "", forecast: forecast2030.TFP2030.toFixed(2), change: `+${scenario.TFP_growth}%/năm×5`, color: "#38bdf8" },
                { label: "Vốn K", base: K_input[5].toFixed(0), unit: "nghìn tỷ VND", forecast: forecast2030.K2030.toFixed(0), change: `+${scenario.K_growth}%/năm`, color: "#3b82f6" },
                { label: "Lao động L", base: L_input[5].toFixed(1), unit: "triệu người", forecast: forecast2030.L2030.toFixed(1), change: `+${scenario.L_growth}%/năm`, color: "#10b981" },
                { label: "Số hóa D", base: D_input[5].toFixed(1), unit: "% GDP", forecast: scenario.D_target.toFixed(1), change: "KT số", color: "#f59e0b" },
                { label: "AI Capacity", base: AI_input[5].toFixed(1), unit: "nghìn DN", forecast: scenario.AI_target.toFixed(1), change: "Tăng mạnh", color: "#f59e0b" },
                { label: "Nhân lực số H", base: H_input[5].toFixed(1), unit: "% LĐ qua đào tạo", forecast: scenario.H_target.toFixed(1), change: "+ điểm %", color: "#8b5cf6" },
              ].map((item, i) => (
                <div key={i} style={{ background: "rgba(15,23,42,0.8)", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "12px" }}>
                  <p style={{ fontSize: 11, color: "#64748b" }}>{item.label}</p>
                  <p style={{ fontSize: 11, margin: 0 }}>Cơ sở 2025: {item.base} {item.unit}</p>
                  <p style={{ fontSize: 14, color: item.color, fontWeight: 700 }}>→ 2030: {item.forecast} {item.unit}</p>
                  <p style={{ fontSize: 11, color: "#64748b" }}>{item.change}</p>
                </div>
              ))}
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="2030" />
        </div>
      )}

      {/* TAB 5 - THẢO LUẬN CHÍNH SÁCH (có thêm GeminiPanel) */}
      {tab === "discuss" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <h3 style={{ margin: "0 0 12px", color: "#38bdf8", fontSize: 16 }}>a) TFP có xu hướng tăng hay giảm? Nói lên gì về chất lượng tăng trưởng?</h3>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>
              <p><strong>Trả lời:</strong> TFP tăng liên tục từ <strong style={{color:"#38bdf8"}}>{historicalTFP[0].toFixed(2)}</strong> (2020) lên <strong style={{color:"#38bdf8"}}>{historicalTFP[5].toFixed(2)}</strong> (2025), tốc độ bình quân <strong style={{color:"#22d3ee"}}>{((Math.pow(historicalTFP[5]/historicalTFP[0], 1/5)-1)*100).toFixed(2)}%/năm</strong>. Điều này cho thấy chất lượng tăng trưởng đang được cải thiện, nền kinh tế chuyển dịch từ tăng trưởng dựa vào vốn và lao động sang tăng trưởng dựa vào hiệu quả sử dụng nguồn lực và đổi mới công nghệ.</p>
            </div>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 12px", color: "#10b981", fontSize: 16 }}>b) Trong các yếu tố mới D, AI, H, yếu tố nào đóng góp nhiều nhất cho tăng trưởng giai đoạn vừa qua? Vì sao?</h3>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>
              <p><strong>Trả lời:</strong> Số hóa D đóng góp nhiều nhất (<strong>{growthAnalysis.cD.toFixed(2)}%/năm</strong>, chiếm {growthAnalysis.shares.D.toFixed(1)}% tổng tăng trưởng), tiếp theo là AI (<strong>{growthAnalysis.cAI.toFixed(2)}%/năm</strong>, {growthAnalysis.shares.AI.toFixed(1)}%) và nhân lực số H (<strong>{growthAnalysis.cH.toFixed(2)}%/năm</strong>, {growthAnalysis.shares.H.toFixed(1)}%). Nguyên nhân: D tăng nhanh (từ 12% lên 19,5% GDP), hệ số co giãn γ=0,10 cao, và các chính sách thúc đẩy kinh tế số.</p>
            </div>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 12px", color: "#f59e0b", fontSize: 16 }}>c) Mục tiêu Việt Nam đạt 30% kinh tế số/GDP vào 2030 có khả thi không nếu dựa trên mô hình này? Cần ràng buộc gì?</h3>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>
              <p><strong>Trả lời:</strong> Với kịch bản D={scenario.D_target.toFixed(1)}% GDP, GDP 2030 dự báo {forecast2030.GDP2030.toFixed(0)} nghìn tỷ VND. Mức tăng D cần {(scenario.D_target - D_input[5]).toFixed(1)} điểm % trong 5 năm (~{((scenario.D_target - D_input[5])/5).toFixed(1)} điểm %/năm), cao hơn giai đoạn trước. Khả thi nếu có đầu tư hạ tầng số lớn, đào tạo nhân lực chất lượng cao, thể chế thông thoáng (sandbox, Nghị quyết 57).</p>
            </div>
          </Card>
          <Card style={{ background: "rgba(6,182,212,0.06)", border: "1px solid #06b6d440" }}>
            <h3 style={{ margin: "0 0 12px", color: "#06b6d4" }}>📐 Tóm tắt mô hình và tham số hiện tại</h3>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 2, fontFamily: "monospace" }}>
              <p>Y_t = A_t × K_t^{alpha} × L_t^{beta} × D_t^{gamma} × AI_t^{delta} × H_t^{theta}</p>
              <p>alpha = {alpha}, beta = {beta}, gamma = {gamma}, delta = {delta}, theta = {theta}</p>
              <p>📊 TFP trung bình = {avgTFP.toFixed(4)} | MAPE = {mapeDetails.MAPE.toFixed(2)}%</p>
              <p>🎯 GDP₂₀₃₀ = {forecast2030.GDP2030.toFixed(0)} nghìn tỷ VND (≈ {(forecast2030.GDP2030/24.25).toFixed(0)} tỷ USD)</p>
            </div>
          </Card>
          <GeminiPanel data={geminiData} currentTab="discuss" />
        </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#334155" }}>
        Bài 1 – AIDEOM-VN | Dữ liệu: GSO/NSO 2026, MoST, MIC | Sliders điều khiển co giãn & kịch bản | Tích hợp Gemini AI trong từng tab
      </div>
    </div>
  );
}