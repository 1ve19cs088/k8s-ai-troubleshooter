import axios from "axios";

const api = axios.create({
    baseURL: "http://127.0.0.1:8000"
});

// Get all pods
export const getPods = async () => {
    const response = await api.get("/pods");
    return response.data;
};

// Analyze a pod
export const analyzePod = async (podName) => {
    const response = await api.get(`/analyze/${podName}`);
    return response.data;
};

// Get pod logs
export const getLogs = async (podName) => {
    const response = await api.get(`/logs/${podName}`);
    return response.data;
};

export default api;