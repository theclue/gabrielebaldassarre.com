import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { createExtractionAdapter } from './native.mjs';

const ROOT = '/synthetic/trusted-repository-root';
const HASH = 'a'.repeat(64);
const PREPARED = Object.freeze({
  schema_version: 'author-extraction/1',
  source: { article_id: 'A12', path: '_posts/synthetic.md' },
  method: { prepare_version: 'prepare/1' },
  input_hash: HASH,
  body: 'offline fixture',
  passages: [],
  measurements: { scope: 'raw_markdown_body' },
});
const FINAL_JSON = '{"schema_version":"author-extraction/1"}';
const ALLOWED_CONTEXT = { sessionId: 'session-fixture-1', agent: 'author-extractor' };

function failure(code, message = `synthetic ${code}`) {
  const error = new Error(message);
  error.code = code;
  error.details = [];
  return error;
}

async function rejectionCode(promise, code) {
  let caught;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, `expected rejection with native code ${code}`);
  assert.equal(Object.hasOwn(caught, 'code'), true);
  assert.equal(Object.hasOwn(caught, 'message'), true);
  assert.equal(Object.hasOwn(caught, 'details'), true);
  assert.equal(caught.code, code);
  assert.ok(caught.message.length <= 240);
  assert.ok(Array.isArray(caught.details));
  assert.ok(caught.details.length <= 5);
  return caught;
}

function adapterWith({ prepareArticle = async () => PREPARED, acceptCandidate = async () => FINAL_JSON } = {}) {
  const calls = { prepare: [], accept: [] };
  const coreApi = {
    async prepareArticle(root, articleId) {
      calls.prepare.push({ root, articleId });
      return prepareArticle(root, articleId);
    },
    async acceptCandidate(root, articleId, inputHash, candidateJson) {
      calls.accept.push({ root, articleId, inputHash, candidateJson });
      return acceptCandidate(root, articleId, inputHash, candidateJson);
    },
  };
  return { adapter: createExtractionAdapter(coreApi, ROOT), calls };
}

function submitInput(overrides = {}) {
  return {
    article_id: 'A12',
    input_hash: HASH,
    candidate_json: '{"candidate":"synthetic"}',
    ...overrides,
  };
}

