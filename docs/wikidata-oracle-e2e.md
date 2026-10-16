# Wikidata oracle: verifica end-to-end di `/annotate-post`

**Esito: PASS su fixture temporanea, host OpenCode isolato e Wikidata live,
13 ottobre 2026.** Nessun post reale modificato, nessuna build o deploy.

## Perimetro e metodo

- OpenCode e SDK plugin **2.0.24**, Ruby **4.0.7**, Node **26.10.0**.
- Sessione `build`, modello `github-copilot/gpt-6.1-sol`.
- Dispatch del comando effettivo tramite
  `POST /api/session/{sessionID}/command`, `name: "annotate-post"`:
  non una semplice simulazione del prompt o una chiamata diretta al bridge.
- Fixture sorgente: `_scripts/wikidata-integration/fixtures/annotate-post.md`,
  copiata in un draft temporaneo nel checkout canonico. La prima annotazione
  dei due blocchi semantici era esplicitamente autorizzata in memoria.
- API Wikidata e WDQS reali, nessun endpoint fake o QID preassegnato.
  La run finale è stata eseguita fuori dalla VPN, con verifica TLS normale,
  senza override del trust store.
- Lettura autorizzata dei soli output gestiti da OpenCode; `jq`, `python3`
  e `shasum` consentiti per proiezioni/calcoli locali read-only, non per
  retrieval, lancio manuale dell'oracolo o scritture intermedie.
- Il servizio OpenCode preesistente non è stato riavviato o modificato.
  L'host isolato del test è stato terminato e atteso dopo la prova.

## Risultati verificati

| Controllo | Esito |
|---|---|
| Comando → plugin → bridge → processo Ruby reale | PASS |
| `open → discover → expand → validate → close` nella stessa run | PASS |
| Retrieval live | 20 candidati, 42 archi, 28 richieste HTTP |
| Espansione | 1 hop; la distanza nel grafo non assegna la profondità editoriale |
| Decisioni | 7, una per concetto, con `type` esplicito |
| Validazione | `accepted: true`; tutti i 6 check del core superati |
| SHA-256 del documento proposto | Confermato indipendentemente sui byte UTF-8 esatti |
| Prerequisiti | 1 required, 1 recommended, 5 helpful |
| `sameAs` nuovi | 3, tutti riconducibili a candidati/evidenze della run |
| Riferimenti helpful grounded | Unix shell (`Q14663`), Unix-like operating system (`Q14656`) |
| Altra selezione | Shell command (`Q141700575`), recommended |
| Astensioni | Z shell, operating system, POSIX: evidenze parziali; command interpreter: ambiguità |
| Chiusura | `closed: true`, `validation_outcome: accepted` |
| Writer | Rilettura dell'originale dopo close, una sola patch finale |
| Preservazione | Body identico nella proposta semantica; codice e Liquid esistenti identici nel finale |
| Campi approvati | I due blocchi semantici restano invariati nella composizione finale |
| YAML finale | Parsato indipendentemente con `Psych.safe_load`, alias disabilitati |
| Derivati | Nessun campo lessicale/composito persistito |

Il checker indipendente ha superato **41/41 verifiche**. Il comando ha aggiunto
anche audience/proficiency, difficoltà dichiarata e due commenti inline di
posizionamento immagini, dopo la validazione semantica. Il tentativo del comando
di eseguire un controllo YAML separato era permission-denied nella sessione di
test: il parsing del documento finale è stato effettuato dal checker, non
attribuito al comando.

I checksum dei **37 post/draft preesistenti** sono invariati. Durante il test
sono state osservate modifiche concorrenti ai file del consolidator, lasciate
intatte: non si dichiara l'invarianza o la pulizia dell'intero working tree.
La patch della sessione E2E riguarda esclusivamente il suo draft temporaneo,
poi rimosso; la fixture originale riutilizzabile conserva i byte testati.

### Features semantiche osservate

| Campo | Valore |
|---|---:|
| `concept_count` | 4 |
| `concept_density` | 1.0 |
| `jargon_ratio` | 14.8 |
| `definition_coverage` | 0.43 |
| `external_knowledge_demand` | 4 |
| `prerequisite_depth` | 1.1 |
| `math_density` | 0.0 |
| `code_density` | 1.1 |
| `blocking_prerequisite_count` | 1 |

Sono valori editoriali osservati, **non golden deterministici**. Il conteggio
bloccante è coerente con il singolo prerequisito required.

### Identificatori dell'evidenza locale

- Sessione: `ses_eca9c51d8ffeczKQbUAW2uOYS4`.
- Run: `run-94db1dc4d2e868111c6e0f7723fa24f2`.
- SHA-256 originale: `9a568742bf2668855f1718d17b1a715dbc6cdd836a67a7a4e2ccbc14732d0040`.
- SHA-256 proposta: `aadc44f184a1ff203398040a6dcc03f15e0fc145a20ec1252c62c4734bb7625c`.
- SHA-256 finale: `51ed3d5ce6f02044a473b296215813b632637e0f372f6a8f7fe5b52cd71c3b59`.

Transcript, proposte e checker restano nello scratch locale
`annotate-post-e2e-8his2tkt` sotto la directory temporanea OpenCode autorizzata.
Non sono stati pubblicati transcript grezzi, credenziali o stati del provider.

## Difetti trovati e regressioni

1. Il plugin chiamava `ctx.session.get(sessionID)` invece dell'input V2
   `ctx.session.get({ sessionID })`. Corretto; il nuovo test del plugin usa
   l'SDK reale e il core Ruby per open/validate/close offline.
2. Gli esempi del comando omettevano `decisions[].type`, causando
   `invalid_request`. Ora select, abstain e preserve_existing dichiarano
   esplicitamente il discriminatore, con regressione documentale automatica.
3. Un risultato JSON voluminoso viene salvato dall'host in un tool-output
   gestito. Le istruzioni ora spiegano come leggere/proiettare la stessa
   risposta ufficiale, senza fallback di retrieval.

I tentativi precedenti con TLS non disponibile, output non leggibile,
discriminatore mancante o verifica hash non autorizzata hanno chiuso la run
senza scrivere. La vecchia istanza dell'host mostrava inoltre un errore di
risoluzione dell'SDK; l'istanza nuova ha caricato il plugin originale. Non è
stato introdotto un workaround nel loader di produzione.

Regressioni offline finali:

```sh
ruby test/wikidata_oracle_test.rb
node --test _scripts/wikidata-integration/index.test.mjs
```

**48 test Ruby / 401 assertion e 6 test Node: zero failure/error/skip.**

## Ripetizione e limiti

Usare una nuova copia unpublished della fixture sotto `_drafts/`, una sessione
con accesso agli output gestiti e ai calcoli locali read-only, e il comando
`/annotate-post` effettivo. Autorizzare la prima annotazione in memoria; verificare
receipt, SHA-256, close, invarianti e singola scrittura prima di dichiarare PASS.
Rimuovere solo il draft creato dal test, dopo averne conservato l'evidenza.
Per leggere il transcript via API, usare pagine piccole: il CLI può troncare
risposte molto grandi, rendendole JSON incompleto.

La prova riguarda questo checkout canonico e questa fixture, non tutti i post,
worktree o provider. Non certifica verità semantica, accuratezza delle stime LLM,
consumer SEO, cancellation dell'intera sessione o sicurezza universale del
writer. Il core resta read-only e consultivo; l'audit formale resta pending.
