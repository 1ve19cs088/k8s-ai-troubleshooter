import { useState, useEffect } from "react";

import Navbar from "../components/Navbar";
import SummaryCards from "../components/SummaryCards";
import PodList from "../components/PodList";
import AnalysisPanel from "../components/AnalysisPanel";

import { analyzePod, getPods } from "../api/api";

export default function Dashboard() {

    const [pods, setPods] = useState([]);
    const [selectedPod, setSelectedPod] = useState(null);
    const [analysis, setAnalysis] = useState(null);

    // Load pods from backend
    useEffect(() => {

        async function loadPods() {

            try {

                const result = await getPods();
                setPods(result);

            } catch (err) {

                console.error(err);

            }

        }

        loadPods();

    }, []);

    // Analyze selected pod
    useEffect(() => {

        if (!selectedPod) return;

        async function fetchAnalysis() {

            try {

                const result = await analyzePod(selectedPod);
                console.log("Pods from backend:", result);

                setAnalysis(result);

            } catch (error) {

                console.error(error);

                setAnalysis({
                    error: "Unable to analyze pod."
                });

            }

        }

        fetchAnalysis();

    }, [selectedPod]);

    return (

        <div>

            <Navbar />

            <div className="container">

                <SummaryCards />

                <div className="main-grid">

                    <PodList
                        pods={pods}
                        selectedPod={selectedPod}
                        setSelectedPod={setSelectedPod}
                    />

                    <AnalysisPanel
                        selectedPod={selectedPod}
                        analysis={analysis}
                    />

                </div>

            </div>

        </div>

    );

}