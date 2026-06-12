import { useState } from "react";

const GEMINI_API_KEY = "PASTE_API_KEY_CUA_BAN_VAO_DAY";

export default function GeminiAnalyst({ context }) {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Bạn là chuyên gia kinh tế Việt Nam. Hãy phân tích kết quả sau bằng tiếng Việt, nêu nhận xét, ý nghĩa và khuyến nghị chính sách:\n\n${context}`
              }]
            }]
          }),
        }
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setResult(text || "Không có kết quả.");
    } catch (err) {
      setResult("Lỗi kết nối Gemini: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      marginTop: 32, background: "#1e2538", borderRadius: 12,
      padding: 24, border: "1px solid #3b4a6b"
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>🤖</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
          Tác nhân Gemini AI — Phân tích kết quả
        </span>
        <span style={{
          background: "#4285f4", color: "#fff", fontSize: 10,
          padding: "2px 8px", borderRadius: 99, marginLeft: 4
        }}>
          Google Gemini
        </span>
      </div>

      {/* Nút bấm */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          background: loading ? "#374151" : "linear-gradient(135deg, #4285f4, #0f9d58)",
          color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 24px", fontSize: 14, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: 16
        }}
      >
        {loading ? "⏳ Đang phân tích..." : "✨ Phân tích với Gemini AI"}
      </button>

      {/* Kết quả */}
      {result && (
        <div style={{
          background: "#0f1117", borderRadius: 8, padding: 16,
          color: "#e2e8f0", fontSize: 14, lineHeight: 1.7,
          whiteSpace: "pre-wrap", border: "1px solid #2d3748"
        }}>
          {result}
        </div>
      )}
    </div>
  );
}