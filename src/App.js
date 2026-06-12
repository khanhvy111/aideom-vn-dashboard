import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Bai1 from "./pages/Bai1";
import Bai2 from "./pages/Bai2";
import Bai3 from "./pages/Bai3";
import Bai4 from "./pages/Bai4";
import Bai5 from "./pages/Bai5";
import Bai6 from "./pages/Bai6";
import Bai7 from "./pages/Bai7";
import Bai8 from "./pages/Bai8";
import Bai9 from "./pages/Bai9";
import Bai10 from "./pages/Bai10";
import Bai11 from "./pages/Bai11";
import Bai12 from "./pages/Bai12";

const menuItems = [
  { path: "/bai1",  emoji: "🏆", label: "Bài 1 — Cobb-Douglas + AI" },
  { path: "/bai2",  emoji: "💰", label: "Bài 2 — LP ngân sách số" },
  { path: "/bai3",  emoji: "📋", label: "Bài 3 — Priority 10 ngành" },
  { path: "/bai4",  emoji: "🗺️", label: "Bài 4 — LP ngành-vùng" },
  { path: "/bai5",  emoji: "🏗️", label: "Bài 5 — MIP 15 dự án" },
  { path: "/bai6",  emoji: "🏆", label: "Bài 6 — TOPSIS 6 vùng" },
  { path: "/bai7",  emoji: "🌐", label: "Bài 7 — NSGA-II Pareto" },
  { path: "/bai8",  emoji: "⏳", label: "Bài 8 — Động 2026-2035" },
  { path: "/bai9",  emoji: "👥", label: "Bài 9 — Lao động & AI" },
  { path: "/bai10", emoji: "🎲", label: "Bài 10 — Stochastic SP" },
  { path: "/bai11", emoji: "🤖", label: "Bài 11 — Q-learning RL" },
  { path: "/bai12", emoji: "🇻🇳", label: "Bài 12 — AIDEOM tích hợp" },
];

function Sidebar() {
  return (
    <div style={{
      width: 230, minHeight: "100vh", background: "#1a1f2e",
      padding: "16px 0", position: "fixed", left: 0, top: 0,
      overflowY: "auto", borderRight: "1px solid #2d3748"
    }}>
      <div style={{
        color: "#fff", fontWeight: 800, fontSize: 14,
        padding: "0 16px 12px", borderBottom: "1px solid #2d3748", marginBottom: 8
      }}>
        🇻🇳 AIDEOM-VN
      </div>
      <NavLink to="/" style={({ isActive }) => ({
        display: "block", padding: "8px 16px", fontSize: 13,
        color: isActive ? "#f97316" : "#e2e8f0",
        textDecoration: "none", fontWeight: 600
      })}>
        🏠 Trang chủ
      </NavLink>
      {menuItems.map((item) => (
        <NavLink key={item.path} to={item.path}
          style={({ isActive }) => ({
            display: "block", padding: "7px 16px", fontSize: 12.5,
            color: isActive ? "#f97316" : "#94a3b8",
            textDecoration: "none",
            background: isActive ? "rgba(249,115,22,0.1)" : "transparent",
            borderLeft: isActive ? "3px solid #f97316" : "3px solid transparent",
          })}>
          {item.emoji} {item.label}
        </NavLink>
      ))}
    </div>
  );
}

function HomePage() {
  return (
    <div style={{ color: "#fff" }}>
      <h1 style={{ fontSize: 36, fontWeight: 800 }}>🇻🇳 AIDEOM-VN</h1>
      <p style={{ color: "#94a3b8", fontSize: 16, fontStyle: "italic", marginTop: 8 }}>
        AI-Driven Decision Optimization Model for Vietnam
      </p>
      <p style={{ color: "#64748b", marginTop: 8 }}>
        Web app giải 12 bài toán mô hình ra quyết định phát triển kinh tế Việt Nam
        trong kỉ nguyên AI — dữ liệu thực 2020-2025.
      </p>
      <div style={{ display: "flex", gap: 20, marginTop: 32, flexWrap: "wrap" }}>
        {[
          { label: "GDP 2025",           value: "514,0 tỷ USD", change: "↑ +8,02%" },
          { label: "Kinh tế số / GDP",   value: "≈19,5%",       change: "↑ +1,2 đpt" },
          { label: "FDI giải ngân 2025", value: "27,6 tỷ USD",  change: "↑ +8,9%" },
          { label: "GDP/người 2025",     value: "5.026 USD",    change: "↑ +6,9%" },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: "#1e2538", borderRadius: 12,
            padding: "20px 24px", minWidth: 150, flex: 1
          }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>{stat.label}</div>
            <div style={{ color: "#f97316", fontSize: 22, fontWeight: 800 }}>{stat.value}</div>
            <div style={{ color: "#22c55e", fontSize: 12, marginTop: 4 }}>{stat.change}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", background: "#0f1117", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ marginLeft: 230, flex: 1, padding: "32px 40px" }}>
          <Routes>
            <Route path="/"      element={<HomePage />} />
            <Route path="/bai1"  element={<Bai1 />} />
            <Route path="/bai2"  element={<Bai2 />} />
            <Route path="/bai3"  element={<Bai3 />} />
            <Route path="/bai4"  element={<Bai4 />} />
            <Route path="/bai5"  element={<Bai5 />} />
            <Route path="/bai6"  element={<Bai6 />} />
            <Route path="/bai7"  element={<Bai7 />} />
            <Route path="/bai8"  element={<Bai8 />} />
            <Route path="/bai9"  element={<Bai9 />} />
            <Route path="/bai10" element={<Bai10 />} />
            <Route path="/bai11" element={<Bai11 />} />
            <Route path="/bai12" element={<Bai12 />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}