# Step 5 — Author Runtime Compiler

The runtime compiler selects a **task-specific operational profile** from the
governed `author-model.json`. It does not extract, consolidate, review source
patterns again, generate posts, call a provider or publish anything.

Its two consumable outputs are:

- `author-runtime-profile.json` (`author-runtime-profile/1`): compact structured
  data containing resolved operative text and lineage;
- `author-runtime-instructions.md`: instructions rendered from the same profile,
  ready to pass to an LLM alongside the actual writing/revision material.

Neither consumer needs to load the full author model to interpret the selected
instructions. The complete model remains the governed source.

For everyday Markdown post/draft creation, the local
[`/create-post` integration](post-authoring.md) hides compilation and verification,
calls Rake and injects the resolved instructions through V2 session hooks.
The standalone compiler below remains provider-free; the integration does not
claim that context injection proves prose compliance or provider delivery.

## Compile a task

From the repository root:

```sh
npm --prefix _scripts/author-extraction run compile:author-runtime -- --task _scripts/author-extraction/fixtures/runtime-tasks/A08-scientific-units.json
npm --prefix _scripts/author-extraction run check:author-runtime -- --task _scripts/author-extraction/fixtures/runtime-tasks/A08-scientific-units.json
npm --prefix _scripts/author-extraction run test:author-runtime
```

Task paths are repository-relative, without traversal or symlinks. Each task is
stored under a hash-addressed directory in
`docs/author-pattern-results/v1.3/author-runtimes/`. It contains the profile,
rendered instructions and a final manifest with their exact SHA-256 values.
Identical reruns are idempotent; different existing bytes are not overwritten.
`--check` writes nothing. There is no `--force`, arbitrary output path, deploy
or replacement of the current author model.

A minimal task is:

```json
{
  "mode": "generate",
  "content_type": "tutorial",
  "language": "it",
  "objective": "Spiegare una configurazione riutilizzabile senza introdurre complessità non necessaria."
}
```

The supported modes are `generate`, `rewrite`, `expand` and `review`. Audience,
topic, constraints and series context may be added when known. `mixed` requires
explicit `mixed_content_types`: it does not mean activate everything. `other`
fails with a request for an applicable supported context, rather than guessing
an authorial profile for an unsupported genre.

## Explicit contextual signals, not keyword inference

`features` selects relevant aspects of the brief, for example a numerical
calculation, physical quantities with mathematical formalism, data interpretation,
mutable information, a configuration choice or external dependencies. The closed
enum is in `_scripts/author-extraction/author-runtime-profile.schema.json`.
Unknown signals are rejected. Mere words in `objective` or `topic` never activate
profiles, devices or semantic concepts.

`local_topics` has four deliberately narrow values:

- `phase_portrait`;
- `lighting_model`;
- `social_networks`;
- `quantum_logic_or_measurement_contrast`.

Only the corresponding local rule is resolved into `contextual_rules`. Selecting
the lighting model does not insert the phase-portrait rule, social-network
analogies or quantum contrasts. Broad principles retain their original conditional
scope; the runtime does not turn a clause about scientific writing into a rule
for every tutorial.

There are no top-k scores or rhetorical quotas. Common corpus smoke tasks need
two or three devices; a genuinely richer explicit brief may need more. A device
must have both an allowed contextual profile and an actual activation condition.

## Device status and mandatory guardrails

- `available`: a resource the LLM may use, not an instruction to use it.
- `preferred`: favor it when useful; it remains conditional, not compulsory.
- `required`: permitted **only** through an explicit `device_requests` entry for
  this task, with `status_basis: "task_requirement"`. Genre, source risk or
  relevance alone never creates this status.

For example, a requested worked calculation is declared by the feature
`quantitative_calculation` and
`"device_requests": [{ "id": "D02", "status": "required" }]`.
Requesting a required continuation device without a real plan or applicable
scope-delimitation context fails rather than inventing a sequel.

Every activated guardrail is mandatory. Its schema has **no status or optional
field**. The compiler first gathers guardrails linked by active profiles,
selected devices and principle lineage, then projects their **applicable
operative clauses**. Linkage identifies candidates; it no longer copies every
clause into the runtime regardless of context.

Compiler revision `author-runtime-compiler/1.1` implements this deterministic
projection in `runtime-guardrails.mjs`. Applicable clauses remain mandatory:
there are no scores, quotas or task switches that disable them. The active
guardrail's `source_clause_ids` records the version-local source fragments;
its source-pattern lineage is restricted to the projected clauses. Some general
invariants remain unitary rather than being split mechanically at punctuation.

