export default function SummaryCards({ pods, deployments, services, events }) {
    const unhealthyPods = pods.filter(p => p.status !== "Running").length;
    const unhealthyDeploys = deployments.filter(d => d.ready < d.desired).length;
    const warnings = events.filter(e => e.type === "Warning").length;

    return (
        <div className="summary-grid">
            <div className="summary-card">
                <div className="summary-icon pods">☸</div>
                <div className="summary-info">
                    <h3>{pods.length}</h3>
                    <p>Pods {unhealthyPods > 0 ? `· ${unhealthyPods} unhealthy` : "· all running"}</p>
                </div>
            </div>
            <div className="summary-card">
                <div className="summary-icon deployments">⬡</div>
                <div className="summary-info">
                    <h3>{deployments.length}</h3>
                    <p>Deployments {unhealthyDeploys > 0 ? `· ${unhealthyDeploys} degraded` : "· all ready"}</p>
                </div>
            </div>
            <div className="summary-card">
                <div className="summary-icon services">⇄</div>
                <div className="summary-info">
                    <h3>{services.length}</h3>
                    <p>Services</p>
                </div>
            </div>
            <div className="summary-card">
                <div className="summary-icon events">⚡</div>
                <div className="summary-info">
                    <h3>{events.length}</h3>
                    <p>Events {warnings > 0 ? `· ${warnings} warnings` : ""}</p>
                </div>
            </div>
        </div>
    );
}
