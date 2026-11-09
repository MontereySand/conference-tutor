# Conference tutor review rules

- Every talk claim cites a chunk retrieved in the same request. Reference additions are attributed separately. Keep lib/lesson/schema.ts and validate.ts consistent.
- Bind asynchronous results to TurnKey. Abort/discard stale results on profile, source, language and turn changes.
- Microphone only after a press; audio only after Listen. No spontaneous recording or speech.
- Four locale dictionaries share a typed key contract. No silent English translation fallback.
- Never put secrets, question text, profile facts, answers or transcript text in logs/spans. Metadata only.
- Paid calls need budget admission, maxRetries: 0 and server-observed usage settlement. Aborts retain holds.
- Profile facts may change explanations, never source claims; explicit corrections override profile cues.
- Use palette tokens. Burnt orange at most once per view, never body text. Preserve focus, reduced motion and keyboard access.
- Never commit prepared data or paste transcript text, reference excerpts or profile facts into code, fixtures, tests or documentation.
- CI and build must work without private data or credentials. Do not publish local images or deploy publicly.
