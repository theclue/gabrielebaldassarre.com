# Author-extraction v1.1 pilot report — A12

## Status

The bounded A12 v1.1 pilot has a native `accepted` candidate record, persisted byte-for-byte from the authoritative `canonical_json` field. Outcomes are: **technical PASS** (T4; offline suite 28 passed, 0 failed), **formal/hash/provenance PASS**, **independent quality GO** (no blockers), and **combined pilot gate PASS**. Under the user's conditional authorization, the remaining eleven allowlisted articles were processed in separate bounded runs. All twelve canonical records are accepted and byte-verified; all observations remain `unreviewed`. See the [final corpus report](final-report.md) for corpus-wide verification and limits. This status does not promote any candidate to an approved record.

## Authorized run and native evidence

- Scope: `pilotA12`; one article and one session; provider/model explicitly selected as `github-copilot/gpt-6.1-sol` (`variant: default`); six-step ceiling for a user turn and two-submit ceiling for the session. No provider fallback, recovery session, or orchestrator retry was reported. Three assistant messages/steps were observed within the turn ceiling, with one prepare and one submit and no correction.
- Session: `ses_ecf08f2a4ffeE1yI0p0REBY2Oc`; prompt message: `msg_130f74bcb001VpMKc7deK45mB7`.
- Read-only retrieval: OpenCode CLI `opencode api session.message.get`, selecting each message by session and message ID with the repository directory. The direct message results identified the expected `author_extraction_prepare` and `author_extraction_submit` tool parts by tool name and call ID. The parallel native collection/direct-lookup comparison reported for this run matched; this report relies on the direct message results for the byte checks below.
- Prepare: message `msg_130f74bf300147AAZkhrDINFQn`, call `call_iSPF4dPnEdjg5WzjYQdIUKMP`; one text item, 24,017 UTF-8 bytes, SHA-256 `2e175a399a3bb5fdb603f8b25745bf6f7f98e354dab1af5b1c58db9b48cdb910`. Native status was `completed`, metadata `truncated: false`.
- Submit: message `msg_130f755670011ablZMy6216J7E`, call `call_olNolUoeIrAcXHNti5GYkEfT`; one text item, 6,614 UTF-8 bytes, SHA-256 `6fe880ae7e419a1fcae90e8b6ed60f5fef5d42545e63e1bcffab6860db424364`. Native status was `completed`, metadata `truncated: false`. The tool-result envelope itself reports `status: accepted`; `completed` alone is not treated as acceptance. Both tool outputs are below the 51,200-byte ordinary output cap, and no truncation marker was present.
- Runtime figures reported by the operator: USD 0.0384522; 12,092 input, 1,221 output, and 95 reasoning tokens. Transport retry count was not exposed; no orchestrator retry was reported.

## Persisted record and provenance

- Record: [`A12.json`](A12.json) in the user-approved `docs/author-extraction-results/v1.1/` destination, exact UTF-8 bytes of the submit envelope's `canonical_json` string; no reserialization, rewriting, or trailing newline. It is the authoritative canonical record, not the surrounding envelope or assistant prose.
- Exactness check: saved record is 6,037 bytes, SHA-256 `df925f0f3fba3f599c1581ee46e6d21226447a4d9744362c3c1490c3ddfe5910`; byte-for-byte comparison with the extracted native `canonical_json` succeeded.
- Schema: `author-extraction/1.1`. Article: `A12`; source path `_posts/devops/2026-05-27-una-shell-history-per-ogni-progetto.md`.
- `input_hash`: `686d1bec824d01731ba94314e80306339229619f89b24e1807126927ae2d4cc4`.
- `corpus_hash`: `31ab2684da116696a53686fafa0dbe0adee6d6a3532d50ce4bde03e89cdc7d40`.
- `file_hash`: `836105877667f1412803479c93c3891cbb8a9adf52d888f2c4d4f8b97c724e24`.
- `schema_hash`: `063c71461104299b4cfae449d1c32f24642c76fcfe0d9a8340a7023a48fa1047`.
- `instructions_hash`: `6fb281e871a48583b9ed9d9780973f2997e27d00cd11ecbcbb509f2af6ed5c22`.
- Method versions: `prepare/1`, `raw-blank-lines/1`, `raw-body-counts/1`, `author-extractor/1.1`.
- Preparation reports a raw Markdown body of 9,377 UTF-8 bytes, 137 nonblank lines, and 62 raw passages. The record contains nine observations: rhetorical 3, epistemic 2, semantic 1, decisional 3; every observation has `review_status: unreviewed`. `processing.status` is `not_tracked`; `passages_total` is 62, `passages_with_observations` is 10, and processed/failed are null. These fields are not evidence that all passages were analyzed. `advanced_stylometry` remains `not_computed`.

## Review boundary

The independent reviewer checked all nine pilot observations against the article and cited passages: labels and descriptions were supported, dimensions and `inference_kind` were coherent, and no global claims were made; no blocker was found. This qualitative assessment is limited to this pilot. It is not human author approval, universal proof of truth or entailment, or evidence of exhaustive article coverage. All nine stored observations remain `unreviewed`, and `processing` remains `not_tracked`; the review does not change the record. The user's prior conditional authorization, after the selected pilot gate passed, allowed the remaining eleven bounded runs; their outcomes and the corpus-wide limits are documented in the [final report](final-report.md).
