# Step 4 — Author Model Compiler

The compiler composes the **29 approved author patterns** into a smaller operational
model, rather than performing another extraction, clustering run or per-pattern
review. Its output is
[`author-pattern-results/v1.3/author-model.json`](author-pattern-results/v1.3/author-model.json),
with schema version `author-model/1`.

## Inputs and authority

- The completed 52-decision sheet remains immutable for this step.
- `reviewed-author-patterns.json` supplies the 29 effective approved formulations,
  their applicability and qualitative judgments. Its audit supplies the author's
  review notes, including qualifications not repeated in the effective entries.
- `reviewed-semantic-model.json` supplies three retained conceptual contexts,
  **not stylistic instructions**. It is optional in the compiled model.
- The authored composition lives in
  `_scripts/author-extraction/author-model.composition.json`. It is a source-bound
  synthesis, not a second set of human decisions about the original patterns.

The model's `source_review_hash` means the **canonical completed-review hash**,
currently `0634ee72b622572a38a8fb684f28ca15eb026070dd029288d8e2128128f95f28`.
It is not the original frozen-input binding's differently named
`review_source_hash`. The compiler reruns the pure step-3 verifier and requires
the released author-pattern bytes, and semantic bytes when included, to match
its exact outputs. It does not invoke or change the fail-closed native apply
tool, authenticate a human operator, or publish to the website.

Source IDs are copied exactly, including retained `APC::…` and `SPC::…` IDs.
The [canonical single-colon convention](author-identifiers.md) applies to new
contracts, not an in-place normalization of this hash-bound v1.3 model. A future
ID migration must update every structured reference and provenance binding
together; neither the compiler nor its child agent silently renames source IDs.

## Coordinated model

| Principle | Operational purpose |
| --- | --- |
| P01 | Orient the exposition and practical adequacy to its purpose. |
| P02 | Calibrate claims, personal preferences, time dependence and informative limits. |
| P03 | Show grounded connections, antecedents and contrasts without forced equivalence. |
| P04 | Coordinate models, formalism, hypothetical scenarios and worked calculations. |
| P05 | Balance resource reuse, simplicity, optimization and targeted adaptability. |
| P06 | Accompany the reader without imposing a rhetorical or serial template. |

The six principles partition the original 29 author IDs: each has exactly one
**primary principle**. The same source may support a contextual refinement,
device or guardrail without becoming another independent instruction. These
are operational compositions, not step-3 semantic merges; no original ID,
membership, review decision or evidence count changes.

Four contextual profiles cover scientific explanation, projects/tutorials,
scope and planned continuations, and explicitly restricted applications. Six
devices are available for selective use, subject to ten guardrails. Neither
profiles nor devices form a mandatory article outline or numerical usage quota.
In particular:

- Formalism, abstraction/physical-relation/dimensional-balance connections and
  variable-condition extensions keep their approved scientific scope.
- Hypothetical scenarios are privileged in divulgation and less frequent in
  tutorials; they do not replace operational instructions.
- The phase portrait, lighting-model input limitations, social-network analogies
  and classical/quantum contrasts keep their specific activation conditions.
  An article-local support count is not itself a restriction on an explicitly
  approved broader formulation, such as resource reuse.
- Omissions must be informative, not tautological or lapalissian; they must
  **never** suggest exclusion because the reader would not understand.
- A planned continuation is not an automatic sequel. A placeholder or fallback
  does not promise equivalent information or uninterrupted operation.

`source_index` is a **lineage ledger, not another 29-rule checklist**. It maps
each original ID to its primary principle, original qualitative judgments,
article/observation counts and JSON pointers to applicability and review notes
in the hash-bound author-pattern artifact. All six single-article author sources
remain visibly single-article; multiple articles are not labelled independent
evidence. No risk scores, inferred frequency thresholds or automatic exclusions
are introduced. Notes attached only to rejected/discarded groups are not
resurrected as new operative principles.

The three `semantic_context` entries each have `optional: true` and
`usage: "conceptual_context_only_not_style"`. They may help interpret an actual
discussion of invariance, state spaces or the distinction between a modelled
system and its associated object. They do not cause those topics or metaphors
to be inserted into unrelated writing.

## Compile and verify

From `_scripts/author-extraction/`:

```sh
npm run compile:author-model
npm run check:author-model
npm run test:author-model
```

The first command creates only `docs/author-pattern-results/v1.3/author-model.json`,
with exclusive creation: **an existing model is never overwritten**. The check
command recompiles in memory and compares exact bytes, without writing. Changes
to composition, compiler, schema or reviewed inputs therefore make an older
model fail its check; regeneration is a separate explicit artifact operation,
not a silent rewrite or re-review of source decisions.

To compile without the optional semantic layer when no output yet exists:

