import { useState, useEffect } from "react";
import { getPodDetail, getLogs } from "../api/api";

function classifyLogLine(line) {
    const l = line.toLowerCase();
    if (/\b(error|err|fatal|exception|panic|critical|failed|failure)\b/.test(l)) return "error";
    if (/\b(warn|warning)\b/.test(l)) return "warn";
    if (/\b(info|notice)\b/.test(l)) return "info";
    if (/\b(debug|trace|verbose)\b/.test(l)) return "debug";
    return "default";
}

const LOG_LEVEL_STYLES = {
    error:   { border: "#dc2626", badge: "#fee2e2", badgeText: "#b91c1c", label: "ERR" },
    warn:    { border: "#d97706", badge: "#fef3c7", badgeText: "#92400e", label: "WARN" },
    info:    { border: "#2563eb", badge: "#eff6ff", badgeText: "#1d4ed8", label: "INFO" },
    debug:   { border: "#6b7280", badge: "#f3f4f6", badgeText: "#374151", label: "DBG" },
    default: { border: "#e2e6ef", badge: "#f8f9fc", badgeText: "#6b7280", label: "LOG" },
};

// Extracts optional timestamp prefix from log line
function parseLogLine(raw) {
    const tsMatch = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/s);
    if (tsMatch) return { ts: tsMatch[1].replace("T", " ").slice(0, 19), msg: tsMatch[2] };
    return { ts: null, msg: raw };
}

