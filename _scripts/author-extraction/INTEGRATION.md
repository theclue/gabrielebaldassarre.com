# Author subagents: usage and native plugin integration

This guide covers author-subagent usage and repository-local OpenCode V2
wiring. Current scope is **twenty approved articles**, extraction v1.3 and
consolidation v0.6. All four ID conventions and candidate fields are retained.
See [the contract guide](../../docs/author-extraction.md)
for versioning and the distinction between acceptance and author approval.

## Guida rapida: usare i subagent in futuro

Questi componenti sono **agenti OpenCode con tool forniti da plugin locali**,
non skill e non comandi `/`. I plugin vengono caricati dalla configurazione
del repository; non occorre invocarli manualmente. Non esistono attualmente
`/author-extractor`, `/author-consolidator` o `/consolidate-author`.

| Nome esatto | Quando usarlo | Unità di lavoro | Tool usati dall'agente |
| --- | --- | --- | --- |
| `author-extractor` | Produrre nuove osservazioni candidate da un articolo approvato | Un ID tra `A01` e `A20` per sessione | `author_extraction_prepare`, `author_extraction_submit` |
| `author-pattern-consolidator` | Raggruppare osservazioni già estratte e verificate | Una dimensione per sessione | `author_pattern_consolidation_prepare`, `author_pattern_consolidation_submit` |

### Come avviare un lavoro

1. Apri OpenCode nella root di questo repository.
2. Rivolgiti al tuo agente principale chiedendo esplicitamente di **delegare al
   subagent indicato**, con articolo/dimensione, provider/modello e limiti.
   Non devi chiamare personalmente i tool `prepare` e `submit`: sono riservati
   ai rispettivi agenti. L'agente principale deve avere il permesso di delega;
   se non lo ha, fermarsi e chiarire la configurazione, senza aggirare i permessi.
3. Se vuoi salvare il risultato, indica separatamente la destinazione e se
   autorizzi una sostituzione. In assenza di questa scelta, non salvare né
   sovrascrivere file. Una nuova esecuzione richiede inferenza: non serve per
   leggere o verificare risultati già prodotti.

I prompt sotto sono esempi, non autorizzazioni permanenti. Il modello indicato
è una scelta esplicita per quella singola esecuzione, non un default del plugin;
puoi indicarne un altro disponibile. Se non è disponibile, fermarsi senza fallback.

### Esempio: estrarre un articolo

```text
Delega ad author-extractor una nuova estrazione del solo articolo A12.
Usa github-copilot/gpt-6.1-sol#max, senza fallback.
Autorizzo al massimo 6 step nel turno, un prepare e un solo submit.
In caso di rifiuto fermati: non autorizzo correzioni o sessioni sostitutive.
Non salvare o sovrascrivere file. Riporta l'esito e i riferimenti al risultato nativo.
```

Sostituisci `A12` con l'ID approvato desiderato: non passare un percorso o testo
arbitrario. Una correzione può essere autorizzata separatamente **nella stessa
sessione**, sullo stesso articolo/hash, entro il massimo di due submit complessivi.
Non avviare automaticamente gli altri articoli.

### Esempio: consolidare una dimensione

```text
Delega ad author-pattern-consolidator il consolidamento della sola dimensione rhetorical.
Usa github-copilot/gpt-6.1-sol#max, senza fallback.
Autorizzo al massimo 5 step, un prepare e un solo submit.
Se la preparazione è blocked o vuota, oppure il submit è rifiutato, fermati.
Non rigenerare estrazioni, non riprovare e non creare sessioni sostitutive.
Non salvare, sovrascrivere o finalizzare risultati. Riporta l'esito e i riferimenti nativi.
```

Le dimensioni ammesse sono esattamente `rhetorical`, `epistemic`, `semantic` e
`decisional`. Per elaborarle tutte, autorizza esplicitamente quattro deleghe,
una sessione distinta per dimensione, senza duplicati o retry. Il consolidatore
non sceglie il corpus: il plugin attualmente configura
`docs/author-extraction-results/v1.3` in `opencode.json`. Tutti i venti record v1.3
devono superare il gate di processing; un blocco non autorizza un refresh,
un cambio di directory o una modifica delle receipt.

### Risultato, salvataggio e passaggio successivo

- Un'esecuzione è accettata solo se il tool restituisce `status: "accepted"`.
  Un riepilogo dell'assistente o il solo stato `completed` non bastano.
- Il `canonical_json` del risultato nativo è autorevole. I subagent e i plugin
  **non salvano file automaticamente**: l'agente principale deve recuperare
  il risultato esatto per sessione/messaggio/tool e, solo se autorizzato,
  salvarne i byte senza riformattazione o newline aggiuntive. Conservare anche
  quei riferimenti permette di verificarne la provenienza in futuro.