```sh
node compile-author-model.mjs --without-semantic-context
node compile-author-model.mjs --check --without-semantic-context
```

In that mode `semantic_context` is empty and semantic-output provenance is
`null`; the released semantic file is not required. The underlying frozen
review sources are still verified. The operative principles, profiles, devices
and guardrails are unchanged by removing semantic context.

## Reusable subagent

The project defines `.opencode/agents/author-model-compiler.md` as a V2
`mode: subagent` agent. It inherits the caller's model rather than choosing a
provider. The configured pipeline orchestrator is allowed to invoke it. The
child denies every capability except these two native tools registered by the
existing project plugin:

- `author_model_prepare({ include_semantic_context?: boolean })`: read-only,
  verified projection of effective approved formulations, applicability, review
  notes, judgments, local-support counts, optional semantic sources and the
  composition schema. It does not use rejected notes, posts or previous models
  as a new synthesis checklist.
- `author_model_submit({ source_review_hash, input_hash, candidate_json })`:
  validates the new composition through the existing compiler and saves a
  **separate candidate**. The real host identity must be `author-model-compiler`;
  neither a parent agent nor an argument naming that identity grants access.

Ask the primary agent, for example:

```text
Usa il subagente author-model-compiler per rilanciare lo Step 4 dai pattern
attualmente revisionati. Includi il contesto semantico facoltativo e non
promuovere o sovrascrivere il modello attuale.
```

This runs the synthesis again; it is not merely a rerun of the checked-in fixed
composition. The preparation's `input_hash` binds the complete projection,
source artifacts, schema, compiler, instructions and semantic option. A changed
input invalidates submission rather than transferring old approval. One rejected
composition may be corrected once against the same preparation; accepted,
cancelled and stale sessions do not silently restart.

A successful receipt has `status: "compiled_candidate"`, with a hash-addressed
directory under `docs/author-pattern-results/v1.3/author-model-candidates/`.
It contains `preparation.json`, `composition.json`, `author-model.json` and a
`manifest.json` written last. Exact repeated candidates are idempotent; conflicting
files or unsafe/symlinked destinations fail without overwriting them. Cancellation
can leave incomplete candidate files, but never promotes them or changes the
current model. A complete receipt and read-back verification establish a saved
candidate, not human review of the synthesis or permission to publish it.

The source review, reviewed artifacts, current composition and current model
are not writable by the child. Selection and promotion of a candidate remain
a separate explicit coordinator action; no promotion tool or `--force` switch
is introduced. The native review-apply gate remains unchanged and fail-closed.
The pipeline's input paths remain bound to approved v1.3 data: a different corpus
version needs a separately authorized source-contract update, not a guessed path.

The prepared payload exceeds the ordinary 51,200-byte output cap. The plugin
returns complete bounded text with `metadata.truncated: false`; VM tests compare
the full current payload byte-for-byte through the executor. That is producer/VM
evidence, not proof of live-host transfer or provider attention. Project files
and tests alone also do not prove that an already-running session has refreshed
its agent/tool catalog. If the agent or its tools are unavailable, reopen the
project in a fresh session rather than using shell access or another role as a
fallback.

A preparation-only native smoke run in child session
`ses_ec0f6ef1affei0StMjSTg84yJa` returned `ready`, 29 author patterns and three
semantic sources. Its input hash
`741445303e694229ff9f4e3ab62984799aa39dd7f27e15115abe4dc4aca201c8`
and instruction hash matched a fresh offline preparation. No submission was
made and no candidate directory was created in the real workspace. This
establishes that the registered child preparation route worked for this
snapshot; it does not certify an entire synthesis/submission run or independent
byte-level live-host retrieval. Candidate persistence remains covered by the
fixture and VM tests, not claimed as a real-workspace native submission.

## Verification boundaries

`model.mjs` is pure with respect to filesystem writes. The small CLI is the
create-only artifact writer. The schema and validator check closed fields,
binding, complete source coverage, primary ownership, component references,
eligible lineage and separation of semantic IDs from operative instructions.
The output records source, composition, schema and compiler hashes, without
timestamps or new review judgments.

The composition is marked
`compiled_synthesis_not_separately_human_reviewed`. Its reviewed **sources** are
human approved; the synthesis is not labelled as another human-approved review
or proof of stable personality. Mechanical validation does not certify semantic
entailment or that every nuance has been perfectly paraphrased. Regression tests
cover the explicit qualifications above; the source audit remains authoritative
if a compressed directive could be read more broadly.

This artifact is an operational model for a later consumer, **not an avatar
prompt, generator, automatic content editor, runtime deployment or website
integration**. Those require separate work.

[Step 5 — Author Runtime Compiler](author-runtime.md) now supplies that bounded
runtime consumer: it resolves task-specific instructions without changing this
model, copying its entire ledger or treating semantic concepts as style.
