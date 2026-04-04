import { useEffect, useState } from "react";

const API_BASE = "https://gigshield-v1.onrender.com/api";

function ScoreRing({ score, color }) {
  const radius = 72;
  const circ = 2 * Math.PI * radius;
  const fill = (score / 100) * circ;

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
      {/* Track */}
      <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
      {/* Progress */}
      <circle
        cx="90" cy="90" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)", filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
}

function FactorCard({ factor }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}>
      <span style={{ fontSize: 26 }}>{factor.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#8888a8", marginBottom: 3 }}>{factor.label}</div>
        <div style={{ fontSize: 15, color: "#f0f0f8", fontWeight: 600 }}>{factor.value}</div>
        <div style={{ fontSize: 11, color: "#55556a", marginTop: 3 }}>{factor.detail}</div>
      </div>
      <div style={{
        background: factor.points > 0 ? "rgba(242,108,108,0.12)" : "rgba(74,222,128,0.1)",
        border: `1px solid ${factor.points > 0 ? "rgba(242,108,108,0.3)" : "rgba(74,222,128,0.2)"}`,
        color: factor.points > 0 ? "#f26c6c" : "#4ade80",
        borderRadius: 8,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 700,
        minWidth: 44,
        textAlign: "center",
      }}>
        {factor.points > 0 ? `+${factor.points}` : "0"}
      </div>
    </div>
  );
}

export default function RiskScore() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [animScore, setAnimScore] = useState(0);

  const userPhone = localStorage.getItem("userPhone");

  useEffect(() => {
    if (!userPhone) {
      setError("Please log in to see your risk score.");
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/risk-score/${encodeURIComponent(userPhone)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.message || "Failed to load risk score.");
        }
      })
      .catch(() => setError("Could not connect to server."))
      .finally(() => setLoading(false));
  }, []);

  // Animate the score ring
  useEffect(() => {
    if (!data) return;
    let start = 0;
    const end = data.score;
    const step = () => {
      start += 2;
      if (start >= end) { setAnimScore(end); return; }
      setAnimScore(start);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [data]);

  const containerStyle = {
    fontFamily: "'DM Sans', sans-serif",
    background: "#0d0d14",
    minHeight: "100vh",
    color: "#f0f0f8",
    padding: "2.5rem 2rem",
    maxWidth: 720,
    margin: "0 auto",
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(124,110,249,0.3)", borderRadius: "50%", borderTopColor: "#7c6ef9", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#8888a8" }}>Analyzing your risk profile...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#f26c6c" }}>{error}</p>
      </div>
    );
  }

  const { score, riskLevel, riskColor, recommendation, city, riskZone, weather, disaster, factors, currentPlan, coverageStatus, pastDisruptionCount } = data;

  return (
    <div style={containerStyle}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 13, color: "#55556a", marginBottom: 6 }}>Real-time AI analysis</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Your Risk Score</h1>
        <p style={{ fontSize: 14, color: "#8888a8", marginTop: 6 }}>
          Based on live weather, NASA satellite data, and your disruption history in <strong style={{ color: "#f0f0f8" }}>{city}</strong>
        </p>
      </div>

      {/* Score Card */}
      <div style={{
        background: "linear-gradient(145deg, #1a1a2b 0%, #13131f 100%)",
        border: `1px solid ${riskColor}33`,
        borderRadius: 20,
        padding: "36px 28px",
        marginBottom: 24,
        boxShadow: `0 0 60px ${riskColor}18`,
        display: "flex",
        alignItems: "center",
        gap: 36,
        flexWrap: "wrap",
      }}>
        {/* Ring */}
        <div style={{ position: "relative", width: 180, height: 180, flexShrink: 0 }}>
          <ScoreRing score={animScore} color={riskColor} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 42, fontWeight: 800, color: riskColor, lineHeight: 1 }}>{animScore}</span>
            <span style={{ fontSize: 14, color: "#8888a8", marginTop: 4 }}>/ 100</span>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${riskColor}18`, border: `1px solid ${riskColor}44`, borderRadius: 30, padding: "6px 16px", marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor, animation: "pulse 2s infinite" }} />
            <span style={{ fontWeight: 700, color: riskColor, fontSize: 14 }}>{riskLevel} Risk</span>
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }`}</style>

          <div style={{ display: "flex", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Zone</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{riskZone}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Plan</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{currentPlan || "None"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Coverage</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: coverageStatus === "Active" ? "#4ade80" : "#f26c6c" }}>{coverageStatus}</div>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#c0c0d8", lineHeight: 1.6 }}>
            💡 {recommendation}
          </div>
        </div>
      </div>

      {/* Weather Strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        marginBottom: 28,
      }}>
        {[
          { label: "Rainfall", value: `${weather.rain_1h} mm/hr`, icon: "🌧️", sub: weather.rain_1h >= 60 ? "⚠️ Trigger level" : "Below trigger" },
          { label: "Temperature", value: `${weather.temp_celsius}°C`, icon: "🌡️", sub: weather.temp_celsius >= 45 ? "⚠️ Extreme heat" : "Normal range" },
          { label: "Disasters", value: disaster.has_disaster ? `${disaster.events.length} Active` : "None", icon: "🛰️", sub: disaster.has_disaster ? disaster.events[0]?.title : "NASA: All clear" },
        ].map((item) => (
          <div key={item.label} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "16px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 10, color: "#55556a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#8888a8" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Risk Factors Breakdown */}
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#8888a8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Score Breakdown
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {factors.map((f, i) => (
            <FactorCard key={i} factor={f} />
          ))}
        </div>
      </div>

      {/* Data source note */}
      <p style={{ fontSize: 11, color: "#55556a", textAlign: "center", marginTop: 28 }}>
        Data powered by Weatherbit · OpenWeatherMap · NASA EONET · GigShield AI
        {weather.is_simulated && " · (Simulated fallback data used)"}
      </p>
    </div>
  );
}