- Per il consolidamento, quattro dimensioni accettate non sono ancora il
  bundle finale. L'agente principale può invocare separatamente il core offline
  `finalizeConsolidation` e salvarne l'output nella destinazione autorizzata;
  non esiste un tool nativo di finalizzazione e non serve una nuova inferenza.
- L'accettazione tecnica non è approvazione autoriale: i candidati richiedono
  revisione umana prima di essere usati per un avatar. Per rivedere gli output
  esistenti, chiedi una revisione **senza rieseguire i subagent**.

## Explicit plugin registration

The current consolidator loader tags native/core imports with `?contract=0.6`;
extraction and its verifier use `?contract=1.3`, so a watched plugin reload does
not reuse the previous contract's cached module.
This is a fixed local version tag, never a tool input or a global host restart.
Previously accepted v0.1–v0.5 dimensions are verified against retained local
contract snapshots; do not rerun other dimensions merely to update one contract.

For a new semantic run, the core assigns `SPC::C0001`-style concept IDs and
`SPC::R0001`-style relation IDs, with independent counters. Do not ask the model to
invent IDs or alter accepted JSON by hand. A contract edit alone does not rerun a
subagent: existing outputs remain untouched unless regeneration is authorized.

New decisional groups receive `DPC:A0001`, `DPC:E0001`, or `DPC:T0001` according
to their unchanged `classification`, with one colon and independent counters.
These IDs are also assigned by code and preserved during finalization.

New epistemic groups similarly receive `EPC:A0001`, `EPC:E0001`, or `EPC:T0001`
according to their unchanged `classification`, with one colon and independent
counters. The core assigns and preserves them; the model does not propose IDs.


The root `opencode.json` explicitly registers the plugin **directory**
`./plugins/author-pattern-consolidator`, with the full records directory
selected in its options:

```json
{
  "package": "./plugins/author-pattern-consolidator",
  "options": {
    "recordsDirectory": "docs/author-extraction-results/v1.3"
  }
}
```

This is distinct from the physical module entry file,
`plugins/author-pattern-consolidator/index.js`. In the installed OpenCode
2.0.24, configured plugin sources are scanned as directories relative to the
config file, and the host resolves the directory's default `index.js`; the
explicit local directory does not require a `package.json`. Do not generalize
that resolver detail to other OpenCode versions without checking their docs
and behavior. OpenCode's `.opencode/plugins` JavaScript auto-discovery is a
separate mechanism: remove the old consolidator there and do not register a
second copy. Keep the physical plugin body, relative imports, and repository-
root resolution unchanged. The extraction plugin remains separate and
unaffected. Tools accept a dimension, hashes, and candidate JSON, not a path:
the configured records directory is host configuration, not model-controlled
input. The core still defaults to v1.1; v1.3 is an explicit choice, not a
shorthand or new default.

## Safe activation and recovery

1. Before changing plugin files or configuration, verify there is no
   in-flight extraction, consolidation, form, or permission request that the
   change could affect.
2. Move the existing module out of auto-discovery to the explicit plugin
   directory, preserving its body and imports. Verify the old auto-discovered
   instance is gone before changing root configuration.
3. Only then add the explicit directory entry in root config. Allow the host's
   watched configuration reload, then verify the configured directory,
   resolved entry source, and singleton instance before starting an authorized
   run. Do not assume `ctx.tool.reload` removes an old plugin instance; do not
   globally restart OpenCode or cancel work to force activation.
4. If recovery is needed, restore only this change's source-move/config hunks
   to their baseline, after checking for concurrent edits. Do not use a broad
   reset, cleanup, or overwrite unrelated working-tree changes.

## Run boundaries and evidence

- Run exactly one explicitly authorized article ID per extraction session.
  The session permits at most two submit attempts, including one explicitly
  authorized correction. A correction stays in that session; do not use a new
  session to reset the limit.
- Run one consolidation dimension per session, with one submit and no repair
  or replacement attempt. There is no native finalizer tool: collect the four
  accepted dimension results for the offline core finalizer.
- Preserve each accepted `canonical_json` exactly as returned in the native
  tool result, without a newline or reserialization. Retrieve the original
  assistant tool result by session/message/tool identity through the native
  session/message/tool-part API; do not substitute assistant prose or an
  arbitrary JSON result.
- The core rejects records that are not processing-eligible. Existing v1.1
  `not_tracked` records remain blocked; do not fabricate receipts, bypass the
  gate, or relabel them as v1.2. Tests and successful tool acceptance do not
  constitute semantic, author, or taxonomy approval; candidate outputs remain
  unreviewed.
