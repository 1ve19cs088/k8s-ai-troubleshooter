# K8s AI Troubleshooter

An AI-powered Kubernetes troubleshooting dashboard for developers and DevOps engineers. Instead of running `kubectl` commands manually, get a live visual view of your cluster — pods, deployments, services, and events — and diagnose issues instantly with AI.

![K8s AI Troubleshooter](https://img.shields.io/badge/K8s-AI%20Troubleshooter-2563eb?style=for-the-badge&logo=kubernetes&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Python](https://img.shields.io/badge/Python-3.9+-3776ab?style=flat-square&logo=python)

---

## Features

- **Live cluster view** — connects to your current `kubectl` context automatically; switch between multiple clusters from the UI
- **Multi-resource browser** — browse Pods, Deployments, Services, and Events across any namespace with search and filter
- **Pod deep-dive** — container states, resource requests/limits, restart counts, recent events
- **Structured log viewer** — color-coded log lines by level (ERR / WARN / INFO / DBG) with timestamp parsing and text filter
- **AI analysis** — one click sends raw K8s data (status, events, log tail) to an LLM and returns structured diagnosis: severity, root cause, recommendations, and `kubectl` commands
- **AI chat** — ask free-form questions about your cluster with the selected resource as context
- **Multi-provider AI** — choose your LLM provider from the UI, no environment variables needed:
  - 🟣 **Anthropic** — Claude Haiku / Sonnet / Opus
  - 🟢 **OpenAI** — GPT-4o Mini / GPT-4o / o4-mini
  - ⚫ **GitHub Models** — GPT-4o, Llama 3.3 70B, Mistral Large (**free** with a GitHub PAT)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (localhost:5173)              │
│                                                         │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │  Resource   │  │  Detail Panel   │  │ AI Panel   │  │
│  │  Sidebar    │  │  (pod/deploy/   │  │ (analyze + │  │
│  │  Pods       │  │   svc/events)   │  │  chat)     │  │
│  │  Deploys    │  │                 │  │            │  │
│  │  Services   │  │  Logs · Events  │  │ Claude /   │  │
│  │  Events     │  │  Containers     │  │ GPT / etc. │  │
│  └─────────────┘  └─────────────────┘  └────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│              FastAPI Backend (localhost:8000)            │
│                                                         │
│   /contexts  /namespaces  /pods  /deployments           │
│   /services  /events  /logs  /pod  /ai/analyze          │
│   /ai/chat                                              │
└────────────┬────────────────────────┬───────────────────┘
             │                        │
   ┌──────────▼──────────┐   ┌────────▼────────┐
   │  Kubernetes Python  │   │   LLM Provider  │
   │  Client             │   │  Anthropic /    │
   │  (~/.kube/config)   │   │  OpenAI /       │
   └─────────────────────┘   │  GitHub Models  │
                             └─────────────────┘
```

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- A running Kubernetes cluster with `kubectl` configured (`~/.kube/config`)
- An API key for one of: Anthropic, OpenAI, or a GitHub Personal Access Token (free)

### 1. Clone the repo

```bash
git clone https://github.com/1ve19cs088/k8s-ai-troubleshooter.git
cd k8s-ai-troubleshooter
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the dashboard

Visit **http://localhost:5173**

Click **⚠ Connect AI** in the navbar to set your LLM provider and API key.

---

## AI Provider Setup

| Provider | Cost | How to get a key |
|---|---|---|
| **Anthropic** | ~$0.00025 / 1K tokens (Haiku) | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **OpenAI** | ~$0.00015 / 1K tokens (GPT-4o Mini) | [platform.openai.com](https://platform.openai.com/api-keys) |
| **GitHub Models** | **Free** (rate limited) | [github.com/settings/tokens](https://github.com/settings/tokens) — create a PAT with no extra scopes |

> API keys are stored only in your browser's `localStorage` and sent exclusively to your local backend (`localhost:8000`). They are never sent to any third party.

---

## Project Structure

```
k8s-ai-troubleshooter/
├── backend/
│   ├── main.py              # FastAPI app — K8s + LLM endpoints
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/
│       │   └── api.js       # Axios API client
│       ├── components/
│       │   ├── Navbar.jsx         # Context/namespace switcher + LLM settings modal
│       │   ├── ResourceSidebar.jsx # Tabbed resource list with filter
│       │   ├── DetailPanel.jsx    # Pod/deploy/service/event detail + log viewer
│       │   ├── AIPanel.jsx        # AI analyze + chat panel
│       │   └── SummaryCards.jsx   # Cluster health summary
│       ├── pages/
│       │   └── Dashboard.jsx      # Main layout
│       └── styles/
│           └── global.css
└── kubernetes/              # Sample broken manifests for testing
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contexts` | List all kubeconfig contexts and current context |
| GET | `/namespaces` | List namespaces for a given context |
| GET | `/pods` | List pods (supports `?namespace=` and `?context=`) |
| GET | `/deployments` | List deployments |
| GET | `/services` | List services |
| GET | `/events` | List events, warnings first |
| GET | `/pod/{namespace}/{pod}` | Pod detail — containers, events, conditions |
| GET | `/logs/{namespace}/{pod}` | Tail container logs |
| POST | `/ai/analyze` | AI diagnosis of a pod / deployment / service |
| POST | `/ai/chat` | Free-form AI chat about the cluster |

---

## Testing with Broken Scenarios

The `kubernetes/` folder contains manifests that simulate real-world failure scenarios:

```bash
kubectl apply -f kubernetes/broken-app.yaml       # ImagePullBackOff
kubectl apply -f kubernetes/crash-app.yaml        # CrashLoopBackOff
kubectl apply -f kubernetes/oom-app.yaml          # OOMKilled
kubectl apply -f kubernetes/pending-app.yaml      # Unschedulable / Pending
kubectl apply -f kubernetes/liveness-app.yaml     # Liveness probe failure
kubectl apply -f kubernetes/readiness-app.yaml    # Readiness probe failure
kubectl apply -f kubernetes/service-mismatch.yaml # Service selector mismatch
kubectl apply -f kubernetes/dns-app.yaml          # DNS resolution failure
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Axios |
| Backend | FastAPI, Python 3.9 |
| Kubernetes | `kubernetes` Python client |
| AI — Anthropic | `anthropic` SDK |
| AI — OpenAI / GitHub | `openai` SDK |

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
