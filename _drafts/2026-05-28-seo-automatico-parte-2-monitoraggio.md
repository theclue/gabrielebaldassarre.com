---
layout: post
title: "I numeri non mentono (e io nemmeno): SEO monitoring per blogger fai-da-te"
category: DevOps
excerpt: "Seconda parte della pipeline SEO automatica: un data lake su Cloudflare R2 e D1, Google Trends e Search Console, dbt per le trasformazioni e un report mensile automatizzato. Tutto open source, tutto in GitHub Actions, tutto gratis."
header:
  overlay_filter: 0.5
tags: [SEO, Jekyll, GitHub Actions, Cloudflare, dbt, Google Trends, Search Console, data engineering]
intended_audience: practitioner
proficiency_level: intermediate
broadcast:
  channels: [linkedin, mastodon]
  sent: false
---

Nella {% post_link /devops/seo-automatico-jekyll-parte-1/ "prima parte" role="prerequisite" context="provides-context" target="internal" %} abbiamo costruito il **blocco 1** della pipeline SEO: il supporto all'autorialità. A ogni deploy, Lighthouse, PageSpeed Insights e IndexNow analizzano i post nuovi o modificati e mi dicono se sto facendo danni. Funziona. Ma è un'istantanea. Un controllo puntuale, una tantum.

Quello che manca è la **dimensione temporale**.

Il SEO non è un esame che passi una volta e sei a posto. È un ecosistema: i contenuti invecchiano, le keyword cambiano trend, Google aggiorna l'algoritmo, i crawler AI iniziano a citarti (o smettono). Senza monitoraggio continuo, non hai idea di _cosa_ stia succedendo al tuo blog. È come guidare senza cruscotto: sai che ti stai muovendo, ma non sai a che velocità, con quanta benzina, o se la temperatura del motore è nella norma.

Così è nato il **blocco 2**: il monitoraggio.

E siccome sono un ingegnere e non un social media manager, l'ho costruito come si costruisce un sistema di monitoring che si rispetti: data lake, ETL, modelli dimensionali, alert e report. Tutto open source. Tutto su GitHub Actions. Tutto sfruttando i generosi free tier di Cloudflare.

---

## Architettura: da zero a data lake in tre mosse

Il blocco 2 non è collegato al blocco 1. Non c'è un trigger "a valle del deploy". È un **workflow indipendente, schedulato ogni lunedì alle 8:00 UTC**, che:

1. **Raccoglie** dati dal mondo esterno (Google Trends, Search Console)
2. **Consolida** i dati già prodotti dal blocco 1 (PageSpeed, Lighthouse) in un archivio permanente
3. **Trasforma** i dati grezzi in metriche queryable
4. **Allerta** se qualcosa supera le soglie
5. **Produce** un report mensile

Il tutto poggia su tre servizi Cloudflare:

| Servizio | Ruolo | Free tier |
|---|---|---|
| **R2** (object storage) | Data lake raw — ogni JSON generato finisce qui, per sempre | 10 GB, 10M operazioni Classe A/mese |
| **D1** (serverless SQLite) | Database analitico — metriche strutturate, queryable via HTTP | 5 GB, 5M righe lette/giorno |
| **KV** (key-value) | Stato del workflow (ultimo timestamp, flag) | 1 GB, 100K letture/giorno |

Perché Cloudflare e non, chessò, un PostgreSQL su Railway? Due motivi: (1) il free tier è _davvero_ generoso per un blog personale — ci sto dentro di tre ordini di grandezza, e (2) il sito è già su Cloudflare Pages, quindi tutto l'ecosistema è co-locato. Zero latenza di rete tra R2 e D1 quando si fanno operazioni di ETL.

---

## Arricchire il blocco 1: niente più artifact effimeri

La prima modifica è stata al workflow esistente (`seo-pipeline.yml`). Prima, i report di PageSpeed e Lighthouse venivano salvati come **GitHub Artifacts con retention di 30 giorni**. Dopo un mese, sparivano. Impossibile fare analisi storica.

Ora, ogni job del blocco 1 carica i suoi JSON direttamente su **R2**:

```
r2://gabrielebaldassarre-seo/
  seo/pagespeed/2026-05-26T083000Z/mio-post-mobile.json
  seo/pagespeed/2026-05-26T083000Z/mio-post-desktop.json
  seo/lighthouse/2026-05-26T083000Z/assertions-20260526.json
  seo/history/2026-05-26T083000Z/una-shell-history-per-ogni-progetto.json
```

