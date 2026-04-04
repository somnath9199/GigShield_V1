import React, { useEffect, useState } from "react";

export default function History() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    const phone = localStorage.getItem('userPhone');
    if (!phone) { setLoading(false); return; }

    try {
      // Use backend (service role) — bypasses anon key SELECT permission issues on payouts
      const res  = await fetch(`http://localhost:8000/api/payout/history/${encodeURIComponent(phone)}`);
      const json = await res.json();

      if (json.success && json.data?.length > 0) {
        // Enrich with disruption info per payout
        const enriched = await Promise.all(json.data.map(async (p) => {
          let triggerLabel = 'Road Blockade (AI Verified)';
          let city = '—';
          if (p.disruption_id) {
            try {
              const dr = await fetch(`http://localhost:8000/api/disruption/${p.disruption_id}`);
              const dj = await dr.json();
              if (dj.success && dj.data) {
                triggerLabel = dj.data.disruption_type || triggerLabel;
                city = dj.data.city || city;
              }
            } catch (_) {}
          }
          return { ...p, triggerLabel, city };
        }));
        setTotalPaid(enriched.reduce((s, r) => s + Number(r.amount || 0), 0));
        setPayouts(enriched);
      }
    } catch (e) {
      console.error('History fetch error:', e.message);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ padding: '3rem', color: '#fff' }}>Loading claim history...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Claim History</h1>
        <p style={styles.subtitle}>A transparent ledger of all your automatic parametric payouts.</p>
        {payouts.length > 0 && (
          <div style={styles.totalBadge}>
            Total lifetime payouts: <strong style={{ color: '#4ade80' }}>₹{totalPaid.toLocaleString('en-IN')}</strong>
          </div>
        )}
      </div>

      {payouts.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌤️</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#f0f0f8' }}>No claim history</h3>
          <p style={{ margin: 0, color: '#8888a8' }}>
            No payouts have been issued yet. Report a blockade from the Dashboard to trigger one.
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {payouts.map((claim) => {
            const dateStr = new Date(claim.paid_at || claim.created_at).toLocaleDateString("en-IN", {
              month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
            });
            return (
              <div key={claim.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.claimId}>CLM-{String(claim.id).padStart(5, '0')}</span>
                  <span style={styles.statusBadge}>✓ {claim.status === 'paid' ? 'Settled' : claim.status}</span>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.infoGroup}>
                    <span style={styles.label}>Trigger Event</span>
                    <span style={styles.valueWarning}>{claim.triggerLabel}</span>
                  </div>
                  <div style={styles.infoGroup}>
                    <span style={styles.label}>City / Zone</span>
                    <span style={styles.value}>{claim.city}</span>
                  </div>
                  <div style={styles.infoGroup}>
                    <span style={styles.label}>Date Processed</span>
                    <span style={styles.value}>{dateStr}</span>
                  </div>
                  <div style={styles.infoGroup}>
                    <span style={styles.label}>Bank A/C</span>
                    <span style={styles.value}>••••{String(claim.bank_account_number || '').slice(-4)}</span>
                  </div>
                  <div style={{ ...styles.infoGroup, alignItems: 'flex-end' }}>
                    <span style={styles.label}>Amount Credited</span>
                    <span style={styles.amount}>₹{Number(claim.amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '3rem', color: '#f0f0f8', maxWidth: 960, margin: '0 auto', fontFamily: '"DM Sans", sans-serif' },
  header: { marginBottom: '3.5rem' },
  title: { fontSize: 32, fontWeight: 700, margin: '0 0 10px 0', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 15, color: '#8888a8', lineHeight: 1.6, marginBottom: 16 },
  totalBadge: {
    display: 'inline-block', background: 'rgba(74,222,128,0.08)',
    border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10,
    padding: '8px 16px', fontSize: 14, color: '#a0a0c0'
  },
  emptyState: {
    background: '#13131f', border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: 16, padding: '4rem 2rem', textAlign: 'center'
  },
  list: { display: 'flex', flexDirection: 'column', gap: 20 },
  card: {
    background: '#13131f', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '24px 28px',
    transition: 'transform 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  claimId: {
    fontFamily: '"DM Mono", monospace', color: '#8888a8', fontSize: 14,
    background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 6
  },
  statusBadge: {
    color: '#4ade80', background: 'rgba(74, 222, 128, 0.12)',
    border: '1px solid rgba(74,222,128,0.2)', padding: '6px 12px',
    borderRadius: 20, fontSize: 12, fontWeight: 600
  },
  cardBody: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 24, alignItems: 'center' },
  infoGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, textTransform: 'uppercase', color: '#55556a', fontWeight: 600, letterSpacing: '0.06em' },
  value: { fontSize: 14.5, color: '#d0d0e8', fontWeight: 500 },
  valueWarning: { fontSize: 14.5, color: '#f5a623', fontWeight: 600 },
  amount: { fontSize: 26, color: '#4ade80', fontWeight: 700, letterSpacing: '-0.5px' }
};
