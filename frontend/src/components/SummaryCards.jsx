export default function SummaryCards() {

    const cards = [
        { title: "Running Pods", value: 4 },
        { title: "Failed Pods", value: 7 },
        { title: "Pending Pods", value: 1 },
        { title: "Deployments", value: 8 },
    ];

    return (
        <div className="summary-grid">

            {cards.map((card) => (

                <div className="summary-card" key={card.title}>

                    <h3>{card.title}</h3>

                    <h1>{card.value}</h1>

                </div>

            ))}

        </div>
    );

}