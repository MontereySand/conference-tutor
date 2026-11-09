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

The theatre release uses the supplied audio and includes 45 bilingual prepared, source-cited definitions. Alignment preserves uncertain original intervals rather than inventing word precision. Fifty existing talk documents received timestamp-only partial updates; all returned 200, and all 63 talk chunks matched the updated canonical timestamps afterward. No semantic-text field, new index or re-embedding request was sent.

## Gitar — actual feature reviews and addressed findings

[Core tutor PR #2](https://github.com/MontereySand/conference-tutor/pull/2) was checked at exact head `ffc507e47f60ba89fcf4b610b21cf1484823e7e0` and merged on November 9 at 20:57:20 UTC as [007c90baee403ac69f2da005defb741ac31b3e8d](https://github.com/MontereySand/conference-tutor/commit/007c90baee403ac69f2da005defb741ac31b3e8d), preserving ancestry.

- [Gitar's approved / three-closed summary](https://github.com/MontereySand/conference-tutor/pull/2#issuecomment-6750223096), [successful exact-head Gitar check](https://github.com/MontereySand/conference-tutor/runs/129407116251), and [successful exact-head CI](https://github.com/MontereySand/conference-tutor/actions/runs/42690062707/job/129407144338).
- Resolved findings: [reference citations must not count as talk support](https://github.com/MontereySand/conference-tutor/pull/2#discussion_r4517305457), [malformed model output must not be treated as a client 400](https://github.com/MontereySand/conference-tutor/pull/2#discussion_r4517305628), and [arbitrary Host/origin trust](https://github.com/MontereySand/conference-tutor/pull/2#discussion_r4517341417).
- [Infrastructure PR #1](https://github.com/MontereySand/conference-tutor/pull/1) was incorporated and automatically closed/merged. Its [wiring resolution](https://github.com/MontereySand/conference-tutor/pull/1#issuecomment-6751283451) records the mounted RUM component and called telemetry helpers. Wiring does not establish received telemetry.

The approval above is Gitar's summary/check, not a formal GitHub `reviewDecision` approval (that field was empty). The signed-in installation was separately restricted to this repository.

[Integrated finish PR #3](https://github.com/MontereySand/conference-tutor/pull/3) passed [CI](https://github.com/MontereySand/conference-tutor/actions/runs/42709196236/job/129473909923) and [Gitar](https://github.com/MontereySand/conference-tutor/runs/129473894711) at `24f0dac0dfa5b2d54e5b8ff038d578390a6c0072`, then merged as `e7a4da369827a988dc0c3b9bddbcf453d2fa44e0`. Gitar identified a shared login allowance that could lock out every judge. Auto-apply was enabled and pushed a per-forwarded-IP patch, then paused because the proxy header's trust was unproved. The final reviewed replacement instead requires a generated high-entropy bearer credential, ignores forwarded IPs and removes the shared login counter. It retains bounded bodies, constant-time comparison, origin/host checks and secure sessions; no volumetric DoS protection is claimed. The [rationale](https://github.com/MontereySand/conference-tutor/pull/3#issuecomment-6752789777) corrects Gitar's stale dashboard description. Automated approval is not a substitute for inspecting its patch.

[Release evidence PR #4](https://github.com/MontereySand/conference-tutor/pull/4) subsequently received a whitespace-only auto-applied patch, inspected against its parent, and passed CI with Gitar's approved summary. Review and CI auto-apply are enabled. Repository guidance limits review fixes to low-risk changes, but is not an enforced security boundary; exact-head inspection remains required.

[Theatre UI PR #5](https://github.com/MontereySand/conference-tutor/pull/5) merged as `4d2f952cbb2ab16e586854156c45e53347fc0246`. [Exact-head CI](https://github.com/MontereySand/conference-tutor/actions/runs/42718646832/job/129506621786) succeeded at `95ee5a94be44dd4e3bcd668a5ecb3b253dec4a25`; [Gitar's final summary](https://github.com/MontereySand/conference-tutor/pull/5#issuecomment-6754010529) is approved with all four findings closed and auto-apply on. The final bot patch corrected a profile change during pending language navigation; it was inspected and exercised with actual delayed browser navigation before merge. No separate final-bot-SHA Gitar check is claimed.

## Dash0 — received telemetry and actual Agent0 analysis

[Server telemetry](../lib/telemetry.ts), [server initialization](../instrumentation.node.ts), and [browser RUM](../components/telemetry/rum.tsx) produced real received data during the rehearsal: 46 server spans and three completed-lesson logs for three original requests, matching browser request trace IDs, populated stage/outcome/RUM metrics, and a rendered three-panel dashboard. These are bounded historical observations, not a production benchmark or final-release test.

Agent0 inspected an actual rehearsal trace and reported generation at 3.915 seconds versus retrieval at 0.256 seconds, approximately 92% versus 6% of its 4.25-second server request. It could not name the generation backend because host metadata was not retained. No failure was manufactured and no root-cause fix is claimed.

Independent inspection found no question/answer/profile-identity or credential keys in the sampled server attributes. Actual browser log and trace bodies were also captured privately: sanitized URL components, vitals, HTTP method/status and response byte-size metadata were present, not source/answer bodies. This is sampled privacy evidence, not an exhaustive guarantee. Browser and server trace IDs correlate; direct parent-span continuity was not established. Original captures/dashboard/Agent0 screens remain private pending publication approval.

## Radar — actual deployment Checks and investigation

Before app deployment, read-only CLI observations on November 9 at 20:56:31 UTC showed the existing local kind node Ready and Radar 1.20.2 ready 1/1 with zero restarts. Signed-in Radar observations at 20:58 UTC showed that existing cluster Connected. This is actual connection/baseline evidence, not proof of the tutor release.

The baseline Checks screen reported **170/217 passing, one High and ten Medium**. These findings predate the app deployment; their individual resource ownership was not established. They must not be described as app defects fixed by this release or as an all-clear.

After the interim local deployment, Checks reported **197/247 passing**, with actionable findings increasing from 13 to 16. Radar's assistant reported 1/1 ready at one snapshot; its assessment remained **Still open**, with incomplete history and two unavailable citations. This was genuine operational use, not an all-clear or a repaired incident. The final local container at `e7a4da369827a988dc0c3b9bddbcf453d2fa44e0` subsequently returned relevant English/Spanish search results and rejected foreign/missing Origins with 403, eliminating the earlier observed 503 path.

The earlier `e7a4da` revision was deployed on the existing free event team, with no duplicate environment. [Guarded deployment](../scripts/deploy-hosted.sh) preserved the 2/2 starter and switched the Service only after the tutor candidate became ready 1/1. That historical code-only AMD64 image was pinned as `ghcr.io/montereysand/conference-tutor@sha256:dfd5f3e50722306e9f7ffc36c4e470ab4bea9e0521047c3f2d9c8f3be049522d`; anonymous retrieval verified its manifest, config and all eight layers by hash/size. Ten privately mounted runtime files matched its input digest `fe917858f814dd991ec1b4ad42aba2bfac7fa208fe60646c7c07876a1ee5781e`.

The [earlier image workflow](https://github.com/MontereySand/conference-tutor/actions/runs/42709703065) first failed during manifest publication even though its AMD64 child was retrievable. One authorized rerun at the same code SHA succeeded without permission/source changes; the first denial's root cause is unproved. That historical deployment used the independently verified first child digest, not the rerun's different tag/index digest. The pre-push assertion checked top-level private paths and revision; it was not a recursive content scan.

Actual HTTPS checks covered anonymous HTML/RSC/API isolation, wrong/correct passcodes, Secure/HttpOnly/SameSite=Lax cookies and foreign/missing-Origin rejection. An authenticated browser searched a moment, played the original YouTube video, received an English cited lesson, followed its citation to 687s, then returned to its saved 724.097s position and resumed playback. These are bounded functional observations, not human approval of UI design or timing accuracy.

### Current theatre deployment

Runtime code: `4d2f952cbb2ab16e586854156c45e53347fc0246`. The [code-only image workflow](https://github.com/MontereySand/conference-tutor/actions/runs/42718997811) succeeded on its first attempt, including the top-level private-path assertion. The deployed AMD64 child is `ghcr.io/montereysand/conference-tutor@sha256:aad538157b97a1f04a4416d06e81672e4699037c270a1cea794d5188eab16bd6`; anonymous retrieval verified its manifest, config and all eight layers, totaling 101,295,828 bytes, by hash and size. The assertion is not a recursive content scan.

The existing guarded deployment completed as `ct-hosted-2ee8dad5f47863c2`. HTTPS health reported the full runtime SHA above; anonymous HTML and RSC returned login redirects and the anonymous ask API returned 401, with private/no-store caching. The authenticated browser rendered Intro. Prepared inputs were recomputed immediately before rollout: ten files, 560,148 bytes, aggregate digest `4470c1591ca0de91eb8e590daa6610acda9023b47f30aac48a668d25cd9bf467`. A post-rollout running-pod hash comparison and final authenticated hosted playback/answer pass were not completed: the user took over further checking. No new-release telemetry query or Radar all-clear is claimed.


## Release and review limitations

The integrated Intro → Learn candidate passed 109 Vitest cases, 30 hosted-deployment checks, lint, production build and type checking locally. Subsequent edge repairs passed 18 focused tests, including two new stale-answer/bookmark regressions; budget/alignment checks passed five focused tests. Final PR-head CI passed as linked above. Local browser checks covered the profile fan and real search, a 16:9 four-panel canvas, caption selection/annotation, and genuine cited answers while video continued. Correction and Spanish regeneration preserved the original question timestamp as the player advanced. Further hosted acceptance is now user-owned; these local observations are not a substitute for it.

- The event judge environment expires November 13, 2026. Deployment, anonymous image retrieval and the bounded current-release HTTPS checks above are observed; private delivery of the judge credential is still being arranged. No credential is published.
- Spanish translations are machine-generated and not native-reviewed. Unreviewed sentence intervals remain derived; the human timing target has not been established. Review of all 14 minimized cards is also pending.
- Voice is not included in this build. No physical presenter-remote verification is claimed.
- Screenshots/video require human review and approval before publication. Original source media, raw source passages, private packets and access credentials do not belong in the public evidence package.
- Sponsor eligibility, final video approval and platform submission are not established by this page.
