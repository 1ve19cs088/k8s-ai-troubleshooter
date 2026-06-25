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

@app.get("/analyze/deployment/{deployment_name}")
def analyze_deployment(deployment_name: str):

    deployment_name = deployment_name.strip()

    config.load_kube_config(context="kind-ai-agent")

    apps = client.AppsV1Api()

    deployment = apps.read_namespaced_deployment(
        name=deployment_name,
        namespace="default"
    )

    desired = deployment.spec.replicas
    available = deployment.status.available_replicas or 0
    updated = deployment.status.updated_replicas or 0

    if available < desired:

        return {
            "deployment": deployment_name,
            "issue": "DeploymentRolloutFailure",
            "severity": "High",
            "root_cause": "Deployment rollout has not completed successfully.",
            "status": {
                "desired_replicas": desired,
                "updated_replicas": updated,
                "available_replicas": available
            },
            "recommendation": [
                "Inspect deployment events",
                "Inspect ReplicaSets",
                "Inspect failing Pods",
                "Run kubectl rollout status",
                "Review container logs"
            ]
        }

    return {
        "deployment": deployment_name,
        "message": "Deployment rollout successful"
    }

@app.get("/analyze/service/{service_name}")
def analyze_service(service_name: str):

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    service = v1.read_namespaced_service(
        name=service_name,
        namespace="default"
    )

    endpoints = v1.read_namespaced_endpoints(
        name=service_name,
        namespace="default"
    )

    has_endpoints = False

    if endpoints.subsets:
        for subset in endpoints.subsets:
            if subset.addresses:
                has_endpoints = True

    if not has_endpoints:

        return {
            "service": service_name,
            "issue": "ServiceSelectorMismatch",
            "severity": "High",
            "root_cause": "Service selector does not match any running Pods.",
            "selector": service.spec.selector,
            "recommendation": [
                "Verify Service selector labels",
                "Verify Pod labels",
                "Run kubectl get endpoints",
                "Run kubectl get pods --show-labels"
            ]
        }

    return {
        "service": service_name,
        "message": "Service is healthy"
    }

@app.get("/analyze/readiness/{pod_name}")
def analyze_readiness(pod_name: str):

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    pod = v1.read_namespaced_pod(
        name=pod_name,
        namespace="default"
    )

    # Pod is not Ready
    if not pod.status.conditions:
        return {
            "message": "No readiness information available."
        }

    ready_condition = next(
        (
            c for c in pod.status.conditions
            if c.type == "Ready"
        ),
        None
    )

    if ready_condition and ready_condition.status == "False":

        events = v1.list_namespaced_event(
            namespace="default",
            field_selector=f"involvedObject.name={pod_name}"
        )

        for event in events.items:

            if (
                event.reason == "Unhealthy"
                and "Readiness probe failed" in event.message
            ):

                return {
                    "pod": pod_name,
                    "issue": "ReadinessProbeFailure",
                    "severity": "Medium",
                    "root_cause": "Pod is running but failing its readiness probe.",
                    "probe_message": event.message,
                    "recommendation": [
                        "Verify readiness probe path",
                        "Verify application health endpoint",
                        "Inspect application logs",
                        "Validate readinessProbe configuration",
                        "Run kubectl describe pod"
                    ]
                }

    return {
        "pod": pod_name,
        "message": "Readiness probe is healthy."
    }

@app.get("/analyze/liveness/{pod_name}")
def analyze_liveness(pod_name: str):

    pod_name = pod_name.strip()

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    pod = v1.read_namespaced_pod(
        name=pod_name,
        namespace="default"
    )

    events = v1.list_namespaced_event(
        namespace="default"
    )

    restart_count = 0

    if pod.status.container_statuses:
        restart_count = pod.status.container_statuses[0].restart_count

    for event in events.items:

        if (
            event.involved_object.kind == "Pod"
            and event.involved_object.name == pod_name
        ):

            if (
                event.reason == "Unhealthy"
                and "Liveness probe failed" in event.message
            ):

                return {
                    "pod": pod_name,
                    "issue": "LivenessProbeFailure",
                    "severity": "High",
                    "root_cause": "Container is repeatedly failing its liveness probe and Kubernetes is restarting it.",
                    "restart_count": restart_count,
                    "probe_message": event.message,
                    "recommendation": [
                        "Verify liveness probe path",
                        "Verify application health endpoint",
                        "Inspect application logs",
                        "Increase initialDelaySeconds if startup is slow",
                        "Tune failureThreshold and timeoutSeconds",
                        "Run kubectl describe pod"
                    ]
                }

    return {
        "pod": pod_name,
        "message": "No liveness probe failures detected"
    }

