// IDs identify review candidates within one versioned dimension record, not
// permanent author traits. Ordering depends on membership, never on labels,
// scope, relevance, locale, or the model's proposal order.
export function assignRhetoricalGroupIds(groups) {
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const membership = (group) => JSON.stringify(group.support.map((entry) => entry.observation_id).sort());
  return groups.slice().sort((left, right) => compare(membership(left), membership(right)))
    .map((group, index) => ({ ...group, id: `APC::R${String(index + 1).padStart(4, "0")}` }));
}
