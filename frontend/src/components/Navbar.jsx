import { useState } from "react";

const PROVIDERS = [
    {
        id: "anthropic",
        name: "Anthropic",
        logo: "🟣",
        placeholder: "sk-ant-api03-...",
        link: "https://console.anthropic.com/settings/keys",
        linkLabel: "console.anthropic.com",
        models: [
            { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fastest, cheapest)" },
            { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6 (balanced)" },
            { id: "claude-opus-4-8",           label: "Claude Opus 4.8 (most capable)" },
        ],
        hint: "Paid — ~$0.00025 / 1K tokens with Haiku",
    },
    {
        id: "openai",
        name: "OpenAI",
        logo: "🟢",
        placeholder: "sk-proj-...",
        link: "https://platform.openai.com/api-keys",
        linkLabel: "platform.openai.com",
        models: [
            { id: "gpt-4o-mini", label: "GPT-4o Mini (fastest, cheapest)" },
            { id: "gpt-4o",      label: "GPT-4o (most capable)" },
            { id: "o4-mini",     label: "o4-mini (reasoning)" },
        ],
        hint: "Paid — ~$0.00015 / 1K tokens with GPT-4o Mini",
    },
    {
        id: "github",
        name: "GitHub Models",
        logo: "⚫",
        placeholder: "ghp_... or github_pat_...",
        link: "https://github.com/settings/tokens",
        linkLabel: "github.com/settings/tokens",
        models: [
            { id: "gpt-4o-mini",      label: "GPT-4o Mini" },
            { id: "gpt-4o",           label: "GPT-4o" },
            { id: "Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" },
            { id: "Mistral-large-2411", label: "Mistral Large" },
        ],
        hint: "Free with a GitHub account — rate limited. Create a PAT with no extra scopes.",
    },
];

function getLLMSettings() {
    try {
        return JSON.parse(localStorage.getItem("llm_settings") || "{}");
    } catch {
        return {};
    }
}

function saveLLMSettings(settings) {
    localStorage.setItem("llm_settings", JSON.stringify(settings));
}

function LLMModal({ onClose }) {
    const saved = getLLMSettings();
    const [provider, setProvider] = useState(saved.provider || "anthropic");
    const [apiKey, setApiKey] = useState(saved.api_key || "");
    const [model, setModel] = useState(saved.model || "");
    const [showKey, setShowKey] = useState(false);

    const providerDef = PROVIDERS.find(p => p.id === provider);
    const defaultModel = providerDef?.models[0]?.id || "";

    const save = () => {
        saveLLMSettings({
            provider,
            api_key: apiKey.trim(),
            model: model || defaultModel,
        });
        window.location.reload();
    };

    const clear = () => {
        localStorage.removeItem("llm_settings");
        window.location.reload();
    };

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
            <div style={{
                background: "#fff", borderRadius: 14, padding: "28px 30px",
                width: 480, boxShadow: "0 24px 64px rgba(0,0,0,.35)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 17, margin: 0 }}>AI Provider Settings</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
                </div>

                {/* Provider tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {PROVIDERS.map(p => (
                        <button key={p.id} onClick={() => { setProvider(p.id); setModel(""); setApiKey(""); }}
                            style={{
                                flex: 1, padding: "9px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: provider === p.id ? "2px solid #2563eb" : "2px solid #e2e6ef",
                                background: provider === p.id ? "#eff6ff" : "#f8f9fc",
                                color: provider === p.id ? "#1d4ed8" : "#374151",
                                cursor: "pointer",
                            }}>
                            {p.logo} {p.name}
                        </button>
                    ))}
                </div>

                {/* Provider info */}
                <div style={{
                    background: "#f8f9fc", border: "1px solid #e2e6ef",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#374151",
                }}>
                    <strong>{providerDef?.hint}</strong>
                    <br />
                    Get a key at{" "}
                    <a href={providerDef?.link} target="_blank" rel="noreferrer"
                        style={{ color: "#2563eb" }}>{providerDef?.linkLabel}</a>
                </div>

                {/* API Key */}
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    API Key
                </label>
                <div style={{ position: "relative", marginBottom: 14 }}>
                    <input
                        type={showKey ? "text" : "password"}
                        placeholder={providerDef?.placeholder}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        style={{
                            width: "100%", padding: "9px 38px 9px 12px",
                            border: "1px solid #d1d5db", borderRadius: 7,
                            fontSize: 13, fontFamily: "monospace",
                            boxSizing: "border-box",
                        }}
                        autoFocus
                    />
                    <button onClick={() => setShowKey(v => !v)} style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6b7280",
                    }}>{showKey ? "🙈" : "👁"}</button>
                </div>

                {/* Model selector */}
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Model
                </label>
                <select
                    value={model || defaultModel}
                    onChange={e => setModel(e.target.value)}
                    style={{
                        width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
                        borderRadius: 7, fontSize: 13, marginBottom: 20, background: "#fff",
                    }}
                >
                    {providerDef?.models.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                </select>

                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 18 }}>
                    🔒 Stored only in your browser's localStorage. Sent only to your local backend (localhost:8000) — never to any third party.
                </p>

                <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <button onClick={clear} style={{
                        padding: "8px 14px", border: "1px solid #fca5a5", borderRadius: 7,
                        background: "#fff5f5", color: "#dc2626", fontSize: 12, cursor: "pointer",
                    }}>Clear saved key</button>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={onClose} style={{
                            padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 7,
                            background: "#fff", fontSize: 13, cursor: "pointer",
                        }}>Cancel</button>
                        <button onClick={save} disabled={!apiKey.trim()} style={{
                            padding: "8px 18px", border: "none", borderRadius: 7,
                            background: apiKey.trim() ? "#2563eb" : "#93c5fd",
                            color: "#fff", fontSize: 13, cursor: apiKey.trim() ? "pointer" : "not-allowed",
                            fontWeight: 700,
                        }}>Save & Apply</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { getLLMSettings };

export default function Navbar({
    currentContext, contexts, onContextChange,
    namespace, namespaces, onNamespaceChange,
    onRefresh, loading,
    viewTab, onViewTab,
}) {
    const [showModal, setShowModal] = useState(false);
    const settings = getLLMSettings();
    const hasKey = !!settings.api_key;
    const providerDef = PROVIDERS.find(p => p.id === settings.provider);

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    <path d="M2 12h20"/>
                </svg>
                K8s AI Troubleshooter
            </div>

            <div className="navbar-divider" />

            {/* View tabs */}
            <div style={{ display: "flex", gap: 2 }}>
                {[
                    { id: "cluster", label: "☸ Cluster" },
                    { id: "logs",    label: "▶ Logs" },
                    { id: "events",  label: "⚡ Events" },
                ].map(v => (
                    <button key={v.id} onClick={() => onViewTab(v.id)} style={{
                        padding: "4px 13px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid transparent",
                        background: viewTab === v.id ? "rgba(37,99,235,.15)" : "transparent",
                        color: viewTab === v.id ? "#93c5fd" : "rgba(255,255,255,.6)",
                        cursor: "pointer",
                    }}>{v.label}</button>
                ))}
            </div>

            <div className="navbar-divider" />

            <div className="navbar-controls">
                {currentContext && (
                    <div className="context-badge">
                        <span className="context-dot" />
                        {currentContext}
                    </div>
                )}
                {contexts.length > 1 && (
                    <select className="nav-select" value={currentContext}
                        onChange={e => onContextChange(e.target.value)} title="Switch cluster context">
                        {contexts.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                )}
                <select className="nav-select" value={namespace}
                    onChange={e => onNamespaceChange(e.target.value)} title="Select namespace">
                    <option value="all">All namespaces</option>
                    {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                </select>
            </div>

            <div className="navbar-spacer" />

            {/* LLM status chip */}
            <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: hasKey ? "rgba(74,222,128,.12)" : "rgba(239,68,68,.12)",
                border: `1px solid ${hasKey ? "rgba(74,222,128,.35)" : "rgba(239,68,68,.35)"}`,
                borderRadius: 7, color: hasKey ? "#4ade80" : "#fca5a5",
                padding: "4px 12px", fontSize: 12, cursor: "pointer", marginRight: 6,
            }} title="AI provider settings">
                {hasKey
                    ? <>{providerDef?.logo} {providerDef?.name} · {settings.model?.split("-").slice(0,2).join("-")}</>
                    : "⚠ Connect AI"}
            </button>

            <button className="nav-refresh-btn" onClick={onRefresh} disabled={loading}>
                {loading ? "⟳ Refreshing..." : "⟳ Refresh"}
            </button>

            {showModal && <LLMModal onClose={() => setShowModal(false)} />}
        </nav>
    );
}
