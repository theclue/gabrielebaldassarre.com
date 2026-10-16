# Corpus-20 extraction v1.3 — run report

**Technical PASS:** twenty fresh native sessions, twenty prepares and twenty accepted submits; no corrections, replacement runs or orchestrator retries. 217 candidate observations and 246 evidence references. All twenty records are source/evidence-valid and processing-eligible.

The user approved the proposed A13–A20 additions on 2026-10-14. A01–A12 retain their source paths; the OpenSCAD exclusion is unchanged. The previous twelve-entry manifest is preserved byte-for-byte as `docs/corpus.v1.2.yaml`; old v1.1/v1.2 outputs and all source posts are unchanged. Existing records were not copied, relabelled or retroactively given processing receipts.

Models used the inherited `github-copilot/gpt-6.1-sol#xhigh` selection for this run, without an orchestrator fallback; this is not a permanent default. Provider transport retry counts are not exposed. Each source had its own bounded session (six-step ceiling, one authorized submit). Labels/descriptions are Italian; literal source evidence was not translated or normalized.

## Frozen inputs and method

- Manifest SHA-256: `7094d3f29db4402af47076bea502d7951cac5a710e3ac424eb9187afb58a1150`.
- Extraction schema SHA-256: `d9f42623da2b08048b615d59bedf5a6956a7fe25e387e6dadfc45f7aae7fcc30`.
- Extractor instructions SHA-256: `92c786b212e13fd10d46378405551e6abd43ce1348ff993126797ed0bb90b570`.
- Methods: `author-extraction/1.3`, `author-extractor/1.3`, `prepare/1`, `raw-blank-lines/1`, `raw-body-counts/1`, `host-session-whole-article/1`.
- Every receipt is `whole_article/complete`, from the actual native session. This operational receipt is not exhaustive cognitive attention, passage-by-passage coverage, semantic review or author approval.

## Article records

