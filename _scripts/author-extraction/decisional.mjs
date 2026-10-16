import { formatPatternId } from "./identifiers.mjs";

// classification is unchanged. Each subtype owns an independent, membership-
// ordered review-candidate counter; the separator is one colon, not two.
export function assignDecisionalGroupIds(groups) {
  const codes = { author_candidate: "A", editorial_format: "E", thematic: "T" };
  const counters = { author_candidate: 0, editorial_format: 0, thematic: 0 };
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const membership = (group) => JSON.stringify(group.support.map((entry) => entry.observation_id).sort());
  return groups.slice().sort((left, right) => compare(codes[left.classification], codes[right.classification]) || compare(membership(left), membership(right)))
    .map((group) => ({ ...group, id: formatPatternId("DPC", codes[group.classification], ++counters[group.classification]) }));
}
