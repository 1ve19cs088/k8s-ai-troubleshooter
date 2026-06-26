import { useState, useEffect, useRef, useCallback } from "react";
import { streamLogs } from "../api/api";

function classifyLogLine(line) {
    const l = line.toLowerCase();
    if (/\b(error|err|fatal|exception|panic|critical|failed|failure)\b/.test(l)) return "error";
    if (/\b(warn|warning)\b/.test(l)) return "warn";
    if (/\b(info|notice)\b/.test(l)) return "info";
    if (/\b(debug|trace|verbose)\b/.test(l)) return "debug";
    return "default";
}

const LEVEL_STYLES = {
    error:   { border: "#dc2626", badge: "#fee2e2", badgeText: "#b91c1c", label: "ERR" },
    warn:    { border: "#d97706", badge: "#fef3c7", badgeText: "#92400e", label: "WARN" },
    info:    { border: "#2563eb", badge: "#eff6ff", badgeText: "#1d4ed8", label: "INFO" },
    debug:   { border: "#6b7280", badge: "#f3f4f6", badgeText: "#374151", label: "DBG" },
    default: { border: "#e2e6ef", badge: "#f8f9fc", badgeText: "#6b7280", label: "LOG" },
};

function parseLogLine(raw) {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/s);
    if (m) return { ts: m[1].replace("T", " ").slice(0, 19), msg: m[2] };
    return { ts: null, msg: raw };
}

