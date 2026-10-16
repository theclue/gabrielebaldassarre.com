# Identifier convention: one colon

New author-pipeline contracts use **one `:`** between namespace and local ID:

| Family | Canonical example |
| --- | --- |
| Observation | `A01:O0001` |
| Rhetorical pattern | `APC:R0001` |
| Semantic concept/relation | `SPC:C0001`, `SPC:R0001` |
| Epistemic pattern | `EPC:A0001`, `EPC:E0001`, `EPC:T0001` |
| Decisional pattern | `DPC:A0001`, `DPC:E0001`, `DPC:T0001` |

The formatting policy is centralized in
`_scripts/author-extraction/identifiers.mjs`; canonical format validation is in
`identifiers.schema.json`. New/default calls to the observation, rhetorical and
semantic formatters produce single-colon IDs, as epistemic and decisional IDs
already did. This does not change namespace meaning, membership ordering,
subtype counters, source eligibility or the version-local status of IDs.

## Retained artifacts are not renamed in place

Extraction contracts 1.1–1.3 and consolidation contracts through 0.6 retain their
original formats. Their generators/verifiers pass the declared schema version
explicitly to the shared formatter; only this finite retained-version policy
allows double separators for observation, rhetorical and semantic IDs.
Epistemic and decisional IDs still have a single colon in those contracts.

Consequently, **rerunning the retained v1.3 pipeline still preserves its legacy
IDs**. The approved records, 52-row review, released JSON artifacts and current
author model keep their original bytes and hashes. The model compiler and its
subagent must carry prepared source IDs unchanged, not normalize them inside a
composition. Their existing frozen schemas are intentionally not broadened or
rewritten by this hygiene change.

New contract versions do not inherit the retained double-colon policy. They
must adopt the canonical schema consistently across definitions, references,
review lineage and consumers. A version number passed to a formatter chooses
formatting only: it does **not** make a not-yet-implemented extraction or
consolidation contract eligible to run.

## A future migration is a separate operation

`canonicalIdentifier(value)` converts only a whole recognized ID, never arbitrary
text. `canonicalIdentifierMap(ids)` checks that distinct source definitions will
not collapse onto the same canonical identity. These functions are pure helpers,
not JSON writers or release/migration authorization.

An actual migration must be versioned and update all structured definitions and
references together, record the old-to-new mapping, recompute bindings/hashes and
validate the resulting artifacts. It must preserve review decisions and exact
source quotes. Never apply a global `::` replacement: source code, prose, URLs,
URIs and quoted examples are not identifiers to rewrite.

Run `npm --prefix _scripts/author-extraction run test:identifiers` for canonical
format, retained compatibility, collision and stable-numbering checks. The full
pipeline suite additionally verifies the preserved artifacts and current model.
