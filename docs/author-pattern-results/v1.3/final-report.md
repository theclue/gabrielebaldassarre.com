# Corpus-20 consolidation v0.6 — step-2 run report

**Technical PASS:** four native dimension sessions, one prepare and one accepted submit each; no correction, replacement or orchestrator retry. All twenty fresh v1.3 records passed the eligibility gate before projection. The run stops at candidate consolidation, not author-model approval or step 3.

Verified dataset corpus hash: `bc061167c298415d96547a6709c21aa6889a48814793726d55b670f4c46502f5`. This hashes twenty full-record fingerprints and is distinct from the extraction manifest's raw YAML hash. Methods are `consolidate/6`, `observation-projection/1`, `author-pattern-consolidator/0.6`, with the self-contained local v0.6 schema.

## Accepted dimension files

| Dimension | Groups | Grouped observations | Unclustered | Local-only groups | Bytes | Canonical SHA-256 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| [rhetorical](rhetorical.json) | 13 | 33 | 23 | 1 | 27119 | `c8b5cf945df6e43f477300df025c536f9168e65cf8eaa076d656fb2f8775dda0` |
| [epistemic](epistemic.json) | 16 | 41 | 14 | 5 | 27350 | `57544ad260e6418087922e883e5d7173516bd8ea7e74fb73519bb4915f90b8de` |
| [semantic](semantic.json) | 9 | 21 | 25 | 4 | 18336 | `8fd77c9b3b248ab0ada18d49bc2e407c3dc360c18c8f9c4a6e8b906cffbcc4cd` |
| [decisional](decisional.json) | 14 | 36 | 24 | 6 | 28685 | `a070df8a4229fc3cb075d248f7da308f3388e7e448052f938a6d473b753b9d08` |

All groups have code-derived IDs: `APC::RNNNN`, `EPC:ANNNN`/`EPC:ENNNN`/`EPC:TNNNN`, `SPC::CNNNN`/`SPC::RNNNN`, and `DPC:ANNNN`/`DPC:ENNNN`/`DPC:TNNNN`. Scope/relevance remain independent for rhetorical groups; other vocabularies are unchanged. Do not carry old approvals or ID identities across corpus/input hashes.

## Original native identities

| ID/dimension | Session | Prepare message / call | Submit message / call |
| --- | --- | --- | --- |
| rhetorical | `ses_ec5b33414ffec4A1c3gnCZqFyW` | `msg_13a4ccc25001jDh1vnEsuicivH` / `call_YsUrPWUIuXV1tXxvVn1M7lns` | `msg_13a4cde10001Awl6SYYN39OQHI` / `call_DS0h4L5UWuUqqVpCMtY7QjwQ` |
| epistemic | `ses_ec5b33403ffeojJHXD3TVFycJF` | `msg_13a4ccc3d001W3wcK3gMOH4JOJ` / `call_TfONiDnjF1ALaPdgNNDJUdMw` | `msg_13a4cddaa001gylD1vn4M2mNVQ` / `call_LASUBubm3XwpRcxmd8juCqHT` |
| semantic | `ses_ec5b333f8ffeOR5SYUZGtgsdLF` | `msg_13a4ccc4d001m0XrzbXPPNfXn8` / `call_RvBimcJXSHckDsfvAgx9K0oa` | `msg_13a4cddf0001G7je44sCWvNY2j` / `call_zQzqe4glEFaVorR4MVgqbw0l` |
| decisional | `ses_ec5b333d9ffe6EioVF67rxYUDe` | `msg_13a4ccc5f001GIWv9UJ9vLXaLV` / `call_iFg3T1kJQHO8hE20ZUfQcHKm` | `msg_13a4cddce001k0mAb0u2KagsqN` / `call_I63MxczNI9kotZiqJIHEOI5g` |

- rhetorical input hash: `0c600651749639d4551986edc685b2df4cab55082ba0a9d3d6036e0b1960887a`; prepare SHA-256 `72ac28f9d390c8b5daf6890b834ae7723c1986b7fac6faebe1ef6c7b4fe6e205` (30689 bytes).
- epistemic input hash: `ff7b77517c445abbb3797395f42d115fb190a4d11e2fd5040ea79a46f8880682`; prepare SHA-256 `27fdd8a123bc8dd7a1a65e7c37986d8b6b04b570d9be205a60e84104fb9c922f` (31352 bytes).
- semantic input hash: `5e76f6940ff13135dadf2dec12bde653e8a8235e725d40057b1bbb2bbffb2592`; prepare SHA-256 `2368bcdb5af32a0b9f8043a702751d4ae2211f4a3540ac6676f2bf8990885654` (25679 bytes).
- decisional input hash: `844a36d0fb1d2d9e6ece30e4ed8d69dd9b3278f0956933064190a3c6cb6d48fa`; prepare SHA-256 `a43cdb6f5029fbca65427ab10592acff8062a34958ed4d79ee40fe6ab9584714` (33341 bytes).

Native results were selected by session, assistant message, tool name and call ID through the native API. Collection and direct-message retrievals agreed. Each completed prepare/submit returned exactly one text item with no native truncation. Prepare text and the entire submit envelope, including canonical JSON, byte-matched offline producer replay on frozen inputs. Saved files are the original canonical UTF-8 bytes, not assistant prose or reserialized copies. Producer flags alone were not used as transfer evidence. These checks establish the tested producer/native retrieval boundary, not provider attention or semantic entailment.

## Deterministic step-2 bundle

The offline core finalized the four accepted strings twice to identical bytes. [consolidated-candidates.json](consolidated-candidates.json) has 89080 UTF-8 bytes, SHA-256 `4da5e79e43b4e317ecb396ae53dd71f126638f048bea6d2071e667771081ad68`. All 217 observation IDs occur exactly once across retained group support and final unclustered entries; no support was lost or invented.

- Retained rhetorical: 12.
- Retained author_candidates: 3.
- Retained editorial_format: 3.
- Retained thematic: 13.
- Retained semantic_concepts: 4.
- Retained semantic_relations: 1.
- Final unclustered: 88 non-semantic, 33 semantic. Single-article groups become LOCAL_ONLY entries; their original accepted groups and IDs remain in the dimension files.

Finalization preserves accepted IDs, support, classification and interpretation. Every retained group is `unreviewed`. Cross/recurrent statuses count distinct source articles only, not independent examples or distinctive authorship. Related series, generic technical conventions and period/topic confounding need human judgement; this is not an avatar, ontology or release.

## Validation and isolation

The local suites passed 73 core/adapter tests and four integration tests. Native transfer checks above are separate evidence, not inferred from those tests. Source containment, strict schemas/JSON, exact quotes, frozen input hashes, twenty-source completeness, exclusion checks and rejection of old-record/new-dataset mixtures are enforced. All 53 protected historical JSON files/source posts retain their pre-run hashes; historical extraction and consolidation records remain verifiable with the retained manifest/contracts. No Jekyll build, deploy, global configuration change, provider fallback, style-model promotion or step-3 action was performed.
