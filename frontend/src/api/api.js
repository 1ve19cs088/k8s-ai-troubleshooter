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
