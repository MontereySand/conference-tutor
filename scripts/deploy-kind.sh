#!/usr/bin/env bash
set -euo pipefail

# Run from the app root; private images stay in the existing local cluster.
for tool in docker kind kubectl node git lsof; do
  command -v "$tool" >/dev/null || { printf 'Required command missing: %s\n' "$tool" >&2; exit 1; }
done
for file in Dockerfile .env.local k8s/namespace.yaml k8s/deployment.yaml k8s/service.yaml; do
  [[ -f "$file" ]] || { printf 'Run from the prepared app root; missing %s\n' "$file" >&2; exit 1; }
done

export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
export KIND_EXPERIMENTAL_PROVIDER=docker
sha="$(git rev-parse HEAD)"
image="conference-tutor:$sha"

docker build --target runtime --build-arg "GIT_SHA=$sha" -t "$image" .
kind load docker-image "$image" --name cnh
kubectl --context kind-cnh apply -f k8s/namespace.yaml

# Node parses quoted env values. Only this JSON stream carries credentials, never shell arguments or logs.
node --env-file=.env.local --input-type=module -e '
  import assert from "node:assert/strict";
  const keys = [
    "OPENAI_API_KEY", "ELASTICSEARCH_URL", "ELASTICSEARCH_API_KEY",
    "OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_HEADERS",
    "DASH0_RUM_ENDPOINT", "DASH0_RUM_TOKEN", "SPEND_CAP_USD",
  ];
  assert.equal(keys.length, 8);
  const stringData = Object.fromEntries(keys.map(key => [key, process.env[key] ?? ""]));
  for (const key of ["OPENAI_API_KEY", "ELASTICSEARCH_URL", "ELASTICSEARCH_API_KEY", "SPEND_CAP_USD"]) {
    assert.ok(stringData[key].trim(), `Missing ${key}`);
  }
  assert.ok(Number.isFinite(Number(stringData.SPEND_CAP_USD)) && Number(stringData.SPEND_CAP_USD) >= 0, "Invalid SPEND_CAP_USD");
  process.stdout.write(JSON.stringify({
    apiVersion: "v1", kind: "Secret",
    metadata: { name: "ct-secrets", namespace: "conference-tutor" },
    type: "Opaque", stringData,
  }));
' | kubectl --context kind-cnh apply --server-side --field-manager=conference-tutor-deploy -f -

kubectl --context kind-cnh set image --local -f k8s/deployment.yaml "conference-tutor=$image" -o yaml \
  | kubectl --context kind-cnh apply -f -
kubectl --context kind-cnh apply -f k8s/service.yaml
kubectl --context kind-cnh -n conference-tutor rollout status deployment/conference-tutor --timeout=180s

printf '\nDeployed local image %s (health SHA must equal %s). No image was pushed.\n' "$image" "$sha"
if listeners="$(lsof -nP -iTCP:3010 -sTCP:LISTEN)"; then
  printf '\nPort 3010 has an existing listener; have its owner stop it before forwarding. No process was stopped:\n%s\n' "$listeners"
else
  status=$?
  if [[ "$status" -ne 1 ]]; then
    printf 'Could not inspect port 3010 (lsof exit %s); inspect it before forwarding.\n' "$status" >&2
  fi
fi
printf '\nNext: start this foreground command as a named tool service (do not background it):\n'
printf '%s\n' 'kubectl --context kind-cnh -n conference-tutor port-forward --address 127.0.0.1 svc/conference-tutor 3010:80'
printf '\nThen check the returned SHA is %s:\n' "$sha"
printf '%s\n' 'curl --fail --silent --show-error http://127.0.0.1:3010/api/health'
printf '\nThe writable emptyDir ledger resets on pod replacement; it is not a provider billing cap.\n'