The manifest's `guardrail_resolution` accounts for **every linked candidate**:
`projected`, `covered_by_prohibition`, or `not_applicable`, with clause IDs and
the runtime target. No-plan G06 is covered once by the specific prohibition,
not duplicated as another guardrail row. G10 is absent without an active local
domain; when active it mentions only that domain. G05 carries the essential-step
and non-exhaustive-limits cautions, adding omission/lighting clauses only when
pertinent. G04 likewise keeps only relevant numerical, historical, analogical
or contrast clauses. This is contextual projection, not brevity-based dropping.
If a brief is too large, compilation still fails instead of removing an
applicable mandatory constraint.

`series_context.is_series` does not imply `planned_continuation`. A declared
continuation requires an explicit `continuation_topic`. An independently planned
follow-up to an otherwise standalone article is allowed; what is prohibited is
inferring that plan. Without a plan, runtime prohibitions explicitly prevent
announcing a sequel, including for articles already belonging to a series.

## Optional semantics and standalone operative text

`semantic_topics` may explicitly request `invariance`, `state_space` or
`system_object_distinction`, with a nonblank `topic`. It is a declaration of the
brief's conceptual needs, not an automatic semantic classifier. The compiler
cannot prove from free prose that this declaration is truthful.

Only the corresponding retained contexts are included. Each keeps:

```json
{
  "optional": true,
  "usage": "conceptual_context_only_not_style"
}
```

Changing only this semantic selection does not change profiles, principles,
devices, guardrails or style directives. Omitting it yields an empty semantic
array, not an invitation to imitate concepts or metaphors from the corpus.

The runtime includes resolved principle instructions, applicable contextual
rules, device conditions and mandatory guardrail clauses. Local-scope reminders
and the raccordo device no longer reintroduce inactive examples through `C04`.
IDs remain for traceability, not as a prerequisite for understanding instructions.
`runtime_instructions` supplies activation and output requirements without
duplicating every operative text into another instruction list.

The JSON retains the complete normalized brief. The Markdown instead renders a
short operative summary: action, genre/language, objective, audience, topic,
constraints and human-readable declarations relevant to activation. It does not
echo the whole JSON or its device-request bookkeeping. Free brief text is quoted
and Markdown-escaped, not interpreted as authority to change the runtime policy.

## Source governance, canonical IDs and verification

Version 1 routes the current governed model with exact SHA-256
`88d622c01aee9e0dafa44a2966ebbbe63ff8249336eb0e861da13c157051f8b5`.
It validates the model and its schema fingerprint. After a new model is promoted,
the runtime policy must be checked explicitly: `C01` cannot be assumed to have
the same meaning in an arbitrary future composition. A changed model fails
closed instead of silently reusing the current routing.

Runtime source-pattern references use the new single-colon convention. The
governed source still has retained IDs, so `provenance.source_pattern_bindings`
maps each canonical ID to its exact JSON pointer in the hash-bound model. No
source ID, review or model file is rewritten. Alias collisions are rejected;
semantic IDs cannot appear as operative author-pattern lineage.

The deterministic runtime ID binds the model, normalized task, compiler
implementation (including the clause-projection module) and schemas. Hashes of the actual profile and prompt live in the
manifest, not inside the payload they hash. `verifyAuthorRuntimeProfile` recompiles
from the governed source and rejects edited selections, missing guardrails,
altered device requirements, applicable clauses, covered prohibitions or
provenance even if edited JSON would still satisfy the shape schema.

The payload schema remains `author-runtime-profile/1`; its compiler-version
enum also recognizes retained revision 1. `source_clause_ids` is required for
active guards produced by revision 1.1. Old promoted artifacts retain their
original files, hashes and manifests; the current semantic check recompiles
under the current compiler, not the old projection policy. New compilation
therefore creates a new runtime ID/directory rather than rewriting those files.

The core API in `runtime.mjs` is read-only. The CLI is the bounded artifact writer.
No new native tool, unrestricted writing agent, provider choice or content
publication is introduced by this step. The prompt keeps task data in a separate
quoted block and does not grant tools or override platform instructions. These
are artifact-level safeguards, not proof that every LLM will obey every rule.

## Tests on real articles

`fixtures/runtime-corpus-cases.json` binds seven explicit task annotations to
actual approved corpus articles A02, A07, A08, A09, A10, A13 and A20. Tests verify
the source bytes against their existing extraction-record hashes and check the
expected profiles, local rules, device statuses, full guardrail closure and
semantic selection. They also verify standalone resolved text, size reduction,
canonical-ID lineage, determinism, tamper rejection and create-only writes.

These tests validate selection and prompt materialization on real article
contexts, not a new extraction or human review of the patterns. They do not by
themselves establish the quality of newly generated prose, independent LLM
adherence, scientific truth or human authorship. Any qualitative example should
be labelled separately from this mechanical evidence; source posts stay intact.

The [revision 1 report](author-pattern-results/v1.3/author-runtime-validation.md)
preserves the original seven cases and promoted A08 snapshot. The
[revision 1.1 report](author-pattern-results/v1.3/author-runtime-validation-v1.1.md)
records the clause-projection refinement and replacement example. These are
task-specific examples, not a global runtime for every future post.
