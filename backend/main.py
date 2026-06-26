from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel
from kubernetes import client, config
import anthropic
import os
import json
import time

app = FastAPI(title="K8s AI Troubleshooter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def load_k8s(context: Optional[str] = None):
    """Load kubeconfig for the given context (or current context if None)."""
    config.load_kube_config(context=context)


def get_current_context() -> str:
    contexts, active = config.list_kube_config_contexts()
    return active["name"] if active else ""


def list_all_contexts() -> list[str]:
    contexts, _ = config.list_kube_config_contexts()
    return [c["name"] for c in contexts]


# ──────────────────────────────────────────────
# Context & Namespace Discovery
# ──────────────────────────────────────────────

@app.get("/contexts")
def get_contexts():
    contexts = list_all_contexts()
    current = get_current_context()
    return {"contexts": contexts, "current": current}


@app.get("/namespaces")
def get_namespaces(context: Optional[str] = Query(default=None)):
    load_k8s(context)
    v1 = client.CoreV1Api()
    ns_list = v1.list_namespace()
    return [ns.metadata.name for ns in ns_list.items]


# ──────────────────────────────────────────────
# Pods
# ──────────────────────────────────────────────

@app.get("/pods")
def get_pods(
    context: Optional[str] = Query(default=None),
    namespace: str = Query(default="default"),
):
    load_k8s(context)
    v1 = client.CoreV1Api()

    try:
        if namespace == "all":
            pods = v1.list_pod_for_all_namespaces().items
        else:
            pods = v1.list_namespaced_pod(namespace=namespace).items
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach cluster: {e}")

    result = []
    for pod in pods:
        container_statuses = pod.status.container_statuses or []
        restarts = sum(cs.restart_count for cs in container_statuses)
        ready_count = sum(1 for cs in container_statuses if cs.ready)
        total_count = len(container_statuses)

        result.append({
            "name": pod.metadata.name,
            "namespace": pod.metadata.namespace,
            "status": pod.status.phase or "Unknown",
            "restarts": restarts,
            "ready": f"{ready_count}/{total_count}",
            "node": pod.spec.node_name or "Unscheduled",
            "age": str(pod.metadata.creation_timestamp) if pod.metadata.creation_timestamp else "",
        })

    return result


# ──────────────────────────────────────────────
# Deployments
# ──────────────────────────────────────────────

@app.get("/deployments")
def get_deployments(
    context: Optional[str] = Query(default=None),
    namespace: str = Query(default="default"),
):
    load_k8s(context)
    apps = client.AppsV1Api()

    if namespace == "all":
        deploys = apps.list_deployment_for_all_namespaces().items
    else:
        deploys = apps.list_namespaced_deployment(namespace=namespace).items

    return [
        {
            "name": d.metadata.name,
            "namespace": d.metadata.namespace,
            "desired": d.spec.replicas or 0,
            "ready": d.status.ready_replicas or 0,
            "available": d.status.available_replicas or 0,
            "updated": d.status.updated_replicas or 0,
        }
        for d in deploys
    ]


# ──────────────────────────────────────────────
# Services
# ──────────────────────────────────────────────

@app.get("/services")
def get_services(
    context: Optional[str] = Query(default=None),
    namespace: str = Query(default="default"),
):
    load_k8s(context)
    v1 = client.CoreV1Api()

    if namespace == "all":
        svcs = v1.list_service_for_all_namespaces().items
    else:
        svcs = v1.list_namespaced_service(namespace=namespace).items

    return [
        {
            "name": s.metadata.name,
            "namespace": s.metadata.namespace,
            "type": s.spec.type,
            "cluster_ip": s.spec.cluster_ip or "None",
            "ports": [
                f"{p.port}:{p.target_port}/{p.protocol}"
                for p in (s.spec.ports or [])
            ],
        }
        for s in svcs
    ]


# ──────────────────────────────────────────────
# Events
# ──────────────────────────────────────────────

@app.get("/events")
def get_events(
    context: Optional[str] = Query(default=None),
    namespace: str = Query(default="default"),
):
    load_k8s(context)
    v1 = client.CoreV1Api()

    if namespace == "all":
        events = v1.list_event_for_all_namespaces().items
    else:
        events = v1.list_namespaced_event(namespace=namespace).items

    # Sort by last timestamp descending, show warnings first
    events = sorted(
        events,
        key=lambda e: (
            0 if e.type == "Warning" else 1,
            -(e.last_timestamp.timestamp() if e.last_timestamp else 0),
        ),
    )

    return [
        {
            "namespace": e.metadata.namespace,
            "type": e.type,
            "reason": e.reason,
            "object": f"{e.involved_object.kind}/{e.involved_object.name}",
            "message": e.message,
            "count": e.count or 1,
            "last_seen": str(e.last_timestamp) if e.last_timestamp else "",
        }
        for e in events[:100]
    ]


# ──────────────────────────────────────────────
# Logs
# ──────────────────────────────────────────────

@app.get("/logs/{namespace}/{pod_name}")
def get_logs(
    namespace: str,
    pod_name: str,
    context: Optional[str] = Query(default=None),
    tail_lines: int = Query(default=100),
):
    load_k8s(context)
    v1 = client.CoreV1Api()
    try:
        logs = v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=tail_lines,
        )
        return {"pod_name": pod_name, "namespace": namespace, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ──────────────────────────────────────────────
# Streaming Logs  (SSE)
# ──────────────────────────────────────────────

@app.get("/logs/stream/{namespace}/{pod_name}")
def stream_logs(
    namespace: str,
    pod_name: str,
    context: Optional[str] = Query(default=None),
    tail_lines: int = Query(default=100),
    container: Optional[str] = Query(default=None),
):
    load_k8s(context)
    v1 = client.CoreV1Api()

    def event_generator():
        try:
            # Stream with follow=True, _preload_content=False gives a raw urllib3 response
            kwargs = dict(
                name=pod_name,
                namespace=namespace,
                follow=True,
                tail_lines=tail_lines,
                _preload_content=False,
            )
            if container:
                kwargs["container"] = container

            resp = v1.read_namespaced_pod_log(**kwargs)

            for raw_line in resp:
                line = raw_line.decode("utf-8", errors="replace").rstrip("\n")
                if line:
                    payload = json.dumps({"line": line, "ts": time.time()})
                    yield f"data: {payload}\n\n"

        except Exception as e:
            err = json.dumps({"error": str(e)})
            yield f"data: {err}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",       # disable nginx buffering if proxied
            "Access-Control-Allow-Origin": "http://localhost:5173",
        },
    )


