import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function maskAccount(num) {
  if (!num) return "••••••••";
  const s = String(num);
  return "•".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

export default function Bankinfo() {
  const phone = localStorage.getItem("userPhone");

  const [bankData, setBankData] = useState(null);   // existing saved details
  const [loadingData, setLoadingData] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const [form, setForm] = useState({ accountHolder: "", accountNumber: "", ifsc: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Load existing bank info from Supabase
  useEffect(() => {
    if (!phone) { setLoadingData(false); return; }
    supabase
      .from("users")
      .select("bank_account_holder, bank_account_number, bank_ifsc, payout_setup_done, name")
      .eq("phone", phone)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.bank_account_number) {
          setBankData(data);
          setForm({
            accountHolder: data.bank_account_holder || "",
            accountNumber: data.bank_account_number || "",
            ifsc: data.bank_ifsc || "",
          });
        }
        setLoadingData(false);
      });
  }, [phone]);

  const validate = () => {
    if (!form.accountHolder.trim()) return "Account holder name is required";
    if (!/^\d{9,18}$/.test(form.accountNumber.trim())) return "Account number must be 9–18 digits";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc.trim())) return "Invalid IFSC format (e.g. SBIN0001234)";
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage("");
    const err = validate();
    if (err) { setMessage(err); setIsError(true); return; }

    setSaving(true);
    setIsError(false);
    try {
      const res = await fetch("http://localhost:8000/api/payout/setup-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          accountHolder: form.accountHolder.trim(),
          accountNumber: form.accountNumber.trim(),
          ifsc: form.ifsc.trim().toUpperCase(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to save");

      setBankData({
        bank_account_holder: form.accountHolder.trim(),
        bank_account_number: form.accountNumber.trim(),
        bank_ifsc: form.ifsc.trim().toUpperCase(),
        payout_setup_done: true,
      });
      setEditing(false);
      setMessage("✓ Bank details updated successfully!");
      setIsError(false);
      setTimeout(() => setMessage(""), 4000);
    } catch (e) {
      setMessage(e.message);
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const s = {
    page: { fontFamily: "'DM Sans', sans-serif", background: "#0d0d14", minHeight: "100vh", color: "#f0f0f8", padding: "2.5rem 2rem", maxWidth: 680, margin: "0 auto" },
    label: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#55556a", marginBottom: 6, display: "block" },
    input: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px", color: "#f0f0f8", fontSize: 15, outline: "none", fontFamily: "'DM Mono', monospace", transition: "border-color 0.2s" },
    card: { background: "linear-gradient(145deg, #1a1a2b 0%, #13131f 100%)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 32px", marginBottom: 20 },
  };

  if (loadingData) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(124,110,249,0.3)", borderRadius: "50%", borderTopColor: "#7c6ef9", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        input:focus { border-color: #7c6ef9 !important; box-shadow: 0 0 0 3px rgba(124,110,249,0.15); }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 13, color: "#55556a", marginBottom: 6 }}>Payout Setup</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Bank Information</h1>
        <p style={{ fontSize: 14, color: "#8888a8", marginTop: 6 }}>
          Your payout will be transferred here automatically when a disruption is verified.
        </p>
      </div>

      {/* SUCCESS / error toast */}
      {message && (
        <div style={{
          background: isError ? "rgba(242,108,108,0.1)" : "rgba(74,222,128,0.1)",
          border: `1px solid ${isError ? "rgba(242,108,108,0.35)" : "rgba(74,222,128,0.3)"}`,
          color: isError ? "#f26c6c" : "#4ade80",
          borderRadius: 12, padding: "12px 18px", marginBottom: 20,
          fontSize: 14, fontWeight: 600, animation: "slideUp 0.3s ease"
        }}>
          {message}
        </div>
      )}

      {/* ── IF bank details exist AND not editing → show display card ── */}
      {bankData && !editing ? (
        <>
          {/* Status badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 30, padding: "6px 16px", marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>Payout Account Active</span>
          </div>

          {/* Virtual bank card */}
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
            border: "1px solid rgba(124,110,249,0.4)",
            borderRadius: 20, padding: "28px 32px", marginBottom: 20,
            boxShadow: "0 8px 40px rgba(124,110,249,0.2)",
            position: "relative", overflow: "hidden",
            animation: "slideUp 0.4s ease"
          }}>
            {/* Decorative circles */}
            <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(124,110,249,0.15)" }} />
            <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(124,110,249,0.1)" }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Account Holder</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 0.3 }}>{bankData.bank_account_holder}</div>
                </div>
                <div style={{ fontSize: 32 }}>🏦</div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Account Number</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: 3 }}>
                    {showFull ? bankData.bank_account_number : maskAccount(bankData.bank_account_number)}
                  </span>
                  <button onClick={() => setShowFull(v => !v)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, color: "#a8a8c8", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>
                    {showFull ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 32 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>IFSC Code</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600, color: "#a89cf7", letterSpacing: 2 }}>{bankData.bank_ifsc}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>✓ Verified</div>
                </div>
              </div>
            </div>
          </div>

          {/* Info row */}
          <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
            <span style={{ fontSize: 22 }}>🔒</span>
            <p style={{ fontSize: 13, color: "#8888a8", lineHeight: 1.5, margin: 0 }}>
              Your bank details are encrypted and only used for parametric insurance payouts. GigShield never charges your account.
            </p>
          </div>

          <button
            onClick={() => setEditing(true)}
            style={{ width: "100%", padding: "15px", borderRadius: 12, border: "1px solid rgba(124,110,249,0.4)", background: "rgba(124,110,249,0.1)", color: "#a89cf7", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "0.2s", marginTop: 4 }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(124,110,249,0.2)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(124,110,249,0.1)"}
          >
            ✏️ Update Bank Details
          </button>
        </>
      ) : (
        /* ── FORM (add / edit) ── */
        <div style={{ ...s.card, animation: "slideUp 0.35s ease" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {bankData ? "Update Bank Details" : "Add Bank Account"}
          </h2>
          <p style={{ fontSize: 13, color: "#8888a8", marginBottom: 28 }}>
            {bankData ? "Changes will be reflected immediately in the database." : "Add your bank account to receive automatic payouts."}
          </p>

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={s.label}>Account Holder Name</label>
              <input
                style={s.input}
                placeholder="e.g. Ayush Kumar"
                value={form.accountHolder}
                onChange={e => setForm(f => ({ ...f, accountHolder: e.target.value }))}
              />
            </div>
            <div>
              <label style={s.label}>Account Number</label>
              <input
                style={s.input}
                placeholder="9–18 digit account number"
                value={form.accountNumber}
                onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                maxLength={18}
              />
            </div>
            <div>
              <label style={s.label}>IFSC Code</label>
              <input
                style={{ ...s.input, textTransform: "uppercase" }}
                placeholder="e.g. SBIN0001234"
                value={form.ifsc}
                onChange={e => setForm(f => ({ ...f, ifsc: e.target.value.toUpperCase() }))}
                maxLength={11}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {bankData && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); setMessage(""); }}
                  style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8888a8", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: saving ? "#4a3fa8" : "#7c6ef9", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(124,110,249,0.35)", transition: "0.2s" }}
              >
                {saving ? "Saving..." : bankData ? "Update Details" : "Save Bank Account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}