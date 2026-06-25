import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import SummaryCards from "../components/SummaryCards";
import ResourceSidebar from "../components/ResourceSidebar";
import DetailPanel from "../components/DetailPanel";
import AIPanel from "../components/AIPanel";

import {
    getContexts,
    getNamespaces,
    getPods,
    getDeployments,
    getServices,
    getEvents,
} from "../api/api";

export default function Dashboard() {
    // Context / namespace
    const [contexts, setContexts] = useState([]);
    const [currentContext, setCurrentContext] = useState(null);
    const [namespaces, setNamespaces] = useState([]);
    const [namespace, setNamespace] = useState("default");

    // Resources
    const [pods, setPods] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [services, setServices] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [clusterError, setClusterError] = useState(null);

    // UI state
    const [tab, setTab] = useState("Pods");
    const [selected, setSelected] = useState(null);

    // Load contexts once on mount
    useEffect(() => {
        getContexts()
            .then(data => {
                setContexts(data.contexts);
                setCurrentContext(data.current);
            })
            .catch(console.error);
    }, []);

    // Load namespaces when context changes
    useEffect(() => {
        if (!currentContext) return;
        getNamespaces(currentContext)
            .then(ns => {
                setNamespaces(ns);
                if (!ns.includes(namespace)) setNamespace("default");
            })
            .catch(console.error);
    }, [currentContext]);

    // Load all resources
    const loadResources = useCallback(async () => {
        if (!currentContext) return;
        setLoading(true);
        try {
            setClusterError(null);
            const [p, d, s, e] = await Promise.all([
                getPods(currentContext, namespace),
                getDeployments(currentContext, namespace),
                getServices(currentContext, namespace),
                getEvents(currentContext, namespace),
            ]);
            setPods(p);
            setDeployments(d);
            setServices(s);
            setEvents(e);
        } catch (err) {
            const msg = err.response?.data?.detail || err.message;
            setClusterError(msg);
        }
        setLoading(false);
    }, [currentContext, namespace]);

    useEffect(() => {
        loadResources();
    }, [loadResources]);

    const handleContextChange = (ctx) => {
        setCurrentContext(ctx);
        setSelected(null);
    };

    const handleNamespaceChange = (ns) => {
        setNamespace(ns);
        setSelected(null);
    };

    return (
        <>
            <Navbar
                currentContext={currentContext}
                contexts={contexts}
                onContextChange={handleContextChange}
                namespace={namespace}
                namespaces={namespaces}
                onNamespaceChange={handleNamespaceChange}
                onRefresh={loadResources}
                loading={loading}
            />

            {clusterError && (
                <div style={{ background: "#fee2e2", borderLeft: "4px solid #dc2626", padding: "10px 24px", fontSize: 13, color: "#7f1d1d" }}>
                    ⚠ Cannot reach cluster: {clusterError} — switch to a running context above
                </div>
            )}

            <div className="main-content" style={{ padding: "16px 24px", height: "auto", overflow: "visible" }}>
                <SummaryCards
                    pods={pods}
                    deployments={deployments}
                    services={services}
                    events={events}
                />
            </div>

            <div className="app-layout" style={{ height: "calc(100vh - 56px - 110px)" }}>
                <ResourceSidebar
                    tab={tab}
                    setTab={setTab}
                    pods={pods}
                    deployments={deployments}
                    services={services}
                    events={events}
                    selected={selected}
                    onSelect={setSelected}
                />

                <div style={{ overflowY: "auto", overflowX: "hidden", padding: 16, minHeight: 0 }}>
                    <DetailPanel selected={selected} context={currentContext} />
                </div>

                <AIPanel selected={selected} context={currentContext} />
            </div>
        </>
    );
}
