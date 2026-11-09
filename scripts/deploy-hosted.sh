#!/usr/bin/env bash
set -euo pipefail
# All credentials and prepared bytes stay in Node memory and kubectl stdin.
exec node --input-type=module - "$@" <<'NODE'
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

class DeploymentError extends Error {}
function requireValue(condition, message) {
  if (!condition) throw new DeploymentError(message);
}
try {
  const args = process.argv.slice(2);
  const replaceStarter = args.at(-1) === '--replace-starter';
  if (replaceStarter) args.pop();
  requireValue(args.length >= 3 && args.length <= 5,
    'Usage: bash scripts/deploy-hosted.sh KUBECONFIG TEAM IMAGE@sha256:DIGEST [ENV_FILE] [DATA_DIR] [--replace-starter]');
  const [configFile, team, image, envFile = '.env.local', dataDir = 'data'] = args;
  requireValue(/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(team), 'Invalid team slug');
  requireValue(/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/.test(image),
    'Use an inspected public GHCR image pinned by sha256 digest');
  requireValue(lstatSync(configFile).isFile(), 'Kubeconfig must be an explicit file');
  const namespace = `team-${team}`;
  const origin = `https://${team}.cnh.radarhq.io`;
  const apiOrigin = `https://${team}.vc.cnh.radarhq.io`;
  const owner = 'conference-tutor-hosted';
  const ownerKey = 'app.kubernetes.io/managed-by';
  const releaseKey = 'conference-tutor-release';
  const kube = ['--kubeconfig', resolve(configFile)];
  function kubectl(command, input) {
    const result = spawnSync('kubectl', [...kube, ...command], {
      input: input === undefined ? undefined : JSON.stringify(input),
      encoding: 'utf8', timeout: 210_000, maxBuffer: 16 * 1024 * 1024,
    });
    // Never relay stderr: API errors can contain submitted Secret bodies.
    requireValue(!result.error && result.status === 0, `kubectl ${command[0]} failed; inspect resource status privately`);
    return result.stdout;
  }
  const config = JSON.parse(kubectl(['config', 'view', '--minify', '-o', 'json']));
  requireValue(config.clusters?.length === 1, 'Kubeconfig must select exactly one cluster');
  const cluster = config.clusters[0].cluster;
  const server = new URL(cluster.server);
  requireValue(server.origin === apiOrigin && server.pathname === '/' && !server.search && !server.hash &&
    !server.username && !server.password && !cluster['insecure-skip-tls-verify'], 'Kubeconfig API server does not match the team HTTPS endpoint');
  // Pin the already-checked server and namespace on every subsequent operation.
  kube.push('--server', apiOrigin, '--namespace', namespace, '--request-timeout=30s');
  function get(kind, name) {
    const text = kubectl(['get', kind, name, '--ignore-not-found', '-o', 'json']);
    return text.trim() ? JSON.parse(text) : null;
  }
  requireValue(get('namespace', namespace)?.metadata.name === namespace, 'The assigned team namespace must already exist');
  const service = get('service', 'app');
  requireValue(!service || service.metadata.labels?.[ownerKey] === owner || replaceStarter,
    'Service app is not owned by conference-tutor-hosted; inspect the starter before using --replace-starter');
  requireValue(!service || service.spec.type === 'ClusterIP', 'Existing Service app must be ClusterIP');

  // parseEnv is Node's built-in .env parser, not shell evaluation or inherited process.env.
  const env = parseEnv(readFileSync(envFile, 'utf8'));
  const coreKeys = [
    'OPENAI_API_KEY', 'ELASTICSEARCH_URL', 'ELASTICSEARCH_API_KEY',
    'OTEL_EXPORTER_OTLP_ENDPOINT', 'OTEL_EXPORTER_OTLP_HEADERS',
    'DASH0_RUM_ENDPOINT', 'DASH0_RUM_TOKEN', 'SPEND_CAP_USD',
  ];
  const authKeys = ['JUDGE_ACCESS_REQUIRED', 'JUDGE_ACCESS_CODE', 'JUDGE_SESSION_SECRET', 'PUBLIC_APP_ORIGIN'];
  const stringData = Object.fromEntries([...coreKeys, ...authKeys].map(key => [key, env[key] ?? '']));
  for (const key of ['OPENAI_API_KEY', 'ELASTICSEARCH_URL', 'ELASTICSEARCH_API_KEY', 'SPEND_CAP_USD']) {
    requireValue(stringData[key].trim(), `Missing ${key}`);
  }
  requireValue(Number.isFinite(Number(stringData.SPEND_CAP_USD)) && Number(stringData.SPEND_CAP_USD) >= 0, 'Invalid SPEND_CAP_USD');
  requireValue(stringData.JUDGE_ACCESS_REQUIRED === '1', 'Hosted access requires JUDGE_ACCESS_REQUIRED=1');
  requireValue(stringData.JUDGE_ACCESS_CODE.trim().length >= 16, 'JUDGE_ACCESS_CODE must have at least 16 characters');
  requireValue(stringData.JUDGE_SESSION_SECRET.trim().length >= 32, 'JUDGE_SESSION_SECRET must have at least 32 characters');
  for (const key of ['JUDGE_ACCESS_CODE', 'JUDGE_SESSION_SECRET']) {
    requireValue(stringData[key].length <= 256 && /^[A-Za-z0-9_-]+$/.test(stringData[key]) && new Set(stringData[key]).size >= 8,
      `${key} must be a generated base64url value of at most 256 characters with at least eight distinct characters`);
  }
  requireValue(stringData.JUDGE_ACCESS_CODE !== stringData.JUDGE_SESSION_SECRET, 'Judge code and session secret must be independent');
  requireValue(stringData.PUBLIC_APP_ORIGIN === origin, 'PUBLIC_APP_ORIGIN must exactly match the team HTTPS origin');

  const root = realpathSync(dataDir);
  function bytes(path) {
    const file = resolve(root, path);
    requireValue(file.startsWith(root + sep) && lstatSync(file).isFile() && realpathSync(file) === file,
      'Prepared input must be a regular file under DATA_DIR (no symlinks)');
    const buffer = readFileSync(file);
    try { JSON.parse(buffer.toString('utf8')); } catch { throw new Error('A required prepared JSON file is invalid'); }
    return buffer;
  }
  const sourcesBytes = bytes('sources.json');
  const sources = JSON.parse(sourcesBytes.toString('utf8'));
  requireValue(Array.isArray(sources) && sources.length > 0, 'sources.json must contain prepared sources');
  const paths = new Set(['sources.json', 'index/chunks.json', 'profiles/cards.json', 'evidence/elastic.json']);
  for (const source of sources) {
    requireValue(/^[a-z0-9-]+$/.test(source.id) && Array.isArray(source.referencePaths), 'Invalid source runtime paths');
    for (const declaredPath of source.referencePaths) {
      requireValue(typeof declaredPath === 'string', 'Invalid reference path');
      const path = declaredPath.replace(/^data\//, '');
      requireValue(/^references\/[a-z0-9-]+\.json$/.test(path), 'Only declared reference JSON files may be uploaded');
      paths.add(path);
    }
    if (source.conceptsPath) {
      const path = source.conceptsPath.replace(/^data\//, '');
      requireValue(path === `concepts/${source.id}.json`, 'Invalid concepts path');
      paths.add(path);
    }
    if (source.ready) {
      const transcript = source.transcriptPath?.replace(/^data\//, '');
      requireValue(transcript === `transcripts/${source.id}.en.json`, 'Invalid ready-source transcript path');
      for (const lang of ['en', 'hi', 'es', 'zh']) paths.add(`transcripts/${source.id}.${lang}.json`);
      const review = `transcripts/${source.id}.review.json`;
      try { lstatSync(resolve(root, review)); paths.add(review); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  try { lstatSync(resolve(root, 'transcripts/corrections.json')); paths.add('transcripts/corrections.json'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = [...paths].sort().map(path => ({ path, buffer: path === 'sources.json' ? sourcesBytes : bytes(path) }));
  const hash = createHash('sha256').update(image).update(JSON.stringify(stringData));
  for (const file of files) hash.update(file.path).update('\0').update(file.buffer);
  const release = hash.digest('hex').slice(0, 16);
  const name = `ct-hosted-${release}`;
  const labels = { [ownerKey]: owner, [releaseKey]: release, 'app.kubernetes.io/name': 'conference-tutor' };
  function secret(suffix, data) {
    return { apiVersion: 'v1', kind: 'Secret', metadata: { name: `${name}-${suffix}`, namespace, labels },
      type: 'Opaque', immutable: true, data };
  }
  // Stay below both the decoded Secret limit and encoded API request limits.
  const maxSecretBytes = 900_000;
  function fits(value) { return Buffer.byteLength(JSON.stringify(value)) <= maxSecretBytes; }
  const envSecret = secret('env', Object.fromEntries(Object.entries(stringData).map(([key, value]) => [key, Buffer.from(value).toString('base64')])));
  requireValue(fits(envSecret), 'Environment Secret exceeds the safe size limit');
  const dataSecrets = [];
  const projections = [];
  let current = secret('data-0', {});
  let items = [];
  function finish() {
    if (!items.length) return;
    dataSecrets.push(current);
    projections.push({ secret: { name: current.metadata.name, items } });
    current = secret(`data-${dataSecrets.length}`, {});
    items = [];
  }
  for (const [index, file] of files.entries()) {
    const key = `file-${index}`;
    const value = file.buffer.toString('base64');
    if (!fits({ ...current, data: { ...current.data, [key]: value } })) finish();
    current.data[key] = value;
    requireValue(fits(current), 'A prepared file exceeds one Secret; reduce that runtime file before deployment');
    items.push({ key, path: file.path });
  }
  finish();
  const template = JSON.parse(readFileSync('k8s/hosted/deployment.json', 'utf8'));
  template.metadata = { name, namespace, labels };
  template.spec.selector = { matchLabels: { [ownerKey]: owner, [releaseKey]: release } };
  template.spec.template.metadata = { labels };
  const pod = template.spec.template.spec;
  pod.containers[0].image = image;
  pod.containers[0].envFrom = [{ secretRef: { name: envSecret.metadata.name } }];
  pod.volumes.find(volume => volume.name === 'prepared').projected.sources = projections;
  const resources = [envSecret, ...dataSecrets, template];
  for (const resource of resources) {
    const existing = get(resource.kind.toLowerCase(), resource.metadata.name);
    requireValue(!existing || existing.metadata.labels?.[ownerKey] === owner,
      'A release resource name is already owned by another application');
  }
  // Nothing mutates remotely until every input, Secret size and ownership check passes.
  for (const resource of resources) {
    kubectl(['apply', '--server-side', '--field-manager=conference-tutor-hosted', '-f', '-'], resource);
  }
  kubectl(['rollout', 'status', `deployment/${name}`, '--timeout=180s']);
  const ready = get('deployment', name);
  requireValue(ready?.status?.readyReplicas === 1 && ready.status.updatedReplicas === 1 &&
    ready.status.observedGeneration >= ready.metadata.generation, 'Candidate deployment is not ready; Service app was not changed');
  const selector = { [ownerKey]: owner, [releaseKey]: release };
  const serviceSpec = { selector, ports: [{ name: 'http', port: 80, targetPort: 3000, protocol: 'TCP' }] };
  if (service) {
    // Merge-patch retains map keys unless null removes them; discard the starter selector.
    serviceSpec.selector = { ...Object.fromEntries(Object.keys(service.spec.selector ?? {}).map(key => [key, null])), ...selector };
    // Patch only this approved entrypoint; retain its IP, annotations and unrelated metadata.
    kubectl(['patch', 'service', 'app', '--type=merge', '--patch-file=/dev/stdin'], {
      metadata: { labels: { [ownerKey]: owner, 'app.kubernetes.io/name': 'conference-tutor' } }, spec: serviceSpec,
    });
  } else {
    kubectl(['create', '-f', '-'], { apiVersion: 'v1', kind: 'Service',
      metadata: { name: 'app', namespace, labels: { [ownerKey]: owner } }, spec: { type: 'ClusterIP', ...serviceSpec } });
  }
  // Retain old workloads for inspection; release resources only for a previous deployment we own.
  const previousRelease = service?.metadata.labels?.[ownerKey] === owner ? service.spec.selector?.[releaseKey] : null;
  if (previousRelease && previousRelease !== release && /^[a-f0-9]{16}$/.test(previousRelease)) {
    const previousName = `ct-hosted-${previousRelease}`;
    const previous = get('deployment', previousName);
    if (previous?.metadata.labels?.[ownerKey] === owner) {
      kubectl(['scale', `deployment/${previousName}`, '--replicas=0']);
    }
  }
  console.log(`Ready: ${origin} — namespace ${namespace}, deployment ${name}, image ${image}`);
  console.log('Event hosting expires November 13; kubeconfig tokens rotate after 24 hours. Refresh the explicit kubeconfig before later operations.');
  console.log('The runtime emptyDir ledger resets on replacement; it is not a provider billing cap.');
} catch (error) {
  console.error(error instanceof DeploymentError ? error.message : 'Hosted deployment input or dependency failed; inspect it privately');
  process.exitCode = 1;
}
NODE