| ID | Observations / evidence refs | Bytes | Canonical record SHA-256 | Source SHA-256 |
| --- | ---: | ---: | --- | --- |
| [A01](A01.json) | 10 / 15 | 6790 | `6650efe81f5148c890a7d6d9fbb464e509607d50d6ece8d8a25c5a9338b17a40` | `c4a106a217100d67de82a3962637f52a3cf08892531d754d50d3ac01bf18f526` |
| [A02](A02.json) | 12 / 12 | 9344 | `9037d2a2a70d3857a37030a8a888bededf3538dc0b0ec6bbf9c3e9ef1cf90b04` | `aa17751085cea41199a5d7ccbdca7f5de66f4d70b80d9236722c21209f5b9e55` |
| [A03](A03.json) | 12 / 13 | 8666 | `f8488cf0caf9202a4e15fc1b47de54c34e84e5fb2c0decea9c2cd7a42f27e0f5` | `8e639a9bdde3dfe42df730b7962242b5cf09a39821652ebc786bd16449d37d33` |
| [A04](A04.json) | 10 / 14 | 6923 | `13f6266837331ee5d37a08618169690d425e46ab01642a4501ce15bc2a140054` | `e17507a9be15e98e63707400e8c4b6c6aa1c35e1d97fde6df4f78e0ed903ffcc` |
| [A05](A05.json) | 12 / 13 | 7615 | `390c16a4f51a8f908cd13ad04b004edb2cfc6458fe62a26ec09deb0369fe673a` | `42915ee6b22d7ac0221ced6780a252a19510955a6b613c61430c83b3b9d556dd` |
| [A06](A06.json) | 10 / 11 | 6446 | `4d424fe3e4d60606c4ad02519504e278e20fc0c239735ffc19feea0739308d30` | `1fc22cef0a81ad397e0616f3633ae1ff326d8960271d240283144594d61c8762` |
| [A07](A07.json) | 11 / 13 | 7961 | `eafc92285ea873caccec2bd5a5921e1f093d0295accd48b98b4a8de359805959` | `2dc6b257bc5411f7f1bec3156138772951fc7c9ca841317bb3ae30eb9b7c375b` |
| [A08](A08.json) | 8 / 11 | 7051 | `0268bf2ba8f9d3d1d954077bf097d2ceb0806513eae6085682c4e3650679b9d9` | `2bcbed9f554a9689d82575e2e8205731fea4567cb6fcd8a1e5ce67061ccda2da` |
| [A09](A09.json) | 12 / 13 | 7900 | `0c87939df2b805e83b3d9a853f95a959b12385c6f79d0535b21481b23efbc56b` | `48697f09a962f1f7b0d80042ee057df9900bef3e470f7511222ccf20265787d5` |
| [A10](A10.json) | 10 / 10 | 6982 | `c081c5468b0d9f0e0884c49c4f666ff7df22ed5c2d9a79ae93071a30472eea47` | `1bb94efcf926611d640b9fe1ee41007005d89019103a49f9001630105119b775` |
| [A11](A11.json) | 12 / 12 | 8887 | `b818697e163360a150d3e21070582b21e087c519d6074f24b646563dd0647b64` | `cac67ce2a6e254fe4b427eae422f90cb8a3ce31562efc81ede3d89fcbb029531` |
| [A12](A12.json) | 11 / 14 | 7399 | `a08e5d914439c397d9f947e79f062a2bcd75f830fb32b85a5230d6b98506c47d` | `836105877667f1412803479c93c3891cbb8a9adf52d888f2c4d4f8b97c724e24` |
| [A13](A13.json) | 12 / 14 | 8503 | `23e6ebce4c1d7720fcfa0cd22796dc4c7876f2cb8f94f89ccead3fe089f8743f` | `f35b73ed18b661a8fe790ffa25450a2a726e660a7f505d521a6abbb0015f01c6` |
| [A14](A14.json) | 10 / 11 | 7258 | `55744b86021d9e71b9249b4687f2f5d1d9cd3af74173f35b40735265cff1195d` | `4b58363b464a9ca0887eb096794239b173a27747ba51de9dc6997b02be28f678` |
| [A15](A15.json) | 10 / 11 | 7719 | `7dd3c7c9754300b4e30970395ad482d543145dae8937cb9fd5515baecea9b453` | `47f487eba6bc4c26ad4a85e1fb3587db342bc0ac65b6ee6e180ee2dd28dc93dd` |
| [A16](A16.json) | 10 / 10 | 6637 | `39ade26e209ce8bf0cc4e45c05283d24c33132edf7ffc0885720f7c8d79a5895` | `a1b03e98f9a8d9cc269dda68b40f107febf33376ea9be640626825bd1a985e76` |
| [A17](A17.json) | 9 / 11 | 6329 | `bfb316274d764d8d15fe1b23df167d55e6040c8fc094650359b166e2bfa3dbb1` | `ca9d54c6da1b573caa58d7f3a9e34d7d2e5a111cae126961c73a1d3d86d16928` |
| [A18](A18.json) | 12 / 12 | 8133 | `8e890df489c7b0498af7712611ba4c9d9391332eb3b7e7304a58cb891209f8f5` | `6c7c1e7653621ac0ff2da5413bb011f183ba4c6d13e7ac485991d4aaf29bd6c7` |
| [A19](A19.json) | 12 / 12 | 7904 | `9b565a759bbba7ac2242ae9dc0e094d638345f31e4485d00e856fac072991a70` | `f80505063c942ae08887c657b01579131879a0a71a932c075f96f91da84df4e0` |
| [A20](A20.json) | 12 / 14 | 8142 | `8baf3751856dca69064695215eb278329e2491dde68cf6521a453b08a8afe6a6` | `c2eb34de1d34ccf65124219ce35a49b2c75b49c47336177b3e4d322d6515dac5` |

## Authoritative native identities

