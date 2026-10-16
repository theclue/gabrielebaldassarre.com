# Rhetorical consolidation — contract v0.2 rerun

## Scope and outcome

The user authorized correction of the rhetorical contract and one new rhetorical
consolidation, replacing only `rhetorical.json`. No extraction or other-dimension
inference was performed. **Native acceptance and offline verification: PASS.**

- One native prepare and one native submit, both completed; no correction,
  replacement, or fallback in this run.
- Native model: `github-copilot/gpt-6.1-sol#xhigh`, inherited from the parent
  session, not a new permanent model default.
- `schema_version`: `author-pattern-dimension/0.2`; methods `consolidate/2`,
  `observation-projection/1`, `author-pattern-consolidator/0.2`.
- **10 groups**, IDs `APC::R0001`–`APC::R0010`, with independent
  `pattern_scope` and `author_relevance`; no rhetorical `classification`.
- **22 grouped observations + 12 unclustered = 34**, exhaustive and disjoint.
- All ten groups have `author_relevance: "uncertain"`. They are review candidates,
  not confirmed author traits or evidence of distinctive authorship.

The generic concrete-example grouping was replaced by more circumscribed
operations, including contextualizing small quantities through comparison
(`APC::R0005`) and exposing a numerical or implementation calculation
(`APC::R0009`). Their descriptions and variation notes distinguish example types,
illustration from verification, and unsupported placement/reuse claims. Those
unknowns were not filled by rereading posts or inventing evidence.

## Native result identity and integrity

| Evidence | Value |
| --- | --- |
| Session | `ses_eca9829caffezBjL2EfTC291W3` |
| Prepare message / call | `msg_13567d65e001lRuVxuTKJ9tc13` / `call_XCEoGAZZabzs5qrTcpCIjkT6` |
| Submit message / call | `msg_13567efaa001LuQxybT60XVCX2` / `call_SVjkM9eahieXZAmbgUoiNl7v` |
| Corpus hash | `3c1f995417b47e321318ae804003decda2af0ea294a609479946ba78a4f371f2` |
| Input hash | `6cc31198f9530b1df1dda5d6daabc45b0ed0c619d911373d5b0b47532d2ba306` |
| Schema hash | `0db9f3964ee6c4a6cb915565882ea63cfd4f19a8efdb474dc140306c8e3326df` |
| Instructions hash | `a43633a797b7f3a5830bbcf0494ffc4c3f373b86c937ebebdae50498a37ab647` |
| Saved canonical JSON | 20,548 UTF-8 bytes, no added newline |
| Saved JSON SHA-256 | `76adb52554a3eb46e529860e49a48a8c4bce0247af40ce1f149bac9b94617c0d` |
| Previous rhetorical JSON SHA-256 | `c406a7a52c53fff72f13598af00c785a2f9b09d44e92d66ed69782b1c295c0f3` |

Native results were selected by session, assistant message, tool name, and call
identity through the native API. Collection and direct-message tool parts agreed.
Each completed tool returned exactly one text item, without native truncation.
Prepare text matched `JSON.stringify(prepareConsolidation(...))` byte-for-byte;
submit envelope text and its canonical record matched offline acceptance of the
original native candidate byte-for-byte. The saved file matches the native
`canonical_json`, not an assistant reconstruction. Producer flags alone were not
used as transfer proof. These checks do not establish provider attention or
semantic correctness.

## Isolation and compatibility

Checksums were compared before and after persistence for all twelve v1.2
extraction records and four dimension outputs. **Only `rhetorical.json` changed.**
`epistemic.json`, `semantic.json`, `decisional.json`, and the extraction records
retain their original bytes and provenance.

Offline mixed-version finalization passed with revised rhetorical v0.2 and the
three untouched v0.1 dimensions, checked against the retained v0.1 schema and
byte-identical instruction snapshot. Original methods are retained individually
in `dimension_methods`; the ten rhetorical IDs are preserved in the final
`rhetorical_groups` view. This was an in-memory compatibility check only: no final
bundle was persisted and no step-3 workflow was started.

The local suites passed **59 core/adapter tests + 4 integration tests**. Added
checks cover the two independent axes, model-forbidden generated IDs, membership-
derived ordering, forged/duplicate IDs, preservation during finalization, schema
hash changes, and mixed-version compatibility. The native plugin was active as a
singleton; no global service restart was used.

## Review boundary

Group IDs are local to `(corpus_hash, input_hash, id)`. They remain invariant under
label/scope/relevance-only edits for identical membership sets, but are not
permanent identities across added, removed, split, or merged groups. Future
comparisons must also examine support; no human review or lineage is inferred.
Technical acceptance does not replace the author's review of scope, relevance,
grouping, or interpretation.