Il path include il timestamp ISO 8601 — ogni run è una snapshot immutabile. I GitHub Artifacts restano come cache a breve termine (30 giorni), ma la fonte di verità è R2.

In più, ho aggiunto un **job di change tracking** che, a ogni deploy, calcola il `git diff` dei post modificati e lo salva sia su R2 (archivio raw) sia su D1 in una tabella `post_history` strutturata: commit hash, data, messaggio, tipo di modifica (`created`/`modified`/`deleted`), righe aggiunte e rimosse. Questo tracciamento è propedeutico alla **seontology** (sì, l'ho chiamata così) — l'ontologia semantica del blog che collegherà concetti, tag, keyword trends e modifiche ai contenuti. Ma questa è roba per il blocco 3.

---

## Google Trends: cosa cerca la gente?

Il blocco 1 mi dice _come sto_. Il blocco 2 mi dice _cosa dovrei scrivere_.

Ho integrato **Google Trends** tramite {% xlink "https://serpapi.com/" "serpapi" role="tool" context="enables-step" target="external-commercial" %} (100 chiamate/mese gratis, per un weekly bastano e avanzano). Le keyword da monitorare non le ho scelte io: le estrae automaticamente il sistema:

1. **Categorie del blog** — "DevOps", "Fisica", "Reti Sociali", "Home Assistant", "Meccanica" (fisse, 5)
2. **Top-10 tag per frequenza** — calcolati dinamicamente da tutti i frontmatter dei post
3. **Termini del glossario** — da `_data/glossary.yml` (15 termini tecnici)
4. **Rising queries** — le query in crescita che Google Trends associa a ogni keyword seed (scoperta automatica!)

Il seed set è di circa 25-30 keyword per run. Per ognuna, salvo l'interesse nel tempo (90 giorni), la distribuzione geografica (Italia) e le query correlate in crescita. Queste ultime sono il vero oro: ogni settimana scopro cosa sta cercando la gente _adesso_, e posso decidere se scriverne.

I dati finiscono su R2 (raw) e su D1 (`keyword_trends`) per le query analitiche.

---

## Google Search Console: come mi trovano?

Se Google Trends ti dice cosa cercano, **Search Console** ti dice come ti trovano. Ho integrato l'API ufficiale di Google Search Console tramite una service account:

- **Query metriche**: top 100 query di ricerca, con click, impressions, CTR e posizione media
- **Page metriche**: le stesse metriche, per ogni URL del blog
- **Finestra**: 30 giorni, allineata alla schedulazione weekly

Anche questi dati vanno su R2 (raw) e D1 (`search_console_data`). La tabella ha colonne per `query`, `page`, `clicks`, `impressions`, `ctr`, `position`, `device`, `country` — abbastanza per fare analisi di coverage e identificare i contenuti che performano meglio (o peggio) del previsto.

---

## dbt: dal data lake al data warehouse

Fin qui abbiamo **dati grezzi** in R2 e D1. Ma dati grezzi non sono informazione. Servono **trasformazioni**: pulizia, deduplicazione, aggregazione, modellazione dimensionale.

Per questo ho scelto {% xlink "https://www.getdbt.com/" "dbt" role="tool" context="enables-step" target="external-authoritative" %} (data build tool). dbt è lo standard de facto per la trasformazione dati in ambienti analitici: scrivi modelli SQL, dichiari le dipendenze tra di essi, e dbt li esegue nell'ordine giusto, con test di qualità e contratti di schema. Non è un orchestratore — è un compilatore intelligente.

Il progetto dbt (`_dbt/`) è strutturato in due layer:

### Staging (pulizia e normalizzazione)

```
stg_seo_snapshots   → deduplica i JSON di PageSpeed/Lighthouse
stg_post_history    → arricchisce i git diff con metriche derivate
stg_keyword_trends  → normalizza i dati Trends
stg_search_console  → pulisce e tipizza i dati GSC
```

### Analytics (modelli dimensionali)

```
dim_posts            → SCD Type 2: storico delle modifiche a titoli, tag e categoria
fct_seo_metrics      → KPI SEO giornalieri (performance, accessibility, LCP, CLS, etc.)
fct_post_activity    → velocità e magnitudine delle modifiche per post
fct_keyword_performance → copertura e trend delle keyword
```

Il **dim_posts** è la parte più elegante: usa una **Slowly Changing Dimension di Tipo 2**, il che significa che ogni modifica a un post (titolo, categoria, tag) crea una nuova riga con `valid_from`/`valid_to`, e la riga corrente ha `is_current = TRUE`. Questo permette di ricostruire lo stato del blog _in qualsiasi momento nel passato_ e di correlare i cambiamenti nei contenuti con i trend SEO. Seontology, dicevamo.

dbt compila i modelli in SQLite (il dialetto di D1), valida i contratti di schema (tipi, vincoli, test `unique`/`not_null`/`relationships`) e un adapter Python (`dbt_runner.py`) applica il SQL compilato a D1 via HTTP API. Niente database locale, niente DuckDB, niente complicazioni: il SQL è SQLite, D1 è SQLite.

---

## Alert: quando le cose vanno male

Un sistema di monitoring senza alert è un sistema di monitoring inutile. Le soglie che ho configurato:

| Metrica | Soglia | Azione |
|---|---|---|
| Performance mobile | < 50% | Alert |
| Accessibilità | < 80% | Alert |
| SEO score | < 70% | Alert |
| LCP mobile | > 4 secondi | Alert |
| CLS | > 0.25 | Alert |

Gli alert vengono registrati nella tabella D1 `alerts` e salvati come artifact JSON del workflow, accessibile dalla pagina dell'azione su GitHub. Niente issue automatiche, niente spam sulla codebase: il report è un artifact, non un disturbo. Se voglio approfondire, apro l'ultimo workflow run e leggo.

Per il futuro (blocco 3), l'idea è che questi alert vengano consumati da un agente LLM che propone — e applica — le correzioni automaticamente. Ma non anticipiamo.

---

## Il report mensile

Se il workflow cade di lunedì, e quel lunedì è il primo del mese, parte la generazione del **report mensile**. Un file Markdown con:

- **Site Health Overview**: media di performance, accessibility, SEO e best-practices su tutti gli URL
- **Core Web Vitals**: LCP, TBT, CLS, FCP aggregati
- **Alert del mese**: tabella con URL, metrica, valore vs soglia
- **Search Console top queries**: cosa ha performato meglio in termini di click e CTR

Il report viene salvato come artifact del workflow. Niente GitHub Issues, niente PR: la codebase resta pulita, il report è un output della pipeline, come un log di build. Lo apro quando voglio, lo ignoro quando non mi serve.

---

## Quanto costa

Zero. Ecco il conto:

- **Cloudflare R2**: 10 GB di storage, 10M operazioni Classe A/mese. Con ~100 JSON a settimana da pochi KB l'uno, non arrivo nemmeno all'1%.
- **Cloudflare D1**: 5 GB, 5M righe lette/giorno. Con ~1000 righe a settimana, sto nell'ordine dello 0.1%.
- **serpapi**: 100 chiamate/mese gratuite. Ne consumo ~50-60 a run settimanale.
- **GitHub Actions**: illimitato per repository pubblici. Il workflow weekly consuma ~2 minuti di CI.
- **Google Search Console API**: gratuita, limiti giornalieri generosissimi.
- **Google Trends**: gratuito (tramite serpapi, che fa da proxy).

Non sto pagando un centesimo per tutto questo. Il free tier è la mia religione.

---

## Prossimi passi: il blocco 3

Ora che ho i dati (blocco 1) e il monitoraggio (blocco 2), il passo finale è **l'applicazione automatica delle migliorie**. L'idea:

1. Un agente LLM analizza i report SEO e gli alert
2. Propone modifiche ai post (es. "il titolo è troppo lungo per Google", "manca l'alt text su questa immagine", "questa keyword sta crescendo, scrivici un articolo")
3. Le modifiche vengono applicate in una pull request su GitHub
4. Il blocco 2 monitora l'effetto delle modifiche e chiude il ciclo di feedback

Ma per oggi va bene così. Il cruscotto è acceso. I numeri arrivano. La macchina gira.

Nel frattempo, tutto il codice è su {% xlink "https://github.com/theclue/gabrielebaldassarre.com" "GitHub" role="source" context="supports-claim" target="external-community" %}, nella directory `_scripts/seo/` e `_dbt/`. Sentitevi liberi di saccheggiarlo.