- The explicitly authorized run uses
  `github-copilot/gpt-6.1-sol#max`, without fallback. This is a session
  selection, not a permanent model default.

## Verification status and references

The `test:integration` check should read the actual repository config, verify
the plugin directory exists, and exercise the actual options through SDK setup,
the real `Plugin.define`, adapter, and core routing with controlled host/core
doubles. It checks this repository's integration contract, not the host's
internal plugin resolver. Keep the existing `npm test` suites. Local tests do
not establish empirical host reload/registration or lossless native
tool-result transfer; verify those against the running host before real runs.
After an authorized current run, compare native results and hashes with offline v1.3
preparation/acceptance. Treat test readiness as local evidence only; report
Green and host-runtime outcomes only after the corresponding checks actually
run.

## Corpus-20 run and historical preservation

The author approved the proposed A13–A20 additions on 2026-10-14. The active
`docs/corpus.yaml` has twenty entries; `docs/corpus.v1.2.yaml` preserves the exact
old twelve-entry declaration. New extraction records are in
`docs/author-extraction-results/v1.3/`, and dimension outputs plus the deterministic
step-2 candidate bundle are in `docs/author-pattern-results/v1.3/`. Existing
v1.1/v1.2 files were not overwritten. Twenty references broaden the corpus, but
do not certify a stable register or remove topic/series/period confounding.

For a future full refresh, explicitly authorize A01–A20 and then the four
dimensions; use one session per article/dimension, not a batch inside one agent.
Do not append eight records to old receipts or copy previous group approvals.
The core preserves the one-article maximum of twelve observations (240 total),
closed fields, byte limits, single-dimension submit budget, and current ID rules.
Source posts and historical artifacts are read-only throughout.

The parent can capture a **completed original native result**, with no inference,
using `node _scripts/author-extraction/capture-native.mjs extraction A01 <session>
<approved-audit-directory>` (or `consolidation rhetorical`). This helper verifies
message/tool identity, exact producer bytes, source/processing eligibility and
protected-file hashes before create-only persistence. It is not a way to invoke
the model or fabricate a receipt; it requires an operator-prepared audit directory.
See the run reports for the authoritative native identities and checksums.

## Step 3: source-bound author review (pending; no release)

Step 3 is a human-curated decision layer, not extraction, clustering, an avatar,
a voice prompt, or proof of authorship. The create-only pending sheet is
[`docs/author-pattern-results/v1.3/author-pattern-review.json`](../../docs/author-pattern-results/v1.3/author-pattern-review.json).
It contains one null review row for each of the 52 original groups, including
single-article groups, plus read-only observation, passage-context, and
unclustered-coverage indexes. There are no decisions yet. Do not run models or
recluster as part of reviewing it.

The native review adapter defines exactly these three review tools, each
accepting only an empty object; actual runtime availability is not established
here. The repository root and approved inputs come from trusted host
configuration, not tool arguments:

| Native tool | Intended result | Caller/status boundary |
| --- | --- | --- |
| `author_patterns_validate({})` | Re-verify the frozen source contract and return counts/binding. | Native caller identities are only actual host `build` and `plan`; other identities are denied. |
| `author_review_prepare({})` | Return the full pending sheet from offline `prepareAuthorReview`. | Same caller gate. The core preparation is pure and writes no file. |
| `author_review_apply({})` | No successful result in this host. | Always rejects with `AUTHORIZATION_UNAVAILABLE` for allowed callers; it does not call core apply, produce a preview, or write. Other callers are denied first. |

The source implementation calls `validateAuthorPatterns(root)`,
`prepareAuthorReview(root)`, and pure `applyAuthorReview(root, completeJson)`.
Native validation and preparation are read-only. The offline core apply function
validates a completed sheet and returns two canonical output strings and hashes,
but has no filesystem write or publish operation. Actual native apply is a
separate fail-closed wrapper and **always rejects**, even for `build`/`plan`:
the pinned OpenCode 2.0.24 SDK provides no documented registered non-paid tool
executor that could supply hash-bound human release authorization. The user
approved this fail-closed behavior; ordinary permission approval, a boolean,
person/name, hash/token argument, “Allow Always”, or `ctx.permission.reply` is
not review consent. Tool descriptions must keep this limitation visible.

