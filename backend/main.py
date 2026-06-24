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