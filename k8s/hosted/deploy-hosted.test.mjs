import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const image = `ghcr.io/fixture/tutor@sha256:${'a'.repeat(64)}`;
const code = 'fixture-judge-code_ABCdef0123456789';
const sessionSecret = 'independent-session-secret-for-fixture-only';
function fixture(t, options = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'ct-hosted-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const data = resolve(root, 'data');
  const templateFile = resolve(root, 'k8s/hosted/deployment.json');
  mkdirSync(dirname(templateFile), { recursive: true });
  writeFileSync(templateFile, readFileSync(resolve(appRoot, 'k8s/hosted/deployment.json')));
  function json(path, value) {
    const file = resolve(data, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  }
  json('sources.json', [{ id: 'fixture', ready: true,
    transcriptPath: 'data/transcripts/fixture.en.json', conceptsPath: 'data/concepts/fixture.json',
    referencePaths: ['data/references/fixture.json'] }]);
  for (const lang of ['en', 'es']) json(`transcripts/fixture.${lang}.json`, options.large ? 'x'.repeat(380_000) : []);
  for (const lang of ['hi', 'zh']) json(`transcripts/fixture.${lang}.json`, []);
  for (const path of ['index/chunks.json', 'profiles/cards.json', 'evidence/elastic.json',
    'references/fixture.json', 'concepts/fixture.json', 'transcripts/corrections.json', 'transcripts/fixture.review.json',
    'profiles/provenance.json', 'runtime/ledger.json', 'transcripts/batches/hidden.json', 'raw-packet.json']) json(path, []);
  const config = resolve(root, 'config');
  writeFileSync(config, 'fixture kubeconfig read only by fake kubectl');
  const envFile = resolve(root, 'private.env');
  writeFileSync(envFile, `OPENAI_API_KEY="fixture-key#quoted"\nELASTICSEARCH_URL=https://fixture.invalid\nELASTICSEARCH_API_KEY=fixture-elastic\nSPEND_CAP_USD=25\nJUDGE_ACCESS_REQUIRED=1\nJUDGE_ACCESS_CODE="${code}"\nJUDGE_SESSION_SECRET=${sessionSecret}\nPUBLIC_APP_ORIGIN=https://fixture.cnh.radarhq.io\nUNRELATED_PRIVATE_FIELD=must-not-upload\n${options.env ?? ''}`);
  const log = resolve(root, 'calls.jsonl');
  const fake = resolve(root, 'kubectl');
  writeFileSync(fake, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const index = args.findIndex(arg => ['config', 'get', 'apply', 'rollout', 'patch', 'create', 'scale'].includes(arg));
const cmd = args.slice(index);
const input = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args, cmd, input: input ? JSON.parse(input) : null }) + '\\n');
const stateFile = process.env.FAKE_LOG + '.state';
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
if (process.env.FAKE_STARTER && !state['service/app']) state['service/app'] = {
  metadata: { name: 'app', labels: { preserved: 'label' }, annotations: { preserved: 'annotation' } },
  spec: { type: 'ClusterIP', clusterIP: '10.0.0.1', selector: { app: 'starter', component: 'web' } },
};
function merge(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = merge(result[key], value);
  }
  return result;
}
function out(value) { process.stdout.write(JSON.stringify(value)); }
if (cmd[0] === 'config') out({ clusters: [{ cluster: { server: process.env.FAKE_SERVER || 'https://fixture.vc.cnh.radarhq.io' } }] });
else if (cmd[0] === 'get' && cmd[1] === 'namespace') out({ metadata: { name: cmd[2] } });
else if (cmd[0] === 'get') {
  const resource = state[cmd[1] + '/' + cmd[2]];
  if (resource) out({ ...resource, metadata: { ...resource.metadata, generation: 1 }, status: { readyReplicas: 1, updatedReplicas: 1, observedGeneration: 1 } });
} else if (cmd[0] === 'apply' || cmd[0] === 'create') {
  const value = JSON.parse(input);
  state[value.kind.toLowerCase() + '/' + value.metadata.name] = value;
  fs.writeFileSync(stateFile, JSON.stringify(state));
} else if (cmd[0] === 'patch') {
  if (!cmd.includes('--type=merge')) throw new Error('Fixture supports only JSON merge-patch');
  const key = cmd[1] + '/' + cmd[2];
  state[key] = merge(state[key], JSON.parse(input));
  fs.writeFileSync(stateFile, JSON.stringify(state));
} else if (cmd[0] === 'rollout' && process.env.FAKE_FAIL_ROLLOUT) {
  process.stderr.write('private payload must not be relayed'); process.exitCode = 1;
}
`, { mode: 0o700 });
  function run(extra = [], overrides = {}) {
    const result = spawnSync('bash', [resolve(appRoot, 'scripts/deploy-hosted.sh'), config, 'fixture', image, envFile, data, ...extra], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, PATH: `${root}:${process.env.PATH}`, FAKE_LOG: log, ...overrides },
    });
    const calls = (() => { try { return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } })();
    const state = (() => { try { return JSON.parse(readFileSync(log + '.state', 'utf8')); } catch { return {}; } })();
    return { ...result, calls, state };
  }
  return { run, json, data, templateFile };
}
const mutations = calls => calls.filter(({ cmd }) => ['apply', 'create', 'patch', 'scale', 'delete'].includes(cmd[0]));

test('rejects a mismatched remote API before any mutation', t => {
  const result = fixture(t).run([], { FAKE_SERVER: 'https://wrong.vc.cnh.radarhq.io' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /API server does not match/);
  assert.equal(mutations(result.calls).length, 0);
});

test('requires hosted auth and exact origin before uploading anything', async t => {
  for (const env of ['JUDGE_ACCESS_REQUIRED=0', 'JUDGE_ACCESS_CODE=short', `JUDGE_ACCESS_CODE=${code.slice(0, 31)}`, 'JUDGE_SESSION_SECRET=short', 'PUBLIC_APP_ORIGIN=https://wrong.cnh.radarhq.io']) {
    await t.test(env.split('=')[0], child => {
      const result = fixture(child, { env: `${env}\n` }).run();
      assert.equal(result.status, 1);
      assert.equal(mutations(result.calls).length, 0);
    });
  }
});

test('rejects invalid runtime URLs before uploading any resources', async t => {
  for (const key of ['ELASTICSEARCH_URL', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'DASH0_RUM_ENDPOINT']) {
    for (const value of ['not-a-url', 'http://fixture.invalid', 'https://user:password@fixture.invalid']) {
      await t.test(`${key}: ${value}`, child => {
        const result = fixture(child, { env: `${key}=${value}\n` }).run();
        assert.equal(result.status, 1);
        assert.ok(result.stderr.includes(`Invalid ${key}`));
        assert.equal(mutations(result.calls).length, 0);
      });
    }
  }
});

test('accepts trimmed credential-free HTTPS runtime URLs and blank optional telemetry', t => {
  const result = fixture(t, { env: 'ELASTICSEARCH_URL=" https://fixture.invalid "\nOTEL_EXPORTER_OTLP_ENDPOINT=" "\nDASH0_RUM_ENDPOINT=https://rum.fixture.invalid\n' }).run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.calls.some(call => call.cmd[0] === 'create'));
});

test('rejects credentials longer than the runtime gate accepts before any mutation', async t => {
  for (const key of ['JUDGE_ACCESS_CODE', 'JUDGE_SESSION_SECRET']) {
    await t.test(key, child => {
      const result = fixture(child, { env: `${key}=${'Abcdef0123456789_'.repeat(17)}\n` }).run();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /at most 256 characters/);
      assert.equal(mutations(result.calls).length, 0);
    });
  }
});

test('refuses an unmanaged entrypoint without explicit inspected-starter consent', t => {
  const result = fixture(t).run([], { FAKE_STARTER: '1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--replace-starter/);
  assert.equal(mutations(result.calls).length, 0);
});

test('splits allowlisted private inputs and gates starter cutover on readiness', t => {
  const result = fixture(t, { large: true }).run(['--replace-starter'], { FAKE_STARTER: '1' });
  assert.equal(result.status, 0, result.stderr);
  const submitted = result.calls.filter(call => call.cmd[0] === 'apply').map(call => call.input);
  const secrets = submitted.filter(value => value.kind === 'Secret');
  assert.ok(secrets.length > 2);
  for (const secret of secrets) assert.ok(Buffer.byteLength(JSON.stringify(secret)) <= 900_000);
  const env = Object.fromEntries(Object.entries(secrets.find(secret => secret.metadata.name.endsWith('-env')).data)
    .map(([key, value]) => [key, Buffer.from(value, 'base64').toString()]));
  assert.equal(Object.keys(env).length, 12);
  assert.equal(env.JUDGE_ACCESS_CODE, code);
  assert.equal(env.OPENAI_API_KEY, 'fixture-key#quoted');
  assert.equal(env.UNRELATED_PRIVATE_FIELD, undefined);
  const deployment = submitted.find(value => value.kind === 'Deployment');
  const pod = deployment.spec.template.spec;
  assert.equal(pod.securityContext.runAsUser, 1000);
  assert.equal(pod.containers[0].image, image);
  assert.equal(pod.containers[0].volumeMounts.find(mount => mount.name === 'prepared').readOnly, true);
  const paths = pod.volumes.find(volume => volume.name === 'prepared').projected.sources.flatMap(source => source.secret.items.map(item => item.path));
  assert.ok(paths.includes('transcripts/fixture.en.json'));
  assert.ok(paths.includes('transcripts/fixture.es.json'));
  assert.ok(!paths.includes('transcripts/fixture.hi.json'));
  assert.ok(!paths.includes('transcripts/fixture.zh.json'));
  assert.ok(paths.includes('references/fixture.json'));
  assert.ok(paths.includes('transcripts/fixture.review.json'));
  assert.ok(!paths.some(path => /provenance|ledger|batches|raw-packet/.test(path)));
  const rolloutIndex = result.calls.findIndex(call => call.cmd[0] === 'rollout');
  const patchIndex = result.calls.findIndex(call => call.cmd[0] === 'patch');
  assert.ok(rolloutIndex >= 0 && patchIndex > rolloutIndex);
  assert.deepEqual(result.calls[patchIndex].input.spec.ports, [{ name: 'http', port: 80, targetPort: 3000, protocol: 'TCP' }]);
  const entrypoint = result.state['service/app'];
  assert.deepEqual(entrypoint.spec.selector, deployment.spec.selector.matchLabels);
  assert.equal(entrypoint.spec.clusterIP, '10.0.0.1');
  assert.equal(entrypoint.metadata.labels.preserved, 'label');
  assert.equal(entrypoint.metadata.annotations.preserved, 'annotation');
  assert.ok(!result.calls.some(call => ['delete', 'scale'].includes(call.cmd[0])));
  for (const call of result.calls.slice(1)) {
    assert.ok(call.args.includes('--kubeconfig'));
    assert.ok(call.args.includes('--server'));
    assert.ok(call.args.includes('team-fixture'));
  }
  assert.ok(!`${result.stdout}${result.stderr}`.includes(code));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(sessionSecret));
});

test('failed rollout does not switch or create the public entrypoint', t => {
  const result = fixture(t).run([], { FAKE_FAIL_ROLLOUT: '1' });
  assert.equal(result.status, 1);
  assert.ok(!result.calls.some(call => ['patch', 'create'].includes(call.cmd[0])));
  assert.ok(!result.stderr.includes('private payload'));
});

test('oversized individual files fail before any upload', t => {
  const setup = fixture(t);
  setup.json('index/chunks.json', 'x'.repeat(900_000));
  const result = setup.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds one Secret/);
  assert.equal(mutations(result.calls).length, 0);
});

test('declared path traversal and symlinked private inputs cannot be uploaded', async t => {
  await t.test('path traversal', child => {
    const setup = fixture(child);
    setup.json('sources.json', [{ id: 'fixture', ready: false, referencePaths: ['data/references/../profiles/provenance.json'] }]);
    const result = setup.run();
    assert.equal(result.status, 1);
    assert.equal(mutations(result.calls).length, 0);
  });
  await t.test('symlink', child => {
    const setup = fixture(child);
    const path = resolve(setup.data, 'profiles/cards.json');
    rmSync(path);
    symlinkSync(resolve(setup.data, 'profiles/provenance.json'), path);
    const result = setup.run();
    assert.equal(result.status, 1);
    assert.equal(mutations(result.calls).length, 0);
  });
});

test('creates app:80 only after a fresh candidate is ready', t => {
  const result = fixture(t).run();
  assert.equal(result.status, 0, result.stderr);
  const rolloutIndex = result.calls.findIndex(call => call.cmd[0] === 'rollout');
  const createIndex = result.calls.findIndex(call => call.cmd[0] === 'create');
  assert.ok(createIndex > rolloutIndex);
  assert.equal(result.calls[createIndex].input.metadata.name, 'app');
  assert.equal(result.calls[createIndex].input.metadata.namespace, 'team-fixture');
});

test('changed pod templates create a separate candidate and failed readiness preserves the serving release', t => {
  const setup = fixture(t);
  const first = setup.run();
  assert.equal(first.status, 0, first.stderr);
  const serving = Object.values(first.state).find(resource => resource.kind === 'Deployment');
  const template = JSON.parse(readFileSync(setup.templateFile, 'utf8'));
  template.spec.template.spec.containers[0].resources.requests.cpu = '300m';
  writeFileSync(setup.templateFile, JSON.stringify(template));

  const second = setup.run([], { FAKE_FAIL_ROLLOUT: '1' });
  assert.equal(second.status, 1);
  const calls = second.calls.slice(first.calls.length);
  const candidate = calls.find(call => call.cmd[0] === 'apply' && call.input.kind === 'Deployment').input;
  assert.notEqual(candidate.metadata.name, serving.metadata.name);
  assert.equal(candidate.spec.template.spec.containers[0].resources.requests.cpu, '300m');
  assert.deepEqual(second.state[`deployment/${serving.metadata.name}`], serving);
  assert.deepEqual(second.state['service/app'], first.state['service/app']);
  assert.ok(!calls.some(call => ['patch', 'create', 'scale', 'delete'].includes(call.cmd[0])));
});