# ──────────────────────────────────────────────
# Pod Detail (describe-style)
# ──────────────────────────────────────────────

@app.get("/pod/{namespace}/{pod_name}")
def get_pod_detail(
    namespace: str,
    pod_name: str,
    context: Optional[str] = Query(default=None),
):
    load_k8s(context)
    v1 = client.CoreV1Api()
    try:
        pod = v1.read_namespaced_pod(name=pod_name, namespace=namespace)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    container_statuses = pod.status.container_statuses or []

    containers = []
    for c in pod.spec.containers:
        status = next((s for s in container_statuses if s.name == c.name), None)
        containers.append({
            "name": c.name,
            "image": c.image,
            "ready": status.ready if status else False,
            "restarts": status.restart_count if status else 0,
            "state": _container_state(status) if status else "Unknown",
            "resources": {
                "requests": dict(c.resources.requests or {}),
                "limits": dict(c.resources.limits or {}),
            },
        })

    events = v1.list_namespaced_event(
        namespace=namespace,
        field_selector=f"involvedObject.name={pod_name}",
    )

    return {
        "name": pod.metadata.name,
        "namespace": pod.metadata.namespace,
        "phase": pod.status.phase,
        "node": pod.spec.node_name,
        "labels": dict(pod.metadata.labels or {}),
        "containers": containers,
        "conditions": [
            {"type": c.type, "status": c.status, "reason": c.reason or ""}
            for c in (pod.status.conditions or [])
        ],
        "events": [
            {
                "type": e.type,
                "reason": e.reason,
                "message": e.message,
                "count": e.count or 1,
            }
            for e in events.items
        ],
    }


def _container_state(status) -> str:
    if status.state.running:
        return "Running"
    if status.state.waiting:
        return f"Waiting ({status.state.waiting.reason})"
    if status.state.terminated:
        return f"Terminated ({status.state.terminated.reason})"
    return "Unknown"


# ──────────────────────────────────────────────
# LLM provider helper
# ──────────────────────────────────────────────

PROVIDER_DEFAULTS = {
    "anthropic":    "claude-haiku-4-5-20251001",
    "openai":       "gpt-4o-mini",
    "github":       "gpt-4o-mini",   # GitHub Models (free with PAT)
}

