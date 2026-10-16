// Canonical convention for new contracts: one colon. Retained contracts are
// enumerated explicitly so verification never silently relabels frozen data.
const RETAINED_CONTRACTS = new Set([
  "author-extraction/1.1", "author-extraction/1.2", "author-extraction/1.3",
  ...["dimension", "preparation"].flatMap((kind) => Array.from({ length: 6 }, (_, index) => `author-pattern-${kind}/0.${index + 1}`)),
]);
const CANONICAL = /^(?:A(?:0[1-9]|[1-9][0-9]):O|APC:R|SPC:[CR]|[ED]PC:[AET])(?!0000)[0-9]{4}$/;
const RETAINED_DOUBLE = /^(?:A(?:0[1-9]|[1-9][0-9])::O|APC::R|SPC::[CR])(?!0000)[0-9]{4}$/;
const CODES = { APC: ["R"], SPC: ["C", "R"], EPC: ["A", "E", "T"], DPC: ["A", "E", "T"] };

function invalid(message = "The identifier does not match its namespace or canonical format.") {
  throw Object.assign(new Error(message), { code: "IDENTIFIER_INVALID" });
}

export function identifierConventionForContract(schemaVersion) {
  if (schemaVersion === undefined) return "single_colon";
  if (typeof schemaVersion !== "string" || !/^author-(?:extraction|pattern-(?:dimension|preparation))\/[0-9]+\.[0-9]+$/.test(schemaVersion)) invalid("An explicit supported-family contract version is required.");
  return RETAINED_CONTRACTS.has(schemaVersion) ? "retained_contract" : "single_colon";
}

function sequenceNumber(sequence) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) invalid("Identifier counters must be positive four-digit integers.");
  return String(sequence).padStart(4, "0");
}

export function formatObservationId(articleId, sequence, schemaVersion) {
  if (typeof articleId !== "string" || !/^A(?:0[1-9]|[1-9][0-9])$/.test(articleId)) invalid();
  const separator = identifierConventionForContract(schemaVersion) === "retained_contract" ? "::" : ":";
  return `${articleId}${separator}O${sequenceNumber(sequence)}`;
}

export function formatPatternId(namespace, subtype, sequence, schemaVersion) {
  if (!Object.hasOwn(CODES, namespace) || !CODES[namespace].includes(subtype)) invalid();
  const retained = identifierConventionForContract(schemaVersion) === "retained_contract";
  const separator = retained && (namespace === "APC" || namespace === "SPC") ? "::" : ":";
  return `${namespace}${separator}${subtype}${sequenceNumber(sequence)}`;
}

export function assertCanonicalIdentifier(id) {
  if (typeof id !== "string" || !CANONICAL.test(id)) invalid();
  return id;
}

// Only a whole, recognized identifier can be normalized. This function never
// walks JSON, changes prose/quotes/URLs, writes files or updates provenance.
export function canonicalIdentifier(id) {
  if (typeof id === "string" && RETAINED_DOUBLE.test(id)) return assertCanonicalIdentifier(id.replace("::", ":"));
  return assertCanonicalIdentifier(id);
}

// A future versioned migration must first prove that distinct definitions do
// not collapse onto one ID. The map alone is not a valid artifact migration.
export function canonicalIdentifierMap(ids) {
  if (!Array.isArray(ids)) invalid();
  const result = new Map(); const seen = new Set();
  for (const id of ids) {
    const normalized = canonicalIdentifier(id);
    if (seen.has(normalized)) throw Object.assign(new Error("Identifier normalization would create a duplicate identity."), { code: "IDENTIFIER_COLLISION" });
    seen.add(normalized); result.set(id, normalized);
  }
  return result;
}
