from fastapi import FastAPI
from kubernetes import client, config

app = FastAPI()

@app.get("/")
def home():
    return {"message": "K8s AI Troubleshooter"}

@app.get("/pods")
def get_pods():

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    pods = v1.list_pod_for_all_namespaces()

    return [
        {
            "name": pod.metadata.name,
            "namespace": pod.metadata.namespace,
            "status": pod.status.phase
        }
        for pod in pods.items
    ]
@app.get("/events")
def get_events():

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    events = v1.list_event_for_all_namespaces()

    return [
        {
            "namespace": event.metadata.namespace,
            "type": event.type,
            "reason": event.reason,
            "message": event.message
        }
        for event in events.items
    ]
@app.get("/logs/{pod_name}")
def get_logs(pod_name: str):

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    logs = v1.read_namespaced_pod_log(
        name=pod_name,
        namespace="default"
    )

    return {
        "pod_name": pod_name,
        "logs": logs
    }