import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareArticle, acceptCandidate } from './core.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const APPROVED_TEMP = '/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode';
const ARTICLE_PATH = '_posts/synthetic.md';
const INSTRUCTIONS = '# Synthetic author-extractor fixture\n';
const BODY = 'A😀\r\nline\r\n \t\r\nz e\u0301\r\n\r\ncode $x$';
const SCHEMA_BYTES = await readFile(join(PACKAGE_DIR, 'extraction.schema.json'));

let schemaHash;

before(() => {
  schemaHash = sha256(SCHEMA_BYTES);
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function corpusText(path = ARTICLE_PATH, representative = true, { omitId } = {}) {
  const articleIds = Array.from({ length: 12 }, (_, index) => `A${String(index + 1).padStart(2, '0')}`);
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
  await writeFile(join(root, '_scripts/author-extraction/extraction.schema.json'), SCHEMA_BYTES);
  await writeFile(join(root, '.opencode/agents/author-extractor.md'), INSTRUCTIONS);
  if (path === ARTICLE_PATH) await writeFile(join(root, ARTICLE_PATH), source);
  return root;
}

function observation(dimension, evidence = { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' }) {
  const shared = {
    dimension,
    attribute: 'a bounded candidate attribute',
    interpretation: 'A candidate interpretation, not a verified author trait.',
    context: 'Synthetic test context.',
    status: 'candidate',
    inference_kind: 'inferred',
    evidence: [evidence],
  };
  switch (dimension) {
    case 'rhetorical': return { ...shared, move: 'contrast', function: 'focus attention' };
    case 'epistemic': return { ...shared, claim: 'a claim', basis: null, qualification: 'bounded' };
    case 'semantic': return { ...shared, subject: 'subject', relation: 'relates to', object: 'object', claim_nature: 'descriptive' };
    case 'decisional': return { ...shared, choice: 'choice', rationale: 'rationale', tradeoff: null, condition: 'condition' };
    default: throw new Error(`Unknown test dimension: ${dimension}`);
  }
}

function candidate({ dimension = 'rhetorical', evidence, coverageOverrides = {}, observations } = {}) {
  const observedDimension = observations?.[0]?.dimension ?? dimension;
  const coverage = Object.fromEntries(['rhetorical', 'epistemic', 'semantic', 'decisional'].map((name) => [
    name,
    coverageOverrides[name] ?? {
      status: name === observedDimension ? 'observed' : 'not_observed',
      note: name === observedDimension ? 'One synthetic candidate is present.' : 'No candidate was observed in this dimension.',
    },
  ]));
  return { coverage, observations: observations ?? [observation(dimension, evidence)] };
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
      instructions_version: 'author-extractor/1',
      schema_hash: schemaHash,
      instructions_hash: sha256(instructionsBytes),
    };
    const expectedCanonicalInput = `{"method":{"instructions_hash":"${method.instructions_hash}","instructions_version":"author-extractor/1","measurement_version":"raw-body-counts/1","prepare_version":"prepare/1","schema_hash":"${schemaHash}","segmentation_version":"raw-blank-lines/1"},"source":{"article_id":"A12","corpus_hash":"${source.corpus_hash}","file_hash":"${source.file_hash}","path":"${ARTICLE_PATH}"}}`;

    assert.deepEqual(prepared.source, source);
    assert.deepEqual(prepared.method, method);
    assert.equal(prepared.schema_version, 'author-extraction/1');
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

  it('accepts one valid typed candidate for each of the four closed dimensions', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    for (const dimension of ['rhetorical', 'epistemic', 'semantic', 'decisional']) {
      const finalText = await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({ dimension }));
      const finalRecord = JSON.parse(finalText);
      assert.deepEqual(Object.keys(finalRecord).sort(), ['coverage', 'measurements', 'method', 'observations', 'schema_version', 'source']);
      assert.equal(finalRecord.observations[0].dimension, dimension);
      assert.deepEqual(finalRecord.observations[0].evidence[0], {
        article_id: 'A12', passage_id: 'P0001', quote: 'safe quote',
      });
      assert.equal(finalRecord.measurements.advanced_stylometry.status, 'not_computed');
      assert.equal(finalRecord.measurements.advanced_stylometry.value, null);
      assert.equal(await acceptCandidate(root, 'A12', prepared.input_hash, candidateJson({ dimension })), finalText);
    }
  });

  it('does not infer semantic entailment from literal quote membership', async (t) => {
    const root = await makeRepo(t, { body: 'The page says safe quote.' });
    const prepared = await prepareArticle(root, 'A12');
    const payload = candidate({
      dimension: 'semantic',
      evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' },
      observations: [{
        ...observation('semantic', { article_id: 'A12', passage_id: 'P0001', quote: 'safe quote' }),
        interpretation: 'The deliberately unverified candidate makes an unsupported claim.',
      }],
    });
    const finalRecord = JSON.parse(await acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(payload)));
    assert.equal(finalRecord.observations[0].interpretation, 'The deliberately unverified candidate makes an unsupported claim.');
  });

  it('rejects unknown and non-representative articles without accepting arbitrary sources', async (t) => {
    const root = await makeRepo(t);
    await rejectionCode(prepareArticle(root, 'A13'), 'UNKNOWN_ARTICLE');

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

  it('distinguishes malformed JSON, empty observations, and closed-schema failures', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote' });
    const prepared = await prepareArticle(root, 'A12');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, '{'), 'CANDIDATE_JSON_INVALID');
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify({ coverage: candidate().coverage, observations: [] })), 'NO_OBSERVATIONS');

    const extra = candidate();
    extra.measurements = { utf8_bytes: 10 };
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(extra)), 'CANDIDATE_SCHEMA_INVALID');

    const crossedPayload = candidate();
    crossedPayload.observations[0].dimension = 'semantic';
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(crossedPayload)), 'CANDIDATE_SCHEMA_INVALID');

    const missingNullable = candidate({ dimension: 'epistemic' });
    delete missingNullable.observations[0].basis;
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(missingNullable)), 'CANDIDATE_SCHEMA_INVALID');

    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, ' '.repeat(65_537)), 'LIMIT_EXCEEDED');
  });

  it('checks quote membership within the cited current passage and coverage correspondence', async (t) => {
    const root = await makeRepo(t, { body: 'safe quote\n\nother evidence' });
    const prepared = await prepareArticle(root, 'A12');
    const changedQuote = candidate({ evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'safe  quote' } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(changedQuote)), 'EVIDENCE_INVALID');

    const wrongPassage = candidate({ evidence: { article_id: 'A12', passage_id: 'P0001', quote: 'other evidence' } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(wrongPassage)), 'EVIDENCE_INVALID');

    const wrongArticle = candidate({ evidence: { article_id: 'A11', passage_id: 'P0001', quote: 'safe quote' } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(wrongArticle)), 'EVIDENCE_INVALID');

    const mismatch = candidate({ coverageOverrides: { rhetorical: { status: 'not_observed', note: 'Incorrectly reports absence.' } } });
    await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, JSON.stringify(mismatch)), 'COVERAGE_INVALID');
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
    assert.deepEqual(Object.keys(parsed).sort(), ['coverage', 'measurements', 'method', 'observations', 'schema_version', 'source']);
    assert.equal(finalText, JSON.stringify(parsed));
    assertRecursivelySortedKeys(parsed);

    const secretFixtureText = 'candidate-secret-must-not-be-echoed';
    const invalid = JSON.stringify({ ...candidate(), [secretFixtureText]: true });
    const error = await rejectionCode(acceptCandidate(root, 'A12', prepared.input_hash, invalid), 'CANDIDATE_SCHEMA_INVALID');
    assert.equal(error.message.includes(secretFixtureText), false);
    assert.equal(JSON.stringify(error.details).includes(secretFixtureText), false);
  });
});
