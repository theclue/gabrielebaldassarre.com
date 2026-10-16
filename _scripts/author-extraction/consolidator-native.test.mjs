import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { createConsolidationAdapter, prepareInputSchema, submitInputSchema } from './consolidator-native.mjs';
import { assignRhetoricalGroupIds } from './rhetorical.mjs';
import { assignSemanticGroupIds } from './semantic.mjs';
import { assignDecisionalGroupIds } from './decisional.mjs';
import { assignEpistemicGroupIds } from './epistemic.mjs';

const ROOT = '/synthetic/trusted-consolidation-root';
const CORPUS_HASH = 'a'.repeat(64);
const INPUT_HASH = 'b'.repeat(64);
const ALLOWED_CONTEXT = { sessionId: 'consolidation-session-1', agent: 'author-pattern-consolidator' };
const METHOD = {
  consolidation_version: 'consolidate/1',
  projection_version: 'observation-projection/1',
  instructions_version: 'author-pattern-consolidator/0.1',
  schema_hash: 'c'.repeat(64),
  instructions_hash: 'd'.repeat(64),
};
const PREPARED = {
  status: 'ready',
  schema_version: 'author-pattern-preparation/0.1',
  corpus_hash: CORPUS_HASH,
  input_hash: INPUT_HASH,
  method: METHOD,
  dimension: 'rhetorical',
  observations: [
    {
      observation_id: 'A01::O0001', article_id: 'A01', dimension: 'rhetorical',
      label: 'synthetic observation A01', description: 'A bounded synthetic observation.', inference_kind: 'explicit',
      evidence_refs: [{ passage_id: 'P0001', quote: 'literal {% source %} quote A01' }],
    },
    {
      observation_id: 'A02::O0001', article_id: 'A02', dimension: 'rhetorical',
      label: 'synthetic observation A02', description: 'A bounded synthetic observation.', inference_kind: 'inferred',
      evidence_refs: [{ passage_id: 'P0001', quote: 'literal <em> quote A02' }],
    },
  ],
};

