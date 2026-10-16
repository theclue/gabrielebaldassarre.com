# Author-extraction v1.1 — corpus run report

## Outcome

- **Technical: PASS.** All 12 allowlisted outputs have native `accepted` envelopes and their stored JSON files byte-match each envelope's authoritative `canonical_json`. The final tester reran the offline suites: **28 passed, 0 failed**. The checks covered v1.1 final-schema validity, canonicality, current common/source hashes and provenance, IDs/counts, and exact quote membership in the currently prepared passages. The excluded OpenSCAD article is not included.
- **Independent quality: PASS, no blockers.** The reviewer assessed all 96 observations against the full articles and cited passages; labels/descriptions were supported, dimensions and `inference_kind` coherent, and no unsupported cross-source/global claims were found. The initial constrained view of only two observations was not counted as a pass; the full assessment used lossless temporary views, which are not persisted here.
- **Combined corpus gate: PASS.** This closes the user's selected formal/hash/provenance and independent-quality gate for this authorized extension. It does not approve observations: all 96 remain `unreviewed`, and all records retain `processing.status: not_tracked`, null `passages_processed`/`passages_failed`, and article-local `passages_with_observations` counts that are not coverage receipts.
- Scope/execution: exactly A01–A12, one prompt and one native session per article, one prepare and one submit per session, three assistant messages/steps observed per run, within the six-step and two-submit bounds. No corrections, replacement sessions, duplicate extraction runs, or orchestrator retries were reported. The explicitly selected provider/model was `github-copilot/gpt-6.1-sol`; no fallback was used. Transport-retry counts are not exposed.
- The twelve accepted files total **65,624 canonical UTF-8 bytes**, **96 observations**, and **111 evidence references**. The reported per-session runtime costs sum to **USD 0.5497941**; this is the sum of native-reported usage figures, not an external billing statement or a fixed cost guarantee.

## Common contract and provenance

All twelve records use `author-extraction/1.1`, `author-extractor/1.1`, `prepare/1`, `raw-blank-lines/1`, and `raw-body-counts/1`, with common current-input hashes:

| Input | SHA-256 |
| --- | --- |
| `docs/corpus.yaml` | `31ab2684da116696a53686fafa0dbe0adee6d6a3532d50ce4bde03e89cdc7d40` |
| `_scripts/author-extraction/extraction.schema.json` | `063c71461104299b4cfae449d1c32f24642c76fcfe0d9a8340a7023a48fa1047` |
| `.opencode/agents/author-extractor.md` | `6fb281e871a48583b9ed9d9780973f2997e27d00cd11ecbcbb509f2af6ed5c22` |

Each submit input's `input_hash` matched its own prepared result. Current source bytes were independently hashed against each record's embedded `source.file_hash`; all matched. Native records were retrieved read-only by session/message ID. For each row below, the selected tool part was matched by tool name and call ID, and collection and direct-message text matched; the submit envelope was `accepted` and its canonical bytes matched the persisted file. No assistant prose or reconstructed envelope was used.

