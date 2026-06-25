import { useState, useRef, useEffect } from "react";
import { aiAnalyze, aiChat } from "../api/api";

function severityClass(s) {
    const m = { healthy: "severity-healthy", low: "severity-low", medium: "severity-medium", high: "severity-high", critical: "severity-critical" };
    return m[(s || "").toLowerCase()] || "severity-medium";
}

function AnalysisCard({ data }) {
    return (
        <div className="ai-result-card">
            <span className={`ai-result-severity ${severityClass(data.severity)}`}>
                {data.severity || "Unknown"}
            </span>
            <p style={{ fontSize: 13, marginBottom: 8 }}>{data.summary}</p>

            {data.issues?.length > 0 && (
                <div className="ai-result-section">
                    <strong>Issues</strong>
                    <ul className="ai-result-list">
                        {data.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                    </ul>
                </div>
            )}

            {data.root_cause && data.root_cause !== "None detected" && (
                <div className="ai-result-section" style={{ marginTop: 6 }}>
                    <strong>Root Cause</strong>
                    <p style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>{data.root_cause}</p>
                </div>
            )}

            {data.recommendations?.length > 0 && (
                <div className="ai-result-section">
                    <strong>Recommendations</strong>
                    <ul className="ai-result-list">
                        {data.recommendations.map((r, idx) => <li key={idx}>{r}</li>)}
                    </ul>
                </div>
            )}

            {data.kubectl_commands?.length > 0 && (
                <div className="ai-result-section">
                    <strong>kubectl Commands</strong>
                    {data.kubectl_commands.map((cmd, idx) => (
                        <code key={idx} className="kubectl-cmd">{cmd}</code>
                    ))}
                </div>
            )}
        </div>
    );
}

function renderMessage(msg) {
    if (msg.analysisData) return <AnalysisCard data={msg.analysisData} />;
    // Simple markdown: bold, inline code, code blocks, newlines
    const text = msg.text || "";
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
            return <pre key={i}><code>{part.slice(3, -3).replace(/^\w*\n/, "")}</code></pre>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part.split("\n").map((line, j, arr) => (
            <span key={`${i}-${j}`}>{line}{j < arr.length - 1 ? <br /> : null}</span>
        ));
    });
}

export default function AIPanel({ selected, context }) {
    const llmSettings = (() => { try { return JSON.parse(localStorage.getItem("llm_settings") || "{}"); } catch { return {}; } })();
    const hasKey = !!llmSettings.api_key;

    const [messages, setMessages] = useState([
        {
            role: "assistant",
            text: hasKey
                ? `Hi! I'm your K8s AI assistant powered by **${llmSettings.provider || "AI"}**. Select a resource and click **Analyze** to diagnose it, or ask me anything about your cluster.`
                : "Hi! I'm your K8s AI assistant. Click **⚠ Connect AI** in the navbar to connect a provider (Anthropic, OpenAI, or GitHub Models), then select a resource and hit **Analyze**.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const runAnalysis = async () => {
        if (!selected || loading) return;
        const label = `Analyzing ${selected.type} "${selected.name}"…`;
        setMessages(m => [...m, { role: "user", text: `Analyze ${selected.type}: ${selected.name}` }]);
        setLoading(true);
        try {
            const result = await aiAnalyze({
                resource_type: selected.type,
                resource_name: selected.name,
                namespace: selected.namespace,
                context,
            });
            setMessages(m => [...m, { role: "assistant", analysisData: result }]);
        } catch (err) {
            setMessages(m => [...m, { role: "assistant", text: `Error: ${err.response?.data?.detail || err.message}` }]);
        }
        setLoading(false);
    };

    const sendChat = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput("");
        setMessages(m => [...m, { role: "user", text: userMsg }]);
        setLoading(true);
        try {
            const result = await aiChat({
                message: userMsg,
                context,
                resource_context: selected ? {
                    type: selected.type,
                    name: selected.name,
                    namespace: selected.namespace,
                    status: selected.status || selected.ready,
                } : null,
            });
            setMessages(m => [...m, { role: "assistant", text: result.response }]);
        } catch (err) {
            setMessages(m => [...m, { role: "assistant", text: `Error: ${err.response?.data?.detail || err.message}` }]);
        }
        setLoading(false);
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    };

    return (
        <div className="ai-panel">
            <div className="ai-panel-header">
                <span style={{ fontSize: 18 }}>✦</span>
                <h3>AI Troubleshooter</h3>
                <div className="ai-dot" />
            </div>

            <div className="ai-analyze-bar">
                <button
                    className="ai-analyze-btn"
                    onClick={runAnalysis}
                    disabled={!selected || loading}
                    title={selected ? `Analyze ${selected.name}` : "Select a resource first"}
                >
                    {loading ? "⟳ Analyzing..." : selected ? `✦ Analyze ${selected.name}` : "✦ Select a resource to analyze"}
                </button>
            </div>

            <div className="ai-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`ai-message ${msg.role}`}>
                        <div className={`ai-avatar ${msg.role}`}>
                            {msg.role === "assistant" ? "✦" : "U"}
                        </div>
                        <div className={`ai-bubble ${msg.role}`}>
                            {renderMessage(msg)}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="ai-message assistant">
                        <div className="ai-avatar assistant">✦</div>
                        <div className="ai-bubble assistant" style={{ color: "var(--text-muted)" }}>
                            <span className="spinner" /> Thinking...
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="ai-chat-input">
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask about your cluster… (Enter to send)"
                    disabled={loading}
                />
                <button className="ai-send-btn" onClick={sendChat} disabled={loading || !input.trim()}>
                    ↑
                </button>
            </div>
        </div>
    );
}
