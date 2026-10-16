import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { prepareArticle, acceptCandidate, verifyExtractionRecord } from './core.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const APPROVED_TEMP = '/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode';
const ARTICLE_PATH = '_posts/synthetic.md';
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INSTRUCTIONS = '# Synthetic author-extractor fixture\n';
const BODY = 'A😀\r\nline\r\n \t\r\nz e\u0301\r\n\r\ncode $x$';
const SCHEMA_BYTES = await readFile(join(PACKAGE_DIR, 'extraction.v1.3.schema.json'));
const RETAINED_SCHEMA_BYTES = await readFile(join(PACKAGE_DIR, 'extraction.v1.2.schema.json'));
const LEGACY_SCHEMA_BYTES = await readFile(join(PACKAGE_DIR, 'extraction.schema.json'));
const LEGACY_SCHEMA_SHA256 = '063c71461104299b4cfae449d1c32f24642c76fcfe0d9a8340a7023a48fa1047';
const SEED_AGGREGATE_SHA256 = 'bac1a6b9535a2175bde2653ed3aa1cce62fee68b338c26e638b48100e172d69f';
const HAS_LOCAL_SEED_DATA = await Promise.all(Array.from({ length: 12 }, (_, index) => {
  const articleId = `A${String(index + 1).padStart(2, '0')}`;
  return access(join(REPO_ROOT, 'docs/author-extraction-results/v1.1', `${articleId}.json`));
})).then(() => true, () => false);

let schemaHash;

