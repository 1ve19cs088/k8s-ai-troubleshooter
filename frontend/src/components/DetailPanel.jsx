import { useState, useEffect, useRef, useCallback } from "react";
import { getPodDetail, streamLogs } from "../api/api";

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

function LogLine({ line }) {
    const level = classifyLogLine(line);
    const s = LOG_LEVEL_STYLES[level];
    const { ts, msg } = parseLogLine(line);
    return (
        <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "5px 10px", borderRadius: 6,
            borderLeft: `3px solid ${s.border}`,
            background: "var(--surface)", fontSize: 12, lineHeight: 1.4,
        }}>
            <span style={{
                background: s.badge, color: s.badgeText, borderRadius: 4,
                padding: "1px 5px", fontSize: 10, fontWeight: 700,
                flexShrink: 0, minWidth: 30, textAlign: "center",
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
}

function LogsSection({ resource, canHaveLogs, context }) {
    const [lines, setLines]           = useState([]);
    const [streaming, setStreaming]   = useState(false);
    const [error, setError]           = useState(null);
    const [filter, setFilter]         = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [autoScroll, setAutoScroll] = useState(true);
    const esRef    = useRef(null);
    const bottomRef = useRef(null);

    // Auto-scroll to bottom when new lines arrive
    useEffect(() => {
        if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [lines, autoScroll]);

    // Stop stream when pod changes
    useEffect(() => {
        return () => { esRef.current?.close(); };
    }, [resource.name, resource.namespace]);

    const startStream = useCallback(() => {
        esRef.current?.close();
        setLines([]);
        setError(null);
        setStreaming(true);

        esRef.current = streamLogs({
            namespace: resource.namespace,
            podName: resource.name,
            context,
            tailLines: 200,
            onLine: (line) => setLines(prev => [...prev, line]),
            onError: (err) => { setError(err); setStreaming(false); },
        });

        // Mark as stopped when EventSource closes naturally
        esRef.current.addEventListener("error", () => setStreaming(false));
    }, [resource.name, resource.namespace, context]);

    const stopStream = () => {
        esRef.current?.close();
        setStreaming(false);
    };

    const filtered = lines.filter(line => {
        const level = classifyLogLine(line);
        const matchLevel = levelFilter === "all" || level === levelFilter;
        const matchText  = !filter || line.toLowerCase().includes(filter.toLowerCase());
        return matchLevel && matchText;
    });

    const counts = { error: 0, warn: 0, info: 0, debug: 0, default: 0 };
    lines.forEach(l => { counts[classifyLogLine(l)]++; });

    return (
        <div className="detail-section">
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <h4 style={{ flex: 1 }}>Container Logs</h4>

                {streaming && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#16a34a" }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: "50%", background: "#4ade80",
                            animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0,
                        }} />
                        Live
                    </span>
                )}

                {/* Auto-scroll toggle */}
                {lines.length > 0 && (
                    <button onClick={() => setAutoScroll(v => !v)} style={{
                        padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        border: "1px solid var(--border)",
                        background: autoScroll ? "#eff6ff" : "var(--surface2)",
                        color: autoScroll ? "#2563eb" : "var(--text-muted)",
                        cursor: "pointer",
                    }} title="Toggle auto-scroll to bottom">
                        ↓ {autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
                    </button>
                )}

                {/* Clear */}
                {lines.length > 0 && (
                    <button onClick={() => setLines([])} style={{
                        padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        border: "1px solid var(--border)", background: "var(--surface2)",
                        color: "var(--text-muted)", cursor: "pointer",
                    }}>Clear</button>
                )}

                {/* Stream / Stop */}
                {canHaveLogs ? (
                    streaming ? (
                        <button onClick={stopStream} style={{
                            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: "1px solid #fca5a5", background: "#fee2e2",
                            color: "#dc2626", cursor: "pointer",
                        }}>⏹ Stop</button>
                    ) : (
                        <button onClick={startStream} style={{
                            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: "1px solid #93c5fd", background: "#eff6ff",
                            color: "#2563eb", cursor: "pointer",
                        }}>▶ Stream logs</button>
                    )
                ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>
                        Not running
                    </span>
                )}
            </div>

            {/* Not running warning */}
            {!canHaveLogs && (
                <div style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderLeft: "4px solid #d97706", borderRadius: 8,
                    padding: "14px 16px", fontSize: 12, color: "var(--text-muted)",
                    display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
                    <div>
                        <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>No logs available</strong>
                        {resource.status === "Pending"
                            ? "Pod is Pending — container hasn't started yet."
                            : "Container failed before producing any output."}
                        <code style={{ display: "inline-block", marginTop: 8, background: "#0d1117", color: "#7dd3fc", padding: "3px 8px", borderRadius: 4, fontSize: 11 }}>
                            kubectl describe pod {resource.name} -n {resource.namespace}
                        </code>
                    </div>
                </div>
            )}

            {/* Idle state */}
            {canHaveLogs && !streaming && lines.length === 0 && !error && (
                <div style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "24px", textAlign: "center",
                    color: "var(--text-muted)", fontSize: 12,
                }}>
                    Click <strong>▶ Stream logs</strong> to follow live container output
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{
                    background: "#fee2e2", border: "1px solid #fca5a5",
                    borderRadius: 8, padding: "10px 14px", fontSize: 12,
                    color: "#dc2626", marginBottom: 8,
                }}>
                    ✕ {error}
                </div>
            )}

            {/* Filter bar */}
            {lines.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {["all", "error", "warn", "info", "debug"].map(lvl => {
                        const s = LOG_LEVEL_STYLES[lvl] || LOG_LEVEL_STYLES.default;
                        const cnt = lvl === "all" ? lines.length : counts[lvl];
                        const active = levelFilter === lvl;
                        return (
                            <button key={lvl} onClick={() => setLevelFilter(lvl)} style={{
                                padding: "3px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                border: active ? `1px solid ${s.border}` : "1px solid var(--border)",
                                background: active ? s.badge : "var(--surface2)",
                                color: active ? s.badgeText : "var(--text-muted)",
                                cursor: "pointer",
                            }}>
                                {lvl === "all" ? "All" : s.label}
                                {cnt > 0 && <span style={{ opacity: 0.7 }}> ({cnt})</span>}
                            </button>
                        );
                    })}
                    <input
                        placeholder="Filter lines…"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={{
                            marginLeft: "auto", padding: "3px 9px",
                            border: "1px solid var(--border)", borderRadius: 6,
                            fontSize: 11, background: "var(--surface2)", color: "var(--text)", width: 140,
                        }}
                    />
                </div>
            )}

            {/* Log lines */}
            {lines.length > 0 && (
                <>
                    <div style={{
                        display: "flex", flexDirection: "column", gap: 3,
                        borderRadius: 8, border: "1px solid var(--border)",
                        padding: 6, background: "var(--surface2)",
                        maxHeight: 420, overflowY: "auto",
                    }}
                        onScroll={e => {
                            const el = e.currentTarget;
                            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                            setAutoScroll(atBottom);
                        }}
                    >
                        {filtered.length === 0 ? (
                            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                                No lines match the current filter
                            </div>
                        ) : (
                            filtered.map((line, i) => <LogLine key={i} line={line} />)
                        )}
                        <div ref={bottomRef} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                        <span>{streaming ? "● Streaming" : "● Stopped"}</span>
                        <span>Showing {filtered.length} of {lines.length} lines</span>
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

    useEffect(() => {
        setDetail(null);
        getPodDetail(resource.namespace, resource.name, context)
            .then(setDetail)
            .catch(() => setDetail({ error: true }));
    }, [resource.name, resource.namespace, context]);

    const canHaveLogs = resource.status === "Running" || resource.restarts > 0;

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

    const ICONS  = { pod: "☸", deployment: "⬡", service: "⇄", event: "⚡" };
    const LABELS = { pod: "Pod", deployment: "Deployment", service: "Service", event: "Event" };
    const icon  = ICONS[selected.kind]  || "☸";
    const label = LABELS[selected.kind] || selected.kind;
    const title = selected.kind === "event" ? selected.object : selected.name;

    return (
        <div className="detail-panel">
            <div className="detail-header">
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div className="detail-title">{title}</div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 4 }}>
                    {label} · {selected.namespace}
                </span>
            </div>

            {selected.kind === "pod"        && <PodDetail resource={selected} context={context} />}
            {selected.kind === "deployment" && <DeployDetail resource={selected} />}
            {selected.kind === "service"    && <ServiceDetail resource={selected} />}
            {selected.kind === "event"      && <EventDetail resource={selected} />}
        </div>
    );
}

function EventDetail({ resource }) {
    const isWarning = resource.type === "Warning";
    return (
        <div className="detail-body">
            <div className="detail-section">
                <h4>Event Detail</h4>
                <div className="kv-grid">
                    <KV label="Type"      value={resource.type} />
                    <KV label="Reason"    value={resource.reason} />
                    <KV label="Object"    value={resource.object} />
                    <KV label="Namespace" value={resource.namespace} />
                    <KV label="Count"     value={resource.count} />
                    <KV label="Last Seen" value={resource.last_seen} />
                </div>
            </div>
            <div className="detail-section">
                <h4>Message</h4>
                <div style={{
                    background: isWarning ? "#fff7ed" : "var(--surface2)",
                    border: `1px solid ${isWarning ? "#fed7aa" : "var(--border)"}`,
                    borderLeft: `4px solid ${isWarning ? "#d97706" : "#16a34a"}`,
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--text)",
                    wordBreak: "break-word",
                }}>
                    {resource.message}
                </div>
            </div>
        </div>
    );
}
