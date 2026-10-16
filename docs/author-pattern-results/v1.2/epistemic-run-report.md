# Epistemic consolidation — v0.5 rerun

**Native acceptance and offline verification: PASS.** The user authorized the
epistemic ID clause and one epistemic rerun. The run used one prepare and one
submit, without repair, retry, another dimension, or extraction.

The accepted record contains **10 groups**: 4 `author_candidate`
(`EPC:A0001`–`EPC:A0004`), no `editorial_format` groups, and 6 `thematic`
(`EPC:T0001`–`EPC:T0006`). The schema also supports `EPC:ENNNN`; IDs use one
colon and independent subtype counters. **24 grouped + 10 unclustered = 34
observations**, exhaustive and disjoint. Acceptance is technical, not author or
semantic approval.

## Native identity and integrity

| Evidence | Value |
| --- | --- |
| Model, inherited from parent | `github-copilot/gpt-6.1-sol#xhigh` |
| Session | `ses_eca5a7e58ffeYe882iCAOoiLhQ` |
| Prepare message / call | `msg_135a581cf001lXIWevmwCe6aIo` / `call_GHLXsQ4ltQMosYRCNQsuDPaQ` |
| Submit message / call | `msg_135a59634001chlOYLhFFoyzui` / `call_u5WZWWVOjh5aMej8RnMle4z1` |
| Schema version | `author-pattern-dimension/0.5` |
| Corpus hash | `3c1f995417b47e321318ae804003decda2af0ea294a609479946ba78a4f371f2` |
| Input hash | `b3de95fd7ba3bcdd44a7bff92076b3cfc9b294030d7fe0122f919587c0a840db` |
| Schema hash | `cc0dbdf799a39318555d00648f759b660afbb0108de00e65b55e2f06fa17eea1` |
| Instructions hash | `2fbe548801372ceb4cda101ced4f5430ebbb0bcdca52eb466fd4616b15abcb77` |
| Canonical UTF-8 bytes | 17,287, no added newline |
| Saved JSON SHA-256 | `c40a0608b2e4639a04f96d62b629b90b6dbad29b064219596256b3ecb0b4cb70` |
| Previous epistemic JSON SHA-256 | `5555d9ebeffe04083a2017168150e54d12beefd4767dfc1a109b7dbd27dec84e` |

Original tool parts were retrieved by native session/message/tool/call identity;
collection and direct retrieval agreed. Both completed tools returned exactly
one text item without native truncation. Prepare text byte-matched offline
preparation; the submit envelope and canonical record byte-matched offline
acceptance of its original candidate. The saved JSON is the exact native
`canonical_json`, not reconstructed assistant prose. These checks do not prove
provider attention, distinctive authorship, or semantic correctness.

## Isolation and compatibility

Before/after checksums covered twelve v1.2 extraction records and four dimension
JSON files. **Only `epistemic.json` changed.** Rhetorical, semantic, decisional,
and extraction outputs retain their bytes and provenance. The v0.4 instruction
snapshot is byte-identical to the previous active instructions, preserving the
existing decisional record's verifiability.

The contract suites passed **71 core/adapter tests + 4 integration tests** before
the rerun, including epistemic subtype codes/counters, ID rejection, deterministic
membership ordering, final routing, and mixed-version compatibility. The host
exposed one active consolidator plugin with v0.5 agent instructions.

Mixed-version finalization passed in memory and preserved IDs of all nine
retained cross-article epistemic groups. One single-article thematic group is
retained with its ID in the accepted record; its observations become `LOCAL_ONLY`
unclustered entries in the final view. No final bundle was persisted and no
step-3 run was started. Reviews should reference `(corpus_hash, input_hash, id)`;
these are version-local group IDs, not permanent identities or author approval.
