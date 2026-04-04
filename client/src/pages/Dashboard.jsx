import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend
);
import "./Dashboard.css";

const WEEKLY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Sub-components ────────────────────────────────────────── */

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${color}`}>{value}</span>
      <span className="stat-sub">{sub}</span>
    </div>
  );
}

function DisruptionBanner({ onDismiss }) {
  return (
    <div className="disruption-banner">
      <svg
        className="disruption-icon"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 3L17.5 16.5H2.5L10 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line
          x1="10" y1="8.5" x2="10" y2="11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="13.5" r="0.85" fill="currentColor" />
      </svg>

      <div className="disruption-content">
        <div className="disruption-title">
          Disruption alert — heavy rain detected
        </div>
        <div className="disruption-body">
          High rainfall in Velachery &amp; Tambaram zones may reduce delivery
          volume today. Your coverage multiplier is active.
          <span className="disruption-tag">+1.3× premium</span>
        </div>
      </div>

      <button
        className="disruption-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss alert"
      >
        ✕
      </button>
    </div>
  );
}

function WeeklyChart({ premiums = [], payouts = [] }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const totalPremium = premiums.reduce((a, b) => a + Number(b), 0);
  const totalPayout = payouts.reduce((a, b) => a + Number(b), 0);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");

    // Purple gradient for premium
    const gradPremium = ctx.createLinearGradient(0, 0, 0, 260);
    gradPremium.addColorStop(0, "rgba(124,110,249,0.35)");
    gradPremium.addColorStop(1, "rgba(124,110,249,0.00)");

    // Teal gradient for payout
    const gradPayout = ctx.createLinearGradient(0, 0, 0, 260);
    gradPayout.addColorStop(0, "rgba(46,196,166,0.35)");
    gradPayout.addColorStop(1, "rgba(46,196,166,0.00)");

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: WEEKLY_LABELS,
        datasets: [
          {
            label: "Premium",
            data: premiums,
            borderColor: "rgba(124,110,249,1)",
            backgroundColor: gradPremium,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: "rgba(124,110,249,1)",
            pointBorderColor: "#1a1a2b",
            pointBorderWidth: 2,
            tension: 0.45,
            fill: true,
          },
          {
            label: "Payout",
            data: payouts,
            borderColor: "rgba(46,196,166,1)",
            backgroundColor: gradPayout,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: "rgba(46,196,166,1)",
            pointBorderColor: "#1a1a2b",
            pointBorderWidth: 2,
            tension: 0.45,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1a1a2b",
            titleColor: "#f0f0f8",
            bodyColor: "#8888a8",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) =>
                `  ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN")}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: "#55556a", font: { size: 11, family: "'DM Sans', sans-serif" } },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.05)" },
            border: { display: false },
            beginAtZero: true,
            ticks: {
              color: "#55556a",
              font: { size: 11, family: "'DM Sans', sans-serif" },
              callback: (v) => "₹" + v,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, []);

  // Update data seamlessly over existing graph
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.data.datasets[0].data = premiums;
      chartRef.current.data.datasets[1].data = payouts;
      chartRef.current.update();
    }
  }, [premiums, payouts]);

  return (
    <div className="chart-section">
      <div className="chart-header">
        <div>
          <div className="chart-title">Premium paid vs Payouts received</div>
          <div className="chart-subtitle">Last 7 days · Chennai</div>
        </div>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-dot premium" />
            <span>Premium</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot payout" />
            <span>Payout</span>
          </div>
        </div>
      </div>

      <div className="chart-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      <div className="chart-summary">
        <div className="chart-sum-item">
          <span className="chart-sum-label">Week total premium</span>
          <span className="chart-sum-value purple">
            ₹{totalPremium.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="chart-sum-item">
          <span className="chart-sum-label">Week total payout</span>
          <span className="chart-sum-value teal">
            ₹{totalPayout.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Camera Modal ─────────────────────────────────────────── */
function ReportModal({ onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const fileInputRef = useRef(null);
  const [photoData, setPhotoData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let s;
    const startCam = async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setStream(s);
      } catch (err) {
        console.error("Camera access denied", err);
      }
    };
    startCam();

    return () => {
      if (s) s.getTracks().forEach(t => t.stop());
    };
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUri = canvas.toDataURL('image/jpeg');
    setPhotoData(dataUri);
  };

  const retake = () => {
    setPhotoData(null);
  };

  const pickFromGallery = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoData(ev.target.result);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const submitToAI = async () => {
    setAnalyzing(true);
    try {
      const userPhone = localStorage.getItem("userPhone");
      const res = await fetch("https://gigshield-v1.onrender.com/api/curfew-detection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photoData, userPhone }),
      });
      const data = await res.json();

      setAnalyzing(false);

      if (data.success && data.data?.payout_issued) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 3500);
      } else {
        const pred = data.data?.prediction || data.message || "Unknown";
        const conf = data.data?.confidence ? Math.round(data.data.confidence * 100) + "%" : "";
        alert(`AI Analysis: ${pred} ${conf}. No disruption payout issued.`);
        retake();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to reach AI service.");
      setAnalyzing(false);
    }
  };

  return (
    <div className="cam-modal-overlay">
      <div className="cam-modal-content">
        <div className="cam-modal-head">
          <h2 style={{ fontSize: 20, color: '#fff' }}>AI Validation Camera</h2>
          <button className="cam-close" onClick={onClose}>✕</button>
        </div>

        {!success ? (
          <div className="cam-body">
            <div className="cam-viewfinder">
              {!photoData ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="cam-video" />
                  <div className="cam-overlay-ui">
                    <div className="cam-crosshair" />
                    <button className="cam-capture-btn" onClick={takePhoto}>
                      <div className="cam-capture-inner" />
                    </button>
                    <div className="cam-hint">Point at blockade &amp; capture</div>
                  </div>
                </>
              ) : (
                <>
                  <img src={photoData} className="cam-preview" alt="Validation Snapshot" />
                  <div className="cam-overlay-ui">
                    {analyzing ? (
                      <div className="cam-analyzing">
                        <span className="spinner" />
                        <div>Running Computer Vision Model...</div>
                      </div>
                    ) : (
                      <div className="cam-actions">
                        <button className="cam-retake-btn" onClick={retake}>↺ Retake</button>
                        <button className="cam-submit-btn" onClick={submitToAI}>Validate with AI →</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Gallery upload — placed OUTSIDE viewfinder so it's never blocked */}
            {!photoData && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <button
                  onClick={pickFromGallery}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px dashed rgba(255,255,255,0.25)",
                    borderRadius: 12,
                    color: "#ccc",
                    padding: "11px 0",
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    letterSpacing: 0.3,
                  }}
                >
                  🖼️ Upload from Gallery / Files
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="cam-success">
            <div className="done-icon" style={{ marginBottom: 16 }}>✓</div>
            <h3 style={{ fontSize: 24, marginBottom: 8, color: '#10b981' }}>Blockade Verified!</h3>
            <p style={{ color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>
              AI has verified the roadblock. Maps API indicates no alternate routes. Disruption payout has been authorized.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Payout Celebration Modal ───────────────────────────────── */
function PayoutCelebration({ amount, onClose }) {
  return (
    <div className="payout-overlay" onClick={onClose}>
      <div className="payout-card" onClick={(e) => e.stopPropagation()}>
        <div className="payout-icon-wrap">
          <div className="payout-icon-glow"></div>
          <span className="payout-icon">⚡</span>
        </div>
        <h2 className="payout-title">Parametric Trigger Hit!</h2>
        <p className="payout-body">
          Heavy Rainfall threshold met in your zone. <b className="payout-amount-text">₹{amount}</b> has automatically been dispatched to your UPI.
        </p>
        <button className="payout-close-btn" onClick={onClose}>Awesome!</button>
      </div>

      <div className="confetti-container">
        {[...Array(60)].map((_, i) => {
          const angle = Math.random() * Math.PI * 2;
          const velocity = 100 + Math.random() * 400;
          const tx = Math.cos(angle) * velocity;
          const ty = Math.sin(angle) * velocity;
          return (
            <div
              key={i}
              className={`confetti piece-${i % 5}`}
              style={{
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                left: '50%', top: '50%',
                animationDelay: `${Math.random() * 0.1}s`
              }}
            />
          )
        })}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ────────────────────────────────────────── */
const Dashboard = () => {
  const [showDisruption, setShowDisruption] = useState(true);
  const [showCamera, setShowCamera]   = useState(false);
  const [userData, setUserData]   = useState(null);
  const [payoutsData, setPayoutsData] = useState([]);

  const fetchDashboard = async () => {
    const phone = localStorage.getItem('userPhone');
    if (!phone) return;

    // Fetch user — try both phone formats
    let { data: user } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
    if (!user) {
      const alt = phone.startsWith('+91') ? phone.slice(3) : `+91${phone}`;
      ({ data: user } = await supabase.from('users').select('*').eq('phone', alt).maybeSingle());
    }
    if (!user) return;
    setUserData(user);

    // Fetch payouts via backend (service role key — bypasses anon permission issues)
    try {
      const res  = await fetch(`https://gigshield-v1.onrender.com/api/payout/history/${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json.success) setPayoutsData(json.data || []);
    } catch (e) {
      console.warn('Could not fetch payouts:', e.message);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (!userData) {
    return <div className="dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  // Compute totals from real payouts table data
  const totalReceived = payoutsData.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Build weekly chart arrays (Mon=0 … Sun=6) from payouts in last 7 days
  const weeklyPayouts  = [0, 0, 0, 0, 0, 0, 0];
  const weeklyPremiums = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  payoutsData.forEach((p) => {
    const d = new Date(p.paid_at || p.created_at);
    if ((now - d) / 86400000 < 7) {
      let idx = d.getDay() - 1; if (idx < 0) idx = 6;
      weeklyPayouts[idx] += Number(p.amount || 0);
    }
  });
  let todayIdx = now.getDay() - 1; if (todayIdx < 0) todayIdx = 6;
  weeklyPremiums[todayIdx] = Number(userData.this_week_premium || 0);

  const dynamicStats = [
    { id: "coverage",       label: "Coverage",       value: userData.coverage_status || "Active",                      sub: "Renews Monday",    color: "green",  icon: "🛡️" },
    { id: "this-week",      label: "This Week",      value: `₹${userData.this_week_premium || 0}`,                     sub: "Premium paid",    color: "purple", icon: "📅" },
    { id: "total-received", label: "Total Received", value: `₹${totalReceived.toLocaleString('en-IN')}`,              sub: "Lifetime payouts", color: "teal",   icon: "💳" },
    { id: "risk-status",    label: "Risk Status",    value: "Low",                                                     sub: "No flags this week", color: "green", icon: "📊" },
  ];

  return (
    <div className="dashboard">
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <span className="topbar-greeting">Welcome back, {userData.name ? userData.name.split(' ')[0] : 'Rider'}</span>
            <h1 className="topbar-title">Rider Dashboard</h1>
          </div>
          <button className="report-btn" onClick={() => setShowCamera(true)}>
            🚨 Report Blockade
          </button>
        </div>
        <div className="topbar-right">
          <div className="coverage-badge">
            <span className="pulse-dot" />
            Coverage active
          </div>
          <span className="date-chip">{today}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-cards">
        {dynamicStats.map((s) => (
          <StatCard key={s.id} {...s} />
        ))}
      </div>

      <WeeklyChart premiums={weeklyPremiums} payouts={weeklyPayouts} />

      {/* Disruption banner */}
      {showDisruption && (
        <DisruptionBanner onDismiss={() => setShowDisruption(false)} />
      )}

      {/* Camera modal */}
      {showCamera && <ReportModal onClose={() => setShowCamera(false)} />}
    </div>
  );
};

export default Dashboard;
