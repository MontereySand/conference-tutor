# Conference tutor

Understand the hard part of a technical talk, then return to the same moment. Elasticsearch is the source/retrieval layer; explanations stay tied to retrieved evidence. General mode or a supplied professional card changes the explanation, not source facts.

## Private inputs, public code

Code is public; the talk transcript, reference excerpts and profile cards are prepared privately and are **not** in this repository. A clone builds and runs its inline-fixture tests without them, but cannot provide the private tutor experience until the prepared data is supplied. No public backend or dataset download is offered. Local container images include private data and must never be pushed.

Before the 11:00 build window: scaffold/dependencies, English transcript and derived intervals, chunks, reference bank, 13 minimized professional cards, four concept windows and local tool/account setup were prepared. Application implementation resumes from that scaffold.

## Local run

Node 26, npm, privately prepared data/ and .env.local are required for the full app.

1. npm ci
2. Supply sources.json, transcripts/, index/chunks.json, references/, concepts/, profiles/cards.json and evidence/elastic.json under ignored data/.
3. Configure OPENAI_API_KEY, ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY in ignored .env.local. Optional Dash0 values enable telemetry. SPEND_CAP_USD defaults to 25, a per-runtime admission guard, not a provider billing cap.
4. npm run dev; open http://localhost:3000.

Checks: npm run lint; npm test; npm run build; npm run typecheck. CI uses no private data or secrets.

Translations are machine-generated, not native-reviewed. Untouched sentence timings remain derived. Evaluation questions are invented, not observed learner questions. No learner database, accounts, scraping or live-web retrieval. Publication of original source media/packets is not authorized by this code repository.

Sponsor evidence and actual verification results will be recorded in docs/sponsor-evidence.md; installation alone is not proof of usage.