| ID/dimension | Session | Prepare message / call | Submit message / call |
| --- | --- | --- | --- |
| A01 | `ses_ec5be75a1ffe08Al0rwQFcVSk1` | `msg_13a418aba001r8qYFuWyj0j9OJ` / `call_6FyNfTRvVYHY8NUBNPOuyHzL` | `msg_13a4194ae00185dTN3CogH6kxS` / `call_vku9duRSpLbBvSpjqnZXPcUb` |
| A02 | `ses_ec5be7574ffetZq5PgAVFDUo4Y` | `msg_13a418ad400155WTOMjZ6gpCOW` / `call_Poxy9Mf2WJnFwBRnuuLDLv4v` | `msg_13a419429001n412WywLjAy9aX` / `call_XVgruo8wUtdDShq4EhJx1Xdy` |
| A03 | `ses_ec5bbee23ffeJa9PlV4ULufnnZ` | `msg_13a44121b001iYJwsKNUrPHFEQ` / `call_LcmWJuauNAOHsosslvGiYdEV` | `msg_13a4420200018P3sMPl3jDgDUy` / `call_5b3v22EM1Jv22tyHlJT0fzTo` |
| A04 | `ses_ec5bbee22ffe6ravo3wq5sFH4r` | `msg_13a441207001AlY0ckexfh1KRV` / `call_KMlygLFL0uvS0aEh4M1OAIAz` | `msg_13a441cbc001TDmC7cwA9utDJ6` / `call_Ojqgd7avSeHChEBjeAHVjRlx` |
| A05 | `ses_ec5b9b76bffeYiQCrRqAt1zPos` | `msg_13a4648c5001n9T331hfTIVrXh` / `call_5CRzS5cKDv5MrVVQqtntDRXL` | `msg_13a465096001ZYl5BGiguYJzAH` / `call_TbKFveit6h8g8NYFxovrEVti` |
| A06 | `ses_ec5b9b72effeveby7ywfhQFmud` | `msg_13a4648f4001JAjBdfWxh6Nbnz` / `call_JrmlG6VmdJeRoYSzQw974Uen` | `msg_13a465227001ZjBaOHY3s6O7AV` / `call_pWWSh18EcOrFSXN3Xia9w1Ta` |
| A07 | `ses_ec5b7df1effeLd38j6Tvio5jFI` | `msg_13a482158001b4qYxEdX20IQa7` / `call_JwlX8VrBPqNYtuBZJUj8aa96` | `msg_13a482929001jJHWp2r1sMfiAL` / `call_Mwuw5tcs7ItI58zhEgVB6g0W` |
| A08 | `ses_ec5b7df1cffenWw8wKnI8GTHDx` | `msg_13a48214e001rZzRWJvK3aAORD` / `call_kC7gtLpk8kPETTeLtmhbrPVP` | `msg_13a4828bf001QBQNkWWwU7yDpi` / `call_Zi1hmyBLKS6h0X2YQJRDyYLF` |
| A09 | `ses_ec5b64ba6ffeieEx04fcrO6zeb` | `msg_13a49b47b001faN12IKaVhMLsH` / `call_oztukPwdNMzvCw84JY8kz8Ry` | `msg_13a49bbaf001yFDEOoYNsbS9en` / `call_4j2mqpFE2Xc3sG9TRopDSNc5` |
| A10 | `ses_ec5b64b83ffeaTrCkBQIwulMLC` | `msg_13a49b4a000120FREKYIHSQ71N` / `call_lmM85TTnuh11tMypKBH2MsdI` | `msg_13a49bb84001JCoHYeu1FYdP0e` / `call_oD9F39IDB4oIX7fIQvMfQwb0` |
| A11 | `ses_ec5b64b7bffex3Xe7hVwcEq8SG` | `msg_13a49b4ba00129WMdQvIyFpINC` / `call_anbeJgA0IO9eQa9xPrBY5V7m` | `msg_13a49c071001BuAcBZnbIHXSRJ` / `call_QopcxFuhfpViltepksPEvSjs` |
| A12 | `ses_ec5b64ae6ffeYO2TPGIFUCUiEm` | `msg_13a49b533001YNN7uWlurmXw4t` / `call_bnIYSdML9eVYSpSvLPegsy0h` | `msg_13a49bbe1001f38OuUVKAKaw8C` / `call_jy0neeiQdFRkMxt16hWU96qL` |
| A13 | `ses_ec5be75a9ffe1WLQ3Leyxynvio` | `msg_13a418aa4001p6N07cNlC95EjM` / `call_WnOwokfmeXFWanKNl3YDrAig` | `msg_13a41940c0012xrn50NTtraTEo` / `call_ZsqzwpSRbfpyOyRv4qADxvWS` |
| A14 | `ses_ec5be75a2ffegpTF7Wr6cZiarR` | `msg_13a418a9b001Td9Z4PLgAUhb5L` / `call_7JNMl9tub00GFNh9YDvMmOSE` | `msg_13a4191f2001cSu85stgYt0SOu` / `call_WyzD1VW3gn9ywGsv18jX6hip` |
| A15 | `ses_ec5bbee0fffeV0bVpPNg0rRzk9` | `msg_13a44124000116Wdb7sbPHYdI3` / `call_DV2FOGUwzq8dBmqmHyqDqHYY` | `msg_13a441f13001pzp0Dfe1IN0cad` / `call_UztbzyyLUjzINDs6yYQ3i5Ui` |
| A16 | `ses_ec5bbedd4ffebaapG7jIputvw2` | `msg_13a441260001PrVYsSHHr3rmNN` / `call_XibNpAJsfHUgsyDxOMhByQTR` | `msg_13a441ef2001b46ctwh5agZwEu` / `call_JS3mDT2y04OGlSBxTfm0xolp` |
| A17 | `ses_ec5b9b72dffe1Bh8SqhtNoV2DV` | `msg_13a4649000011XnBnracMLTovJ` / `call_8tVOoAGuZ5kcbsUiRs3OfAm7` | `msg_13a465278001TAKHMTETu4qzgq` / `call_4s88ZGQ3b8jItSmu3P1m8XMQ` |
| A18 | `ses_ec5b9b719ffe7fJcFYIiycLcB4` | `msg_13a464920001Cp4dtYaEqhhnd7` / `call_h6IxDxd1fLxXllahdnwQ5ptx` | `msg_13a465070001VbnJw84euEWEi4` / `call_R4FDC5dS8zkq0g66kYMd35cf` |
| A19 | `ses_ec5b7df1bffeWHJTdOh9Gpd44L` | `msg_13a482161001mIh8y7MrOiZOxD` / `call_FlkkxwBFngGVqZe6ihqdNZY9` | `msg_13a48294c001qoascp32K1O2j0` / `call_zOgDAyBsbMRQY0iqa9lMOyUQ` |
| A20 | `ses_ec5b7df1affeIO6oglWmwnJSKA` | `msg_13a48216a001OOkxmcPSCA8fTK` / `call_icwkj0Klpb7mFECwsrAqqQjQ` | `msg_13a482902001u5PoHMK6sbkEsb` / `call_dmC2ICh1tlYKC7hxY0Zru5cm` |

