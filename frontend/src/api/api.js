import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:8000" });

// ── Context & Namespaces ──────────────────────────
export const getContexts = () => api.get("/contexts").then(r => r.data);

export const getNamespaces = (context) =>
    api.get("/namespaces", { params: { context } }).then(r => r.data);

// ── Resources ─────────────────────────────────────
export const getPods = (context, namespace) =>
    api.get("/pods", { params: { context, namespace } }).then(r => r.data);

export const getDeployments = (context, namespace) =>
    api.get("/deployments", { params: { context, namespace } }).then(r => r.data);

export const getServices = (context, namespace) =>
    api.get("/services", { params: { context, namespace } }).then(r => r.data);

export const getEvents = (context, namespace) =>
    api.get("/events", { params: { context, namespace } }).then(r => r.data);

export const getPodDetail = (namespace, podName, context) =>
    api.get(`/pod/${namespace}/${podName}`, { params: { context } }).then(r => r.data);

export const getLogs = (namespace, podName, context, tailLines = 100) =>
    api.get(`/logs/${namespace}/${podName}`, { params: { context, tail_lines: tailLines } }).then(r => r.data);

// Returns an EventSource for live streaming — caller must call .close() to stop
export function streamLogs({ namespace, podName, context, tailLines = 100, container, onLine, onError }) {
    const params = new URLSearchParams({ tail_lines: tailLines });
    if (context)   params.set("context", context);
    if (container) params.set("container", container);
    const url = `http://127.0.0.1:8000/logs/stream/${namespace}/${podName}?${params}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.error) { onError?.(data.error); es.close(); }
            else onLine?.(data.line);
        } catch { onLine?.(e.data); }
    };
    es.onerror = () => { onError?.("Stream disconnected"); es.close(); };
    return es;
}

// ── AI ────────────────────────────────────────────
function withLLM(payload) {
    try {
        const s = JSON.parse(localStorage.getItem("llm_settings") || "{}");
        return {
            ...payload,
            api_key: s.api_key || "",
            provider: s.provider || "anthropic",
            model: s.model || "",
        };
    } catch {
        return payload;
    }
}

export const aiAnalyze = (payload) =>
    api.post("/ai/analyze", withLLM(payload)).then(r => r.data);

export const aiChat = (payload) =>
    api.post("/ai/chat", withLLM(payload)).then(r => r.data);

export default api;