function candidate(overrides = {}) {
  return {
    groups: [{
      classification: 'author_candidate',
      label: 'synthetic recurring tendency',
      description: 'A pattern supported by two synthetic articles.',
      abstraction_kind: 'observed_regularities',
      rationale: 'Both article observations support this synthetic group.',
      variation_notes: ['The evidence uses literal markup and Liquid text.'],
      member_observation_ids: ['A01::O0001', 'A02::O0001'],
    }],
    unclustered_observations: [],
    ...overrides,
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function acceptedDimension(input = candidate()) {
  const sourceById = new Map(PREPARED.observations.map((item) => [item.observation_id, item]));
  const group = input.groups[0];
  const support = group.member_observation_ids
    .map((observation_id) => ({ observation_id, article_id: sourceById.get(observation_id).article_id }))
    .sort((left, right) => left.observation_id < right.observation_id ? -1 : left.observation_id > right.observation_id ? 1 : 0);
  return canonicalize({
    schema_version: 'author-pattern-dimension/0.1',
    dimension: 'rhetorical',
    corpus_hash: CORPUS_HASH,
    input_hash: INPUT_HASH,
    method: METHOD,
    groups: [{
      classification: group.classification,
      label: group.label,
      description: group.description,
      abstraction_kind: group.abstraction_kind,
      rationale: group.rationale,
      variation_notes: group.variation_notes,
      support,
      observation_count: support.length,
      article_count: new Set(support.map((item) => item.article_id)).size,
    }],
    unclustered_observations: [],
  });
}

function acceptedJson(input = candidate()) {
  return JSON.stringify(acceptedDimension(input));
}

function blockedPreparation() {
  return {
    status: 'blocked',
    schema_version: 'author-pattern-preparation/0.1',
    corpus_hash: CORPUS_HASH,
    diagnostics: [{ code: 'PROCESSING_NOT_TRACKED', article_id: 'A01' }],
  };
}

function adapterWith({ prepareConsolidation = async () => PREPARED, acceptDimensionCandidate: accept = async (_root, _dimension, _corpusHash, _inputHash, json) => acceptedJson(JSON.parse(json)) } = {}) {
  const calls = { prepare: [], accept: [] };
  const coreApi = {
    async prepareConsolidation(root, dimension, recordsDirectory) {
      calls.prepare.push({ root, dimension, recordsDirectory });
      return prepareConsolidation(root, dimension, recordsDirectory);
    },
    async acceptDimensionCandidate(root, dimension, corpusHash, inputHash, candidateJson, recordsDirectory) {
      calls.accept.push({ root, dimension, corpusHash, inputHash, candidateJson, recordsDirectory });
      return accept(root, dimension, corpusHash, inputHash, candidateJson, recordsDirectory);
    },
  };
  return { adapter: createConsolidationAdapter(coreApi, ROOT, { recordsDirectory: 'docs/author-extraction-results/v1.2' }), calls };
}

function submitInput(overrides = {}) {
  return {
    dimension: 'rhetorical',
    corpus_hash: CORPUS_HASH,
    input_hash: INPUT_HASH,
    candidate_json: JSON.stringify(candidate()),
    ...overrides,
  };
}

async function rejectionCode(promise, code) {
  let caught;
  try { await promise; } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `expected error ${code}`);
  assert.equal(caught.code, code);
  assert.ok(caught.message.length <= 240);
  assert.ok(Array.isArray(caught.details));
  assert.ok(caught.details.length <= 5);
  assert.ok(caught.details.every((pointer) => /^(?:|\/(?:[^~]|~[01])*)$/.test(pointer)));
  return caught;
}

describe('consolidation native adapter protocol (closed schemas; no SDK or provider)', () => {
  it('compiles closed tool/result schemas and denies any agent except the consolidator', async () => {
    const schema = JSON.parse(await readFile(new URL('./patterns.schema.json', import.meta.url), 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validatePrepared = ajv.compile({ $schema: schema.$schema, $defs: schema.$defs, $ref: '#/$defs/PrepareResult' });
    const validateAccepted = ajv.compile({ $schema: schema.$schema, $defs: schema.$defs, $ref: '#/$defs/AcceptedDimension' });
    assert.equal(validatePrepared(PREPARED), true, JSON.stringify(validatePrepared.errors));
    assert.equal(validateAccepted(acceptedDimension()), true, JSON.stringify(validateAccepted.errors));
    assert.deepEqual(prepareInputSchema.required, ['dimension']);
    assert.deepEqual(submitInputSchema.required, ['dimension', 'corpus_hash', 'input_hash', 'candidate_json']);

    const { adapter, calls } = adapterWith();
    await rejectionCode(adapter.prepare({ dimension: 'rhetorical' }, { ...ALLOWED_CONTEXT, agent: 'author-extractor' }), 'AGENT_DENIED');
    await rejectionCode(adapter.submit(submitInput(), { ...ALLOWED_CONTEXT, agent: 'author-extractor' }), 'AGENT_DENIED');
    assert.equal(calls.prepare.length, 0);
    assert.equal(calls.accept.length, 0);
  });

  it('binds one dimension and both hashes across repeat preparation and submission', async () => {
    const { adapter, calls } = adapterWith();
    const first = await adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    const repeated = await adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    assert.deepEqual(repeated, first);
    assert.equal(calls.prepare.length, 2);
    await rejectionCode(adapter.prepare({ dimension: 'semantic' }, ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    await rejectionCode(adapter.submit(submitInput({ corpus_hash: 'e'.repeat(64) }), ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    assert.equal(calls.accept.length, 0);

    const wrongInputHash = adapterWith();
    const wrongInputContext = { ...ALLOWED_CONTEXT, sessionId: 'wrong-consolidation-input-hash' };
    await wrongInputHash.adapter.prepare({ dimension: 'rhetorical' }, wrongInputContext);
    await rejectionCode(wrongInputHash.adapter.submit(submitInput({ input_hash: 'f'.repeat(64) }), wrongInputContext), 'PROTOCOL_INVALID');

    const changedResults = [PREPARED, { ...PREPARED, input_hash: 'e'.repeat(64) }];
    const changed = adapterWith({ prepareConsolidation: async () => changedResults.shift() });
    const changedContext = { ...ALLOWED_CONTEXT, sessionId: 'changed-consolidation-hash' };
    await changed.adapter.prepare({ dimension: 'rhetorical' }, changedContext);
    await rejectionCode(changed.adapter.prepare({ dimension: 'rhetorical' }, changedContext), 'INPUT_CHANGED');

    const changedCorpusResults = [PREPARED, { ...PREPARED, corpus_hash: 'e'.repeat(64) }];
    const changedCorpus = adapterWith({ prepareConsolidation: async () => changedCorpusResults.shift() });
    const changedCorpusContext = { ...ALLOWED_CONTEXT, sessionId: 'changed-consolidation-corpus' };
    await changedCorpus.adapter.prepare({ dimension: 'rhetorical' }, changedCorpusContext);
    await rejectionCode(changedCorpus.adapter.prepare({ dimension: 'rhetorical' }, changedCorpusContext), 'INPUT_CHANGED');
  });

  it('accepts the core canonical ordering of non-ASCII groups independent of runtime collation', async () => {
    const fourObservationPreparation = {
      ...PREPARED,
      observations: [
        ...PREPARED.observations,
        {
          observation_id: 'A03::O0001', article_id: 'A03', dimension: 'rhetorical',
          label: 'synthetic observation A03', description: 'A bounded synthetic observation.', inference_kind: 'explicit',
          evidence_refs: [{ passage_id: 'P0001', quote: 'literal quote A03' }],
        },
        {
          observation_id: 'A04::O0001', article_id: 'A04', dimension: 'rhetorical',
          label: 'synthetic observation A04', description: 'A bounded synthetic observation.', inference_kind: 'explicit',
          evidence_refs: [{ passage_id: 'P0001', quote: 'literal quote A04' }],
        },
      ],
    };
    const shared = {
      classification: 'author_candidate',
      description: 'A recurring group with shared bounded evidence.',
      abstraction_kind: 'observed_regularities',
      rationale: 'Both articles support this synthetic group.',
      variation_notes: [],
    };
    const proposal = {
      groups: [
        { ...shared, label: 'zeta pattern', member_observation_ids: ['A01::O0001', 'A02::O0001'] },
        { ...shared, label: 'ångström pattern', member_observation_ids: ['A03::O0001', 'A04::O0001'] },
      ],
      unclustered_observations: [],
    };
    const projected = new Map(fourObservationPreparation.observations.map((item) => [item.observation_id, item]));
    const normalized = proposal.groups.map((group) => {
      const support = group.member_observation_ids.map((observation_id) => ({
        observation_id,
        article_id: projected.get(observation_id).article_id,
      })).sort((left, right) => left.observation_id < right.observation_id ? -1 : left.observation_id > right.observation_id ? 1 : 0);
      return {
        classification: group.classification,
        label: group.label,
        description: group.description,
        abstraction_kind: group.abstraction_kind,
        rationale: group.rationale,
        variation_notes: group.variation_notes,
        support,
        observation_count: support.length,
        article_count: new Set(support.map((item) => item.article_id)).size,
      };
    }).sort((left, right) => {
      const leftJson = JSON.stringify(canonicalize(left));
      const rightJson = JSON.stringify(canonicalize(right));
      return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
    });
    const coreCanonical = JSON.stringify(canonicalize({
      schema_version: 'author-pattern-dimension/0.1', dimension: 'rhetorical',
      corpus_hash: CORPUS_HASH, input_hash: INPUT_HASH, method: METHOD,
      groups: normalized, unclustered_observations: [],
    }));
    const { adapter } = adapterWith({
      prepareConsolidation: async () => fourObservationPreparation,
      acceptDimensionCandidate: async () => coreCanonical,
    });
    const session = { ...ALLOWED_CONTEXT, sessionId: 'non-ascii-native-groups' };
    await adapter.prepare({ dimension: 'rhetorical' }, session);
    const accepted = await adapter.submit(submitInput({ candidate_json: JSON.stringify(proposal) }), session);
    assert.equal(accepted.status, 'accepted');
  });

  it('makes blocked preparation terminal and does not call candidate acceptance', async () => {
    const { adapter, calls } = adapterWith({ prepareConsolidation: async () => blockedPreparation() });
    const blocked = await adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    assert.equal(blocked.status, 'blocked');
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    await rejectionCode(adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    assert.equal(calls.accept.length, 0);
  });

  it('counts its single submission before local payload validation and keeps candidate prose inert', async () => {
    const rejected = adapterWith();
    await rejected.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    await rejectionCode(rejected.adapter.submit(submitInput({ candidate_json: '{' }), ALLOWED_CONTEXT), 'CANDIDATE_JSON_INVALID');
    await rejected.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    await rejectionCode(rejected.adapter.submit(submitInput(), ALLOWED_CONTEXT), 'ATTEMPT_LIMIT');
    assert.equal(rejected.calls.accept.length, 0);

    const schemaRejected = adapterWith();
    const schemaContext = { ...ALLOWED_CONTEXT, sessionId: 'local-schema-rejection' };
    await schemaRejected.adapter.prepare({ dimension: 'rhetorical' }, schemaContext);
    await rejectionCode(schemaRejected.adapter.submit(submitInput({ candidate_json: '{"groups":[],"unclustered_observations":[],"unexpected":true}' }), schemaContext), 'CANDIDATE_SCHEMA_INVALID');
    await rejectionCode(schemaRejected.adapter.submit(submitInput(), schemaContext), 'ATTEMPT_LIMIT');

    const oversizedCandidate = adapterWith();
    const sizeContext = { ...ALLOWED_CONTEXT, sessionId: 'candidate-size-limit' };
    await oversizedCandidate.adapter.prepare({ dimension: 'rhetorical' }, sizeContext);
    await rejectionCode(oversizedCandidate.adapter.submit(submitInput({ candidate_json: 'x'.repeat(256 * 1024 + 1) }), sizeContext), 'LIMIT_EXCEEDED');

    const literal = candidate({ groups: [{
      ...candidate().groups[0],
      rationale: 'Literal {% xlink "https://example.test" "source" %} <script>not executed</script>',
    }] });
    const candidateJson = JSON.stringify(literal);
    const inert = adapterWith();
    await inert.adapter.prepare({ dimension: 'rhetorical' }, { ...ALLOWED_CONTEXT, sessionId: 'literal-candidate-session' });
    const input = submitInput({ candidate_json: candidateJson });
    const result = await inert.adapter.submit(input, { ...ALLOWED_CONTEXT, sessionId: 'literal-candidate-session' });
    assert.equal(inert.calls.accept[0].candidateJson, candidateJson);
    assert.equal(JSON.parse(result.canonical_json).groups[0].rationale, literal.groups[0].rationale);
  });

  it('does not issue a submit for empty dimensions and serializes concurrent submits', async () => {
    const emptyPrepared = { ...PREPARED, observations: [] };
    const empty = adapterWith({ prepareConsolidation: async () => emptyPrepared });
    await empty.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    await rejectionCode(empty.adapter.submit(submitInput(), ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    assert.equal(empty.calls.accept.length, 0);

    let release;
    let entered;
    const enteredCall = new Promise((resolve) => { entered = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    const concurrent = adapterWith({ acceptDimensionCandidate: async () => { entered(); await gate; return acceptedJson(); } });
    const session = { ...ALLOWED_CONTEXT, sessionId: 'concurrent-submit-session' };
    await concurrent.adapter.prepare({ dimension: 'rhetorical' }, session);
    const first = concurrent.adapter.submit(submitInput(), session);
    await enteredCall;
    await rejectionCode(concurrent.adapter.submit(submitInput(), session), 'ATTEMPT_LIMIT');
    release();
    const accepted = await first;
    assert.equal(accepted.status, 'accepted');
    assert.equal(concurrent.calls.accept.length, 1);
    await rejectionCode(concurrent.adapter.submit(submitInput(), session), 'PROTOCOL_INVALID');
  });

  it('cancels irreversibly while preparation or submission is in flight', async () => {
    let releasePrepare;
    let enteredPrepare;
    const preparing = new Promise((resolve) => { enteredPrepare = resolve; });
    const prepareGate = new Promise((resolve) => { releasePrepare = resolve; });
    const duringPrepare = adapterWith({ prepareConsolidation: async () => { enteredPrepare(); await prepareGate; return PREPARED; } });
    const controller = new AbortController();
    const prepareContext = { ...ALLOWED_CONTEXT, sessionId: 'abort-during-prepare', signal: controller.signal };
    const preparation = duringPrepare.adapter.prepare({ dimension: 'rhetorical' }, prepareContext);
    await preparing;
    controller.abort();
    releasePrepare();
    await rejectionCode(preparation, 'CANCELLED');
    await rejectionCode(duringPrepare.adapter.submit(submitInput(), prepareContext), 'CANCELLED');
    assert.equal(duringPrepare.calls.accept.length, 0);

    let releaseSubmit;
    let enteredSubmit;
    const submitting = new Promise((resolve) => { enteredSubmit = resolve; });
    const submitGate = new Promise((resolve) => { releaseSubmit = resolve; });
    const duringSubmit = adapterWith({ acceptDimensionCandidate: async () => { enteredSubmit(); await submitGate; return acceptedJson(); } });
    const submitController = new AbortController();
    const submitContext = { ...ALLOWED_CONTEXT, sessionId: 'abort-during-submit', signal: submitController.signal };
    await duringSubmit.adapter.prepare({ dimension: 'rhetorical' }, submitContext);
    const pending = duringSubmit.adapter.submit(submitInput(), submitContext);
    await submitting;
    submitController.abort();
    releaseSubmit();
    await rejectionCode(pending, 'CANCELLED');
    assert.equal(duringSubmit.calls.accept.length, 1);
    await rejectionCode(duringSubmit.adapter.submit(submitInput(), submitContext), 'CANCELLED');
  });

  it('rejects malformed core output, wrong support mapping, and oversize accepted output before returning a result', async () => {
    const wrong = acceptedDimension();
    wrong.groups[0].support[0].article_id = 'A12';
    const badMapping = adapterWith({ acceptDimensionCandidate: async () => JSON.stringify(canonicalize(wrong)) });
    await badMapping.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    await rejectionCode(badMapping.adapter.submit(submitInput(), ALLOWED_CONTEXT), 'RECORD_DERIVED_INVALID');
    await rejectionCode(badMapping.adapter.submit(submitInput(), ALLOWED_CONTEXT), 'ATTEMPT_LIMIT');
    assert.equal(badMapping.calls.accept.length, 1);

    const invalidPrepared = adapterWith({
      prepareConsolidation: async () => ({ ...PREPARED, observations: [{ ...PREPARED.observations[0], raw_body: 'must not be accepted' }] }),
    });
    await rejectionCode(invalidPrepared.adapter.prepare({ dimension: 'rhetorical' }, { ...ALLOWED_CONTEXT, sessionId: 'invalid-prepared-schema' }), 'RECORD_SCHEMA_INVALID');
    assert.equal(invalidPrepared.calls.accept.length, 0);

    const wrongBinding = structuredClone(acceptedDimension());
    wrongBinding.input_hash = 'f'.repeat(64);
    const invalidBinding = adapterWith({ acceptDimensionCandidate: async () => JSON.stringify(canonicalize(wrongBinding)) });
    const bindingContext = { ...ALLOWED_CONTEXT, sessionId: 'invalid-accepted-binding' };
    await invalidBinding.adapter.prepare({ dimension: 'rhetorical' }, bindingContext);
    await rejectionCode(invalidBinding.adapter.submit(submitInput(), bindingContext), 'RECORD_DERIVED_INVALID');

    const malformed = adapterWith({ acceptDimensionCandidate: async () => '{' });
    await malformed.adapter.prepare({ dimension: 'rhetorical' }, { ...ALLOWED_CONTEXT, sessionId: 'malformed-output' });
    await rejectionCode(malformed.adapter.submit(submitInput(), { ...ALLOWED_CONTEXT, sessionId: 'malformed-output' }), 'RECORD_JSON_INVALID');

    const oversizedUtf8 = 'é'.repeat(2 * 1024 * 1024 + 1);
    assert.ok(Buffer.byteLength(oversizedUtf8, 'utf8') > 4 * 1024 * 1024);
    const oversized = adapterWith({ acceptDimensionCandidate: async () => oversizedUtf8 });
    await oversized.adapter.prepare({ dimension: 'rhetorical' }, { ...ALLOWED_CONTEXT, sessionId: 'oversized-output' });
    await rejectionCode(oversized.adapter.submit(submitInput(), { ...ALLOWED_CONTEXT, sessionId: 'oversized-output' }), 'LIMIT_EXCEEDED');
  });

  it('sanitizes unknown core failures and enforces session sealing after acceptance', async () => {
    const secret = 'private synthetic text must not appear in safe adapter errors';
    const unknown = new Error(secret);
    unknown.code = 'UNEXPECTED_CORE_ERROR';
    unknown.details = [];
    const failed = adapterWith({ acceptDimensionCandidate: async () => { throw unknown; } });
    const session = { ...ALLOWED_CONTEXT, sessionId: 'unknown-error-session' };
    await failed.adapter.prepare({ dimension: 'rhetorical' }, session);
    const safeError = await rejectionCode(failed.adapter.submit(submitInput(), session), 'INTERNAL_ERROR');
    assert.equal(safeError.message.includes(secret), false);

    const sealed = adapterWith();
    const sealedContext = { ...ALLOWED_CONTEXT, sessionId: 'sealed-session' };
    await sealed.adapter.prepare({ dimension: 'rhetorical' }, sealedContext);
    assert.equal((await sealed.adapter.submit(submitInput(), sealedContext)).status, 'accepted');
    await rejectionCode(sealed.adapter.submit(submitInput(), sealedContext), 'PROTOCOL_INVALID');
    await rejectionCode(sealed.adapter.prepare({ dimension: 'rhetorical' }, sealedContext), 'PROTOCOL_INVALID');
    assert.equal(sealed.calls.accept.length, 1);
  });

  it('accepts retained v0.2 rhetorical fields and independently checks code-derived IDs', async () => {
    const prepared = {
      ...PREPARED, schema_version: 'author-pattern-preparation/0.2',
      method: { ...METHOD, consolidation_version: 'consolidate/2', instructions_version: 'author-pattern-consolidator/0.2' },
    };
    const proposal = candidate();
    delete proposal.groups[0].classification;
    proposal.groups[0].pattern_scope = 'editorial_format';
    proposal.groups[0].author_relevance = 'candidate';
    const accepted = acceptedDimension();
    accepted.schema_version = 'author-pattern-dimension/0.2';
    accepted.method = prepared.method;
    delete accepted.groups[0].classification;
    accepted.groups[0].pattern_scope = 'editorial_format';
    accepted.groups[0].author_relevance = 'candidate';
    accepted.groups = assignRhetoricalGroupIds(accepted.groups, accepted.schema_version);
    const current = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(accepted)) });
    await current.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    const envelope = await current.adapter.submit(submitInput({ candidate_json: JSON.stringify(proposal) }), ALLOWED_CONTEXT);
    assert.equal(JSON.parse(envelope.canonical_json).groups[0].id, 'APC::R0001');

    const forged = structuredClone(accepted);
    forged.groups[0].id = 'APC::R0002';
    const invalid = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(forged)) });
    await invalid.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    await rejectionCode(invalid.adapter.submit(submitInput({ candidate_json: JSON.stringify(proposal) }), ALLOWED_CONTEXT), 'RECORD_DERIVED_INVALID');

    const legacyProposal = adapterWith({ prepareConsolidation: async () => prepared });
    await legacyProposal.adapter.prepare({ dimension: 'rhetorical' }, ALLOWED_CONTEXT);
    await rejectionCode(legacyProposal.adapter.submit(submitInput(), ALLOWED_CONTEXT), 'CANDIDATE_SCHEMA_INVALID');
    assert.equal(legacyProposal.calls.accept.length, 0);
  });

  it('validates current semantic IDs against kind and submitted membership before returning acceptance', async () => {
    const prepared = {
      ...PREPARED, schema_version: 'author-pattern-preparation/0.3', dimension: 'semantic',
      method: { ...METHOD, consolidation_version: 'consolidate/3', instructions_version: 'author-pattern-consolidator/0.3' },
      observations: ['A01', 'A02', 'A03', 'A04'].map((article_id) => ({
        ...PREPARED.observations[0], article_id, observation_id: `${article_id}::O0001`, dimension: 'semantic',
      })),
    };
    const proposal = { groups: [
      { ...candidate().groups[0], semantic_kind: 'concept', member_observation_ids: ['A01::O0001', 'A02::O0001'] },
      { ...candidate().groups[0], semantic_kind: 'relation', member_observation_ids: ['A03::O0001', 'A04::O0001'] },
    ], unclustered_observations: [] };
    proposal.groups.forEach((group) => { delete group.classification; });
    const accepted = {
      schema_version: 'author-pattern-dimension/0.3', dimension: 'semantic', corpus_hash: CORPUS_HASH, input_hash: INPUT_HASH, method: prepared.method,
      groups: assignSemanticGroupIds(proposal.groups.map(({ member_observation_ids, ...group }) => ({
        ...group, support: member_observation_ids.map((observation_id) => ({ observation_id, article_id: observation_id.split('::')[0] })),
        observation_count: member_observation_ids.length, article_count: 2,
      })), prepared.schema_version), unclustered_observations: [],
    };
    const input = submitInput({ dimension: 'semantic', candidate_json: JSON.stringify(proposal) });
    const current = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(accepted)) });
    await current.adapter.prepare({ dimension: 'semantic' }, ALLOWED_CONTEXT);
    const envelope = await current.adapter.submit(input, ALLOWED_CONTEXT);
    assert.deepEqual(JSON.parse(envelope.canonical_json).groups.map((group) => group.id), ['SPC::C0001', 'SPC::R0001']);
    for (const [id, code] of [['SPC::C0002', 'RECORD_DERIVED_INVALID'], ['SPC::R0001', 'RECORD_SCHEMA_INVALID']]) {
      const forged = structuredClone(accepted);
      forged.groups[0].id = id;
      const invalid = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(forged)) });
      await invalid.adapter.prepare({ dimension: 'semantic' }, ALLOWED_CONTEXT);
      await rejectionCode(invalid.adapter.submit(input, ALLOWED_CONTEXT), code);
    }
    const generated = structuredClone(proposal);
    generated.groups[0].id = 'SPC::C0001';
    const invalidProposal = adapterWith({ prepareConsolidation: async () => prepared });
    await invalidProposal.adapter.prepare({ dimension: 'semantic' }, ALLOWED_CONTEXT);
    await rejectionCode(invalidProposal.adapter.submit(submitInput({ dimension: 'semantic', candidate_json: JSON.stringify(generated) }), ALLOWED_CONTEXT), 'CANDIDATE_SCHEMA_INVALID');
    assert.equal(invalidProposal.calls.accept.length, 0);
  });

  it('validates decisional subtype IDs without changing classification or accepting model-generated IDs', async () => {
    const prepared = {
      ...PREPARED, schema_version: 'author-pattern-preparation/0.4', dimension: 'decisional',
      method: { ...METHOD, consolidation_version: 'consolidate/4', instructions_version: 'author-pattern-consolidator/0.4' },
      observations: Array.from({ length: 6 }, (_, index) => {
        const article_id = `A0${index + 1}`;
        return { ...PREPARED.observations[0], article_id, observation_id: `${article_id}::O0001`, dimension: 'decisional' };
      }),
    };
    const proposal = { groups: ['author_candidate', 'editorial_format', 'thematic'].map((classification, index) => ({
      ...candidate().groups[0], classification,
      member_observation_ids: prepared.observations.slice(index * 2, index * 2 + 2).map((observation) => observation.observation_id),
    })), unclustered_observations: [] };
    const accepted = {
      schema_version: 'author-pattern-dimension/0.4', dimension: 'decisional', corpus_hash: CORPUS_HASH, input_hash: INPUT_HASH, method: prepared.method,
      groups: assignDecisionalGroupIds(proposal.groups.map(({ member_observation_ids, ...group }) => ({
        ...group, support: member_observation_ids.map((observation_id) => ({ observation_id, article_id: observation_id.split('::')[0] })), observation_count: 2, article_count: 2,
      }))), unclustered_observations: [],
    };
    const input = submitInput({ dimension: 'decisional', candidate_json: JSON.stringify(proposal) });
    const current = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(accepted)) });
    await current.adapter.prepare({ dimension: 'decisional' }, ALLOWED_CONTEXT);
    assert.deepEqual(JSON.parse((await current.adapter.submit(input, ALLOWED_CONTEXT)).canonical_json).groups.map((group) => group.id), ['DPC:A0001', 'DPC:E0001', 'DPC:T0001']);
    const forged = structuredClone(accepted);
    forged.groups[0].id = 'DPC:A0002';
    const invalid = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(forged)) });
    await invalid.adapter.prepare({ dimension: 'decisional' }, ALLOWED_CONTEXT);
    await rejectionCode(invalid.adapter.submit(input, ALLOWED_CONTEXT), 'RECORD_DERIVED_INVALID');
    proposal.groups[0].id = 'DPC:A0001';
    const invalidProposal = adapterWith({ prepareConsolidation: async () => prepared });
    await invalidProposal.adapter.prepare({ dimension: 'decisional' }, ALLOWED_CONTEXT);
    await rejectionCode(invalidProposal.adapter.submit(submitInput({ dimension: 'decisional', candidate_json: JSON.stringify(proposal) }), ALLOWED_CONTEXT), 'CANDIDATE_SCHEMA_INVALID');
  });

  it('checks epistemic prefix, counters, classification, and member-derived IDs before acceptance', async () => {
    const prepared = {
      ...PREPARED, schema_version: 'author-pattern-preparation/0.5', dimension: 'epistemic',
      method: { ...METHOD, consolidation_version: 'consolidate/5', instructions_version: 'author-pattern-consolidator/0.5' },
      observations: Array.from({ length: 6 }, (_, index) => {
        const article_id = `A0${index + 1}`;
        return { ...PREPARED.observations[0], article_id, observation_id: `${article_id}::O0001`, dimension: 'epistemic' };
      }),
    };
    const proposal = { groups: ['author_candidate', 'editorial_format', 'thematic'].map((classification, index) => ({
      ...candidate().groups[0], classification,
      member_observation_ids: prepared.observations.slice(index * 2, index * 2 + 2).map((observation) => observation.observation_id),
    })), unclustered_observations: [] };
    const accepted = {
      schema_version: 'author-pattern-dimension/0.5', dimension: 'epistemic', corpus_hash: CORPUS_HASH, input_hash: INPUT_HASH, method: prepared.method,
      groups: assignEpistemicGroupIds(proposal.groups.map(({ member_observation_ids, ...group }) => ({
        ...group, support: member_observation_ids.map((observation_id) => ({ observation_id, article_id: observation_id.split('::')[0] })), observation_count: 2, article_count: 2,
      }))), unclustered_observations: [],
    };
    const input = submitInput({ dimension: 'epistemic', candidate_json: JSON.stringify(proposal) });
    const current = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(accepted)) });
    await current.adapter.prepare({ dimension: 'epistemic' }, ALLOWED_CONTEXT);
    assert.deepEqual(JSON.parse((await current.adapter.submit(input, ALLOWED_CONTEXT)).canonical_json).groups.map((group) => group.id), ['EPC:A0001', 'EPC:E0001', 'EPC:T0001']);
    const forged = structuredClone(accepted);
    forged.groups[0].id = 'EPC:A0002';
    const invalid = adapterWith({ prepareConsolidation: async () => prepared, acceptDimensionCandidate: async () => JSON.stringify(canonicalize(forged)) });
    await invalid.adapter.prepare({ dimension: 'epistemic' }, ALLOWED_CONTEXT);
    await rejectionCode(invalid.adapter.submit(input, ALLOWED_CONTEXT), 'RECORD_DERIVED_INVALID');
    proposal.groups[0].id = 'EPC:A0001';
    const invalidProposal = adapterWith({ prepareConsolidation: async () => prepared });
    await invalidProposal.adapter.prepare({ dimension: 'epistemic' }, ALLOWED_CONTEXT);
    await rejectionCode(invalidProposal.adapter.submit(submitInput({ dimension: 'epistemic', candidate_json: JSON.stringify(proposal) }), ALLOWED_CONTEXT), 'CANDIDATE_SCHEMA_INVALID');
  });
});