function LogsSection({ resource, canHaveLogs, logs, logsLoading, showLogs, loadLogs }) {
    const [filter, setFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");

    const lines = logs ? logs.split("\n").filter(l => l.trim()) : [];
    const filtered = lines.filter(line => {
        const level = classifyLogLine(line);
        const matchLevel = levelFilter === "all" || level === levelFilter;
        const matchText = !filter || line.toLowerCase().includes(filter.toLowerCase());
        return matchLevel && matchText;
    });

    const counts = { error: 0, warn: 0, info: 0, debug: 0, default: 0 };
    lines.forEach(l => { counts[classifyLogLine(l)]++; });

    return (
        <div className="detail-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h4>Container Logs</h4>
                <button
                    onClick={loadLogs}
                    disabled={logsLoading}
                    style={{
                        padding: "4px 12px",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        cursor: canHaveLogs ? "pointer" : "not-allowed",
                        fontSize: 11,
                        fontWeight: 600,
                        opacity: canHaveLogs ? 1 : 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                    }}
                    title={canHaveLogs ? "Load container logs" : "Container has not started — no logs available"}
                >
                    {logsLoading ? "⟳ Loading…" : showLogs ? "↻ Reload" : "📜 Load logs"}
                </button>
            </div>

            {!showLogs && !logsLoading && (
                <div style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 12,
                }}>
                    Click <strong>Load logs</strong> to view container output
                </div>
            )}

            {showLogs && !canHaveLogs && (
                <div style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderLeft: "4px solid #d97706",
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
                    <div>
                        <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>No logs available</strong>
                        {resource.status === "Pending"
                            ? "Pod is Pending — container hasn't started yet."
                            : "Container has not produced any logs or failed before startup."}
                        <code style={{ display: "inline-block", marginTop: 8, background: "#0d1117", color: "#7dd3fc", padding: "3px 8px", borderRadius: 4, fontSize: 11 }}>
                            kubectl describe pod {resource.name} -n {resource.namespace}
                        </code>
                    </div>
                </div>
            )}

            {showLogs && canHaveLogs && logs && (
                <>
                    {/* Level summary + filters */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {["all", "error", "warn", "info", "debug"].map(lvl => {
                            const s = LOG_LEVEL_STYLES[lvl] || LOG_LEVEL_STYLES.default;
                            const cnt = lvl === "all" ? lines.length : counts[lvl];
                            const active = levelFilter === lvl;
                            return (
                                <button key={lvl} onClick={() => setLevelFilter(lvl)} style={{
                                    padding: "3px 9px",
                                    borderRadius: 12,
                                    border: active ? `1px solid ${s.border}` : "1px solid var(--border)",
                                    background: active ? s.badge : "var(--surface2)",
                                    color: active ? s.badgeText : "var(--text-muted)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}>
                                    {lvl === "all" ? "All" : s.label} {cnt > 0 && <span style={{ opacity: 0.7 }}>({cnt})</span>}
                                </button>
                            );
                        })}
                        <input
                            placeholder="Filter lines…"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            style={{
                                marginLeft: "auto",
                                padding: "3px 9px",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                fontSize: 11,
                                background: "var(--surface2)",
                                color: "var(--text)",
                                width: 140,
                            }}
                        />
                    </div>

                    {/* Log lines — event-row style */}
                    <div style={{
                        overflowY: "visible",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        padding: 6,
                        background: "var(--surface2)",
                    }}>
                        {filtered.length === 0 && (
                            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                                No lines match the current filter
                            </div>
                        )}
                        {filtered.map((line, i) => {
                            const level = classifyLogLine(line);
                            const s = LOG_LEVEL_STYLES[level];
                            const { ts, msg } = parseLogLine(line);
                            return (
                                <div key={i} style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    borderLeft: `3px solid ${s.border}`,
                                    background: "var(--surface)",
                                    fontSize: 12,
                                    lineHeight: 1.4,
                                }}>
                                    <span style={{
                                        background: s.badge,
                                        color: s.badgeText,
                                        borderRadius: 4,
                                        padding: "1px 5px",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                        minWidth: 30,
                                        textAlign: "center",
                                    }}>{s.label}</span>
                                    {ts && (
                                        <span style={{ color: "var(--text-muted)", fontSize: 10, flexShrink: 0, paddingTop: 1, fontFamily: "monospace" }}>
                                            {ts}
                                        </span>
                                    )}
                                    <span style={{ fontFamily: "monospace", wordBreak: "break-all", color: "var(--text)", flex: 1 }}>
                                        {msg}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
                        Showing {filtered.length} of {lines.length} lines
                    </div>
                </>
            )}
        </div>
    );
}

function KV({ label, value }) {
    return (
        <div className="kv-item">
            <div className="kv-label">{label}</div>
            <div className="kv-value">{value ?? "—"}</div>
        </div>
    );
}

function PodDetail({ resource, context }) {
    const [detail, setDetail] = useState(null);
    const [logs, setLogs] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        setDetail(null);
        setLogs(null);
        setShowLogs(false);
        getPodDetail(resource.namespace, resource.name, context)
            .then(setDetail)
            .catch(() => setDetail({ error: true }));
    }, [resource.name, resource.namespace, context]);

    const canHaveLogs = resource.status === "Running" || resource.restarts > 0;

    const loadLogs = () => {
        if (!canHaveLogs) {
            setShowLogs(true);
            setLogs(null);
            return;
        }
        setLogsLoading(true);
        setShowLogs(true);
        getLogs(resource.namespace, resource.name, context)
            .then(r => setLogs(r.logs || "(no log output)"))
            .catch(err => {
                const detail = err.response?.data?.detail || "";
                if (detail.includes("waiting") || detail.includes("not started") || detail.includes("ContainerCreating")) {
                    setLogs(null); // show no-logs UI
                } else {
                    setLogs("(could not retrieve logs — container may not have started yet)");
                }
            })
            .finally(() => setLogsLoading(false));
    };

    return (
        <div className="detail-body">
            <div className="detail-section">
                <h4>Overview</h4>
                <div className="kv-grid">
                    <KV label="Phase" value={resource.status} />
                    <KV label="Node" value={resource.node} />
                    <KV label="Namespace" value={resource.namespace} />
                    <KV label="Ready" value={resource.ready} />
                    <KV label="Restarts" value={resource.restarts} />
                </div>
            </div>

            {detail && !detail.error && (
                <>
                    <div className="detail-section">
                        <h4>Containers</h4>
                        {detail.containers?.map(c => (
                            <div key={c.name} style={{ background: "var(--surface2)", borderRadius: 7, padding: "10px 12px", marginBottom: 8 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                                    <span className={`badge ${c.ready ? "badge-running" : "badge-failed"}`} style={{ fontSize: 10 }}>
                                        {c.state}
                                    </span>
                                    {c.restarts > 0 && <span className="badge badge-warning" style={{ fontSize: 10 }}>{c.restarts} restarts</span>}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{c.image}</div>
                                {(c.resources.requests || c.resources.limits) && (
                                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                        {Object.keys(c.resources.requests || {}).map(k => (
                                            <span key={k} style={{ fontSize: 10, background: "var(--surface)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4 }}>
                                                req {k}: {c.resources.requests[k]}
                                            </span>
                                        ))}
                                        {Object.keys(c.resources.limits || {}).map(k => (
                                            <span key={k} style={{ fontSize: 10, background: "#fef3c7", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 4 }}>
                                                lim {k}: {c.resources.limits[k]}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {detail.events?.length > 0 && (
                        <div className="detail-section">
                            <h4>Recent Events</h4>
                            <div className="events-list">
                                {detail.events.map((e, i) => (
                                    <div key={i} className={`event-row ${e.type?.toLowerCase()}`}>
                                        <span className="event-reason">{e.reason}</span>
                                        <span className="event-message">{e.message}</span>
                                        {e.count > 1 && <span className="event-count">×{e.count}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <LogsSection
                resource={resource}
                context={context}
                canHaveLogs={canHaveLogs}
                logs={logs}
                setLogs={setLogs}
                logsLoading={logsLoading}
                setLogsLoading={setLogsLoading}
                showLogs={showLogs}
                setShowLogs={setShowLogs}
                loadLogs={loadLogs}
            />
        </div>
    );
}

function DeployDetail({ resource }) {
    const healthy = resource.ready >= resource.desired && resource.desired > 0;
    return (
        <div className="detail-body">
            <div className="detail-section">
                <h4>Replica Status</h4>
                <div className="kv-grid">
                    <KV label="Desired" value={resource.desired} />
                    <KV label="Ready" value={resource.ready} />
                    <KV label="Available" value={resource.available} />
                    <KV label="Updated" value={resource.updated} />
                    <KV label="Namespace" value={resource.namespace} />
                    <KV label="Status" value={healthy ? "Healthy" : "Degraded"} />
                </div>
            </div>
        </div>
    );
}

function ServiceDetail({ resource }) {
    return (
        <div className="detail-body">
            <div className="detail-section">
                <h4>Service Info</h4>
                <div className="kv-grid">
                    <KV label="Type" value={resource.type} />
                    <KV label="Cluster IP" value={resource.cluster_ip} />
                    <KV label="Namespace" value={resource.namespace} />
                    <KV label="Ports" value={(resource.ports || []).join(", ")} />
                </div>
            </div>
        </div>
    );
}

export default function DetailPanel({ selected, context }) {
    if (!selected) {
        return (
            <div className="detail-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="empty-state">
                    <div className="icon">☸</div>
                    <p>Select a resource from the left panel to inspect it</p>
                </div>
            </div>
        );
    }

    const typeLabel = { pod: "Pod", deployment: "Deployment", service: "Service" }[selected.type] || selected.type;

    return (
        <div className="detail-panel">
            <div className="detail-header">
                <span style={{ fontSize: 18 }}>
                    {selected.type === "pod" ? "☸" : selected.type === "deployment" ? "⬡" : "⇄"}
                </span>
                <div className="detail-title">{selected.name}</div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 4 }}>
                    {typeLabel} · {selected.namespace}
                </span>
            </div>

            {selected.type === "pod" && <PodDetail resource={selected} context={context} />}
            {selected.type === "deployment" && <DeployDetail resource={selected} />}
            {selected.type === "service" && <ServiceDetail resource={selected} />}
        </div>
    );
}
