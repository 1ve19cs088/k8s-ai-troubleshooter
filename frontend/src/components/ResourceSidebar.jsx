import { useState } from "react";

function statusBadge(status) {
    const s = (status || "").toLowerCase();
    if (s === "running") return <span className="badge badge-running">● Running</span>;
    if (s === "pending") return <span className="badge badge-pending">◌ Pending</span>;
    if (s === "failed") return <span className="badge badge-failed">✕ Failed</span>;
    return <span className="badge badge-unknown">{status}</span>;
}

function deployBadge(d) {
    if (d.ready >= d.desired && d.desired > 0) return <span className="badge badge-running">● Ready</span>;
    if (d.ready === 0) return <span className="badge badge-failed">✕ Down</span>;
    return <span className="badge badge-pending">◌ Degraded</span>;
}

export default function ResourceSidebar({
    tab, setTab,
    pods, deployments, services,
    selected, onSelect,
}) {
    const [search, setSearch] = useState("");

    const TABS = ["Pods", "Deploys", "Services"];

    const filteredPods = pods.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );
    const filteredDeploys = deployments.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase())
    );
    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );
    return (
        <div className="sidebar">
            <div className="sidebar-tabs">
                {TABS.map(t => (
                    <button
                        key={t}
                        className={`sidebar-tab ${tab === t ? "active" : ""}`}
                        onClick={() => { setTab(t); onSelect(null); }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="sidebar-search">
                <input
                    placeholder="Filter..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="sidebar-list">
                {tab === "Pods" && filteredPods.map(p => (
                    <div
                        key={`${p.namespace}/${p.name}`}
                        className={`resource-item ${selected?.name === p.name && selected?.namespace === p.namespace ? "selected" : ""}`}
                        onClick={() => onSelect({ kind: "pod", ...p })}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="resource-item-name" title={p.name}>{p.name}</div>
                            <div className="resource-item-ns">{p.namespace}</div>
                        </div>
                        {statusBadge(p.status)}
                        {p.restarts > 0 && (
                            <span className="badge badge-warning" style={{ fontSize: 10 }}>
                                {p.restarts}↺
                            </span>
                        )}
                    </div>
                ))}

                {tab === "Deploys" && filteredDeploys.map(d => (
                    <div
                        key={`${d.namespace}/${d.name}`}
                        className={`resource-item ${selected?.name === d.name && selected?.namespace === d.namespace ? "selected" : ""}`}
                        onClick={() => onSelect({ kind: "deployment", ...d })}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="resource-item-name" title={d.name}>{d.name}</div>
                            <div className="resource-item-ns">{d.namespace}</div>
                        </div>
                        {deployBadge(d)}
                        <span className="resource-item-ns">{d.ready}/{d.desired}</span>
                    </div>
                ))}

                {tab === "Services" && filteredServices.map(s => (
                    <div
                        key={`${s.namespace}/${s.name}`}
                        className={`resource-item ${selected?.name === s.name && selected?.namespace === s.namespace ? "selected" : ""}`}
                        onClick={() => onSelect({ kind: "service", ...s })}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="resource-item-name" title={s.name}>{s.name}</div>
                            <div className="resource-item-ns">{s.namespace}</div>
                        </div>
                        <span className="badge badge-unknown" style={{ fontSize: 10 }}>{s.type}</span>
                    </div>
                ))}

                {((tab === "Pods" && filteredPods.length === 0) ||
                  (tab === "Deploys" && filteredDeploys.length === 0) ||
                  (tab === "Services" && filteredServices.length === 0)) && (
                    <div className="empty-state" style={{ padding: "30px 10px" }}>
                        <div className="icon">◎</div>
                        <p>No {tab.toLowerCase()} found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