The only native source-allowed identities are `build` and `plan`, resolved from
the actual host caller. Extractor, consolidator, custom orchestrator, and tool
arguments that purport to name a caller are not authorized. The current parent
role cannot be changed or forged by tool arguments. An operator may select the
actual `build` or `plan` primary in the OpenCode UI for native validation or
preparation; no imaginary slash command or identity argument is involved. In
this environment real parent calls to validate/apply returned `AGENT_DENIED`.
That demonstrates guard reachability, **not** a successful allowed native call;
there is no successful native prepare or verified authorization UI. VM/core
tests do not establish real host dispatch or native byte transfer. Do not claim
activation or native preparation success, change permissions, invoke Paseo or
agents, or use a public HTTP client/global restart to work around the boundary.

The currently prepared sheet is an offline-core result persisted create-only
from the exact `prepareAuthorReview` string. It binds the corpus, method, all
four dimension source bytes and input hashes, both schema hashes, and a
`review_source_hash`; edited or stale source-bound fields fail closed and are
not repaired. Identical input hashes do not imply identical model grouping.
The full coverage is 52 groups (13 rhetorical, 16 epistemic, 9 semantic, 14
decisional), 217 indexed observations, 246 evidence references, 229 cited exact
passage contexts, and 86 unclustered observations; 16 groups are local to one
article. These are source context, not evidence of entailment or recurrence.
Review vocabulary and semantic merge constraints are specified in the [step-3
contract](../../docs/author-extraction.md#step-3-human-curated-author-pattern-review-pending).

Do not create reviewed outputs in this phase. Both
`docs/author-pattern-results/v1.3/reviewed-author-patterns.json` and
`docs/author-pattern-results/v1.3/reviewed-semantic-model.json` must remain
absent. Submitting the pending sheet to the offline core must fail
`REVIEW_INCOMPLETE`, without writes. T8 requires an actual completed review and
separate operator authorization of the exact canonical completed-review hash;
neither is available here, and software cannot mechanically prove the physical
identity of a human operator. No reviewed JSON is published by this guide or
this preparation step.

OpenCode V2 references: [Plugins](https://opencode.ai/v2/docs/plugins/),
[Build plugins](https://opencode.ai/v2/docs/build/plugins/), and
[Configuration](https://opencode.ai/v2/docs/config/).

## Step 4 — authorized-source operational compilation

The preceding pending-phase restrictions describe step-3 preparation, not an
automatic release path. Human review is now complete and the two local reviewed
artifacts were generated in a separately authorized step. The native review
adapter has not been enabled, modified or bypassed.

`model.mjs` exports pure `compileAuthorModel(repoRoot, compositionJson, options)`.
It revalidates the completed review using the offline core and compares the
released source bytes with that core's exact outputs before composing anything.
Its `source_review_hash` is the canonical **completed** review hash. The authored,
hash-bound composition and closed schema are `author-model.composition.json`
and `author-model.schema.json` in this package.

The default composition reduces 29 approved source patterns to six primary
principles, with four conditional profiles, six optional devices and ten
guardrails. A generated lineage ledger preserves every original ID, qualitative
risk/relevance/utility, single-article support and pointers to applicability and
review notes. Rejected groups are not reintroduced and source decisions are not
changed. The three semantic groups are optional conceptual context, never style.

`npm run compile:author-model` exclusively creates
`docs/author-pattern-results/v1.3/author-model.json`; it refuses overwrites.
`npm run check:author-model` recompiles and compares exact bytes read-only.
`npm run test:author-model` covers binding, coverage, reference, scope-regression
and source-integrity cases. `--without-semantic-context` omits the semantic layer
and does not require its released JSON file. The deterministic compiler itself
does not call a model/provider or perform extraction, publication or deployment.
See [the model guide](../../docs/author-model.md) for coordination semantics.

### Reusable compiler subagent

`.opencode/agents/author-model-compiler.md` uses V2 `permissions` and inherits its
parent's model. It denies all capabilities except `author_model_prepare` and
`author_model_submit`. The existing plugin registers these tools through
`model-native.mjs`; host identity is checked independently of tool arguments.
The pipeline orchestrator's child-agent allowlist includes this new agent.

`model-agent.mjs` prepares only effective approved patterns, their applicability,
review notes and qualitative judgments, plus optional retained semantic context
and the composition schema. It does not project source posts, rejected notes or
an old author model. Its input hash binds the entire projection, source bytes,
schema, compiler, agent instructions and preparation implementation. Preparation
is read-only. Submit revalidates the binding and invokes the unchanged compiler;
it saves only a separate hash-addressed candidate, never the current model or
composition. One rejected composition may be corrected once in the same session.

Candidate directories are under
`docs/author-pattern-results/v1.3/author-model-candidates/<input-hash>/<model-hash>/`.
They contain the prepared snapshot, composition, compiled model and final
manifest. Identical reruns are idempotent, differing existing files fail closed,
and cancellation never promotes a candidate. Candidate promotion is a separate
coordinator action, not a new native publication gate or a change to review apply.

Use a primary prompt such as “Usa il subagente author-model-compiler per
rilanciare lo Step 4 dai pattern attualmente revisionati, senza promuovere il
candidato”. `npm run test:author-model-agent` tests the core, host-identity
protocol, cancellation, source binding, candidate writes and agent permissions.
Integration tests load the real plugin in a VM, including exact transfer of the
current preparation above 51,200 bytes. This is not proof that the live host has
refreshed its catalog, executed a child run or delivered untruncated data to a
provider. Do not restart global services, widen permissions, impersonate a host
identity or fall back to shell/provider calls if the registered route is missing.

A subsequent read-only child smoke probe (`ses_ec0f6ef1affei0StMjSTg84yJa`)
successfully returned a ready model preparation for all 29 approved author
patterns and three semantic sources. Its prepared/input and instruction hashes
matched the current offline core. It did not submit a composition or create a
real candidate; successful live native submission and independent byte-level
host transfer remain unclaimed. This does not change the fail-closed review
apply tool or grant any model-promotion authority.

### Identifier hygiene for later contracts

`identifiers.mjs` centralizes namespace formatting with a canonical single `:`.
Default/new rhetorical and semantic group assignments and observation formatting
use this convention; epistemic and decisional IDs keep their existing single
colon. Retained generation and verification explicitly pass their declared
schema version, preserving all historical IDs and hashes. Frozen schemas are
not edited, and reruns of the retained v1.3 pipeline still use legacy IDs.

`identifiers.schema.json` rejects double separators in canonical/new contracts.
The whole-value normalizer and collision-checking map are pure aids for an
explicit future versioned migration, not a global replacement or artifact
writer. New schema versions still require normal implementation/authorization
before they can run. See [identifier conventions](../../docs/author-identifiers.md)
and run `npm run test:identifiers` for the regression checks.

## Step 5 — compact resolved author runtime

`runtime.mjs` exports read-only `compileAuthorRuntimeProfile(repoRoot, taskJson)`
and `verifyAuthorRuntimeProfile(repoRoot, profileJson)`. The task schema and
compiled contract are `author-runtime-profile.schema.json`. Routing is bound to
the exact governed author-model fingerprint and explicit structured task signals;
it does not guess new profile meanings after a different model is promoted.

The runtime resolves selected principle text, applicable contextual rules, a
small relevant device set and all applicable clauses of guardrails connected
through profiles, devices and principle lineage. Revision 1.1 first gathers
linked candidates, then projects clauses with explicit context predicates;
general invariant guards remain unitary. Guardrails have no optional state. `required` devices must
come from an explicit eligible task request. Semantic topics require explicit
conceptual need and keep `conceptual_context_only_not_style`; selecting them does
not change the operative/style selection. Unknown contexts are not invented.

Canonical single-colon runtime source IDs are bound to original model IDs by
JSON pointers and the source-model hash, not by rewriting the legacy source.
The output omits the complete model/source ledger and resolves the internal
scope references that would otherwise require looking up another component.
No self-referential runtime hash is stored in the profile. Clause IDs are
version-local runtime fragments, not new author-pattern identifiers or reviews.

The manifest records the disposition of every linked guardrail in
`guardrail_resolution`, including obligations represented once by a prohibition
and guards with no applicable clause. The no-plan G06 is not duplicated and G10
does not carry inactive local examples. The Markdown task block is compact
operative prose; the JSON remains authoritative for the complete brief.

Run `npm run compile:author-runtime -- --task <repository-relative.json>` to
materialize a hash-addressed `author-runtime-profile.json`, instructions Markdown
and final manifest under `docs/author-pattern-results/v1.3/author-runtimes/`.
`npm run check:author-runtime -- --task <same-task>` is read-only. Identical runs
are idempotent; conflicts, unsafe paths and symlinks fail without overwriting.

`npm run test:author-runtime` includes seven actual corpus-article contexts,
source-byte checks, selection/guardrail/status assertions, semantic isolation and
tamper tests. This is not a provider benchmark or a content publication. No
native review/model authority or agent permission is expanded. See
[the runtime guide](../../docs/author-runtime.md) for the API, schema decisions,
usage and validation boundaries.

Promoted revision-1 runtime artifacts stay byte-preserved. The additive schema
supports their shape, but fresh compilation/checks use revision 1.1 and produce
a new hash-addressed runtime. The full governed author model and its approved
review are not changed by this projection fix.
