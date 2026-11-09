# Conference tutor

Understand the hard part of a technical talk, then return to the same moment. Elasticsearch is the source/retrieval layer; explanations stay tied to retrieved evidence. General mode or a supplied professional card changes the explanation, not source facts.

## Private inputs, public code

Code is public; the talk transcript, reference excerpts and profile cards are prepared privately and are **not** in this repository. A clone builds and runs its inline-fixture tests without them, but cannot provide the private tutor experience until the prepared data is supplied. The approved invited-judge deployment uses a passcode gate, a public code-only image and private runtime data/secrets; no public dataset is offered. Local images containing private data must never be pushed.

Before the 11:00 build window: scaffold/dependencies, English transcript and derived intervals, chunks, reference bank, 13 minimized professional cards, four concept windows and local tool/account setup were prepared. A user-requested fourteenth card was added during the build from an existing supplied packet. No raw packets are published.

## Local run

Node 26, npm, privately prepared data/ and .env.local are required for the full app.

1. npm ci
2. Supply sources.json, transcripts/, index/chunks.json, references/, concepts/, profiles/cards.json and evidence/elastic.json under ignored data/.
3. Configure OPENAI_API_KEY, ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY in ignored .env.local. Optional Dash0 values enable telemetry. SPEND_CAP_USD defaults to 25, a per-runtime admission guard, not a provider billing cap.
4. npm run dev; open http://localhost:3000.

Checks: npm run lint; npm test; npm run build; npm run typecheck. CI uses no private data or secrets.

## Retrieval verified

71 passages use Jina `.jina-embeddings-v5-text-small` through Elasticsearch `semantic_text`. Eight invented queries cover two mechanisms across all four languages.

| Mode | Expected window in top 3 | Median latency |
| --- | ---: | ---: |
| Keyword | 6/8 | 117.5 ms |
| Semantic | 8/8 | 133.5 ms |
| Hybrid RRF | 8/8 | 180.5 ms |
| Jina rerank over RRF | 8/8 | 364 ms |

Hybrid remains selected: reranking did not improve top-3 support. These are one-pass retrieval measurements, not teaching-quality or native-language accuracy claims.

Translations are machine-generated, not native-reviewed. Untouched sentence timings remain derived. Evaluation questions are invented, not observed learner questions. No learner database, accounts, scraping or live-web retrieval. Publication of original source media/packets is not authorized by this code repository.

Sponsor evidence and actual verification results will be recorded in docs/sponsor-evidence.md; installation alone is not proof of usage.

## Invited-judge hosting

The Docker target `public-runtime` contains code only. The default final target `runtime` still includes private data for local kind: **never push it**. The manually dispatched `Public runtime image` workflow hardcodes `--target public-runtime` and publishes `ghcr.io/<repository>:sha-<commit>`, without private inputs or secret build arguments. Before dispatching it, inspect an integrated code-only image for absent private data, `.env` files and credentials; confirm the resulting GHCR package is publicly pullable and supports the cluster's architecture. Authentication code (`proxy.ts`) must be integrated before building.

Run from the prepared app root with Node 26 and kubectl. Discover the actual team and its existing workloads first; supply the downloaded kubeconfig explicitly, never a default context. Save the eight existing core env fields plus `JUDGE_ACCESS_REQUIRED=1`, a generated base64url judge code (at least 16 characters), an independent generated base64url session secret (at least 32), and `PUBLIC_APP_ORIGIN` set to the team's exact HTTPS application origin in the private env file. Each generated value must contain at least eight distinct characters. Do not put the code in a URL or Git.

```sh
bash scripts/deploy-hosted.sh "$HOSTED_KUBECONFIG" "$HOSTED_TEAM" "$HOSTED_IMAGE" ../.env.local data
```

`HOSTED_IMAGE` must be the inspected public GHCR reference pinned as `ghcr.io/owner/image@sha256:<digest>`, not a mutable tag. The script checks the kubeconfig API against the actual team's `vc.cnh.radarhq.io` endpoint before mutation and works only in the **existing** `team-<team>` namespace. It refuses an unmanaged Service `app` by default. Only after inspecting its current selector, owner and image and confirming it is the event starter, append `--replace-starter` to that same command. The candidate must pull and become Ready before Service `app:80` changes; no starter workload is deleted or scaled. Previous deployments owned by this script are retained but scaled to zero after successful cutover.

Only allowlisted runtime JSON files are projected read-only under `/app/data`, preserving paths; no raw packets, provenance, batches or ledgers are uploaded. Secrets are partitioned below 900,000 encoded bytes before any upload; a single oversized runtime file is rejected before mutation. Env values use Node's `.env` parser, and only the eight core fields and four access fields are sent. Credentials and payloads are never printed. `/app/data/runtime` is a separate uid-1000 writable emptyDir; its guard ledger resets with pod replacement, not provider billing.

Hosting ends November 13, 2026; remote kubeconfig tokens rotate after 24 hours. Refresh that explicit kubeconfig for later operations. Judge cookies expire eight hours after login, without sliding renewal; rotating either judge code or session secret invalidates existing sessions. A failed rollout leaves the existing Service unchanged and returns failure; inspect candidate resource status privately, not Secret payloads. Retained zero-replica releases and any failed candidates require deliberate owner-scoped cleanup; unrelated team resources are untouched.

Focused deployment checks (inline fixtures/fake kubectl, no cluster or credentials):

```sh
node --test k8s/hosted/deploy-hosted.test.mjs
```

After actual deployment, verify anonymous requests cannot read private pages/data, login works, `/api/health` reports the intended SHA, and an authenticated real lesson works. These instructions do not assert that hosting or image publication has been executed.