@app.get("/analyze/dns/{pod_name}")
def analyze_dns(pod_name: str):

    pod_name = pod_name.strip()

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    logs = v1.read_namespaced_pod_log(
        name=pod_name,
        namespace="default"
    )

    dns_errors = [
        "NXDOMAIN",
        "can't find",
        "can't resolve",
        "no such host",
        "Temporary failure in name resolution",
        "Name or service not known"
    ]

    for error in dns_errors:

        if error.lower() in logs.lower():

            return {
                "pod": pod_name,
                "issue": "DNSResolutionFailure",
                "severity": "High",
                "root_cause": "Application failed to resolve a DNS name.",
                "log_snippet": logs.strip(),
                "recommendation": [
                    "Verify Service name",
                    "Verify Namespace",
                    "Check CoreDNS pods",
                    "Verify DNS policy",
                    "Run nslookup from another pod",
                    "Inspect Kubernetes Service configuration"
                ]
            }

    return {
        "pod": pod_name,
        "message": "DNS resolution is healthy."
    }

@app.get("/analyze/network/{pod_name}")
def analyze_network(pod_name: str):

    pod_name = pod_name.strip()

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    logs = v1.read_namespaced_pod_log(
        name=pod_name,
        namespace="default"
    )

    network_errors = [
        "Connection refused",
        "Connection timed out",
        "Network is unreachable",
        "No route to host",
        "Operation timed out",
        "error getting response",
        "connection reset",
        "i/o timeout"
    ]

    if any(error.lower() in logs.lower() for error in network_errors):

        return {
            "pod": pod_name,
            "issue": "NetworkingFailure",
            "severity": "High",
            "root_cause": "Application failed to communicate with a remote endpoint.",
            "log_snippet": logs,
            "recommendation": [
                "Verify destination IP or Service",
                "Verify destination port",
                "Check Service and Endpoints",
                "Verify NetworkPolicy configuration",
                "Check firewall/security groups",
                "Run connectivity tests from another pod"
            ]
        }

    return {
        "pod": pod_name,
        "message": "No networking failure detected."
    }

@app.get("/analyze/resource/{pod_name}")
def analyze_resource(pod_name: str):

    pod_name = pod_name.strip()

    config.load_kube_config(context="kind-ai-agent")

    v1 = client.CoreV1Api()

    pod = v1.read_namespaced_pod(
        name=pod_name,
        namespace="default"
    )

    container = pod.spec.containers[0]
    status = pod.status.container_statuses[0]

    requests = container.resources.requests or {}
    limits = container.resources.limits or {}

    cpu_request = requests.get("cpu", "Not Set")
    cpu_limit = limits.get("cpu", "Not Set")

    memory_request = requests.get("memory", "Not Set")
    memory_limit = limits.get("memory", "Not Set")

    restart_count = status.restart_count

    if (
        status.state
        and status.state.terminated
        and status.state.terminated.reason == "OOMKilled"
    ):

        return {
            "pod": pod_name,
            "issue": "ResourceExhaustion",
            "severity": "Critical",
            "root_cause": "Container exceeded its configured memory limit and was terminated by Kubernetes.",

            "resources": {
                "cpu_request": cpu_request,
                "cpu_limit": cpu_limit,
                "memory_request": memory_request,
                "memory_limit": memory_limit
            },

            "restart_count": restart_count,

            "recommendation": [
                "Increase memory limit",
                "Review application memory usage",
                "Investigate memory leaks",
                "Monitor memory utilization",
                "Consider Vertical Pod Autoscaler",
                "Configure Horizontal Pod Autoscaler"
            ]
        }

    if (
        status.last_state
        and status.last_state.terminated
        and status.last_state.terminated.reason == "OOMKilled"
    ):

        return {
            "pod": pod_name,
            "issue": "ResourceExhaustion",
            "severity": "Critical",
            "root_cause": "Container was previously OOMKilled due to memory exhaustion.",

            "resources": {
                "cpu_request": cpu_request,
                "cpu_limit": cpu_limit,
                "memory_request": memory_request,
                "memory_limit": memory_limit
            },

            "restart_count": restart_count,

            "recommendation": [
                "Increase memory limit",
                "Review application memory usage",
                "Investigate memory leaks",
                "Monitor memory utilization",
                "Consider Vertical Pod Autoscaler",
                "Configure Horizontal Pod Autoscaler"
            ]
        }

    return {
        "pod": pod_name,
        "message": "No resource exhaustion detected."
    }