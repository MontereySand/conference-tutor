# Conference tutor

Understand a technical talk without stopping it. Elasticsearch is the source/retrieval layer; explanations stay tied to retrieved evidence. General mode or a supplied professional card changes the explanation.

Intro presents an overlapping fan of abstract profile cards, with the user's card last. Learn uses a theatre-style four-panel canvas: real 16:9 video, synchronized transcript, explanations and an editable Dump. The interface supports English and Spanish using official [Meta Astryx](https://github.com/meta/astryx) controls, IBM Plex Mono and Playfair Display. Selecting text, editing local caption annotations, asking questions and receiving answers leave playback running; transport and citation actions explicitly seek. Questions capture a bookmark, and retries/corrections retain that original context. Learner annotations never replace source evidence.
Grounded steps and optional practice use progressive disclosure inspired by [LearnHarness](https://github.com/amosblomqvist/learnharness/tree/da08cb5f7d098598ba963c6689b22054c9f2a5a3): the direct answer remains visible; the expected practice answer appears only after an attempt or explicit Skip. Source support never becomes an invented explanation.
The selected interface language also controls generated teaching fields, even when the original question is written in the other language.
Submitting a new question replaces the previous explanation; a failed or cancelled request cannot leave an old answer attached to a newer bookmark. Fullscreen includes the complete theatre canvas and its bottom transport.
Profile-only changes update the shareable URL without reloading the player; language changes load the matching transcript. On small screens, captions remain in a bounded scrolling panel so Dump and transport stay reachable.

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

Private audio preparation requires FFmpeg/ffprobe. `scripts/align-audio.ts transcribe` measures the actual audio before taking a spending hold, disables retries, settles the returned duration, and refuses to overwrite existing ASR output. Failed calls retain their hold. The Whisper ledger rate follows its documented [$0.006/minute list price](https://developers.openai.com/api/docs/models/whisper-1); this is an admission estimate, not a provider invoice or billing guarantee. The existing prepared transcription is reused without another paid request.

## Retrieval verified

71 passages use Jina `.jina-embeddings-v5-text-small` through Elasticsearch `semantic_text`. A historical one-pass experiment used eight invented queries covering two mechanisms in English, Hindi, Spanish and Simplified Chinese; the current product supports English and Spanish only.

| Mode | Expected window in top 3 | Median latency |
| --- | ---: | ---: |
| Keyword | 6/8 | 117.5 ms |
| Semantic | 8/8 | 133.5 ms |
| Hybrid RRF | 8/8 | 180.5 ms |
| Jina rerank over RRF | 8/8 | 364 ms |

Hybrid remains selected: reranking did not improve top-3 support. These are one-pass retrieval measurements, not teaching-quality or native-language accuracy claims.

Spanish translations are machine-generated, not native-reviewed. The supplied full audio was processed once: 188 of 327 sentence intervals were mapped, with complete English word timings for 104 sentences; uncertain intervals retain their original derived values. Forty-five bilingual source-cited definitions are explicitly labeled prepared, not live-generated. Human timing accuracy and review of all 14 minimized cards are not yet established. Evaluation questions are invented, not observed learner questions. No learner database, accounts, scraping or live-web retrieval. Publication of original source media/packets is not authorized by this code repository.

Voice is not included in this build. The original YouTube talk streams directly to the browser; the judge app does not relay original media from a laptop.

See [sponsor evidence](docs/sponsor-evidence.md) for measured Elasticsearch results, actual Gitar reviews, received Dash0/Agent0 evidence, Radar Checks/investigation and explicitly pending final-release gates. Installation, instrumentation and green CI alone do not prove sponsor usage or eligibility.

## Invited-judge hosting

The Docker target `public-runtime` contains code only. The default final target `runtime` still includes private data for local kind: **never push it**. The manually dispatched `Public runtime image` workflow builds `--target public-runtime` without private inputs or secret build arguments. Before publication, require an image-content assertion that private data, `.git` and `.env` files are absent; confirm anonymous GHCR pull and the event cluster's actual architecture. Record the immutable image digest and full code SHA. The verified November 9 deployment baseline and exact image provenance are recorded in [sponsor evidence](docs/sponsor-evidence.md).

Run from the prepared app root with Node 26 and kubectl. Discover the actual team and its existing workloads first; supply the downloaded kubeconfig explicitly, never a default context. Save the eight existing core env fields plus `JUDGE_ACCESS_REQUIRED=1`, a cryptographically generated base64url judge code (at least 24 random bytes / 32 characters), an independent generated base64url session secret (at least 32 characters), and `PUBLIC_APP_ORIGIN` set to the team's exact HTTPS application origin in a separate ignored `.env.hosted.local` file. Each generated value must contain at least eight distinct characters. Keep hosted gate settings out of local development's `.env.local`. Never put credentials or the judge code in a URL, public README, video or Git; deliver access only through a judge-private channel.

Hosted validation must match the runtime gate: both the judge code and session secret are limited to 256 characters. During an approved starter replacement, the Service selector must contain only the new release selector, not leftover starter keys. These are release requirements; confirm the integrated deployment implementation before rollout.

The judge code is a high-entropy bearer credential, not a human-chosen password or PIN. Login uses a bounded request body and constant-time comparison; anonymous attempts cannot exhaust a shared login allowance, and forwarded IP headers are not trusted. There is no application login-rate counter or claim of volumetric DoS protection; that belongs at a trusted ingress. Paid tutor calls retain their separate admission guard.

```sh
bash scripts/deploy-hosted.sh "$HOSTED_KUBECONFIG" "$HOSTED_TEAM" "$HOSTED_IMAGE" ../.env.hosted.local data
```

`HOSTED_IMAGE` must be the inspected public GHCR reference pinned as `ghcr.io/owner/image@sha256:<digest>`, not a mutable tag. The script checks the kubeconfig API against the actual team's `vc.cnh.radarhq.io` endpoint before mutation and works only in the **existing** `team-<team>` namespace. It refuses an unmanaged Service `app` by default. Only after inspecting its current selector, owner and image and confirming it is the event starter, append `--replace-starter` to that same command. The candidate must pull and become Ready before Service `app:80` changes; no starter workload is deleted or scaled. Previous deployments owned by this script are retained but scaled to zero after successful cutover.

Only allowlisted runtime JSON files are projected read-only under `/app/data`, preserving paths; no raw packets, provenance, batches or ledgers are uploaded. Secrets are partitioned below 900,000 encoded bytes before any upload; a single oversized runtime file is rejected before mutation. Env values use Node's `.env` parser, and only the eight core fields and four access fields are sent. Credentials and payloads are never printed. `/app/data/runtime` is a separate uid-1000 writable emptyDir; its guard ledger resets with pod replacement, not provider billing.

Hosting ends November 13, 2026; remote kubeconfig tokens rotate after 24 hours. Refresh that explicit kubeconfig for later operations. Judge cookies expire eight hours after login, without sliding renewal; rotating either judge code or session secret invalidates existing sessions. A failed rollout leaves the existing Service unchanged and returns failure; inspect candidate resource status privately, not Secret payloads. Retained zero-replica releases and any failed candidates require deliberate owner-scoped cleanup; unrelated team resources are untouched.

Focused deployment checks (inline fixtures/fake kubectl, no cluster or credentials):

```sh
node --test k8s/hosted/deploy-hosted.test.mjs
```

After deployment, verify anonymous page, RSC and API requests cannot read private content; wrong/correct passcodes and secure cookies behave correctly; `/api/health` reports the intended full SHA; foreign/missing origins are rejected; and an authenticated real lesson works. These checks and an actual hosted browser playback/lesson/saved-return flow passed for revision `e7a4da369827a988dc0c3b9bddbcf453d2fa44e0`. Private judge-access delivery remains separate; no passcode is published.
