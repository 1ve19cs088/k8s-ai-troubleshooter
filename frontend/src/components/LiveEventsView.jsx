import { useState, useEffect, useRef } from "react";
import { getEvents } from "../api/api";

const POLL_INTERVAL = 5000;

function timeAgo(dateStr) {
    if (!dateStr) return "—";
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveEventsView({ context, namespace }) {
    const [events, setEvents]     = useState([]);
    const [loading, setLoading]   = useState(false);
    const [lastFetch, setLastFetch] = useState(null);
    const [error, setError]       = useState(null);
    const [filter, setFilter]     = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [autoScroll, setAutoScroll] = useState(false);
    const intervalRef = useRef(null);
    const bottomRef   = useRef(null);

    const fetchEvents = async () => {
        if (!context) return;
        setLoading(true);
        try {
            const data = await getEvents(context, namespace);
            setEvents(data);
            setLastFetch(new Date());
            setError(null);
        } catch (e) {
            setError(e.message);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();
        intervalRef.current = setInterval(fetchEvents, POLL_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, [context, namespace]);

    useEffect(() => {
        if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [events, autoScroll]);

    const filtered = events.filter(e => {
        const matchType = typeFilter === "all" || e.type?.toLowerCase() === typeFilter;
        const matchText = !filter || [e.reason, e.message, e.object, e.namespace]
            .join(" ").toLowerCase().includes(filter.toLowerCase());
        return matchType && matchText;
    });

    const warningCount = events.filter(e => e.type === "Warning").length;
    const normalCount  = events.filter(e => e.type === "Normal").length;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, flexWrap: "wrap",
            }}>
                {/* Live indicator */}
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "#fbbf24" : "#4ade80", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                    Live · every 5s
                </span>

                {lastFetch && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Updated {lastFetch.toLocaleTimeString()}
                    </span>
                )}

                <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                    {["all", "warning", "normal"].map(t => {
                        const active = typeFilter === t;
                        const color = t === "warning" ? { bg: "#fff7ed", border: "#d97706", text: "#92400e" }
                                    : t === "normal"  ? { bg: "#f0fdf4", border: "#16a34a", text: "#166534" }
                                    : { bg: "var(--surface2)", border: "var(--border)", text: "var(--text-muted)" };
                        const cnt = t === "all" ? events.length : t === "warning" ? warningCount : normalCount;
                        return (
                            <button key={t} onClick={() => setTypeFilter(t)} style={{
                                padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                border: `1px solid ${active ? color.border : "var(--border)"}`,
                                background: active ? color.bg : "var(--surface2)",
                                color: active ? color.text : "var(--text-muted)", cursor: "pointer",
                            }}>
                                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)} ({cnt})
                            </button>
                        );
                    })}
                </div>

                <input
                    placeholder="Search events…"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        marginLeft: "auto", padding: "3px 10px",
                        border: "1px solid var(--border)", borderRadius: 6,
                        fontSize: 11, background: "var(--surface2)", color: "var(--text)", width: 200,
                    }}
                />

                <button onClick={fetchEvents} disabled={loading} style={{
                    padding: "3px 10px", borderRadius: 6, fontSize: 11,
                    border: "1px solid var(--border)", background: "var(--surface2)",
                    color: "var(--text-muted)", cursor: loading ? "default" : "pointer",
                }}>
                    {loading ? "⟳" : "⟳ Refresh"}
                </button>
            </div>

            {error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", padding: "8px 16px", fontSize: 12, color: "#dc2626", flexShrink: 0 }}>
                    ✕ {error}
                </div>
            )}

            {/* Column headers */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "80px 120px 1fr 200px 80px",
                gap: 0, padding: "6px 16px",
                background: "var(--surface2)", borderBottom: "1px solid var(--border)",
                fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0,
            }}>
                <span>Type</span>
                <span>Reason</span>
                <span>Message</span>
                <span>Object</span>
                <span>Last Seen</span>
            </div>

            {/* Event rows */}
            <div style={{ flex: 1, overflowY: "auto" }}
                onScroll={e => {
                    const el = e.currentTarget;
                    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                    setAutoScroll(atBottom);
                }}
            >
                {filtered.length === 0 && !loading && (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                        {events.length === 0 ? "No events in this namespace" : "No events match the filter"}
                    </div>
                )}
                {filtered.map((e, i) => {
                    const isWarning = e.type === "Warning";
                    return (
                        <div key={i} style={{
                            display: "grid",
                            gridTemplateColumns: "80px 120px 1fr 200px 80px",
                            gap: 0, padding: "7px 16px",
                            borderBottom: "1px solid var(--border)",
                            background: isWarning ? "rgba(251,191,36,.06)" : "transparent",
                            borderLeft: `3px solid ${isWarning ? "#d97706" : "#16a34a"}`,
                            alignItems: "start",
                            fontSize: 12,
                        }}>
                            <span style={{
                                fontWeight: 700, fontSize: 10,
                                color: isWarning ? "#92400e" : "#166534",
                                background: isWarning ? "#fef3c7" : "#dcfce7",
                                border: `1px solid ${isWarning ? "#fde68a" : "#bbf7d0"}`,
                                borderRadius: 4, padding: "1px 6px", display: "inline-block",
                            }}>
                                {e.type || "—"}
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 11 }}>{e.reason || "—"}</span>
                            <span style={{ color: "var(--text)", lineHeight: 1.4, wordBreak: "break-word" }}>{e.message || "—"}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
                                {e.object || "—"}
                                {e.namespace && e.namespace !== namespace && (
                                    <span style={{ display: "block", fontSize: 9, opacity: 0.7 }}>{e.namespace}</span>
                                )}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                {e.last_seen ? timeAgo(e.last_seen) : "—"}
                                {e.count > 1 && <span style={{ display: "block", fontSize: 9, color: "#d97706" }}>×{e.count}</span>}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Footer */}
            <div style={{ padding: "4px 16px", fontSize: 10, color: "var(--text-muted)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexShrink: 0, background: "var(--surface)" }}>
                <span>● Polling every 5s</span>
                <span>Showing {filtered.length} / {events.length} events · {warningCount} warnings</span>
            </div>
        </div>
    );
}