## Transfer evidence and limits

Native results were selected by session, assistant message, tool name and call ID through the native API. Collection and direct-message retrievals agreed. Each completed prepare/submit returned exactly one text item with no native truncation. Prepare text and the entire submit envelope, including canonical JSON, byte-matched offline producer replay on frozen inputs. Saved files are the original canonical UTF-8 bytes, not assistant prose or reserialized copies. Producer flags alone were not used as transfer evidence. These checks establish the tested producer/native retrieval boundary, not provider attention or semantic entailment.

- A11 oversized ordinary-output branch: 52832 prepare UTF-8 bytes; prepare SHA-256 `ef4c37d4769d9f5b4c8d4f4f06ac2b6554581660eb7dbe25b5d897e7d2e2d2d6`; exact producer/native byte comparison passed.
- A20 oversized ordinary-output branch: 66231 prepare UTF-8 bytes; prepare SHA-256 `c9c8ca9bb22f03fb79c21b5679d2fd335bdf324014ac78117b263e151abfa17e`; exact producer/native byte comparison passed.

## Dimension totals

- rhetorical: 56.
- epistemic: 55.
- semantic: 46.
- decisional: 60.

The twenty-source corpus broadens coverage; it does not establish a sufficient statistical sample, stable register, exclusive authorship or factual correctness. Series parts, domains and periods are not independent by default. All observations remain unreviewed. No source posts, author-model document, ontology or avatar were modified. Step 3 remains deferred.