function LogLine({ line }) {
    const level = classifyLogLine(line);
    const s = LEVEL_STYLES[level];
    const { ts, msg } = parseLogLine(line);
    return (
        <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "4px 10px", borderRadius: 5,
            borderLeft: `3px solid ${s.border}`,
            background: "var(--surface)", fontSize: 12, lineHeight: 1.45,
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

export default function LiveLogsView({ pods, selected, onSelect, context }) {
    const [lines, setLines]           = useState([]);
    const [streaming, setStreaming]   = useState(false);
    const [error, setError]           = useState(null);
    const [filter, setFilter]         = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [autoScroll, setAutoScroll] = useState(true);
    const [tailLines, setTailLines]   = useState(200);
    const esRef    = useRef(null);
    const bottomRef = useRef(null);

    // Auto-scroll when new lines come in
    useEffect(() => {
        if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [lines, autoScroll]);

    const startStream = useCallback((pod) => {
        esRef.current?.close();
        setLines([]);
        setError(null);
        setStreaming(true);

        esRef.current = streamLogs({
            namespace: pod.namespace,
            podName: pod.name,
            context,
            tailLines,
            onLine: (line) => setLines(prev => [...prev, line]),
            onError: (err) => { setError(err); setStreaming(false); },
        });

        esRef.current.addEventListener("error", () => setStreaming(false));
    }, [context, tailLines]);

    const stopStream = () => {
        esRef.current?.close();
        setStreaming(false);
    };

    // Auto-start when a running pod is selected
    useEffect(() => {
        if (!selected || selected.kind !== "pod") return;
        const canStream = selected.status === "Running" || selected.restarts > 0;
        if (canStream) startStream(selected);
        return () => { esRef.current?.close(); };
    }, [selected?.name, selected?.namespace]);

    const activePod = selected?.kind === "pod" ? selected : null;

    const counts = { error: 0, warn: 0, info: 0, debug: 0, default: 0 };
    lines.forEach(l => { counts[classifyLogLine(l)]++; });

    const filtered = lines.filter(line => {
        const level = classifyLogLine(line);
        const matchLevel = levelFilter === "all" || level === levelFilter;
        const matchText  = !filter || line.toLowerCase().includes(filter.toLowerCase());
        return matchLevel && matchText;
    });

    return (
        <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
            {/* Pod picker sidebar */}
            <div style={{
                width: 220, flexShrink: 0, borderRight: "1px solid var(--border)",
                overflowY: "auto", background: "var(--surface)",
                display: "flex", flexDirection: "column",
            }}>
                <div style={{ padding: "12px 14px 8px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                    Pods
                </div>
                {pods.length === 0 && (
                    <div style={{ padding: "20px 14px", fontSize: 12, color: "var(--text-muted)" }}>No pods found</div>
                )}
                {pods.map(pod => {
                    const isSelected = activePod?.name === pod.name && activePod?.namespace === pod.namespace;
                    const canStream  = pod.status === "Running" || pod.restarts > 0;
                    const statusColor = pod.status === "Running" ? "#4ade80" : pod.status === "Pending" ? "#fbbf24" : "#f87171";
                    return (
                        <button key={`${pod.namespace}/${pod.name}`}
                            onClick={() => onSelect({ kind: "pod", ...pod })}
                            style={{
                                textAlign: "left", padding: "9px 14px",
                                background: isSelected ? "var(--primary-light, #eff6ff)" : "transparent",
                                border: "none", borderLeft: isSelected ? "3px solid var(--primary, #2563eb)" : "3px solid transparent",
                                cursor: "pointer", display: "flex", flexDirection: "column", gap: 2,
                            }}
                        >
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", wordBreak: "break-all" }}>
                                {pod.name}
                            </span>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{pod.status}</span>
                                {!canStream && <span style={{ fontSize: 9, color: "#9ca3af" }}>no logs</span>}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Log content area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                {/* Toolbar */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                    borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, flexWrap: "wrap",
                }}>
                    {activePod ? (
                        <>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{activePod.name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4 }}>
                                {activePod.namespace}
                            </span>
                            {streaming && (
                                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#16a34a" }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s ease-in-out infinite" }} />
                                    Live
                                </span>
                            )}
                        </>
                    ) : (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Select a pod from the left</span>
                    )}

                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                        <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Tail</label>
                        <select value={tailLines} onChange={e => setTailLines(Number(e.target.value))}
                            style={{ fontSize: 11, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 5, background: "var(--surface2)", color: "var(--text)" }}>
                            {[50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>

                        {lines.length > 0 && (
                            <button onClick={() => setAutoScroll(v => !v)} style={{
                                padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                border: "1px solid var(--border)",
                                background: autoScroll ? "#eff6ff" : "var(--surface2)",
                                color: autoScroll ? "#2563eb" : "var(--text-muted)", cursor: "pointer",
                            }}>↓ {autoScroll ? "Auto" : "Manual"}</button>
                        )}
                        {lines.length > 0 && (
                            <button onClick={() => setLines([])} style={{
                                padding: "3px 9px", borderRadius: 6, fontSize: 11,
                                border: "1px solid var(--border)", background: "var(--surface2)",
                                color: "var(--text-muted)", cursor: "pointer",
                            }}>Clear</button>
                        )}
                        {activePod && (activePod.status === "Running" || activePod.restarts > 0) && (
                            streaming ? (
                                <button onClick={stopStream} style={{
                                    padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                    border: "1px solid #fca5a5", background: "#fee2e2", color: "#dc2626", cursor: "pointer",
                                }}>⏹ Stop</button>
                            ) : (
                                <button onClick={() => startStream(activePod)} style={{
                                    padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                    border: "1px solid #93c5fd", background: "#eff6ff", color: "#2563eb", cursor: "pointer",
                                }}>▶ Stream</button>
                            )
                        )}
                    </div>
                </div>

                {/* Level + text filter bar */}
                {lines.length > 0 && (
                    <div style={{ display: "flex", gap: 6, padding: "8px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0, flexWrap: "wrap", alignItems: "center", background: "var(--surface)" }}>
                        {["all", "error", "warn", "info", "debug"].map(lvl => {
                            const s = LEVEL_STYLES[lvl] || LEVEL_STYLES.default;
                            const cnt = lvl === "all" ? lines.length : counts[lvl];
                            const active = levelFilter === lvl;
                            return (
                                <button key={lvl} onClick={() => setLevelFilter(lvl)} style={{
                                    padding: "3px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                    border: active ? `1px solid ${s.border}` : "1px solid var(--border)",
                                    background: active ? s.badge : "var(--surface2)",
                                    color: active ? s.badgeText : "var(--text-muted)", cursor: "pointer",
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
                                fontSize: 11, background: "var(--surface2)", color: "var(--text)", width: 180,
                            }}
                        />
                    </div>
                )}

                {/* Log stream */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 3 }}
                    onScroll={e => {
                        const el = e.currentTarget;
                        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                        setAutoScroll(atBottom);
                    }}
                >
                    {!activePod && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>
                            Select a pod from the sidebar to stream its logs
                        </div>
                    )}
                    {activePod && !streaming && lines.length === 0 && !error && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8, color: "var(--text-muted)" }}>
                            {(activePod.status === "Running" || activePod.restarts > 0)
                                ? <><span style={{ fontSize: 24 }}>⟳</span><span>Starting stream…</span></>
                                : <><span style={{ fontSize: 24 }}>⚠</span><span>Pod is {activePod.status} — no logs available</span></>
                            }
                        </div>
                    )}
                    {error && (
                        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 8 }}>
                            ✕ {error}
                        </div>
                    )}
                    {filtered.map((line, i) => <LogLine key={i} line={line} />)}
                    <div ref={bottomRef} />
                </div>

                {/* Footer status */}
                {lines.length > 0 && (
                    <div style={{ padding: "4px 16px", fontSize: 10, color: "var(--text-muted)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexShrink: 0, background: "var(--surface)" }}>
                        <span>{streaming ? "● Streaming live" : "● Stopped"}</span>
                        <span>Showing {filtered.length} / {lines.length} lines</span>
                    </div>
                )}
            </div>
        </div>
    );
}
