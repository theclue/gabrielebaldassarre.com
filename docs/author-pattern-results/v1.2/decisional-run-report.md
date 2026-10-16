# Decisional consolidation — v0.4 rerun

**Native acceptance and offline verification: PASS.** The user authorized one
new decisional consolidation and replacement of `decisional.json` only. There
was one prepare and one submit, no repair/retry, other-dimension run, or extraction.

The accepted record contains **12 groups**: 2 `author_candidate`
(`DPC:A0001`–`DPC:A0002`), 3 `editorial_format` (`DPC:E0001`–`DPC:E0003`), and
7 `thematic` (`DPC:T0001`–`DPC:T0007`). IDs have one colon and separate subtype
counters. **32 grouped + 7 unclustered observations = 39**, exhaustive and disjoint.
Acceptance remains technical; no author or semantic approval is implied.

## Native identity and bytes

| Evidence | Value |
| --- | --- |
| Model, inherited from parent | `github-copilot/gpt-6.1-sol#xhigh` |
| Session | `ses_eca6f47caffe4rbBf0YL41gRQD` |
| Prepare message / call | `msg_13590b85e001Y2MG7rBbyDpWoY` / `call_CaXBSdVOe7doTql2utcbpNda` |
| Submit message / call | `msg_13590c18c001M5q5IaR3BG9feb` / `call_kREhKbXbpCzi2yiY2BoNVvmm` |
| Schema version | `author-pattern-dimension/0.4` |
| Corpus hash | `3c1f995417b47e321318ae804003decda2af0ea294a609479946ba78a4f371f2` |
| Input hash | `d8797308b7d6e46f04bf55ff6daaf913d5532b50bb3dbc269d94ef0a084067b7` |
| Schema hash | `82bafaa186cb28e026aec678c99d13f99fca03a342303e096468b1ddddd04d29` |
| Instructions hash | `42052020b0c42ef41ad26527617460fea3c4ba0fdacf3b49685cc486eeb5b46c` |
| Canonical UTF-8 bytes | 18,361, no added newline |
| Saved JSON SHA-256 | `8bbc66f6ba197af4f1fec3f33178bd4684db593afcfc19a40fa92e78a5dbf788` |
| Previous decisional JSON SHA-256 | `8db7d9d6df60f03e264d1a8fd2003986924b6c486cd75acee1a2fdc10280acab` |

Original tool parts were retrieved by session/message/tool/call identity through
the native API; collection and direct retrieval agreed. Both completed tools
returned exactly one text item without native truncation. The prepare text
byte-matched offline preparation; the submit envelope and canonical record
byte-matched offline acceptance of its original candidate. The saved file is the
exact native `canonical_json`, not assistant prose or reserialized JSON. These
checks do not establish provider attention or semantic entailment.

## Isolation and finalization boundary

Before/after checksums covered all twelve v1.2 extraction records and four
dimension files. **Only `decisional.json` changed**; rhetorical, epistemic,
semantic, and extraction outputs retain their bytes and provenance.

Mixed-version finalization passed in memory, preserving IDs of the seven retained
cross-article decisional groups and their classification-based routing. Five
single-article groups remain reviewable with IDs in the accepted dimension record;
in the final view their observations become `LOCAL_ONLY` unclustered entries.
No final bundle was persisted and no step-3 workflow was started. IDs remain
local to `(corpus_hash, input_hash, id)`, not permanent cross-version identities.
