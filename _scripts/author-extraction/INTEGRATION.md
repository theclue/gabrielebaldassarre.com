# Author subagents: usage and native plugin integration

This guide covers author-subagent usage and repository-local OpenCode V2
wiring. Consolidation is v0.5 (classification-coded epistemic IDs); the other
dimensions retain their fields, and extraction remains v1.2.
See [the contract guide](../../docs/author-extraction.md#epistemic-group-ids-v05)
for versioning and the distinction between acceptance and author approval.

## Guida rapida: usare i subagent in futuro

Questi componenti sono **agenti OpenCode con tool forniti da plugin locali**,
non skill e non comandi `/`. I plugin vengono caricati dalla configurazione
del repository; non occorre invocarli manualmente. Non esistono attualmente
`/author-extractor`, `/author-consolidator` o `/consolidate-author`.

| Nome esatto | Quando usarlo | Unità di lavoro | Tool usati dall'agente |
| --- | --- | --- | --- |
| `author-extractor` | Produrre nuove osservazioni candidate da un articolo approvato | Un ID tra `A01` e `A12` per sessione | `author_extraction_prepare`, `author_extraction_submit` |
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
`docs/author-extraction-results/v1.2` in `opencode.json`. Tutti i dodici record
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

The current loader tags its native/core module imports with `?contract=0.5`
so a watched plugin reload does not reuse the previous contract's cached module.
This is a fixed local version tag, never a tool input or a global host restart.
Previously accepted v0.1–v0.4 dimensions are verified against retained local
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
    "recordsDirectory": "docs/author-extraction-results/v1.2"
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
input. The core still defaults to v1.1; v1.2 is an explicit choice, not a
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
After the authorized run, compare native results and hashes with offline v1.2
preparation/acceptance. Treat test readiness as local evidence only; report
Green and host-runtime outcomes only after the corresponding checks actually
run.

OpenCode V2 references: [Plugins](https://opencode.ai/v2/docs/plugins/),
[Build plugins](https://opencode.ai/v2/docs/build/plugins/), and
[Configuration](https://opencode.ai/v2/docs/config/).
