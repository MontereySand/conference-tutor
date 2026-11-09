# Sponsor evidence

Status: November 9, 2026. This records observed results, not a claim that every sponsor gate or the final release has passed. Original operational captures remain private outside this repository. No screenshots have been approved for publication; no raw passages, profile facts, credentials or judge passcode are included here.

## Elasticsearch and Jina — measured retrieval

The prepared Elasticsearch Serverless 9.7.0 index contains 71 passages: 63 talk chunks and eight reference chunks. It uses Jina `.jina-embeddings-v5-text-small` through `semantic_text`, with native reciprocal rank fusion (RRF). Elasticsearch is the app's retrieval layer, not an unused integration.

The historical one-pass experiment used eight invented queries: two mechanism questions in English, Hindi, Spanish and Simplified Chinese. The current product supports only English and Spanish. Success means a supporting talk passage from the expected time window appeared in the top three; it is not a measure of answer quality or native-language fluency.

| Retrieval mode | Supporting window in top 3 | Median retrieval latency |
| --- | ---: | ---: |
| Keyword | 6/8 | 117.5 ms |
| Semantic | 8/8 | 133.5 ms |
| Hybrid RRF | 8/8 | 180.5 ms |
| Jina rerank over RRF | 8/8 | 364 ms |

Hybrid is the recorded app mode: reranking did not improve top-three support in this small experiment. These are previous measurements, not a fresh run or end-to-end generation latency. The private prepared inputs are required to reproduce them; a public clone alone cannot reproduce the corpus results.

Public implementation/method: [index preparation](../scripts/index-elastic.ts) and [retrieval modes](../lib/search.ts). The [current check](../scripts/check-retrieval.ts) uses four English and Spanish queries; its results have not been measured. The earlier eight-query check and detailed measurement records remain in the prior code revision and private `data/evidence/retrieval.json` and `data/evidence/elastic.json`; neither evidence file is a public dataset. No retrieval rerun was performed for this documentation update.

## Gitar — actual feature reviews and addressed findings

[Core tutor PR #2](https://github.com/MontereySand/conference-tutor/pull/2) was checked at exact head `ffc507e47f60ba89fcf4b610b21cf1484823e7e0` and merged on November 9 at 20:57:20 UTC as [007c90baee403ac69f2da005defb741ac31b3e8d](https://github.com/MontereySand/conference-tutor/commit/007c90baee403ac69f2da005defb741ac31b3e8d), preserving ancestry.

- [Gitar's approved / three-closed summary](https://github.com/MontereySand/conference-tutor/pull/2#issuecomment-6750223096), [successful exact-head Gitar check](https://github.com/MontereySand/conference-tutor/runs/129407116251), and [successful exact-head CI](https://github.com/MontereySand/conference-tutor/actions/runs/42690062707/job/129407144338).
- Resolved findings: [reference citations must not count as talk support](https://github.com/MontereySand/conference-tutor/pull/2#discussion_r4517305457), [malformed model output must not be treated as a client 400](https://github.com/MontereySand/conference-tutor/pull/2#discussion_r4517305628), and [arbitrary Host/origin trust](https://github.com/MontereySand/conference-tutor/pull/2#discussion_r4517341417).
- [Infrastructure PR #1](https://github.com/MontereySand/conference-tutor/pull/1) was incorporated and automatically closed/merged. Its [wiring resolution](https://github.com/MontereySand/conference-tutor/pull/1#issuecomment-6751283451) records the mounted RUM component and called telemetry helpers. Wiring does not establish received telemetry.

The approval above is Gitar's summary/check, not a formal GitHub `reviewDecision` approval (that field was empty). These checks apply to the named legacy head, not subsequent finish commits. Repository-only installation scope and CI-fix auto-apply settings are not established by these review comments. Final-release review and CI remain pending.

## Dash0 — instrumentation exists; receipt proof pending

[Server telemetry](../lib/telemetry.ts), [server initialization](../instrumentation.node.ts), and [browser RUM](../components/telemetry/rum.tsx) provide the integration paths. A private three-panel dashboard definition for stage duration, lesson outcomes and browser performance passed the Dash0 CLI's structural dry-run. That is preparation only: it does not establish a rendered dashboard or valid queries over actual received data.

Still pending: a real correlated browser → ask → retrieval/generation trace, received duration/cost/outcome metrics, lesson log and RUM payloads; inspection of actual exported fields for privacy; three populated dashboard panels; and an actual Agent0 answer citing the slowest request's trace and distinguishing retrieval from generation. No received telemetry, diagnosis or dashboard screenshot is claimed here.

## Radar — observed baseline, release investigation pending

Before app deployment, read-only CLI observations on November 9 at 20:56:31 UTC showed the existing local kind node Ready and Radar 1.20.2 ready 1/1 with zero restarts. Signed-in Radar observations at 20:58 UTC showed that existing cluster Connected. This is actual connection/baseline evidence, not proof of the tutor release.

The baseline Checks screen reported **170/217 passing, one High and ten Medium**. These findings predate the app deployment; their individual resource ownership was not established. They must not be described as app defects fixed by this release or as an all-clear.

Still pending: the deployed app's full SHA and readiness, before/after Checks comparison, and a cited Radar assistant investigation of actual pods, restarts/events and Service selection. The free event hosted app is a separate release from local kind. [Local deployment](../scripts/deploy-kind.sh) and [guarded hosted deployment](../scripts/deploy-hosted.sh) are implementation links, not rollout evidence. No hosted digest, working judge URL or post-release all-clear is claimed.

## Release and review limitations

- The event judge environment expires November 13, 2026. The intended deployment is passcode-gated, with a public code-only image and privately mounted prepared inputs. Publication, anonymous image pull and real HTTPS access checks remain pending.
- Spanish translations are machine-generated and not native-reviewed. Unreviewed sentence intervals remain derived; the human timing target has not been established. Review of all 14 minimized cards is also pending.
- Voice is not included in this build. No physical presenter-remote verification is claimed.
- Screenshots/video require human review and approval before publication. Original source media, raw source passages, private packets and access credentials do not belong in the public evidence package.
- Sponsor eligibility, final video approval and platform submission are not established by this page.
