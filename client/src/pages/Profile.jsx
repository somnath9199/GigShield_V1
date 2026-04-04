import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Profile() {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({ name: "", email: "", city: "", platform: "" });
  const [msg, setMsg]   = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const phone = localStorage.getItem("userPhone");
      if (!phone) return;
      let { data } = await supabase.from("users").select("*").eq("phone", phone).maybeSingle();
      if (!data) ({ data } = await supabase.from("users").select("*").eq("phone", phone.replace("+91","")).maybeSingle());
      if (data) { setUser(data); setForm({ name: data.name||"", email: data.email||"", city: data.city||"", platform: data.platform||"" }); }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    const phone = localStorage.getItem("userPhone");
    let { error } = await supabase.from("users").update({ name: form.name, email: form.email, city: form.city, platform: form.platform }).eq("phone", phone);
    if (error) await supabase.from("users").update({ name: form.name, email: form.email, city: form.city, platform: form.platform }).eq("phone", phone.replace("+91",""));
    setUser(u => ({ ...u, ...form }));
    setSaving(false); setEditing(false);
    setMsg("Profile updated successfully!");
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"#888" }}>
      <div style={spinnerStyle} />
    </div>
  );

  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  const planColor = user?.selected_plan?.toLowerCase().includes("suraksha") ? "#a78bfa"
    : user?.selected_plan?.toLowerCase().includes("rakshak") ? "#10b981" : "#60a5fa";

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", { month:"long", year:"numeric" })
    : "—";

  return (
    <div style={{ minHeight:"100vh", padding:"48px 24px", fontFamily:'"DM Sans", sans-serif', color:"#f0f0f8" }}>
      <div style={{ maxWidth:780, margin:"0 auto" }}>

        {/* ── Hero Card ── */}
        <div style={heroCard}>
          {/* Background glow */}
          <div style={glowBall} />

          {/* Avatar + identity */}
          <div style={{ display:"flex", alignItems:"center", gap:28, position:"relative", zIndex:1 }}>
            <div style={avatarWrap}>
              <div style={avatarRing} />
              <div style={avatarInner}>{initials}</div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"#a78bfa", textTransform:"uppercase", marginBottom:4 }}>
                GigShield Member
              </div>
              <h1 style={{ fontSize:32, fontWeight:800, margin:0, letterSpacing:"-0.5px", color:"#fff" }}>{user?.name || "Rider"}</h1>
              <p style={{ color:"#8888a8", fontSize:14, margin:"4px 0 12px" }}>{user?.email || "No email set"}</p>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <Chip color="#10b981" bg="rgba(16,185,129,0.12)" border="rgba(16,185,129,0.3)">
                  ● {user?.coverage_status || "No Plan"}
                </Chip>
                {user?.selected_plan && (
                  <Chip color={planColor} bg={`${planColor}18`} border={`${planColor}40`}>
                    🛡️ {user.selected_plan}
                  </Chip>
                )}
                <Chip color="#94a3b8" bg="rgba(148,163,184,0.08)" border="rgba(148,163,184,0.15)">
                  📅 Since {memberSince}
                </Chip>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, margin:"24px 0" }}>
          {[
            { icon:"🏙️", label:"City", value: user?.city || "—" },
            { icon:"🛵", label:"Platform", value: user?.platform || "—" },
            { icon:"📱", label:"Phone", value: user?.phone || "—" },
          ].map(s => (
            <div key={s.label} style={statCard}>
              <span style={{ fontSize:22, marginBottom:8, display:"block" }}>{s.icon}</span>
              <span style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:"#55556a", fontWeight:600 }}>{s.label}</span>
              <span style={{ fontSize:15, color:"#d0d0e8", fontWeight:600, marginTop:4, display:"block", wordBreak:"break-all" }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* ── Edit Card ── */}
        <div style={formCard}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, margin:0, color:"#fff" }}>Personal Information</h2>
              <p style={{ fontSize:13, color:"#55556a", margin:"4px 0 0" }}>Edit your profile details below</p>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} style={editBtn}>✏️ Edit Profile</button>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            {[
              { label:"Full Name", field:"name", icon:"👤" },
              { label:"Email Address", field:"email", icon:"📧" },
              { label:"City", field:"city", icon:"🏙️" },
              { label:"Platform", field:"platform", icon:"🛵" },
            ].map(({ label, field, icon }) => (
              <div key={field}>
                <label style={labelStyle}>{icon} {label}</label>
                {editing ? (
                  <input
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    style={inputStyle}
                    placeholder={`Enter ${label.toLowerCase()}`}
                  />
                ) : (
                  <div style={valueStyle}>{form[field] || "—"}</div>
                )}
              </div>
            ))}
          </div>

          {/* Read-only */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:20, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <label style={labelStyle}>📱 Phone Number</label>
              <div style={{ ...valueStyle, color:"#94a3b8" }}>{user?.phone || "—"}</div>
            </div>
            <div>
              <label style={labelStyle}>🛡️ Active Plan</label>
              <div style={{ ...valueStyle, color: planColor, fontWeight:700 }}>{user?.selected_plan || "No plan selected"}</div>
            </div>
          </div>

          {editing && (
            <div style={{ display:"flex", gap:12, marginTop:32 }}>
              <button onClick={save} disabled={saving} style={saveBtn}>
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
              <button onClick={() => { setEditing(false); setForm({ name:user?.name||"", email:user?.email||"", city:user?.city||"", platform:user?.platform||"" }); }} style={cancelBtn}>
                Cancel
              </button>
            </div>
          )}

          {msg && (
            <div style={successMsg}>✓ {msg}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-component ── */
function Chip({ children, color, bg, border }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:bg, border:`1px solid ${border}`, borderRadius:20, padding:"4px 12px", fontSize:12, color, fontWeight:600 }}>
      {children}
    </span>
  );
}

