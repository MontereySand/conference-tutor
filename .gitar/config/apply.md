Automatically fix only low-risk findings. Skip changes to authentication, authorization, trusted proxy headers, credential handling, private-data publication, telemetry payloads, deployment ownership, and paid-call admission.

These criteria filter review fixes only; CI fixes are independent. Every pushed patch still requires exact-head review before merge. Do not auto-merge.
