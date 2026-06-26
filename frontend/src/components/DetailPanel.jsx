import { useState, useEffect } from "react";
import { getPodDetail } from "../api/api";

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
            )}

            {/* Hint to dedicated tabs */}
            <div style={{
                margin: "8px 0", padding: "12px 16px",
                background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 12, color: "var(--text-muted)",
                display: "flex", gap: 16,
            }}>
                <span>▶ <strong style={{ color: "var(--text)" }}>Logs tab</strong> — live streaming logs for this pod</span>
                <span>⚡ <strong style={{ color: "var(--text)" }}>Events tab</strong> — cluster-wide live event feed</span>
            </div>
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
