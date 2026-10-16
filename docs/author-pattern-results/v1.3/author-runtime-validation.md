# Step 5 — Runtime validation on real article contexts

This report concerns selection, resolved instructions and a small illustrative
application. It is not another pattern review, a new consolidation, an
independent provider benchmark or a claim of human authorship.

## Governed source and reproducible example

- Source: `author-model.json`, SHA-256
  `88d622c01aee9e0dafa44a2966ebbbe63ff8249336eb0e861da13c157051f8b5`.
- Completed-review hash:
  `0634ee72b622572a38a8fb684f28ca15eb026070dd029288d8e2128128f95f28`.
- Source model size: **41,011 bytes**.
- Example task: `_scripts/author-extraction/fixtures/runtime-tasks/A08-scientific-units.json`.
- Materialized runtime: `ARP:6D694FF2CDF563CBFBFAD186`.
- [Runtime profile](author-runtimes/arp-6d694ff2cdf563cbfbfad186/author-runtime-profile.json),
  SHA-256 `5cb6d5aa218e4020daa595c373240fc820674029e3ceb294ad8300f4a4fcd23b`.
- [Resolved instructions](author-runtimes/arp-6d694ff2cdf563cbfbfad186/author-runtime-instructions.md),
  SHA-256 `72f36ddeebda5b6eef9c8b90619733e181dc828aff233bf8ef6a4767f6fa98cd`.

The example contains one active contextual profile, two principles, one
contextual rule, two devices, all eight linked mandatory guardrails and no
semantic context. The numerical device is `required` because the **task** asks
for a worked calculation, not because scientific writing always requires one.

## Corpus smoke cases

The seven task annotations in `fixtures/runtime-corpus-cases.json` refer to real
approved articles. Tests read the actual files, compare their bytes with the
existing extraction-record hashes and check topic markers before checking the
runtime. The annotations are explicit test briefs, not new extracted author
observations.

| Article | Profiles | Principles | Selected devices | Mandatory guards | Semantics | JSON bytes | Prompt bytes |
| --- | --- | --- | --- | ---: | --- | ---: | ---: |
| A02, social networks | C01, C04 | P03, P06 | D01 available; D03 available | 8 | S01 | 16,460 | 7,725 |
| A07, phase portrait | C01, C04 | P02, P04, P06 | D01 available; D02 preferred | 8 | S02 | 18,433 | 8,686 |
| A08, units | C01 | P04, P06 | D01 available; D02 required | 8 | none | 15,769 | 7,628 |
| A09, lighting project | C02, C04 | P01, P02, P04, P05, P06 | D01 available; D02 available; D05 preferred | 10 | none | 21,874 | 10,428 |
| A10, lunar tutorial | C02, C03 | P01, P02, P05, P06 | D01 available; D05 preferred | 10 | none | 19,516 | 9,109 |
| A13, states and systems | C01 | P04, P06 | D01 available; D02 preferred | 8 | S02, S03 | 17,037 | 8,009 |
| A20, SEO project | C02, C03 | P01, P02, P05, P06 | D01 available; D05 preferred; D06 available | 10 | none | 20,780 | 9,951 |

Notable checks:

- A08 receives no invariance/state-space context merely because it is physics.
- A07 activates only the phase-portrait local rule; A09 only the lighting rule.
- A10 belongs to a series but has no declared continuation plan: no continuation
  device is activated and the instructions forbid inventing a sequel.
- A20 has an explicit test brief for a planned continuation; that device is
  available, not automatically required, and planned work is not called implemented.
- Selecting only semantic context leaves the operative/style selection unchanged.
- High risk does not silently exclude a source or make a device mandatory.
- Every connected guardrail is preserved, including the source profile's broader
  constraints. Local domains mentioned by a guardrail are restrictions, not
  topics to insert into the article.

The JSON profiles are about **38–53%** of the full model's size in these cases;
the resolved prompts are about **19–25%**. This is byte size, not a claim of an
identical tokenizer budget for every LLM.

## Small illustrative application in this session

The following is a short example written by the assistant in the current
session using the materialized A08 runtime and the facts/formula supplied by
the existing A08 passages P0013–P0015. It is **not** the result of a separate
cold-context/provider run and it was not written into the original post. The
calculation is an illustrative conversion, rounded to two significant figures,
not a newly claimed measurement.

> A quale massa corrisponde un'energia di 1 eV? Usiamo l'equivalenza
> massa–energia nella forma \(m=E/c^2\). Con i valori dell'esempio:
>
> \[
> m=\frac{1{,}602\times10^{-19}\,\mathrm{J}}
> {(2{,}99\times10^8\,\mathrm{m/s})^2}
> \simeq 1{,}8\times10^{-36}\,\mathrm{kg}.
> \]
>
> Il raccordo non è soltanto numerico. La relazione fisica indica l'operazione
> da compiere e il bilanciamento dimensionale la rende leggibile nelle unità:
> \(\mathrm{J}/(\mathrm{m^2/s^2})=\mathrm{kg}\). Stiamo ricavando una massa
> da un'energia, non assegnando due nomi alla stessa grandezza.

This example uses one optional transition question and fulfils the explicitly
required numerical calculation. It does not add a compulsory hypothetical
apparatus, history, reader reassurance, an autobiographical anecdote, semantic
metaphors or an announced sequel. These observations illustrate application of
the runtime contract; they are not a quantitative judgment of voice fidelity or
a scientific validation of the corpus as a whole.

## Automated results and boundaries

- Full package suite: **145/145 passed**, including 17 runtime tests.
- Plugin VM integration checks: **6/6 passed**; no new runtime native tool was added.
- Exact runtime recompilation and manifest hash checks passed.
- Tampered profiles, removed guards, invented required-device states, unsupported
  contexts, stale models and unsafe output paths are rejected.
- Existing source posts, extraction/consolidation records, human review, released
  transformations and author model were not changed.

Actual generation quality and robust LLM adherence still need task-specific
assessment when the profile is used by a writing model. No provider/model was
selected or invoked by the deterministic runtime compiler, and no article was
published, committed or deployed by these checks.
