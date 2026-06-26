function MiniBar({ value, total, color }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.06)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s ease" }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 28, textAlign: "right" }}>{pct}%</span>
        </div>
    );
}

function StatRow({ label, count, color, dot }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot || color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-muted)", flex: 1 }}>{label}</span>
            <span style={{ fontWeight: 700, color: count > 0 ? color : "var(--text-muted)", fontFamily: "var(--mono, monospace)" }}>{count}</span>
        </div>
    );
}

export default function SummaryCards({ pods, deployments, services, events }) {
    const runningPods  = pods.filter(p => p.status === "Running").length;
    const pendingPods  = pods.filter(p => p.status === "Pending").length;
    const failedPods   = pods.filter(p => !["Running", "Pending", "Succeeded"].includes(p.status)).length;

    const healthyDeploys  = deployments.filter(d => d.ready >= d.desired && d.desired > 0).length;
    const degradedDeploys = deployments.filter(d => d.ready < d.desired && d.ready > 0).length;
    const downDeploys     = deployments.filter(d => d.ready === 0).length;

    const clusterNodeTypes = [...new Set(services.map(s => s.type).filter(Boolean))];
    const warnings = events.filter(e => e.type === "Warning").length;

    // Health score: 0–100
    const totalChecks = pods.length + deployments.length;
    const healthyChecks = runningPods + healthyDeploys;
    const healthScore = totalChecks > 0 ? Math.round((healthyChecks / totalChecks) * 100) : 100;
    const scoreColor = healthScore >= 90 ? "#22c55e" : healthScore >= 70 ? "#f59e0b" : "#ef4444";
    const scoreLabel = healthScore >= 90 ? "Healthy" : healthScore >= 70 ? "Degraded" : "Critical";

    return (
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr 1fr", gap: 12 }}>

            {/* Health score card */}
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "16px 18px",
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 6,
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 80% 50%, ${scoreColor}14 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Cluster Health</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: scoreColor, lineHeight: 1, letterSpacing: "-2px" }}>{healthScore}</span>
                    <span style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 600 }}>/ 100</span>
                </div>
                <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
                    color: scoreColor, background: `${scoreColor}18`, border: `1px solid ${scoreColor}30`,
                    borderRadius: 20, padding: "2px 9px", alignSelf: "flex-start",
                }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: scoreColor }} />
                    {scoreLabel}
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
                    <div style={{ width: `${healthScore}%`, height: "100%", background: scoreColor, borderRadius: 3, transition: "width .5s ease" }} />
                </div>
            </div>

            {/* Pods */}
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Pods</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-1px" }}>{pods.length}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>total</span>
                    </div>
                </div>
                <MiniBar value={runningPods} total={pods.length} color="#22c55e" />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                    <StatRow label="Running"  count={runningPods}  color="#22c55e" />
                    <StatRow label="Pending"  count={pendingPods}  color="#f59e0b" />
                    <StatRow label="Failed"   count={failedPods}   color="#ef4444" />
                </div>
            </div>

            {/* Deployments */}
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Deployments</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-1px" }}>{deployments.length}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>total</span>
                    </div>
                </div>
                <MiniBar value={healthyDeploys} total={deployments.length} color="#22c55e" />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                    <StatRow label="Healthy"  count={healthyDeploys}  color="#22c55e" />
                    <StatRow label="Degraded" count={degradedDeploys} color="#f59e0b" />
                    <StatRow label="Down"     count={downDeploys}     color="#ef4444" />
                </div>
            </div>

            {/* Services + Events */}
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 0,
            }}>
                {/* Services row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 6 }}>Services</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {clusterNodeTypes.length > 0 ? clusterNodeTypes.map(t => (
                                <span key={t} style={{
                                    fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                    background: "var(--surface2)", border: "1px solid var(--border)",
                                    color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: .5,
                                }}>{t}</span>
                            )) : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
                        </div>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-1px" }}>{services.length}</span>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid var(--border)", margin: "0 -2px 8px" }} />

                {/* Events row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 6 }}>Events</div>
                        {warnings > 0 ? (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                                background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", color: "#f59e0b",
                            }}>⚠ {warnings} warnings</span>
                        ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)", color: "#22c55e" }}>
                                ✓ No warnings
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-1px" }}>{events.length}</span>
                </div>
            </div>

        </div>
    );
}
