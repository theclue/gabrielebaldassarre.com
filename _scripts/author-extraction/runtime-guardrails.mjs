import { canonicalIdentifier } from "./identifiers.mjs";

// Version-local clauses of the governed model's existing guardrails. These
// are applicability/projection rules, not new author-pattern review decisions.
export function projectRuntimeGuardrails(model, task, linkedIds, principleIds, deviceIds) {
  const has = (feature) => task.features.includes(feature);
  const local = (topic) => task.local_topics.includes(topic);
  const types = new Set(task.content_type === "mixed" ? task.mixed_content_types : [task.content_type]);
  const scientific = types.has("scientific_explainer");
  const planningProhibition = task.series_context.planned_continuation
    ? "Non inventare date, destinazioni o dettagli della prosecuzione non dichiarati nel brief."
    : "Non annunciare una prosecuzione: il brief non dichiara un piano.";
  const guardrails = [], resolution = [];
  const known = new Set(model.guardrails.map((g) => g.id));
  if ([...linkedIds].some((id) => !known.has(id))) throw Object.assign(new Error("An unknown guardrail cannot be projected."), { code: "RUNTIME_GUARDRAIL_POLICY_INVALID" });

  for (const source of model.guardrails.filter((g) => linkedIds.has(g.id))) {
    const clauses = [], covered = [];
    const allowed = new Set(source.source_pattern_ids.map(canonicalIdentifier));
    const add = (number, applies, instruction, sourceIds = [...allowed]) => {
      if (!applies) return;
      if (sourceIds.some((id) => !allowed.has(id))) throw Object.assign(new Error("A projected clause introduces new source lineage."), { code: "RUNTIME_LINEAGE_INVALID" });
      clauses.push({ id: `${source.id}:C${String(number).padStart(2, "0")}`, instruction, source_pattern_ids: sourceIds });
    };
    switch (source.id) {
      case "G01": case "G02": case "G03":
        add(1, true, source.instruction);
        break;
      case "G04": {
        const math = scientific && has("mathematical_connection") && deviceIds.has("D03");
        const network = local("social_networks") && deviceIds.has("D03");
        add(1, math || network, "Non trasformare una somiglianza in identità o generalizzazione dimostrata, né un'analogia in prova del modello.",
          [...(math ? ["APC:R0002"] : []), ...(network ? ["APC:R0006"] : [])]);
        add(2, scientific && has("historical_context") && deviceIds.has("D03"), "Non rappresentare la storia come progresso lineare inevitabile.", ["APC:R0005"]);
        add(3, has("quantitative_calculation") && deviceIds.has("D02"), "Non trattare un caso numerico illustrativo come validazione generale del modello.", ["APC:R0012"]);
        add(4, has("practical_relevance") && deviceIds.has("D05"), "Non gonfiare l'importanza di applicazioni celebri per valorizzare il tema.", ["APC:R0004"]);
        add(5, local("quantum_logic_or_measurement_contrast"), "Non estendere il contrasto quantistico a una confutazione generale della fisica classica.", ["APC:R0008"]);
        break;
      }
      case "G05":
        add(1, scientific && has("scope_delimitation"), "Nelle omissioni dichiarate evitare di norma tautologie e spiegazioni lapalissiane dell'esclusione.", ["DPC:E0001"]);
        add(2, local("lighting_model"), "Nel modello luminoso non elencare limiti totalmente tautologici o lapalissiani.", ["EPC:T0010"]);
        add(3, true, "Non eliminare passaggi indispensabili per delimitare il testo.", ["DPC:E0001"]);
        add(4, true, "Non trasformare la cautela epistemica nell'obbligo di esplicitare ogni limite possibile.");
        break;
      case "G06":
        if (!task.series_context.planned_continuation) covered.push("G06:C01");
        else {
          add(2, true, "Usare anticipazioni soltanto per la prosecuzione effettivamente pianificata nel brief.");
          add(3, task.series_context.is_series, "Dichiarare di norma prima l'appartenenza alla serie.");
          add(4, true, "Non rinviare ciò che serve all'obiettivo della trattazione corrente.");
          add(5, true, "Un annuncio non dimostra che la prosecuzione sia stata realizzata.");
          covered.push("G06:C06");
        }
        break;
      case "G07":
        add(1, types.has("tutorial") && has("external_dependencies"), "Non proporre alternative automaticamente né far proliferare opzioni non verificate.");
        add(2, types.has("tutorial") && has("external_dependencies"), "Distinguere disponibilità, funzionalità e informazione conservata, senza presumere equivalenza o continuità della soluzione alternativa.");
        break;
      case "G08":
        add(1, principleIds.has("P05"), source.instruction.replace(" e non è limitata alle API", ""));
        break;
      case "G09":
        add(1, principleIds.has("P04") || deviceIds.has("D02"), "Non aggiungere formalismo, scenari o calcoli soltanto per imitare il registro.");
        add(2, scientific && has("variable_conditions"), "Non introdurre generalizzazioni a condizioni variabili che non servono all'obiettivo.", ["EPC:T0014"]);
        add(3, scientific && has("mathematical_formalism") && has("physical_quantities"), "Il bilanciamento dimensionale è necessario nel raccordo fra concetti matematici e grandezze fisiche, non un ornamento facoltativo.", ["EPC:T0009"]);
        add(4, scientific && has("mathematical_formalism"), "Non presentare il modello astratto come descrizione fisica completa o come rifiuto di esempi e analogie.", ["DPC:T0003", "DPC:T0008"]);
        break;
      case "G10": {
        const ids = [];
        if (local("phase_portrait")) { ids.push("EPC:T0008"); add(1, true, "Non estendere la valutazione del ritratto di fase a una superiorità generale del visuale.", ["EPC:T0008"]); }
        if (local("lighting_model")) { ids.push("EPC:T0010"); add(2, true, "Non generalizzare i limiti dei dati del modello luminoso a qualsiasi dato o modello.", ["EPC:T0010"]); }
        if (local("social_networks")) { ids.push("APC:R0006"); add(3, true, "Non estendere le analogie nelle reti sociali a proprietà non coperte dal confronto.", ["APC:R0006"]); }
        if (local("quantum_logic_or_measurement_contrast")) { ids.push("APC:R0008"); add(4, true, "Non trasferire il contrasto classico/quantistico della logica o misura ad altri confronti fra teorie.", ["APC:R0008"]); }
        add(5, ids.length > 0, "Il sostegno locale non prova ricorrenza indipendente; una dichiarazione più ampia dell'autore non modifica i conteggi o i limiti approvati.", ids);
        break;
      }
      default:
        throw Object.assign(new Error("The linked guardrail has no explicit clause policy."), { code: "RUNTIME_GUARDRAIL_POLICY_INVALID" });
    }
    const target = clauses.length ? `/guardrails/${guardrails.length}` : null;
    if (clauses.length) guardrails.push({ id: source.id, source_clause_ids: clauses.map((c) => c.id),
      instruction: clauses.map((c) => c.instruction).join(" "), source_pattern_ids: [...new Set(clauses.flatMap((c) => c.source_pattern_ids))].sort() });
    resolution.push({ guardrail_id: source.id, disposition: clauses.length ? "projected" : covered.length ? "covered_by_prohibition" : "not_applicable",
      clause_ids: clauses.map((c) => c.id), runtime_target: target, covered_clause_ids: covered,
      covered_by: covered.length ? "/runtime_instructions/prohibitions/1" : null,
      reason: clauses.length ? "Clausole pertinenti obbligatorie, selezionate dal brief." : covered.length ? "Obbligo già presente nella prohibition specifica; nessuna duplicazione." : "Nessuna condizione di applicabilità attiva nel brief." });
  }
  return { guardrails, resolution, planningProhibition };
}