before(() => {
  schemaHash = sha256(SCHEMA_BYTES);
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function workflowReceipt(prepared, sessionId = 'synthetic-core-session') {
  return {
    workflow_version: 'host-session-whole-article/1',
    mode: 'whole_article',
    session_id: sessionId,
    article_id: prepared.source.article_id,
    input_hash: prepared.input_hash,
    prepare_returned: true,
  };
}

function corpusText(path = ARTICLE_PATH, representative = true, { omitId } = {}) {
  const articleIds = Array.from({ length: 20 }, (_, index) => `A${String(index + 1).padStart(2, '0')}`);
  const sources = articleIds
    .filter((id) => id !== omitId)
    .flatMap((id) => [
      `  - id: ${id}`,
      `    percorso: ${id === 'A12' ? path : `_posts/synthetic/${id}.md`}`,
      `    rappresentativo_stile: ${id === 'A12' ? representative : true}`,
    ]);
  return [
    'contesto:',
    '  finalita: Corpus sintetico usato esclusivamente nei test offline.',
    '  approvazione_editoriale:',
    '    ambito: I percorsi sono fixture sintetiche e non attestano autorialita.',
    '    dichiarazione_utente: Dato sintetico per esercitare il contratto locale.',
    '  revisione_utente_modello_generato: pending',
    'fonti:',
    ...sources,
    'esclusioni:',
    '  - percorso: _posts/excluded-openscad.md',
    '    motivo: Esclusione sintetica di test; nessuna affermazione di autorialita.',
    '',
  ].join('\n');
}

async function makeRepo(t, {
  body = BODY,
  path = ARTICLE_PATH,
  representative = true,
  corpus = corpusText(path, representative),
  source = `---\r\ntitle: Synthetic fixture\r\nlayout: post\r\n---\r\n${body}`,
} = {}) {
  const root = await mkdtemp(join(APPROVED_TEMP, 'author-extraction-core-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, '_scripts/author-extraction'), { recursive: true });
  await mkdir(join(root, '.opencode/agents'), { recursive: true });
  await mkdir(join(root, '_posts'), { recursive: true });
  await writeFile(join(root, 'docs/corpus.yaml'), corpus);
  await writeFile(join(root, '_scripts/author-extraction/extraction.schema.json'), LEGACY_SCHEMA_BYTES);
  await writeFile(join(root, '_scripts/author-extraction/extraction.v1.2.schema.json'), RETAINED_SCHEMA_BYTES);
  await writeFile(join(root, '_scripts/author-extraction/extraction.v1.3.schema.json'), SCHEMA_BYTES);
  await writeFile(join(root, '.opencode/agents/author-extractor.md'), INSTRUCTIONS);
  if (path === ARTICLE_PATH) await writeFile(join(root, ARTICLE_PATH), source);
  return root;
}

function observation(dimension, evidence = { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' }, overrides = {}) {
  return {
    dimension,
    label: 'synthetic candidate label',
    description: 'A synthetic single-proposition observation for contract testing.',
    inference_kind: 'inferred',
    evidence: [evidence],
    ...overrides,
  };
}

function candidate({ dimension = 'rhetorical', evidence, observations } = {}) {
  return { observations: observations ?? [observation(dimension, evidence)] };
}

function candidateJson(options) {
  return JSON.stringify(candidate(options));
}

function assertRecursivelySortedKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertRecursivelySortedKeys(item);
  } else if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    assert.deepEqual(keys, [...keys].sort());
    for (const item of Object.values(value)) assertRecursivelySortedKeys(item);
  }
}

async function rejectionCode(promise, code) {
  let caught;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, `expected a rejected Error with code ${code}`);
  assert.equal(Object.hasOwn(caught, 'code'), true);
  assert.equal(Object.hasOwn(caught, 'message'), true);
  assert.equal(Object.hasOwn(caught, 'details'), true);
  assert.equal(caught.code, code);
  assert.equal(typeof caught.message, 'string');
  assert.ok(caught.message.length <= 240);
  assert.ok(Array.isArray(caught.details));
  assert.ok(caught.details.length <= 5);
  for (const pointer of caught.details) assert.match(pointer, /^(?:|\/(?:[^~]|~[01])*)$/);
  return caught;
}

describe('author extraction core', () => {
  it('compiles the full Draft 2020-12 schema and Candidate with Ajv strict mode', async () => {
    const schema = JSON.parse(await readFile(join(PACKAGE_DIR, 'extraction.v1.3.schema.json'), 'utf8'));
    const legacySchema = JSON.parse(LEGACY_SCHEMA_BYTES);
    assert.equal(schema.$id, 'urn:gabrielebaldassarre:author-extraction:1.3');
    assert.equal(legacySchema.$id, 'urn:gabrielebaldassarre:author-extraction:1.1');
    assert.equal(sha256(LEGACY_SCHEMA_BYTES), LEGACY_SCHEMA_SHA256, 'the frozen v1.1 schema bytes must remain unchanged');
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
    });
    const validateFinalRecord = ajv.compile(schema);
    const validateLegacyRecord = ajv.compile(legacySchema);
    const validateCandidate = ajv.compile({
      $schema: schema.$schema,
      $defs: schema.$defs,
      $ref: '#/$defs/Candidate',
    });
    assert.equal(typeof validateFinalRecord, 'function');
    assert.equal(typeof validateLegacyRecord, 'function');
    assert.equal(typeof validateCandidate, 'function');
  });

  it('prepares raw Markdown spans, code-point offsets, mechanical counts, and independently checked hashes', async (t) => {
    const root = await makeRepo(t);
    const prepared = await prepareArticle(root, 'A12');
    const corpusBytes = await readFile(join(root, 'docs/corpus.yaml'));
    const sourceBytes = await readFile(join(root, ARTICLE_PATH));
    const instructionsBytes = await readFile(join(root, '.opencode/agents/author-extractor.md'));
    const source = {
      article_id: 'A12',
      path: ARTICLE_PATH,
      corpus_hash: sha256(corpusBytes),
      file_hash: sha256(sourceBytes),
    };
    const method = {
      prepare_version: 'prepare/1',
      segmentation_version: 'raw-blank-lines/1',
      measurement_version: 'raw-body-counts/1',
      instructions_version: 'author-extractor/1.3',
      workflow_version: 'host-session-whole-article/1',
      schema_hash: schemaHash,
      instructions_hash: sha256(instructionsBytes),
    };
    const expectedCanonicalInput = `{"method":{"instructions_hash":"${method.instructions_hash}","instructions_version":"author-extractor/1.3","measurement_version":"raw-body-counts/1","prepare_version":"prepare/1","schema_hash":"${schemaHash}","segmentation_version":"raw-blank-lines/1","workflow_version":"host-session-whole-article/1"},"source":{"article_id":"A12","corpus_hash":"${source.corpus_hash}","file_hash":"${source.file_hash}","path":"${ARTICLE_PATH}"}}`;

    assert.deepEqual(prepared.source, source);
    assert.deepEqual(prepared.method, method);
    assert.equal(prepared.schema_version, 'author-extraction/1.3');
    assert.equal(prepared.input_hash, sha256(Buffer.from(expectedCanonicalInput, 'utf8')));
    assert.equal(prepared.body, BODY);
    assert.deepEqual(prepared.passages, [
      { passage_id: 'P0001', start_cp: 0, end_cp: 8, text: 'A😀\r\nline' },
      { passage_id: 'P0002', start_cp: 14, end_cp: 18, text: 'z e\u0301' },
      { passage_id: 'P0003', start_cp: 22, end_cp: 30, text: 'code $x$' },
    ]);
    assert.deepEqual(prepared.measurements, {
      scope: 'raw_markdown_body',
      utf8_bytes: 34,
      unicode_code_points: 30,
      nonblank_lines: 4,
      advanced_stylometry: { status: 'not_computed', value: null, reason_code: 'OUT_OF_SCOPE_V1' },
    });
    assert.equal(JSON.stringify(await prepareArticle(root, 'A12')), JSON.stringify(prepared));
  });

  it('accepts all four dimensions with the same five LLM-authored fields', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    for (const dimension of ['rhetorical', 'epistemic', 'semantic', 'decisional']) {
      const finalText = await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({ dimension }));
      const finalRecord = JSON.parse(finalText);
      assert.deepEqual(Object.keys(finalRecord).sort(), [
        'dimension_presence', 'measurements', 'method', 'observations', 'processing', 'schema_version', 'source',
      ]);
      assert.equal(finalRecord.schema_version, 'author-extraction/1.3');
      assert.equal(finalRecord.observations[0].dimension, dimension);
      assert.deepEqual(Object.keys(finalRecord.observations[0]).sort(), [
        'description', 'dimension', 'evidence', 'id', 'inference_kind', 'label', 'review_status',
      ]);
      assert.equal(finalRecord.observations[0].id, 'A12::O0001');
      assert.equal(finalRecord.observations[0].review_status, 'unreviewed');
      assert.deepEqual(finalRecord.observations[0].evidence[0], { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' });
      assert.deepEqual(finalRecord.dimension_presence, Object.fromEntries(
        ['rhetorical', 'epistemic', 'semantic', 'decisional'].map((name) => [name, {
          status: name === dimension ? 'observed' : 'not_observed',
          observation_count: name === dimension ? 1 : 0,
        }]),
      ));
      assert.deepEqual(finalRecord.processing, {
        mode: 'whole_article',
        status: 'not_tracked',
        article_processed: null,
        passages_available: 1,
        passages_cited: 1,
        receipt: null,
      });
      assert.equal(Object.hasOwn(finalRecord, 'coverage'), false);
      assert.equal(finalRecord.measurements.advanced_stylometry.status, 'not_computed');
      assert.equal(finalRecord.measurements.advanced_stylometry.value, null);
      assert.equal(await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({ dimension })), finalText);
    }
  });

  it('tracks host whole-article processing separately from direct untracked acceptance', async (t) => {
    const root = await makeRepo(t, { body: 'cited first passage\n\nuncited second passage\n\nuncited third passage' });
    const prepared = await prepareArticle(root, 'A12');
    const payload = candidate({ evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'cited first passage' } });

    const direct = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(payload)));
    assert.deepEqual(direct.processing, {
      mode: 'whole_article', status: 'not_tracked', article_processed: null,
      passages_available: 3, passages_cited: 1, receipt: null,
    });
    const directVerified = await verifyExtractionRecord(root, JSON.stringify(direct));
    assert.equal(directVerified.processing_eligible, false);
    assert.equal(directVerified.processing_reason, 'PROCESSING_NOT_TRACKED');

    const receipt = workflowReceipt(prepared);
    const completeText = await acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(payload), { workflowReceipt: receipt });
    const complete = JSON.parse(completeText);
    assert.deepEqual(complete.processing, {
      mode: 'whole_article', status: 'complete', article_processed: true,
      passages_available: 3, passages_cited: 1, receipt,
    });
    assert.equal(Object.hasOwn(complete.processing, 'passages_processed'), false);
    assert.equal(Object.hasOwn(complete.processing, 'passages_failed'), false);

    const verified = await verifyExtractionRecord(root, completeText);
    const reconstructedInputHash = sha256(Buffer.from(JSON.stringify(canonicalJson({ source: complete.source, method: complete.method })), 'utf8'));
    assert.equal(verified.processing_eligible, true);
    assert.equal(verified.processing_reason, null);
    assert.equal(verified.record_fingerprint, sha256(Buffer.from(JSON.stringify(canonicalJson(complete)), 'utf8')));
    assert.equal(complete.processing.receipt.input_hash, reconstructedInputHash);
    assert.equal(complete.processing.receipt.input_hash, prepared.input_hash);

    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(payload), {
      workflowReceipt: { ...receipt, input_hash: 'f'.repeat(64) },
    }), 'WORKFLOW_RECEIPT_INVALID');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(payload), {
      workflowReceipt: { ...receipt, mode: 'per_passage' },
    }), 'WORKFLOW_RECEIPT_INVALID');
  });

  it('recomputes accepted record IDs, dimension counts, and processing counts during verification', async (t) => {
    const root = await makeRepo(t, { body: 'first quote\n\nsecond quote' });
    const prepared = await prepareArticle(root, 'A12');
    const base = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({
      evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'first quote' },
    })));
    const tamperCases = [
      (record) => { record.observations[0].id = 'A12::O0002'; },
      (record) => { record.dimension_presence.rhetorical.observation_count = 2; },
      (record) => { record.processing.passages_cited = 0; },
      (record) => { record.processing.passages_available = 99; },
    ];
    for (const tamper of tamperCases) {
      const record = structuredClone(base);
      tamper(record);
      await rejectionCode(verifyExtractionRecord(root, JSON.stringify(record)), 'RECORD_DERIVED_INVALID');
    }
  });

  it('keeps the reserved per-passage branch ineligible and rejects malformed JSON structure', async (t) => {
    const root = await makeRepo(t, { body: 'first quote\n\nsecond quote' });
    const prepared = await prepareArticle(root, 'A12');
    const base = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({
      evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'first quote' },
    })));
    for (const status of ['complete', 'partial']) {
      const record = structuredClone(base);
      record.processing = {
        mode: 'per_passage', status, passages_total: 2,
        passages_processed: status === 'complete' ? 2 : 1,
        passages_failed: status === 'complete' ? 0 : 1,
        passages_with_observations: 1,
      };
      const verified = await verifyExtractionRecord(root, JSON.stringify(record));
      assert.equal(verified.processing_eligible, false);
      assert.equal(verified.processing_reason, 'UNSUPPORTED_PROCESSING_MODE');
    }
    const invalidCounts = structuredClone(base);
    invalidCounts.processing = {
      mode: 'per_passage', status: 'complete', passages_total: 9,
      passages_processed: 9, passages_failed: 0, passages_with_observations: 1,
    };
    await rejectionCode(verifyExtractionRecord(root, JSON.stringify(invalidCounts)), 'RECORD_DERIVED_INVALID');
    await rejectionCode(verifyExtractionRecord(root, '{"schema_version":"author-extraction/1.2","schema_version":"author-extraction/1.2"}'), 'RECORD_JSON_INVALID');
    await rejectionCode(verifyExtractionRecord(root, '{"schema_version":"author-extraction/1.2", "source":"unterminated}'), 'RECORD_JSON_INVALID');
  });

  it('verifies the existing twelve v1.1 records read-only, including A11 Liquid evidence', { skip: !HAS_LOCAL_SEED_DATA }, async () => {
    const aggregate = createHash('sha256');
    let observationCount = 0;
    let evidenceCount = 0;
    let a11Quote;
    for (let index = 1; index <= 12; index += 1) {
      const articleId = `A${String(index).padStart(2, '0')}`;
      const recordBytes = await readFile(join(REPO_ROOT, 'docs/author-extraction-results/v1.1', `${articleId}.json`));
      aggregate.update(articleId).update('\0').update(recordBytes).update('\0');
      const verified = await verifyExtractionRecord(REPO_ROOT, recordBytes.toString('utf8'));
      assert.equal(verified.record.schema_version, 'author-extraction/1.1');
      assert.equal(verified.record.source.article_id, articleId);
      assert.equal(verified.processing_eligible, false);
      assert.equal(verified.processing_reason, 'PROCESSING_NOT_TRACKED');
      assert.match(verified.record_fingerprint, /^[a-f0-9]{64}$/);
      observationCount += verified.record.observations.length;
      evidenceCount += verified.record.observations.reduce((total, item) => total + item.evidence.length, 0);
      if (articleId === 'A11') {
        const evidence = verified.record.observations.find((item) => item.id === 'A11::O0003').evidence.find((item) => item.passage_id === 'P0034');
        assert.ok(evidence.quote.includes('{% xlink '));
        const prepared = await prepareArticle(REPO_ROOT, 'A11');
        assert.ok(prepared.passages.find((passage) => passage.passage_id === 'P0034').text.includes(evidence.quote));
        a11Quote = evidence.quote;
      }
    }
    assert.equal(aggregate.digest('hex'), SEED_AGGREGATE_SHA256);
    assert.equal(observationCount, 96);
    assert.equal(evidenceCount, 111);
    assert.ok(a11Quote);
  });

  it('counts cited passages distinctly and assigns observation IDs in accepted array order', async (t) => {
    const root = await makeRepo(t, { body: 'first quote\n\nsecond quote\n\nthird quote' });
    const prepared = await prepareArticle(root, 'A12');
    const rhetorical = observation('rhetorical', { article_id: 'A12', passage_id: 'P0001', quote: 'first quote' });
    rhetorical.evidence.push({ article_id: 'A12', passage_id: 'P0001', quote: 'quote' });
    const rhetoricalSecond = observation('rhetorical', { article_id: 'A12', passage_id: 'P0001', quote: 'first quote' }, {
      label: 'a second synthetic rhetorical label',
      description: 'A second synthetic single-proposition observation.',
    });
    const decisional = observation('decisional', { article_id: 'A12', passage_id: 'P0001', quote: 'first quote' });
    const semantic = observation('semantic', { article_id: 'A12', passage_id: 'P0003', quote: 'third quote' });
    const ordered = candidate({ observations: [rhetorical, rhetoricalSecond, decisional, semantic] });
    const first = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(ordered)));

    assert.deepEqual(first.observations.map(({ id, dimension }) => [id, dimension]), [
      ['A12::O0001', 'rhetorical'], ['A12::O0002', 'rhetorical'],
      ['A12::O0003', 'decisional'], ['A12::O0004', 'semantic'],
    ]);
    assert.deepEqual(first.dimension_presence, {
      rhetorical: { status: 'observed', observation_count: 2 },
      epistemic: { status: 'not_observed', observation_count: 0 },
      semantic: { status: 'observed', observation_count: 1 },
      decisional: { status: 'observed', observation_count: 1 },
    });
    const totalDimensionCount = Object.values(first.dimension_presence)
      .reduce((sum, entry) => sum + entry.observation_count, 0);
    assert.equal(totalDimensionCount, first.observations.length);
    for (const entry of Object.values(first.dimension_presence)) {
      assert.equal(entry.status, entry.observation_count > 0 ? 'observed' : 'not_observed');
    }
    assert.deepEqual(first.processing, {
      mode: 'whole_article', status: 'not_tracked', article_processed: null,
      passages_available: 3, passages_cited: 2, receipt: null,
    });

    const reordered = candidate({ observations: [semantic, rhetoricalSecond, decisional, rhetorical] });
    const second = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(reordered)));
    assert.deepEqual(second.observations.map(({ id, dimension }) => [id, dimension]), [
      ['A12::O0001', 'semantic'], ['A12::O0002', 'rhetorical'],
      ['A12::O0003', 'decisional'], ['A12::O0004', 'rhetorical'],
    ]);
  });

  it('does not infer semantic entailment from literal quote membership', async (t) => {
    const root = await makeRepo(t, { body: 'The page says safe quote.' });
    const prepared = await prepareArticle(root, 'A12');
    const payload = candidate({
      dimension: 'semantic',
      evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' },
      observations: [observation('semantic', { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' }, {
        description: 'The deliberately unverified candidate makes an unsupported claim.',
      })],
    });
    const finalRecord = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(payload)));
    assert.equal(finalRecord.observations[0].description, 'The deliberately unverified candidate makes an unsupported claim.');
  });

  it('rejects unknown and non-representative articles without accepting arbitrary sources', async (t) => {
    const root = await makeRepo(t);
    await rejectionCode(prepareArticle(root, 'A21'), 'UNKNOWN_ARTICLE');

    const unapprovedRoot = await makeRepo(t, { representative: false });
    await rejectionCode(prepareArticle(unapprovedRoot, 'A12'), 'CORPUS_INVALID');

  });

  it('fails closed on malformed, duplicate, aliased, and escaping corpus declarations', async (t) => {
    const malformed = await makeRepo(t, { corpus: 'fonti: [\n' });
    await rejectionCode(prepareArticle(malformed, 'A12'), 'CORPUS_INVALID');

    const incomplete = await makeRepo(t, { corpus: corpusText(ARTICLE_PATH, true, { omitId: 'A11' }) });
    await rejectionCode(prepareArticle(incomplete, 'A12'), 'CORPUS_INVALID');

    const duplicate = await makeRepo(t, {
      corpus: [
        'fonti:',
        '  - id: A12',
        '    percorso: _posts/synthetic.md',
        '    rappresentativo_stile: true',
        '  - id: A12',
        '    percorso: _posts/other.md',
        '    rappresentativo_stile: true',
        'esclusioni: []',
        '',
      ].join('\n'),
    });
    await rejectionCode(prepareArticle(duplicate, 'A12'), 'CORPUS_INVALID');

    const aliased = await makeRepo(t, { corpus: 'fonti:\n  - &article\n    id: A12\n    percorso: _posts/synthetic.md\n    rappresentativo_stile: true\n  - *article\n' });
    await rejectionCode(prepareArticle(aliased, 'A12'), 'CORPUS_INVALID');

    const escaping = await makeRepo(t, { path: '../outside.md' });
    await rejectionCode(prepareArticle(escaping, 'A12'), 'CORPUS_INVALID');
  });

  it('rejects path escapes through symlinks and non-regular sources', async (t) => {
    const root = await makeRepo(t, { path: '_posts/link.md' });
    const outside = `${root}.outside.md`;
    t.after(() => rm(outside, { force: true }));
    await writeFile(outside, '---\ntitle: outside\n---\nnot approved');
    await symlink(outside, join(root, '_posts/link.md'));
    await rejectionCode(prepareArticle(root, 'A12'), 'SOURCE_INVALID');

    const directorySource = await makeRepo(t, { path: '_posts/directory.md' });
    await mkdir(join(directorySource, '_posts/directory.md'));
    await rejectionCode(prepareArticle(directorySource, 'A12'), 'SOURCE_INVALID');
  });

  it('validates exact front-matter boundaries and UTF-8 without normalizing body text', async (t) => {
    const missingOpen = await makeRepo(t, { source: 'title: no boundary\n---\nbody' });
    await rejectionCode(prepareArticle(missingOpen, 'A12'), 'SOURCE_BOUNDARY');

    const missingClose = await makeRepo(t, { source: '---\ntitle: never closed\nbody' });
    await rejectionCode(prepareArticle(missingClose, 'A12'), 'SOURCE_INVALID');

    const badFrontmatter = await makeRepo(t, { source: '---\ntitle: [invalid\n---\nbody' });
    await rejectionCode(prepareArticle(badFrontmatter, 'A12'), 'SOURCE_INVALID');

    const invalidUtf8 = await makeRepo(t);
    await writeFile(join(invalidUtf8, ARTICLE_PATH), Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff]));
    await rejectionCode(prepareArticle(invalidUtf8, 'A12'), 'SOURCE_INVALID');
  });

  it('rejects oversized sources rather than truncating them', async (t) => {
    const root = await makeRepo(t, { body: 'x'.repeat(262_145) });
    await rejectionCode(prepareArticle(root, 'A12'), 'LIMIT_EXCEEDED');
  });

  it('keeps prompt-like text, Liquid, code, and markup as inert raw article data', async (t) => {
    const body = 'Literal {{7*7}} {% include "private.md" %} <script>no-op</script> $(touch sentinel)';
    const root = await makeRepo(t, { body });
    const prepared = await prepareArticle(root, 'A12');
    assert.equal(prepared.body, body);
    assert.equal(prepared.passages[0].text, body);
    await assert.rejects(readFile(join(root, 'sentinel')));
  });

  it('preserves synthetic HTML and Liquid text byte-for-byte through evidence serialization', async (t) => {
    const body = '<p>Source {% xlink "https://example.test/a" "AI Advisors" role="source" %} remains literal.</p>\n\n<!-- do not render -->';
    const root = await makeRepo(t, { body });
    const prepared = await prepareArticle(root, 'A12');
    const quote = '{% xlink "https://example.test/a" "AI Advisors" role="source" %}';
    assert.deepEqual(prepared.passages.map(({ text }) => text), ['<p>Source {% xlink "https://example.test/a" "AI Advisors" role="source" %} remains literal.</p>', '<!-- do not render -->']);
    const finalRecord = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({
      evidence: { article_id: 'A12', passage_id: 'P0001', quote },
    })));
    assert.equal(finalRecord.observations[0].evidence[0].quote, quote);
  });

  it('distinguishes malformed JSON, empty observations, and closed-schema failures', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, '{'), 'CANDIDATE_JSON_INVALID');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, '{"observations":[],"observations":[]}'), 'CANDIDATE_JSON_INVALID');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, '{"observations":[{"label":"bad\nquote"}]}'), 'CANDIDATE_JSON_INVALID');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify({ observations: [] })), 'NO_OBSERVATIONS');

    for (const extraField of ['coverage', 'source', 'measurements', 'dimension_presence', 'processing', 'id', 'receipt', 'workflow_receipt', 'workflowReceipt', 'article_processed', 'passages_available']) {
      const extra = { ...candidate(), [extraField]: {} };
      await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(extra)), 'CANDIDATE_SCHEMA_INVALID');
    }

    for (const oldOrGeneratedField of ['id', 'review_status', 'status', 'attribute', 'interpretation', 'context', 'subject', 'object']) {
      const extra = candidate();
      extra.observations[0][oldOrGeneratedField] = 'not candidate-authored in v1.2';
      await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(extra)), 'CANDIDATE_SCHEMA_INVALID');
    }

    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, ' '.repeat(65_537)), 'LIMIT_EXCEEDED');
  });

  it('checks quote membership within the cited current passage', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote\n\nother evidence' });
    const prepared = await prepareArticle(root, 'A12');
    const changedQuote = candidate({ evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'safe  quote' } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(changedQuote)), 'EVIDENCE_INVALID');

    const wrongPassage = candidate({ evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'other evidence' } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(wrongPassage)), 'EVIDENCE_INVALID');

    const wrongArticle = candidate({ evidence: { article_id: 'A11', passage_id: 'P0001', quote: 'safe quote' } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(wrongArticle)), 'EVIDENCE_INVALID');
  });

  it('rejects stale hashes before context-dependent evidence checks and leaves current source intact', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    const candidateWithBadQuote = candidate({ evidence: { article_id: 'A12', passage_id: 'P9999', quote: 'not present' } });
    await writeFile(join(root, ARTICLE_PATH), `---\ntitle: Synthetic fixture\n---\nchanged source`);
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(candidateWithBadQuote)), 'INPUT_CHANGED');
    assert.match(await readFile(join(root, ARTICLE_PATH), 'utf8'), /changed source/);
  });

  it('binds the input hash to corpus and instruction bytes as well as article bytes', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    await writeFile(join(root, 'docs/corpus.yaml'), `${corpusText()}# changed declaration\n`);
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, candidateJson()), 'INPUT_CHANGED');

    const anotherRoot = await makeRepo(t, { body: 'safe quote' });
    const anotherPrepared = await prepareArticle(anotherRoot, 'A12');
    await writeFile(join(anotherRoot, '.opencode/agents/author-extractor.md'), '# changed instructions\n');
    await rejectionCode(acceptCandidate(anotherRoot, 'A12', anotherPrepared.input_hash, candidateJson()), 'INPUT_CHANGED');
  });

  it('returns only canonical final fields and does not echo submitted text in errors', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    const finalText = await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson());
    const parsed = JSON.parse(finalText);
    assert.deepEqual(Object.keys(parsed).sort(), [
      'dimension_presence', 'measurements', 'method', 'observations', 'processing', 'schema_version', 'source',
    ]);
    assert.equal(finalText, JSON.stringify(parsed));
    assertRecursivelySortedKeys(parsed);

    const secretFixtureText = 'candidate-secret-must-not-be-echoed';
    const invalid = JSON.stringify({ ...candidate(), [secretFixtureText]: true });
    const error = await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, invalid), 'CANDIDATE_SCHEMA_INVALID');
    assert.equal(error.message.includes(secretFixtureText), false);
    assert.equal(JSON.stringify(error.details).includes(secretFixtureText), false);
  });

  it('accepts A20 with tracked v1.3 processing and rejects A21 or an incomplete twenty-source manifest', async (t) => {
    const root = await makeRepo(t);
    await mkdir(join(root, '_posts/synthetic'), { recursive: true });
    await writeFile(join(root, '_posts/synthetic/A20.md'), '---\ntitle: Synthetic A20\n---\nsafe quote');
    const prepared = await prepareArticle(root, 'A20');
    const payload = candidate({ evidence: { article_id: 'A20', passage_id: 'P0001', quote: 'safe quote' } });
    const record = await acceptCandidate(root, 'A20', prepared.input_hash, JSON.stringify(payload), { workflowReceipt: workflowReceipt(prepared, 'synthetic-A20') });
    const verified = await verifyExtractionRecord(root, record);
    assert.equal(verified.record.schema_version, 'author-extraction/1.3');
    assert.equal(verified.record.observations[0].id, 'A20::O0001');
    assert.equal(verified.processing_eligible, true);
    await rejectionCode(prepareArticle(root, 'A21'), 'UNKNOWN_ARTICLE');
    await writeFile(join(root, 'docs/corpus.yaml'), corpusText(ARTICLE_PATH, true, { omitId: 'A20' }));
    await rejectionCode(prepareArticle(root, 'A12'), 'CORPUS_INVALID');
  });
});