| ID | Session | Prepare message / call | Submit message / call |
| --- | --- | --- | --- |
| A01 | `ses_ecefb15d2ffeUCWtspAI8L0Xfy` | `msg_131051cbf0011JX0myhYCws28I` / `call_2CrLmabsgK5woi0gbUEhAgQ3` | `msg_13105245e001j4zv2F1Sa1TXEx` / `call_7oV5h5jGMsz8filCrsxGmhh7` |
| A02 | `ses_ecef9df99ffejqojnJ0nU7LPTD` | `msg_131064158001rivAbV81Wztv87` / `call_EKsVAC4fdGJ8LcoNQGWroucV` | `msg_131064759001nwZGWkHB9QnlYL` / `call_7Vu9qXcpVDjHE1VSQ4FtWlp8` |
| A03 | `ses_ecef8cfe3ffedRG1bCSTwiLJU9` | `msg_13107551a001lwYOP4aPOF7R9N` / `call_nwBxpvAip4pxNUiNdyZs6dYW` | `msg_131075b08001w0W8oToEKh0qD4` / `call_iFsuEWTc2b10D1uDHlw4xwS2` |
| A04 | `ses_ecef79e18ffeBjgdgebKhxBuBp` | `msg_131088779001M5MeykFy4kHuYx` / `call_WjbsJBZrAClTYHYt16D7JlQM` | `msg_131088e1e0016Y1YHcUCFBGEG2` / `call_WhU4Bk0iwp1YMlTK7Ar2tqNh` |
| A05 | `ses_ecef67be9ffeY8x3pVUo5iiJfb` | `msg_13109ac5f0019DK3s6RpXiBkcf` / `call_mRJAneYoPDHnknzA26XUH6io` | `msg_13109b2ce0016SENdoZWELh4XL` / `call_PbvVabcVxPE9gJ7L2o4tbDES` |
| A06 | `ses_ecef563a6ffe0f7C7VAOXyeFAx` | `msg_1310ac843001G2DDDszg54T6NZ` / `call_LtYfHmJJQB6Z7UDVVHkfMfpU` | `msg_1310ace87001UWe2pmNU2CEgMo` / `call_qrv2JXMfzamUy0DrS5jbJzVs` |
| A07 | `ses_ecef46a85ffeMApiDMmrAbrZCM` | `msg_1310bbd0e001730U6uLPWkAA59` / `call_0DpnxR77o8jsgcF5xmeGYsVh` | `msg_1310bc2e5001l53fq6ZupYtIy9` / `call_rIztJgWqoZAD92LUrQ4eb387` |
| A08 | `ses_ecee68b9cffe0E73Crq2qjs9d7` | `msg_13119b854001Sou0YOl131ZDbx` / `call_Mb2f1OIw8RvxACFMfZcMDBva` | `msg_13119c39e001gpXx2qgkzd0yYf` / `call_HHAOAdt6YVdrQKU2akQZcMZR` |
| A09 | `ses_ecee19f19ffekicFvJdrDyzdFM` | `msg_1311e8cd6001LMHGRkprB1tSqI` / `call_V1nErtjQoNUR1ccG7uuwRSf7` | `msg_1311e94cb001CaxYH9gM4aIpTz` / `call_iZ7xUNFdTm01frCcWhHwNq53` |
| A10 | `ses_ecee084b3ffeERYKhsy0nS4A9T` | `msg_1311fa4260017jX9ZTHEQs63Qu` / `call_OO1Z658qMWhr3kAZ9mRvdgRW` | `msg_1311fad1c001br2pKQjj0VuXJO` / `call_TJTZEPE1muo0bv09MEhTn3Qq` |
| A11 | `ses_ecedf5aaaffe3FrgqcrUuXZGFL` | `msg_13120dec4001tQC2xCAnGZHtfK` / `call_7r6d3PNVjkmwUzuMZ3rU3l44` | `msg_13120e8a7001wealu9QZGw3wHm` / `call_CaSRFOmY5V4IYUiTQdtuAl2C` |
| A12 | `ses_ecf08f2a4ffeE1yI0p0REBY2Oc` | `msg_130f74bf300147AAZkhrDINFQn` / `call_iSPF4dPnEdjg5WzjYQdIUKMP` | `msg_130f755670011ablZMy6216J7E` / `call_olNolUoeIrAcXHNti5GYkEfT` |

## Per-article records

The `source` path and `file_hash` below are embedded in each canonical record; current file bytes were checked against those hashes. The JSON SHA-256 is for the saved canonical UTF-8 bytes. Costs are reported per native session.

