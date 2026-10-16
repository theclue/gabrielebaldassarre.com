# Runtime compiler 1.1 — contextual guardrail clauses

This is a technical refinement of the runtime projection, not a new author-model
composition or per-pattern review. The governed model and its hash are unchanged:
`88d622c01aee9e0dafa44a2966ebbbe63ff8249336eb0e861da13c157051f8b5`.
The [promoted revision-1 example and report](author-runtime-validation.md) remain
byte-preserved with their original hashes.

## Updated eV example

The same A08 brief now produces `ARP:4B5275EA8296FB42E66217BE`:

- [author-runtime-profile.json](author-runtimes/arp-4b5275ea8296fb42e66217be/author-runtime-profile.json)
  — SHA-256 `27ff5283b4f9863a1d7d4208f5bd4bebe592cd993fab52e7f871359e7f0e1ac0`.
- [author-runtime-instructions.md](author-runtimes/arp-4b5275ea8296fb42e66217be/author-runtime-instructions.md)
  — SHA-256 `def154a056dc0549f861f3cda8e7f18d6cecdae13867b06ea45acd848994ba5d`.
- [manifest.json](author-runtimes/arp-4b5275ea8296fb42e66217be/manifest.json)
  — includes exact artifact hashes and the disposition of every linked guardrail.

| Selection | Revision 1 | Revision 1.1 |
| --- | ---: | ---: |
| Scientific profile | 1 | 1 |
| Principles | 2 | 2 |
| Contextual rules | 1 | 1 |
| Devices | 2 | 2 |
| Guardrail rows | 8 | 6 |
| Semantic contexts | 0 | 0 |
| Profile bytes | 15,769 | 13,183 |
| Prompt bytes | 7,628 | 5,480 |

Device selection is unchanged: D01 is `available`, D02 is `required` because the
brief explicitly requests a numerical calculation. The profile's JSON retains
the complete normalized brief. Markdown uses a compact operative summary rather
than repeating that JSON.

### What changed in the guardrails

- **G04:** only the numerical-example clause is active. No classical/quantum
  contrast or unrelated analogy/history clause enters this example.
- **G05:** keep only essential steps and avoid making epistemic caution an
  obligation to enumerate every possible limit:

  > Non eliminare passaggi indispensabili per delimitare il testo. Non trasformare
  > la cautela epistemica nell'obbligo di esplicitare ogni limite possibile.

- **G06:** no duplicated row. Its applicable obligation appears once as:

  > Non annunciare una prosecuzione: il brief non dichiara un piano.

- **G10:** not applicable because no local domain is active. The prompt contains
  no lighting model, phase portrait, social-network or classical/quantum examples.
- **G09:** keep the formalism/dimensional-balance safeguards that apply, not the
  variable-condition extension clause.

All six active guardrails remain mandatory and have no optional status. The
continuation prohibition is also mandatory; fewer rows do not mean dropping it.
Active guards carry version-local `source_clause_ids`. The manifest's
`guardrail_resolution` records `projected`, `covered_by_prohibition` and
`not_applicable`, including the exact target for each represented obligation.
There is no task switch to disable an applicable clause or a brevity-based quota.

## Seven real-article regression contexts

The same explicit corpus tasks are used; profiles, principle selection, local
rules, device statuses and semantic selection remain unchanged. Only projection
and rendering are refined.

| Article | Active guardrail rows | Profile bytes | Prompt bytes |
| --- | ---: | ---: | ---: |
| A02 — social networks | 6 | 13,641 | 5,617 |
| A07 — phase portrait | 6 | 16,044 | 6,708 |
| A08 — units | 6 | 13,183 | 5,480 |
| A09 — lighting project | 8 | 18,950 | 7,842 |
| A10 — lunar tutorial | 6 | 15,172 | 6,374 |
| A13 — states and systems | 5 | 13,887 | 5,661 |
| A20 — SEO project | 6 | 16,469 | 7,208 |

Local G10 clauses activate only for their declared domain, not all four domains
at once. Planned continuations retain their useful G06 obligations; external
dependency tutorials retain G07's functional/informative-equivalence safeguards.
Compact scope reminders and the raccordo device do not reintroduce inactive
local examples through a different field. Optional semantics remain conceptual
only and do not affect style activation.

## Verification and limits

- Full package tests: **149/149 passed**, including 21 runtime tests.
- Plugin VM integration checks: **6/6 passed**.
- Model recompilation check passed with the unchanged governed-model hash.
- Tests reject removing a projected guardrail, deleting a covered prohibition or
  falsifying clause lineage; source definitions are not rewritten.
- The old promoted profile still validates against the additive shape schema and
  retains SHA-256 `5cb6d5aa218e4020daa595c373240fc820674029e3ceb294ad8300f4a4fcd23b`.

These are selection, rendering and artifact-integrity checks, not a new
independent LLM prose benchmark or a scientific validation of the articles.
No provider call, source-post edit, commit, deployment or publication was part
of this refinement. A fresh semantic check uses the current compiler policy;
old artifacts are historical snapshots, not silently recompiled in place.