def llm_complete(provider: str, api_key: str, model: str,
                 system: str, user: str) -> str:
    """Call the appropriate LLM and return the text response."""
    if provider == "anthropic":
        ac = anthropic.Anthropic(api_key=api_key)
        msg = ac.messages.create(
            model=model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text

    # OpenAI-compatible (openai + github models)
    from openai import OpenAI
    base_url = (
        "https://models.inference.ai.azure.com"
        if provider == "github"
        else None
    )
    oc = OpenAI(api_key=api_key, base_url=base_url)
    resp = oc.chat.completions.create(
        model=model,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return resp.choices[0].message.content


# ──────────────────────────────────────────────
# AI Analysis
# ──────────────────────────────────────────────

class AIRequest(BaseModel):
    resource_type: str       # pod | deployment | service
    resource_name: str
    namespace: str
    context: Optional[str] = None
    user_question: Optional[str] = None
    api_key: Optional[str] = None
    provider: str = "anthropic"
    model: Optional[str] = None


@app.post("/ai/analyze")
def ai_analyze(req: AIRequest):
    api_key = req.api_key or os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key provided. Click '⚠ Set API Key' in the toolbar."
        )
    model = req.model or PROVIDER_DEFAULTS.get(req.provider, "gpt-4o-mini")

    # Gather raw k8s data to pass to Claude
    load_k8s(req.context)
    v1 = client.CoreV1Api()
    apps = client.AppsV1Api()

    context_data: dict = {}

    try:
        if req.resource_type == "pod":
            pod = v1.read_namespaced_pod(name=req.resource_name, namespace=req.namespace)
            context_data["phase"] = pod.status.phase
            context_data["conditions"] = [
                {"type": c.type, "status": c.status, "reason": c.reason or ""}
                for c in (pod.status.conditions or [])
            ]
            container_statuses = pod.status.container_statuses or []
            context_data["containers"] = [
                {
                    "name": cs.name,
                    "ready": cs.ready,
                    "restarts": cs.restart_count,
                    "state": _container_state(cs),
                    "last_state": (
                        _container_state_dict(cs.last_state) if cs.last_state else None
                    ),
                }
                for cs in container_statuses
            ]
            # Events
            events = v1.list_namespaced_event(
                namespace=req.namespace,
                field_selector=f"involvedObject.name={req.resource_name}",
            )
            context_data["events"] = [
                {"type": e.type, "reason": e.reason, "message": e.message, "count": e.count}
                for e in events.items
            ]
            # Tail logs
            try:
                logs = v1.read_namespaced_pod_log(
                    name=req.resource_name,
                    namespace=req.namespace,
                    tail_lines=50,
                )
                context_data["logs_tail"] = logs
            except Exception:
                context_data["logs_tail"] = "(could not retrieve logs)"

        elif req.resource_type == "deployment":
            d = apps.read_namespaced_deployment(name=req.resource_name, namespace=req.namespace)
            context_data["desired"] = d.spec.replicas
            context_data["ready"] = d.status.ready_replicas or 0
            context_data["available"] = d.status.available_replicas or 0
            context_data["updated"] = d.status.updated_replicas or 0
            context_data["conditions"] = [
                {"type": c.type, "status": c.status, "reason": c.reason or "", "message": c.message or ""}
                for c in (d.status.conditions or [])
            ]

        elif req.resource_type == "service":
            s = v1.read_namespaced_service(name=req.resource_name, namespace=req.namespace)
            context_data["type"] = s.spec.type
            context_data["selector"] = dict(s.spec.selector or {})
            context_data["cluster_ip"] = s.spec.cluster_ip
            try:
                ep = v1.read_namespaced_endpoints(name=req.resource_name, namespace=req.namespace)
                has_ep = bool(ep.subsets and any(sub.addresses for sub in ep.subsets))
                context_data["has_endpoints"] = has_ep
                context_data["endpoint_count"] = sum(
                    len(sub.addresses) for sub in (ep.subsets or []) if sub.addresses
                )
            except Exception:
                context_data["has_endpoints"] = "unknown"

    except Exception as e:
        context_data["fetch_error"] = str(e)

    import json
    system_prompt = """You are an expert Kubernetes Site Reliability Engineer.
You receive raw Kubernetes resource data and diagnose issues concisely.
Respond in this exact JSON structure:
{
  "summary": "one-sentence status summary",
  "issues": ["list of detected issues, empty if healthy"],
  "root_cause": "root cause explanation or 'None detected'",
  "severity": "Critical|High|Medium|Low|Healthy",
  "recommendations": ["actionable steps"],
  "kubectl_commands": ["kubectl commands the developer can run to investigate further"]
}"""

    user_content = f"""Kubernetes {req.resource_type.upper()} Analysis Request

Resource: {req.resource_name}
Namespace: {req.namespace}

Raw K8s Data:
{json.dumps(context_data, indent=2)}
"""
    if req.user_question:
        user_content += f"\nDeveloper Question: {req.user_question}"

    import re
    raw = llm_complete(req.provider, api_key, model, system_prompt, user_content).strip()
    try:
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception:
        pass

    return {"raw_response": raw}


def _container_state_dict(state) -> dict:
    if state.running:
        return {"type": "Running"}
    if state.waiting:
        return {"type": "Waiting", "reason": state.waiting.reason}
    if state.terminated:
        return {"type": "Terminated", "reason": state.terminated.reason, "exit_code": state.terminated.exit_code}
    return {}


# ──────────────────────────────────────────────
# AI Chat (free-form question about the cluster)
# ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    namespace: str = "default"
    resource_context: Optional[dict] = None
    api_key: Optional[str] = None
    provider: str = "anthropic"
    model: Optional[str] = None


@app.post("/ai/chat")
def ai_chat(req: ChatRequest):
    api_key = req.api_key or os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key provided. Click '⚠ Set API Key' in the toolbar."
        )

    import json
    model = req.model or PROVIDER_DEFAULTS.get(req.provider, "gpt-4o-mini")

    system_prompt = """You are an expert Kubernetes SRE assistant embedded in a K8s troubleshooting dashboard.
Answer questions concisely. Format responses with markdown for readability.
Include kubectl commands when useful. Keep responses focused and actionable."""

    user_content = req.message
    if req.resource_context:
        user_content = f"Context: {json.dumps(req.resource_context, indent=2)}\n\nQuestion: {req.message}"

    text = llm_complete(req.provider, api_key, model, system_prompt, user_content)
    return {"response": text}
