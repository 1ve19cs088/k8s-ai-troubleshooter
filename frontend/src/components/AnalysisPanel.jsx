export default function AnalysisPanel({ selectedPod, analysis }) {

    if (!selectedPod) {

        return (

            <div className="panel analysis-panel">

                <h2>🤖 AI Kubernetes Diagnosis</h2>

                <div className="empty-state">

                    <h3>No Pod Selected</h3>

                    <p>
                        Select any pod from the left panel.
                    </p>

                    <p>
                        The AI engine will inspect:
                    </p>

                    <ul>
                        <li>📦 Pod Status</li>
                        <li>📋 Kubernetes Events</li>
                        <li>📜 Container Logs</li>
                        <li>⚙ Kubernetes Resources</li>
                    </ul>

                </div>

            </div>

        );

    }

    return (

        <div className="panel analysis-panel">

            <h2>🤖 AI Kubernetes Diagnosis</h2>

            <div className="analysis-section">

                <h4>📦 Pod</h4>

                <p>{selectedPod}</p>

            </div>

            <div className="analysis-section">

                <h4>⚠ Issue</h4>

                <p>{analysis?.issue || "Waiting for backend..."}</p>

            </div>

            <div className="analysis-section">

                <h4>🔥 Severity</h4>

                <span className="severity-badge">

                    {analysis?.severity || "Unknown"}

                </span>

            </div>

            <div className="analysis-section">

                <h4>💡 Root Cause</h4>

                <p>

                    {analysis?.root_cause ||
                        "The AI diagnosis will appear here after backend integration."}

                </p>

            </div>

            <div className="analysis-section">

                <h4>✅ Recommendations</h4>

                {analysis?.recommendation ? (

                    <ul>

                        {analysis.recommendation.map((item, index) => (

                            <li key={index}>{item}</li>

                        ))}

                    </ul>

                ) : (

                    <ul>

                        <li>Waiting for AI recommendations...</li>

                    </ul>

                )}

            </div>

        </div>

    );

}