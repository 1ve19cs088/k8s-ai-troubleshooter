export default function PodList({

    pods,
    selectedPod,
    setSelectedPod

}) {

    return (

        <div className="panel">

            <h2>Pods</h2>

            {pods.length === 0 ? (

                <p>Loading pods...</p>

            ) : (

                pods.map((pod) => (

                    <button

                        key={pod.name}

                        className={`pod-button ${selectedPod === pod.name ? "selected" : ""}`}

                        onClick={() => setSelectedPod(pod.name)}

                    >

                        {pod.name}

                    </button>

                ))

            )}

        </div>

    );

}