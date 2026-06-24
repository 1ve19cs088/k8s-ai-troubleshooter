from fastapi import FastAPI
from kubernetes import client, config

app = FastAPI()


@app.get("/")
def home():
    return {
        "message": "K8s AI Troubleshooter"
    }


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

    pod_name = pod_name.strip()

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


@app.get("/analyze/{pod_name}")
def analyze_pod(pod_name: str):

    pod_name = pod_name.strip()

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    pod = v1.read_namespaced_pod(
        name=pod_name,
        namespace="default"
    )

    # --------------------------------------------------
    # OOMKilled Detection (highest priority)
    # --------------------------------------------------
    if (
        pod.status.container_statuses
        and pod.status.container_statuses[0].last_state
        and pod.status.container_statuses[0].last_state.terminated
    ):

        terminated = (
            pod.status.container_statuses[0]
            .last_state
            .terminated
        )

        if terminated.reason == "OOMKilled":

            return {
                "pod": pod_name,
                "issue": "OOMKilled",
                "root_cause": "Container exceeded memory limit",
                "severity": "High",
                "recommendation": [
                    "Increase memory limit",
                    "Investigate memory leaks",
                    "Profile application memory usage"
                ]
            }

    # --------------------------------------------------
    # Waiting State Checks
    # --------------------------------------------------
    if (
        pod.status.container_statuses
        and pod.status.container_statuses[0].state
        and pod.status.container_statuses[0].state.waiting
    ):

        reason = (
            pod.status.container_statuses[0]
            .state
            .waiting
            .reason
        )

        # ImagePullBackOff
        if reason == "ImagePullBackOff":

            return {
                "pod": pod_name,
                "issue": "ImagePullBackOff",
                "root_cause": "Container image could not be pulled",
                "severity": "High",
                "recommendation": [
                    "Verify image name",
                    "Verify image tag",
                    "Check registry access"
                ]
            }

        # CrashLoopBackOff
        if reason == "CrashLoopBackOff":

            return {
                "pod": pod_name,
                "issue": "CrashLoopBackOff",
                "root_cause": "Application crashes immediately after startup",
                "severity": "High",
                "recommendation": [
                    "Review container logs",
                    "Check startup command",
                    "Validate application configuration"
                ]
            }

    # --------------------------------------------------
    # Generic Pending Detection
    # (must come AFTER ImagePullBackOff)
    # --------------------------------------------------
    if pod.status.phase == "Pending":

        return {
            "pod": pod_name,
            "issue": "Pending",
            "root_cause": "Pod could not be scheduled",
            "severity": "Medium",
            "recommendation": [
                "Check node resources",
                "Check CPU and memory requests",
                "Inspect scheduling events"
            ]
        }

    # --------------------------------------------------
    # Default Response
    # --------------------------------------------------
    return {
        "pod": pod_name,
        "message": "No known issue detected"
    }