/* ── Styles ── */
const heroCard = {
  background:"linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
  border:"1px solid rgba(99,102,241,0.2)",
  borderRadius:24, padding:"36px 40px",
  position:"relative", overflow:"hidden",
  boxShadow:"0 8px 40px rgba(99,102,241,0.1)",
};
const glowBall = {
  position:"absolute", right:-60, top:-80,
  width:300, height:300, borderRadius:"50%",
  background:"radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
  pointerEvents:"none",
};
const avatarWrap = { position:"relative", width:88, height:88, flexShrink:0 };
const avatarRing = {
  position:"absolute", inset:-4, borderRadius:"50%",
  background:"linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa)",
  zIndex:0,
};
const avatarInner = {
  position:"absolute", inset:3, borderRadius:"50%",
  background:"linear-gradient(135deg,#1e1e35,#2a1f4e)",
  display:"flex", alignItems:"center", justifyContent:"center",
  fontSize:30, fontWeight:800, color:"#fff", zIndex:1,
};
const statCard = {
  background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
  borderRadius:16, padding:"24px 20px",
  display:"flex", flexDirection:"column",
  transition:"border-color 0.2s",
};
const formCard = {
  background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
  borderRadius:20, padding:"36px 40px",
  backdropFilter:"blur(12px)",
};
const labelStyle = { fontSize:11, fontWeight:700, color:"#55556a", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:8 };
const valueStyle = { fontSize:15, color:"#d0d0e8", padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", minHeight:44 };
const inputStyle = {
  width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(99,102,241,0.35)",
  borderRadius:10, color:"#fff", padding:"12px 16px", fontSize:15,
  fontFamily:'"DM Sans", sans-serif', outline:"none", boxSizing:"border-box",
  transition:"border-color 0.2s",
};
const editBtn = {
  background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)",
  borderRadius:10, color:"#818cf8", padding:"10px 20px", cursor:"pointer",
  fontSize:13, fontWeight:700, fontFamily:'"DM Sans", sans-serif',
  transition:"all 0.2s",
};
const saveBtn = {
  flex:1, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none",
  borderRadius:12, color:"#fff", padding:"15px 0", fontSize:15,
  fontWeight:800, cursor:"pointer", fontFamily:'"DM Sans", sans-serif',
  boxShadow:"0 4px 20px rgba(99,102,241,0.35)",
};
const cancelBtn = {
  flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
  borderRadius:12, color:"#8888a8", padding:"15px 0", fontSize:15,
  fontWeight:600, cursor:"pointer", fontFamily:'"DM Sans", sans-serif',
};
const successMsg = {
  marginTop:20, background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)",
  borderRadius:12, padding:"14px 20px", color:"#10b981", fontSize:14,
  textAlign:"center", fontWeight:600,
};
const spinnerStyle = {
  width:36, height:36, borderRadius:"50%",
  border:"3px solid rgba(99,102,241,0.2)",
  borderTopColor:"#6366f1",
  animation:"spin 0.8s linear infinite",
};