describe('native extraction adapter protocol (injected core; no SDK or agent invocation)', () => {
  it('keeps the agent Markdown CoverageEntry example aligned with the frozen closed schema', async () => {
    const agentMarkdown = await readFile(new URL('../../.opencode/agents/author-extractor.md', import.meta.url), 'utf8');
    const marker = 'CoverageEntry schema-shape example only—not an article finding or default status:';
    const markerIndex = agentMarkdown.indexOf(marker);
    assert.notEqual(markerIndex, -1, 'agent instructions must label the example as schema shape, not a finding/default');
    const fencedExample = agentMarkdown.slice(markerIndex + marker.length).match(/```json\s*([\s\S]*?)\s*```/);
    assert.ok(fencedExample, 'the labelled example must remain a JSON fenced block');
    const example = JSON.parse(fencedExample[1]);

    const schema = JSON.parse(await readFile(new URL('./extraction.schema.json', import.meta.url), 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const localSchema = { $schema: schema.$schema, $defs: schema.$defs };
    const validateEntry = ajv.compile({ ...localSchema, $ref: '#/$defs/CoverageEntry' });
    const validateCoverage = ajv.compile({ ...localSchema, $ref: '#/$defs/Coverage' });

    assert.equal(validateEntry(example), true, JSON.stringify(validateEntry.errors));
    assert.equal(validateEntry({ status: example.status, notes: example.note }), false);
    assert.equal(validateEntry({ ...example, example_extra: 'not allowed' }), false);
    const coverage = Object.fromEntries(['rhetorical', 'epistemic', 'semantic', 'decisional'].map((dimension) => [dimension, example]));
    assert.equal(validateCoverage(coverage), true, JSON.stringify(validateCoverage.errors));
    assert.equal(validateCoverage({ ...coverage, extra_dimension: example }), false);
  });

  it('denies any agent other than the authorized extractor', async () => {
    const { adapter, calls } = adapterWith();
    await rejectionCode(adapter.prepare({ article_id: 'A12' }, { ...ALLOWED_CONTEXT, agent: 'other-agent' }), 'AGENT_DENIED');
    await rejectionCode(adapter.submit(submitInput(), { ...ALLOWED_CONTEXT, agent: 'other-agent' }), 'AGENT_DENIED');
    assert.equal(calls.prepare.length, 0);
    assert.equal(calls.accept.length, 0);
  });

  it('requires a session context and keeps preparation bound to one article and hash', async () => {
    const { adapter, calls } = adapterWith();
    await rejectionCode(adapter.prepare({ article_id: 'A12' }, { agent: 'author-extractor' }), 'PROTOCOL_INVALID');
    await rejectionCode(adapter.submit(submitInput(), { ...ALLOWED_CONTEXT, sessionId: 'session-unprepared' }), 'PROTOCOL_INVALID');

    const first = await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    const again = await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    assert.deepEqual(first, PREPARED);
    assert.deepEqual(again, first);

    await rejectionCode(adapter.prepare({ article_id: 'A11' }, ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    await rejectionCode(adapter.submit(submitInput({ article_id: 'A11' }), ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    await rejectionCode(adapter.submit(submitInput({ input_hash: 'b'.repeat(64) }), ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    assert.equal(calls.accept.length, 0);

    const changingHashes = [HASH, 'b'.repeat(64)];
    const changed = adapterWith({
      prepareArticle: async () => ({ ...PREPARED, input_hash: changingHashes.shift() }),
    });
    const changedContext = { ...ALLOWED_CONTEXT, sessionId: 'session-changed-hash' };
    await changed.adapter.prepare({ article_id: 'A12' }, changedContext);
    await rejectionCode(changed.adapter.prepare({ article_id: 'A12' }, changedContext), 'INPUT_CHANGED');
    assert.equal(changed.calls.prepare.length, 2);
  });

  it('delegates only the injected root and the bound source/hash, then returns one compact acceptance envelope', async () => {
    const { adapter, calls } = adapterWith();
    const input = submitInput();
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    const envelope = await adapter.submit(input, ALLOWED_CONTEXT);
    assert.deepEqual(calls.accept, [{
      root: ROOT,
      articleId: 'A12',
      inputHash: HASH,
      candidateJson: input.candidate_json,
    }]);
    assert.deepEqual(envelope, { status: 'accepted', canonical_json: FINAL_JSON });
    assert.deepEqual(Object.keys(envelope).sort(), ['canonical_json', 'status']);
    assert.equal(JSON.stringify(envelope), `{"status":"accepted","canonical_json":${JSON.stringify(FINAL_JSON)}}`);
  });

  it('counts failed received submissions, including malformed JSON, and allows only two attempts', async () => {
    const { adapter, calls } = adapterWith({
      acceptCandidate: async () => { throw failure('CANDIDATE_JSON_INVALID'); },
    });
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    await rejectionCode(adapter.submit(submitInput({ candidate_json: '{' }), ALLOWED_CONTEXT), 'CANDIDATE_JSON_INVALID');
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    await rejectionCode(adapter.submit(submitInput({ candidate_json: 'not-json' }), ALLOWED_CONTEXT), 'CANDIDATE_JSON_INVALID');
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'ATTEMPT_LIMIT');
    assert.equal(calls.accept.length, 2);
    assert.equal(calls.prepare.length, 3);
  });

  it('permits a valid retry after one failure and seals the session after acceptance', async () => {
    let attempt = 0;
    const { adapter, calls } = adapterWith({
      acceptCandidate: async () => {
        attempt += 1;
        if (attempt === 1) throw failure('CANDIDATE_SCHEMA_INVALID');
        return FINAL_JSON;
      },
    });
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'CANDIDATE_SCHEMA_INVALID');
    assert.deepEqual(await adapter.submit(submitInput(), ALLOWED_CONTEXT), { status: 'accepted', canonical_json: FINAL_JSON });
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    await rejectionCode(adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT), 'PROTOCOL_INVALID');
    assert.equal(calls.accept.length, 2);
  });

  it('serializes concurrent submissions so acceptance seals before a queued submit executes', async () => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const { adapter, calls } = adapterWith({
      acceptCandidate: async () => {
        await firstGate;
        return FINAL_JSON;
      },
    });
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    const first = adapter.submit(submitInput(), ALLOWED_CONTEXT);
    const second = adapter.submit(submitInput(), ALLOWED_CONTEXT);
    releaseFirst();
    assert.deepEqual(await first, { status: 'accepted', canonical_json: FINAL_JSON });
    await rejectionCode(second, 'PROTOCOL_INVALID');
    assert.equal(calls.accept.length, 1);
  });

  it('makes abort and AbortSignal cancellation irreversible for the current session', async () => {
    const { adapter, calls } = adapterWith();
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    assert.equal(adapter.abort(ALLOWED_CONTEXT.sessionId), undefined);
    await rejectionCode(adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT), 'CANCELLED');
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'CANCELLED');
    assert.equal(calls.prepare.length, 1);
    assert.equal(calls.accept.length, 0);

    const signalled = adapterWith();
    const controller = new AbortController();
    await signalled.adapter.prepare({ article_id: 'A12' }, { ...ALLOWED_CONTEXT, sessionId: 'session-signal', signal: controller.signal });
    controller.abort();
    const signalContext = { ...ALLOWED_CONTEXT, sessionId: 'session-signal', signal: controller.signal };
    await rejectionCode(signalled.adapter.submit(submitInput(), signalContext), 'CANCELLED');
    await rejectionCode(signalled.adapter.prepare({ article_id: 'A12' }, signalContext), 'CANCELLED');
    assert.equal(signalled.calls.accept.length, 0);
  });

  it('propagates stale-input rejection rather than creating an accepted envelope', async () => {
    const { adapter, calls } = adapterWith({
      acceptCandidate: async () => { throw failure('INPUT_CHANGED'); },
    });
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'INPUT_CHANGED');
    assert.equal(calls.accept.length, 1);
  });

  it('rejects an oversized serialized prepared record rather than returning partial data', async () => {
    const oversized = { ...PREPARED, body: 'x'.repeat(4 * 1024 * 1024) };
    const { adapter, calls } = adapterWith({ prepareArticle: async () => oversized });
    await rejectionCode(adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT), 'LIMIT_EXCEEDED');
    assert.equal(calls.prepare.length, 1);
    assert.equal(calls.accept.length, 0);
  });

  it('rejects an oversized serialized acceptance envelope rather than truncating it', async () => {
    const { adapter } = adapterWith({ acceptCandidate: async () => 'x'.repeat(1_048_577) });
    await adapter.prepare({ article_id: 'A12' }, ALLOWED_CONTEXT);
    await rejectionCode(adapter.submit(submitInput(), ALLOWED_CONTEXT), 'LIMIT_EXCEEDED');
  });
});
