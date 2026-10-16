import { formatPatternId } from "./identifiers.mjs";

// Review-candidate IDs are local to a versioned dimension record. Concept and
// relation counters are independent; labels and proposal order do not rank IDs.
export function assignSemanticGroupIds(groups, schemaVersion) {
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const membership = (group) => JSON.stringify(group.support.map((entry) => entry.observation_id).sort());
  const counters = { concept: 0, relation: 0 };
  return groups.slice().sort((left, right) => compare(left.semantic_kind, right.semantic_kind) || compare(membership(left), membership(right)))
    .map((group) => {
      const code = group.semantic_kind === "concept" ? "C" : "R";
      const sequence = ++counters[group.semantic_kind];
      return { ...group, id: formatPatternId("SPC", code, sequence, schemaVersion) };
    });
}
