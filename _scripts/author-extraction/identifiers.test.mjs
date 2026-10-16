import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  assertCanonicalIdentifier, canonicalIdentifier, canonicalIdentifierMap,
  formatObservationId, formatPatternId, identifierConventionForContract,
} from "./identifiers.mjs";
import { assignRhetoricalGroupIds } from "./rhetorical.mjs";
import { assignSemanticGroupIds } from "./semantic.mjs";
import { assignEpistemicGroupIds } from "./epistemic.mjs";
import { assignDecisionalGroupIds } from "./decisional.mjs";

const schema = JSON.parse(await readFile(new URL("./identifiers.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ strict: true }).compile(schema);
const group = (observation_id, extra = {}) => ({ label: "Synthetic group", support: [{ observation_id, article_id: observation_id.slice(0, 3) }], ...extra });

describe("canonical identifier hygiene and explicit retained-contract compatibility", () => {
  it("uses exactly one colon by default across all generated identifier families", () => {
    const ids = [formatObservationId("A01", 1), formatPatternId("APC", "R", 1), formatPatternId("SPC", "C", 1),
      formatPatternId("SPC", "R", 2), formatPatternId("EPC", "A", 1), formatPatternId("DPC", "T", 7)];
    assert.deepEqual(ids, ["A01:O0001", "APC:R0001", "SPC:C0001", "SPC:R0002", "EPC:A0001", "DPC:T0007"]);
    for (const id of ids) { assert.ok(validate(id)); assert.equal(assertCanonicalIdentifier(id), id); }
  });

  it("rejects double separators, wrong namespace codes, malformed counters and arbitrary text in canonical contracts", () => {
    for (const id of ["APC::R0001", "SPC::C0001", "A01::O0001", "DPC::A0001", "APC:C0001", "SPC:A0001", "EPC:R0001",
      "A00:O0001", "APC:R0000", "APC:R001", "SPC:::C0001", "https://example.test/a::b", "C++::name"]) {
      assert.equal(validate(id), false, id);
      assert.throws(() => assertCanonicalIdentifier(id), { code: "IDENTIFIER_INVALID" });
    }
  });

  it("makes retained formatting an explicit finite version policy rather than a default inherited by new contracts", () => {
    for (const version of ["1.1", "1.2", "1.3"]) assert.equal(formatObservationId("A01", 1, `author-extraction/${version}`), "A01::O0001");
    for (const kind of ["dimension", "preparation"]) for (const version of ["0.2", "0.3", "0.4", "0.5", "0.6"]) {
      const contract = `author-pattern-${kind}/${version}`;
      assert.equal(formatPatternId("APC", "R", 1, contract), "APC::R0001");
      assert.equal(formatPatternId("SPC", "C", 1, contract), "SPC::C0001");
      assert.equal(formatPatternId("EPC", "A", 1, contract), "EPC:A0001");
      assert.equal(formatPatternId("DPC", "T", 1, contract), "DPC:T0001");
    }
    assert.equal(identifierConventionForContract(), "single_colon");
    assert.equal(formatObservationId("A01", 1, "author-extraction/1.4"), "A01:O0001");
    assert.equal(formatPatternId("APC", "R", 1, "author-pattern-dimension/0.7"), "APC:R0001");
    assert.equal(formatPatternId("SPC", "C", 1, "author-pattern-preparation/0.7"), "SPC:C0001");
    assert.throws(() => identifierConventionForContract("infer-from-the-id"), { code: "IDENTIFIER_INVALID" });
  });

  it("keeps membership ordering and independent counters while new rhetorical and semantic generators default to one colon", () => {
    const groups = [group("A02:O0001"), group("A01:O0001")];
    const rhetorical = assignRhetoricalGroupIds(groups);
    assert.deepEqual(rhetorical.map((g) => g.id), ["APC:R0001", "APC:R0002"]);
    assert.equal(rhetorical[0].support[0].observation_id, "A01:O0001");
    assert.deepEqual(assignRhetoricalGroupIds(groups, "author-pattern-dimension/0.6").map((g) => g.id), ["APC::R0001", "APC::R0002"]);
    const semanticGroups = [group("A03:O0001", { semantic_kind: "relation" }), group("A02:O0001", { semantic_kind: "concept" }), group("A01:O0001", { semantic_kind: "concept" })];
    assert.deepEqual(assignSemanticGroupIds(semanticGroups).map((g) => g.id), ["SPC:C0001", "SPC:C0002", "SPC:R0001"]);
    assert.deepEqual(assignSemanticGroupIds(semanticGroups, "author-pattern-dimension/0.6").map((g) => g.id), ["SPC::C0001", "SPC::C0002", "SPC::R0001"]);
    const renamed = groups.slice().reverse().map((g) => ({ ...g, label: "Different label" }));
    assert.deepEqual(assignRhetoricalGroupIds(renamed).map((g) => [g.id, g.support]), rhetorical.map((g) => [g.id, g.support]));
  });

  it("routes epistemic and decisional generators through the same canonical formatter without changing their IDs", () => {
    const groups = [group("A01:O0001", { classification: "thematic" }), group("A02:O0001", { classification: "author_candidate" }), group("A03:O0001", { classification: "editorial_format" })];
    assert.deepEqual(assignEpistemicGroupIds(groups).map((g) => g.id), ["EPC:A0001", "EPC:E0001", "EPC:T0001"]);
    assert.deepEqual(assignDecisionalGroupIds(groups).map((g) => g.id), ["DPC:A0001", "DPC:E0001", "DPC:T0001"]);
    for (const value of [0, -1, 1.5, 10000, NaN]) assert.throws(() => formatPatternId("APC", "R", value), { code: "IDENTIFIER_INVALID" });
    assert.throws(() => formatPatternId("SPC", "A", 1), { code: "IDENTIFIER_INVALID" });
  });

  it("normalizes only complete known identifier values and detects identity collisions before a future migration", () => {
    assert.equal(canonicalIdentifier("APC::R0013"), "APC:R0013");
    assert.equal(canonicalIdentifier("SPC::R0002"), "SPC:R0002");
    assert.equal(canonicalIdentifier("A20::O0012"), "A20:O0012");
    assert.equal(canonicalIdentifier("DPC:T0009"), "DPC:T0009");
    assert.deepEqual([...canonicalIdentifierMap(["APC::R0001", "SPC::C0001", "EPC:A0001"])], [["APC::R0001", "APC:R0001"], ["SPC::C0001", "SPC:C0001"], ["EPC:A0001", "EPC:A0001"]]);
    assert.throws(() => canonicalIdentifierMap(["APC::R0001", "APC:R0001"]), { code: "IDENTIFIER_COLLISION" });
    assert.throws(() => canonicalIdentifierMap(["DPC:A0001", "DPC:A0001"]), { code: "IDENTIFIER_COLLISION" });
    assert.throws(() => canonicalIdentifier("DPC::A0001"), { code: "IDENTIFIER_INVALID" });
    assert.throws(() => canonicalIdentifier("a quote containing APC::R0001"), { code: "IDENTIFIER_INVALID" });
  });

  it("rederives every retained v1.3 rhetorical and semantic ID unchanged without modifying the records", async () => {
    for (const [name, assign] of [["rhetorical", assignRhetoricalGroupIds], ["semantic", assignSemanticGroupIds]]) {
      const url = new URL(`../../docs/author-pattern-results/v1.3/${name}.json`, import.meta.url);
      const bytes = await readFile(url); const record = JSON.parse(bytes);
      assert.deepEqual(assign(record.groups.map(({ id, ...g }) => g), record.schema_version), record.groups);
      assert.deepEqual(await readFile(url), bytes);
    }
    const record = JSON.parse(await readFile(new URL("../../docs/author-extraction-results/v1.3/A01.json", import.meta.url), "utf8"));
    assert.ok(record.observations.every((entry, index) => entry.id === formatObservationId(record.source.article_id, index + 1, record.schema_version)));
  });
});