| ID | Canonical record | Source path | Current source SHA-256 | Bytes / record SHA-256 | Observations / evidence refs | Cost USD |
| --- | --- | --- | --- | --- | --- | ---: |
| A01 | [`A01.json`](A01.json) | `_posts/reti-sociali/2018-07-13-introduzione-autovettori-autovalori.md` | `c4a106a217100d67de82a3962637f52a3cf08892531d754d50d3ac01bf18f526` | 5,224 / `4a4d8d0c7433429c3dd20efd45c1070c163d7b160fc322c033a789e12a491d56` | 8 / 12 | 0.0559839 |
| A02 | [`A02.json`](A02.json) | `_posts/reti-sociali/2018-07-29-community-network-model.md` | `aa17751085cea41199a5d7ccbdca7f5de66f4d70b80d9236722c21209f5b9e55` | 5,266 / `987771489d681d10ed7fc98dcd2b9ed3c96556a3c54f12122c920b5604c20fdd` | 8 / 8 | 0.0493803 |
| A03 | [`A03.json`](A03.json) | `_posts/reti-sociali/2018-08-12-legge-potenza-powerlaw.md` | `8e639a9bdde3dfe42df730b7962242b5cf09a39821652ebc786bd16449d37d33` | 6,511 / `37f20fe2eda1bdcb5d79e5ae0520e87bf899c69e3fb952da6f854fdc40c1b6bd` | 9 / 9 | 0.0624155 |
| A04 | [`A04.json`](A04.json) | `_posts/fisica/2019-09-18-logica-quantistica.md` | `e17507a9be15e98e63707400e8c4b6c6aa1c35e1d97fde6df4f78e0ed903ffcc` | 5,072 / `72d54c0d82d3c7c8f43aec08e5088aa2b7861c04921d9de74339fb6026ea0a45` | 8 / 9 | 0.0389425 |
| A05 | [`A05.json`](A05.json) | `_posts/fisica/2019-10-04-spazio-stati-quantistici.md` | `42915ee6b22d7ac0221ced6780a252a19510955a6b613c61430c83b3b9d556dd` | 4,797 / `ba631b511a1306db9122251432d001fb94a829b3f137067cb5451dad940d3945` | 8 / 8 | 0.0422777 |
| A06 | [`A06.json`](A06.json) | `_posts/fisica/2019-11-06-teorema-energia-cinetica.md` | `1fc22cef0a81ad397e0616f3633ae1ff326d8960271d240283144594d61c8762` | 5,047 / `6fa19b8f61910f9c8d0fa4d1869db0c598e4278b4dce9b919c026659ce957d9f` | 8 / 8 | 0.0433740 |
| A07 | [`A07.json`](A07.json) | `_posts/meccanica/2019-10-31-spazio-degli-stati.md` | `2dc6b257bc5411f7f1bec3156138772951fc7c9ca841317bb3ae30eb9b7c375b` | 4,611 / `35e017a23f29e08c50d58df462e24c01ab29d6dfd52360084ced960d812f140c` | 6 / 7 | 0.0405473 |
| A08 | [`A08.json`](A08.json) | `_posts/fisica/2021-05-06-elettronvolt.md` | `2bcbed9f554a9689d82575e2e8205731fea4567cb6fcd8a1e5ce67061ccda2da` | 4,720 / `c92679985412a194ab3fac01815f0843af7f68cc6eb9d86094ce1c8debe7ea50` | 6 / 7 | 0.0270330 |
| A09 | [`A09.json`](A09.json) | `_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md` | `48697f09a962f1f7b0d80042ee057df9900bef3e470f7511222ccf20265787d5` | 6,063 / `e55615f44a89c61a0b4fc407dacebd4f5801288709ac1b7404d23968dab38218` | 8 / 11 | 0.0452357 |
| A10 | [`A10.json`](A10.json) | `_posts/home-assistant/2026-05-10-dashboard-astrometria-parte-1.md` | `1bb94efcf926611d640b9fe1ee41007005d89019103a49f9001630105119b775` | 6,372 / `907e3f379c86ee12660db898fd9e0cb7759bd18655b974e6d9d3028110a2329f` | 9 / 10 | 0.0551086 |
| A11 | [`A11.json`](A11.json) | `_posts/devops/2026-05-16-seo-automatico-jekyll.md` | `cac67ce2a6e254fe4b427eae422f90cb8a3ce31562efc81ede3d89fcbb029531` | 5,904 / `e7b420369079c09d199e994954df74fd71f6bf0e930f496d488ed8cab6cac66b` | 9 / 9 | 0.0510434 |
| A12 | [`A12.json`](A12.json) | `_posts/devops/2026-05-27-una-shell-history-per-ogni-progetto.md` | `836105877667f1412803479c93c3891cbb8a9adf52d888f2c4d4f8b97c724e24` | 6,037 / `df925f0f3fba3f599c1581ee46e6d21226447a4d9744362c3c1490c3ddfe5910` | 9 / 13 | 0.0384522 |

## Delivery and review limits

For A01–A10 and A12, retrieved prepare text items were below OpenCode's ordinary 51,200-byte tool-output cap. A11 is the boundary case: its native prepare text was **52,782 bytes** for 104 passages, SHA-256 `fddcbfcee4416812cc68180f810ab36eb8f25190c3121dc9102c3bf41d7b5afa`. The independent offline check byte-matched that producer text to `JSON.stringify(prepareArticle(repoRoot, 'A11'))` on current inputs; the accepted A11 canonical record and input hash also matched. Collection/direct full-message retrievals agreed. `metadata.truncated: false` was not used as the sole proof. This establishes completeness at the tested producer/native-retrieval boundary, **not** that the provider received, attended to, or consumed every passage; no such claim is made.

The quality review is a bounded candidate-quality assessment for these twelve records only. It is not human author approval, factual/physical correctness review, HA/SEO correctness review, universal proof of truth or entailment, or evidence of exhaustive article coverage. The reviewer found no general author traits or unsupported global claims. Observation counts, four-dimension presence, and `passages_with_observations` are not completeness requirements or passage-coverage evidence. Do not promote, deduplicate, or merge these records into an author profile without a separate authorized review and workflow.
