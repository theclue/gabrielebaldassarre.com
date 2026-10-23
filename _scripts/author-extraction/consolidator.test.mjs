import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { prepareArticle, acceptCandidate, verifyExtractionRecord } from './core.mjs';
import { prepareConsolidation, acceptDimensionCandidate, finalizeConsolidation } from './consolidator.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const APPROVED_TEMP = tmpdir();
const RECORDS_DIRECTORY = 'docs/author-extraction-results/v1.3';
const TWELVE_RECORDS_DIRECTORY = 'docs/author-extraction-results/v1.2';
const LEGACY_RECORDS_DIRECTORY = 'docs/author-extraction-results/v1.1';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const CHILD_PROCESS = String.raw`
  import { prepareConsolidation, acceptDimensionCandidate, finalizeConsolidation } from ${JSON.stringify(new URL('./consolidator.mjs', import.meta.url).href)};
  const root = process.env.SYNTHETIC_REPO_ROOT;
  const candidate = JSON.parse(process.env.CANDIDATE_JSON);
  const dimensions = ['rhetorical', 'epistemic', 'semantic', 'decisional'];
  const accepted = [];
  let corpusHash;
  let inputHash;
  for (const dimension of dimensions) {
    const prepared = await prepareConsolidation(root, dimension, 'docs/author-extraction-results/v1.3');
    if (prepared.status !== 'ready') throw new Error('expected ready preparation for ' + dimension + ': ' + JSON.stringify(prepared));
    if (dimension === 'rhetorical') {
      corpusHash = prepared.corpus_hash;
      inputHash = prepared.input_hash;
    }
    const dimensionCandidate = dimension === 'rhetorical' ? candidate : { groups: [], unclustered_observations: [] };
    accepted.push(await acceptDimensionCandidate(
      root, dimension, prepared.corpus_hash, prepared.input_hash, JSON.stringify(dimensionCandidate), 'docs/author-extraction-results/v1.3',
    ));
  }
  const finalJson = await finalizeConsolidation(root, corpusHash, accepted, 'docs/author-extraction-results/v1.3');
  const finalBundle = JSON.parse(finalJson);
  console.log(JSON.stringify({
    locale: new Intl.Collator().resolvedOptions().locale,
    corpus_hash: corpusHash,
    input_hash: inputHash,
    final_json: finalJson,
    patterns: finalBundle.author_patterns.rhetorical_groups.map(({ id, label, support }) => ({ id, label, support })),
  }));
`;

async function rejectionWithCode(promise, code) {
  let caught;
  try { await promise; } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `expected rejection with code ${code}`);
  assert.equal(caught.code, code);
  return caught;
}

function candidateGroup(label, memberObservationIds) {
  return {
    pattern_scope: 'rhetorical_strategy',
    author_relevance: 'candidate',
    label,
    description: `Synthetic recurring pattern labelled ${label}.`,
    abstraction_kind: 'observed_regularities',
    rationale: 'The same bounded feature recurs across the listed synthetic source records.',
    variation_notes: ['Fixture-only variation note.'],
    member_observation_ids: memberObservationIds,
  };
}

function sameEvidenceGroups(bundle) {
  return bundle.author_patterns.rhetorical_groups
    .map(({ label, support }) => ({
      label,
      support: support.map(({ observation_id, article_id }) => ({ observation_id, article_id }))
        .sort((left, right) => left.observation_id < right.observation_id ? -1 : left.observation_id > right.observation_id ? 1 : 0),
    }))
    .sort((left, right) => left.label < right.label ? -1 : left.label > right.label ? 1 : 0);
}

async function makeTrackedSyntheticRepository(t, {
  dimensionsForArticle = () => ['rhetorical'],
  tracked = true,
  recordsDirectory = RECORDS_DIRECTORY,
  legacyRecords = false,
  recordOrder,
} = {}) {
  const count = recordsDirectory === RECORDS_DIRECTORY ? 20 : 12;
  recordOrder ??= Array.from({ length: count }, (_, index) => index + 1);
  const root = await mkdtemp(join(APPROVED_TEMP, 'author-consolidation-locale-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of [
    recordsDirectory,
    '_scripts/author-extraction',
    '.opencode/agents',
    '_posts/synthetic',
  ]) await mkdir(join(root, relative), { recursive: true });

  const sourceEntries = [];
  for (let index = 1; index <= 20; index += 1) {
    const articleId = `A${String(index).padStart(2, '0')}`;
    const sourcePath = `_posts/synthetic/${articleId}.md`;
    sourceEntries.push(`  - id: ${articleId}\n    percorso: ${sourcePath}\n    rappresentativo_stile: true`);
    const quote = `Evidence quote ${articleId} {% xlink "https://example.test/source" "Source" role="source" %}`;
    await writeFile(join(root, sourcePath), `---\ntitle: ${articleId} synthetic fixture\n---\n${quote}`);
  }
  await writeFile(join(root, 'docs/corpus.yaml'), [
    'contesto:',
    '  finalita: Fixture sintetica esclusiva per testare ordinamento deterministico.',
    '  approvazione_editoriale:',
    '    ambito: Nessun dato di articoli reali.',
    '    dichiarazione_utente: Fixture generata esclusivamente in un temporary root.',
    '  revisione_utente_modello_generato: pending',
    'fonti:',
    ...sourceEntries,
    'esclusioni:',
    '  - percorso: _posts/synthetic/excluded.md',
    '    motivo: Non incluso nel corpus sintetico.',
    '',
  ].join('\n'));
  let archivedCorpus = await readFile(join(root, 'docs/corpus.yaml'), 'utf8');
  for (const entry of sourceEntries.slice(12)) archivedCorpus = archivedCorpus.replace(`${entry}\n`, '');
  await writeFile(join(root, 'docs/corpus.v1.2.yaml'), archivedCorpus);

  await writeFile(join(root, '_scripts/author-extraction/extraction.schema.json'), await readFile(join(PACKAGE_DIR, 'extraction.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/extraction.v1.2.schema.json'), await readFile(join(PACKAGE_DIR, 'extraction.v1.2.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/extraction.v1.3.schema.json'), await readFile(join(PACKAGE_DIR, 'extraction.v1.3.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/patterns.schema.json'), await readFile(join(PACKAGE_DIR, 'patterns.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/patterns.v0.2.schema.json'), await readFile(join(PACKAGE_DIR, 'patterns.v0.2.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/patterns.v0.3.schema.json'), await readFile(join(PACKAGE_DIR, 'patterns.v0.3.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/patterns.v0.4.schema.json'), await readFile(join(PACKAGE_DIR, 'patterns.v0.4.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/patterns.v0.5.schema.json'), await readFile(join(PACKAGE_DIR, 'patterns.v0.5.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/patterns.v0.6.schema.json'), await readFile(join(PACKAGE_DIR, 'patterns.v0.6.schema.json')));
  await writeFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.1.md'), '# Synthetic consolidator instructions\n');
  await writeFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.2.md'), '# Synthetic consolidator instructions\n');
  await writeFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.3.md'), '# Synthetic consolidator instructions\n');
  await writeFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.4.md'), '# Synthetic consolidator instructions\n');
  await writeFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.5.md'), '# Synthetic consolidator instructions\n');
  await writeFile(join(root, '.opencode/agents/author-extractor.md'), '# Synthetic extractor instructions v1.2\n');
  await writeFile(join(root, '.opencode/agents/author-pattern-consolidator.md'), '# Synthetic consolidator instructions\n');

  for (const index of recordOrder) {
    const articleId = `A${String(index).padStart(2, '0')}`;
    const prepared = await prepareArticle(root, articleId);
    const quote = `Evidence quote ${articleId} {% xlink "https://example.test/source" "Source" role="source" %}`;
    const candidateJson = JSON.stringify({ observations: dimensionsForArticle(articleId).map((dimension, observationIndex) => ({
      dimension,
      label: `synthetic ${dimension} ${articleId} ${observationIndex + 1}`,
      description: `Synthetic ${dimension} observation ${observationIndex + 1} for ${articleId}.`,
      inference_kind: 'explicit',
      evidence: [{ article_id: articleId, passage_id: 'P0001', quote }],
    })) });
    const options = tracked ? {
      workflowReceipt: {
        workflow_version: 'host-session-whole-article/1',
        mode: 'whole_article',
        session_id: `synthetic-fixture-${articleId}`,
        article_id: articleId,
        input_hash: prepared.input_hash,
        prepare_returned: true,
      },
    } : undefined;
    let recordJson = await acceptCandidate(root, articleId, prepared.input_hash, candidateJson, options);
    if (recordsDirectory === TWELVE_RECORDS_DIRECTORY) {
      const retained = JSON.parse(recordJson);
      retained.schema_version = 'author-extraction/1.2';
      retained.source.corpus_hash = sha256(Buffer.from(archivedCorpus));
      retained.method.instructions_version = 'author-extractor/1.2';
      retained.method.schema_hash = sha256(await readFile(join(PACKAGE_DIR, 'extraction.v1.2.schema.json')));
      if (retained.processing.receipt) {
        const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value !== null && typeof value === 'object'
          ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
        retained.processing.receipt.input_hash = sha256(Buffer.from(JSON.stringify(canonicalize({ source: retained.source, method: retained.method }))));
      }
      recordJson = JSON.stringify(retained);
    }
    if (legacyRecords) {
      const legacySchema = await readFile(join(PACKAGE_DIR, 'extraction.schema.json'));
      const legacyRecord = JSON.parse(recordJson);
      legacyRecord.schema_version = 'author-extraction/1.1';
      legacyRecord.source.corpus_hash = sha256(Buffer.from(archivedCorpus));
      legacyRecord.method = {
        prepare_version: 'prepare/1',
        segmentation_version: 'raw-blank-lines/1',
        measurement_version: 'raw-body-counts/1',
        instructions_version: 'author-extractor/1.1',
        schema_hash: sha256(legacySchema),
        instructions_hash: sha256(await readFile(join(root, '.opencode/agents/author-extractor.md'))),
      };
      legacyRecord.processing = {
        status: 'not_tracked',
        passages_total: prepared.passages.length,
        passages_processed: null,
        passages_failed: null,
        passages_with_observations: new Set(legacyRecord.observations.flatMap((item) => item.evidence.map((evidence) => evidence.passage_id))).size,
      };
      recordJson = JSON.stringify(legacyRecord);
    }
    await writeFile(join(root, recordsDirectory, `${articleId}.json`), recordJson);
  }
  return root;
}

const DIMENSIONS = ['rhetorical', 'epistemic', 'semantic', 'decisional'];

function featureDimensions(articleId) {
  return [
    'rhetorical', ...(articleId === 'A01' || articleId === 'A02' ? ['rhetorical'] : []),
    'epistemic', 'semantic', 'decisional', ...(articleId === 'A12' ? ['decisional'] : []),
  ];
}

function featureGroup(dimension, kind, label, observations, abstraction = 'observed_regularities') {
  return {
    ...(dimension === 'semantic' ? { semantic_kind: kind }
      : dimension === 'rhetorical' ? {
        pattern_scope: kind === 'editorial_format' ? 'editorial_format' : kind === 'thematic' ? 'local_content_pattern' : 'rhetorical_strategy',
        author_relevance: kind === 'thematic' ? 'unlikely' : 'candidate',
      } : { classification: kind }),
    label,
    description: `Synthetic ${label} description.`,
    abstraction_kind: abstraction,
    rationale: `The synthetic observations support ${label}.`,
    variation_notes: ['Synthetic variation note.'],
    member_observation_ids: observations,
  };
}

function observationsForArticles(prepared, articles) {
  return prepared.observations.filter((item) => articles.includes(item.article_id)).map((item) => item.observation_id);
}

function candidatePartition(prepared, groupSpecs) {
  const groups = groupSpecs.map(({ dimension, kind, label, articles, abstraction }) =>
    featureGroup(dimension, kind, label, observationsForArticles(prepared, articles), abstraction));
  const assigned = new Set(groups.flatMap((group) => group.member_observation_ids));
  return {
    groups,
    unclustered_observations: prepared.observations
      .filter((item) => !assigned.has(item.observation_id))
      .map(({ observation_id }) => ({ observation_id, reason: 'Not clustered in this synthetic fixture.' })),
  };
}

function featureCandidate(dimension, prepared) {
  if (dimension === 'rhetorical') return candidatePartition(prepared, [
    { dimension, kind: 'author_candidate', label: 'Two-article tendency', articles: ['A01', 'A02'] },
    { dimension, kind: 'author_candidate', label: 'Recurring tendency', articles: ['A03', 'A04', 'A05'], abstraction: 'inferred_generalization' },
    { dimension, kind: 'editorial_format', label: 'Editorial format', articles: ['A06', 'A07'] },
    { dimension, kind: 'thematic', label: 'Thematic candidate', articles: ['A08', 'A09'] },
  ]);
  if (dimension === 'epistemic') return candidatePartition(prepared, [
    { dimension, kind: 'author_candidate', label: 'Epistemic comparison', articles: ['A01', 'A02'] },
  ]);
  if (dimension === 'semantic') return candidatePartition(prepared, [
    { dimension, kind: 'concept', label: 'Synthetic concept', articles: ['A01', 'A02', 'A03'] },
    { dimension, kind: 'relation', label: 'Synthetic relation', articles: ['A04', 'A05'] },
  ]);
  return candidatePartition(prepared, [
    { dimension, kind: 'thematic', label: 'Single-article proposal', articles: ['A12'] },
  ]);
}

async function acceptedFeatureDimensions(root, recordsDirectory = RECORDS_DIRECTORY) {
  const prepared = new Map();
  const accepted = [];
  for (const dimension of DIMENSIONS) {
    const result = await prepareConsolidation(root, dimension, recordsDirectory);
    assert.equal(result.status, 'ready');
    prepared.set(dimension, result);
    const candidate = featureCandidate(dimension, result);
    accepted.push(await acceptDimensionCandidate(
      root, dimension, result.corpus_hash, result.input_hash, JSON.stringify(candidate), recordsDirectory,
    ));
  }
  return { prepared, accepted, corpusHash: prepared.get('rhetorical').corpus_hash };
}

function runWithLocale(root, candidateJson, locale) {
  const envLocale = locale === 'en-US' ? 'en_US.UTF-8' : 'sv_SE.UTF-8';
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD_PROCESS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      LANG: envLocale,
      LC_ALL: envLocale,
      LANGUAGE: locale === 'en-US' ? 'en_US:en' : 'sv_SE:sv',
      SYNTHETIC_REPO_ROOT: root,
      CANDIDATE_JSON: candidateJson,
    },
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, `locale child failed (${envLocale}):\n${child.stderr}\n${child.stdout}`);
  return JSON.parse(child.stdout.trim());
}

describe('consolidation ordering is independent of the runtime locale', () => {
  it('keeps final pattern IDs invariant for identical non-ASCII groups and hashes', async (t) => {
    const root = await makeTrackedSyntheticRepository(t);
    const zetaMembers = Array.from({ length: 10 }, (_, index) => `A${String(index + 1).padStart(2, '0')}::O0001`);
    const angstromMembers = Array.from({ length: 10 }, (_, index) => `A${String(index + 11).padStart(2, '0')}::O0001`);
    const candidateJson = JSON.stringify({
      groups: [
        candidateGroup('zeta pattern', zetaMembers),
        candidateGroup('ångström pattern', angstromMembers),
      ],
      unclustered_observations: [],
    });

    const english = runWithLocale(root, candidateJson, 'en-US');
    const swedish = runWithLocale(root, candidateJson, 'sv-SE');
    assert.equal(english.locale, 'en-US', 'child process must resolve the requested English locale');
    assert.equal(swedish.locale, 'sv-SE', 'child process must resolve the requested Swedish locale');
    assert.equal(english.corpus_hash, swedish.corpus_hash, 'the verified corpus inputs must be identical');
    assert.equal(english.input_hash, swedish.input_hash, 'the prepared dimension inputs must be identical');
    assert.deepEqual(sameEvidenceGroups(JSON.parse(english.final_json)), sameEvidenceGroups(JSON.parse(swedish.final_json)), 'group membership and interpretation must be identical');

    const englishIds = Object.fromEntries(english.patterns.map(({ label, id }) => [label, id]));
    const swedishIds = Object.fromEntries(swedish.patterns.map(({ label, id }) => [label, id]));
    assert.deepEqual(
      englishIds,
      swedishIds,
      `locale changed assigned IDs; final bundles equal=${english.final_json === swedish.final_json}`,
    );
    assert.equal(english.final_json, swedish.final_json, 'identical accepted groups must serialize to one deterministic final bundle');
  });
});

describe('consolidator core contract over twenty-source and retained tracked records', () => {
  it('projects only requested observation fields and binds repeatable hashes to records and method', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const prepared = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(prepared.status, 'ready');
    assert.deepEqual(Object.keys(prepared).sort(), ['corpus_hash', 'dimension', 'input_hash', 'method', 'observations', 'schema_version', 'status']);
    assert.deepEqual(Object.keys(prepared.method).sort(), [
      'consolidation_version', 'instructions_hash', 'instructions_version', 'projection_version', 'schema_hash',
    ]);
    assert.deepEqual(Object.keys(prepared.observations[0]).sort(), [
      'article_id', 'description', 'dimension', 'evidence_refs', 'inference_kind', 'label', 'observation_id',
    ]);
    assert.deepEqual(prepared.observations[0].evidence_refs, [{
      passage_id: 'P0001',
      quote: 'Evidence quote A01 {% xlink "https://example.test/source" "Source" role="source" %}',
    }]);
    assert.equal(JSON.stringify(prepared.observations).includes('_posts/'), false);
    assert.equal(JSON.stringify(prepared.observations).includes('measurements'), false);
    assert.equal(JSON.stringify(prepared.observations).includes('corpus_hash'), false);
    assert.deepEqual(await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY), prepared);

    const reverseRoot = await makeTrackedSyntheticRepository(t, {
      dimensionsForArticle: featureDimensions,
      recordOrder: Array.from({ length: 20 }, (_, index) => 20 - index),
    });
    const reversePrepared = await prepareConsolidation(reverseRoot, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(reversePrepared.corpus_hash, prepared.corpus_hash, 'record-file creation order must not affect the verified corpus hash');
    assert.equal(reversePrepared.input_hash, prepared.input_hash, 'record-file creation order must not affect the dimension input hash');

    const firstRecordPath = join(root, RECORDS_DIRECTORY, 'A01.json');
    const originalRecord = await readFile(firstRecordPath, 'utf8');
    const editedRecord = JSON.parse(originalRecord);
    editedRecord.observations[0].label = 'edited but still source-verified synthetic label';
    await writeFile(firstRecordPath, JSON.stringify(editedRecord));
    const changedDataset = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.notEqual(changedDataset.corpus_hash, prepared.corpus_hash, 'record fingerprint changes bind the complete record set');
    assert.notEqual(changedDataset.input_hash, prepared.input_hash);
    await writeFile(firstRecordPath, originalRecord);

    const instructionsPath = join(root, '.opencode/agents/author-pattern-consolidator.md');
    const originalInstructions = await readFile(instructionsPath, 'utf8');
    await writeFile(instructionsPath, `${originalInstructions}\nmethod revision`);
    const changedInstructions = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(changedInstructions.corpus_hash, prepared.corpus_hash);
    assert.notEqual(changedInstructions.input_hash, prepared.input_hash, 'instruction bytes are part of the preparation hash');
    await writeFile(instructionsPath, originalInstructions);

    const schemaPath = join(root, '_scripts/author-extraction/patterns.v0.6.schema.json');
    const originalSchema = await readFile(schemaPath, 'utf8');
    await writeFile(schemaPath, ` ${originalSchema}`);
    const changedSchema = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(changedSchema.corpus_hash, prepared.corpus_hash);
    assert.notEqual(changedSchema.input_hash, prepared.input_hash, 'schema bytes are part of the preparation hash');
  });

  it('blocks valid current and historical corpora with untracked processing before exposing observations', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { tracked: false, dimensionsForArticle: featureDimensions });
    const blocked = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(blocked.status, 'blocked');
    assert.deepEqual(Object.keys(blocked).sort(), ['corpus_hash', 'diagnostics', 'schema_version', 'status']);
    assert.equal(blocked.diagnostics.length, 20);
    assert.ok(blocked.diagnostics.every((item) => item.code === 'PROCESSING_NOT_TRACKED'));
    assert.equal(Object.hasOwn(blocked, 'observations'), false);
    await assert.rejects(
      acceptDimensionCandidate(root, 'rhetorical', blocked.corpus_hash, 'a'.repeat(64), '{"groups":[],"unclustered_observations":[]}', RECORDS_DIRECTORY),
      (error) => error.code === 'PROCESSING_INCOMPLETE',
    );

    const legacyRoot = await makeTrackedSyntheticRepository(t, {
      tracked: false,
      dimensionsForArticle: featureDimensions,
      recordsDirectory: LEGACY_RECORDS_DIRECTORY,
      legacyRecords: true,
    });
    const defaultBlocked = await prepareConsolidation(legacyRoot, 'rhetorical');
    assert.equal(defaultBlocked.status, 'blocked');
    assert.equal(defaultBlocked.diagnostics.length, 12);
    assert.ok(defaultBlocked.diagnostics.every((item) => item.code === 'PROCESSING_NOT_TRACKED'));

    const trackedA12Prepared = await prepareArticle(root, 'A12');
    const trackedA12Candidate = JSON.stringify({ observations: featureDimensions('A12').map((dimension, index) => ({
      dimension,
      label: `synthetic ${dimension} A12 ${index + 1}`,
      description: `Synthetic ${dimension} observation ${index + 1} for A12.`,
      inference_kind: 'explicit',
      evidence: [{
        article_id: 'A12', passage_id: 'P0001',
        quote: 'Evidence quote A12 {% xlink "https://example.test/source" "Source" role="source" %}',
      }],
    })) });
    const trackedA12 = await acceptCandidate(root, 'A12', trackedA12Prepared.input_hash, trackedA12Candidate, {
      workflowReceipt: {
        workflow_version: 'host-session-whole-article/1', mode: 'whole_article',
        session_id: 'synthetic-mixed-tracked-A12', article_id: 'A12',
        input_hash: trackedA12Prepared.input_hash, prepare_returned: true,
      },
    });
    await writeFile(join(root, RECORDS_DIRECTORY, 'A12.json'), trackedA12);
    const mixed = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(mixed.status, 'blocked');
    assert.equal(mixed.diagnostics.length, 19);
    assert.equal(mixed.diagnostics.some((item) => item.article_id === 'A12'), false);
  });

  it('projects the bounded maximum of 240 observations across all four dimensions', async (t) => {
    const dimensions = () => [
      'rhetorical', 'rhetorical', 'rhetorical',
      'epistemic', 'epistemic', 'epistemic',
      'semantic', 'semantic', 'semantic',
      'decisional', 'decisional', 'decisional',
    ];
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: dimensions });
    const prepared = await Promise.all(DIMENSIONS.map((dimension) => prepareConsolidation(root, dimension, RECORDS_DIRECTORY)));
    assert.ok(prepared.every((result) => result.status === 'ready'));
    assert.ok(prepared.every((result) => result.observations.length === 60));
    assert.equal(prepared.reduce((total, result) => total + result.observations.length, 0), 240);
  });

  it('validates schemas, exact partitioning, member dimensions, and candidate-authored prose', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const prepared = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    const validCandidate = featureCandidate('rhetorical', prepared);
    const acceptedText = await acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(validCandidate), RECORDS_DIRECTORY);
    const accepted = JSON.parse(acceptedText);
    assert.equal(accepted.schema_version, 'author-pattern-dimension/0.6');
    assert.equal(accepted.groups.length, 4);
    const groupFacts = accepted.groups.map((group) => [group.label, group.observation_count, group.article_count])
      .sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
    assert.deepEqual(groupFacts, [
      ['Editorial format', 2, 2],
      ['Recurring tendency', 3, 3],
      ['Thematic candidate', 2, 2],
      ['Two-article tendency', 4, 2],
    ]);
    assert.ok(accepted.groups.every((group) => group.rationale.trim().length > 0));
    assert.ok(accepted.groups.every((group) => group.support.every((item) => item.article_id.startsWith('A'))));
    assert.equal(accepted.groups.find((group) => group.label === 'Recurring tendency').abstraction_kind, 'inferred_generalization');

    const duplicateWithinGroup = structuredClone(validCandidate);
    duplicateWithinGroup.groups[0].member_observation_ids.push(duplicateWithinGroup.groups[0].member_observation_ids[0]);
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(duplicateWithinGroup), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');

    const duplicateAcrossGroups = structuredClone(validCandidate);
    duplicateAcrossGroups.groups[1].member_observation_ids.push(duplicateAcrossGroups.groups[0].member_observation_ids[0]);
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(duplicateAcrossGroups), RECORDS_DIRECTORY),
      (error) => error.code === 'PARTITION_INVALID');

    const unknownMember = structuredClone(validCandidate);
    unknownMember.groups[0].member_observation_ids[0] = 'A09::O9999';
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(unknownMember), RECORDS_DIRECTORY),
      (error) => error.code === 'PARTITION_INVALID');

    const crossDimension = structuredClone(validCandidate);
    crossDimension.groups[0].member_observation_ids[0] = 'A01::O0003';
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(crossDimension), RECORDS_DIRECTORY),
      (error) => error.code === 'PARTITION_INVALID');

    const missing = structuredClone(validCandidate);
    missing.unclustered_observations.pop();
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(missing), RECORDS_DIRECTORY),
      (error) => error.code === 'PARTITION_INVALID');

    const duplicateAcrossGroupAndUnclustered = structuredClone(validCandidate);
    duplicateAcrossGroupAndUnclustered.groups[0].member_observation_ids.push(duplicateAcrossGroupAndUnclustered.unclustered_observations[0].observation_id);
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(duplicateAcrossGroupAndUnclustered), RECORDS_DIRECTORY),
      (error) => error.code === 'PARTITION_INVALID');

    const absentRationale = structuredClone(validCandidate);
    delete absentRationale.groups[0].rationale;
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(absentRationale), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');
    const blankRationale = structuredClone(validCandidate);
    blankRationale.groups[0].rationale = '  ';
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(blankRationale), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');

    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash,
      '{"groups":[],"groups":[],"unclustered_observations":[]}', RECORDS_DIRECTORY), (error) => error.code === 'CANDIDATE_JSON_INVALID');
    const unknownProperty = structuredClone(validCandidate);
    unknownProperty.groups[0].authored_count = 500;
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(unknownProperty), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');
    const overlongLabel = structuredClone(validCandidate);
    overlongLabel.groups[0].label = 'x'.repeat(201);
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(overlongLabel), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');
    const overlongDescription = structuredClone(validCandidate);
    overlongDescription.groups[0].description = 'x'.repeat(2001);
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(overlongDescription), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');
    const candidateAuthoredCount = structuredClone(validCandidate);
    candidateAuthoredCount.groups[0].observation_count = 500;
    await assert.rejects(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(candidateAuthoredCount), RECORDS_DIRECTORY),
      (error) => error.code === 'CANDIDATE_SCHEMA_INVALID');

    const secret = 'do-not-echo-consolidation-candidate-secret';
    const malformed = await rejectionWithCode(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash,
      `{"groups": [${JSON.stringify(secret)}`, RECORDS_DIRECTORY), 'CANDIDATE_JSON_INVALID');
    assert.equal(malformed.message.includes(secret), false);
    await rejectionWithCode(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash,
      'x'.repeat(256 * 1024 + 1), RECORDS_DIRECTORY), 'LIMIT_EXCEEDED');

    const semanticPrepared = await prepareConsolidation(root, 'semantic', RECORDS_DIRECTORY);
    const wrongSemanticShape = featureCandidate('semantic', semanticPrepared);
    wrongSemanticShape.groups[0].classification = 'author_candidate';
    delete wrongSemanticShape.groups[0].semantic_kind;
    await rejectionWithCode(acceptDimensionCandidate(root, 'semantic', semanticPrepared.corpus_hash, semanticPrepared.input_hash,
      JSON.stringify(wrongSemanticShape), RECORDS_DIRECTORY), 'CANDIDATE_SCHEMA_INVALID');
  });

  it('finalizes all dimensions with derived support, promotion, semantic separation, and exhaustive coverage', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const finalJson = await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY);
    const bundle = JSON.parse(finalJson);
    const baseSchema = JSON.parse(await readFile(join(PACKAGE_DIR, 'patterns.schema.json'), 'utf8'));
    const rhetoricalSchema = JSON.parse(await readFile(join(PACKAGE_DIR, 'patterns.v0.2.schema.json'), 'utf8'));
    const semanticSchema = JSON.parse(await readFile(join(PACKAGE_DIR, 'patterns.v0.3.schema.json'), 'utf8'));
    const decisionalSchema = JSON.parse(await readFile(join(PACKAGE_DIR, 'patterns.v0.4.schema.json'), 'utf8'));
    const schema = JSON.parse(await readFile(join(PACKAGE_DIR, 'patterns.v0.6.schema.json'), 'utf8'));
    const ajv = new (await import('ajv/dist/2020.js')).default({ allErrors: true, strict: true });
    ajv.addSchema(baseSchema);
    ajv.addSchema(rhetoricalSchema);
    ajv.addSchema(semanticSchema);
    ajv.addSchema(decisionalSchema);
    assert.equal(ajv.compile(schema)(bundle), true);
    assert.equal(finalJson, JSON.stringify(bundle), 'final output is canonical JSON');

    const twoArticles = bundle.author_patterns.rhetorical_groups.find((item) => item.label === 'Two-article tendency');
    const recurrent = bundle.author_patterns.rhetorical_groups.find((item) => item.label === 'Recurring tendency');
    assert.deepEqual([twoArticles.observation_count, twoArticles.article_count, twoArticles.promotion_status], [4, 2, 'cross_article_candidate']);
    assert.deepEqual([recurrent.observation_count, recurrent.article_count, recurrent.promotion_status], [3, 3, 'recurrent_candidate']);
    assert.equal(recurrent.abstraction_kind, 'inferred_generalization');
    assert.ok(bundle.author_patterns.rhetorical_groups.some((item) => item.label === 'Editorial format' && item.pattern_scope === 'editorial_format' && item.author_relevance === 'candidate'));
    assert.ok(bundle.author_patterns.rhetorical_groups.some((item) => item.label === 'Thematic candidate' && item.author_relevance === 'unlikely'));
    assert.equal(bundle.semantic_recurrences.concepts.length, 1);
    assert.equal(bundle.semantic_recurrences.relations.length, 1);
    assert.equal(bundle.semantic_recurrences.concepts[0].dimension, 'semantic');
    assert.equal(bundle.semantic_recurrences.relations[0].dimension, 'semantic');
    assert.equal(bundle.author_patterns.patterns.some((item) => item.dimension === 'semantic'), false);
    assert.equal(bundle.author_patterns.patterns.some((item) => item.label === 'Synthetic concept'), false);
    assert.equal(bundle.author_patterns.unclustered_observations.filter((item) => item.reason === 'LOCAL_ONLY').length, 2);
    const sourceGroups = accepted.flatMap((value) => JSON.parse(value).groups);
    const finalGroups = [
      ...bundle.author_patterns.patterns,
      ...bundle.author_patterns.editorial_format,
      ...bundle.author_patterns.thematic,
      ...bundle.author_patterns.rhetorical_groups,
      ...bundle.semantic_recurrences.concepts,
      ...bundle.semantic_recurrences.relations,
    ];
    for (const finalGroup of finalGroups) {
      const sourceGroup = sourceGroups.find((item) => item.label === finalGroup.label);
      assert.ok(sourceGroup, `missing accepted source for ${finalGroup.label}`);
      assert.deepEqual(
        [finalGroup.abstraction_kind, finalGroup.rationale, finalGroup.variation_notes],
        [sourceGroup.abstraction_kind, sourceGroup.rationale, sourceGroup.variation_notes],
        `${finalGroup.label} must preserve candidate-authored interpretation`,
      );
    }

    const expectedIds = DIMENSIONS.flatMap((dimension) => prepared.get(dimension).observations.map((item) => item.observation_id)).sort();
    const finalIds = [
      ...bundle.author_patterns.patterns,
      ...bundle.author_patterns.editorial_format,
      ...bundle.author_patterns.thematic,
      ...bundle.author_patterns.rhetorical_groups,
      ...bundle.author_patterns.unclustered_observations,
      ...bundle.semantic_recurrences.concepts,
      ...bundle.semantic_recurrences.relations,
      ...bundle.semantic_recurrences.unclustered_observations,
    ].flatMap((item) => item.support ? item.support.map((entry) => entry.observation_id) : [item.observation_id]).sort();
    assert.deepEqual(finalIds, expectedIds, 'each projected observation is represented exactly once in the final bundle');
    assert.equal(new Set(finalIds).size, expectedIds.length);

    const repeated = await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY);
    assert.equal(repeated, finalJson, 'same accepted dimensions yield stable IDs and canonical final output');
  });

  it('fails closed on forged support, derived counts, duplicate/missing dimensions, and stale finalizer inputs', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const { accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const forgedSupport = accepted.map((value) => JSON.parse(value));
    forgedSupport[0].groups[0].support[0].article_id = 'A12';
    await assert.rejects(finalizeConsolidation(root, corpusHash, forgedSupport.map(JSON.stringify), RECORDS_DIRECTORY),
      (error) => error.code === 'SUPPORT_INVALID');

    const forgedCount = accepted.map((value) => JSON.parse(value));
    forgedCount[0].groups[0].article_count += 1;
    await assert.rejects(finalizeConsolidation(root, corpusHash, forgedCount.map(JSON.stringify), RECORDS_DIRECTORY),
      (error) => error.code === 'RECORD_DERIVED_INVALID');

    const duplicateDimension = [...accepted];
    duplicateDimension[1] = accepted[0];
    await assert.rejects(finalizeConsolidation(root, corpusHash, duplicateDimension, RECORDS_DIRECTORY),
      (error) => error.code === 'DIMENSION_INVALID');
    await assert.rejects(finalizeConsolidation(root, corpusHash, accepted.slice(1), RECORDS_DIRECTORY),
      (error) => error.code === 'DIMENSION_INVALID');

    const staleInput = accepted.map((value) => JSON.parse(value));
    staleInput[0].input_hash = 'f'.repeat(64);
    await assert.rejects(finalizeConsolidation(root, corpusHash, staleInput.map(JSON.stringify), RECORDS_DIRECTORY),
      (error) => error.code === 'INPUT_CHANGED');
    const staleMethod = accepted.map((value) => JSON.parse(value));
    staleMethod[0].method.instructions_hash = 'e'.repeat(64);
    await assert.rejects(finalizeConsolidation(root, corpusHash, staleMethod.map(JSON.stringify), RECORDS_DIRECTORY),
      (error) => error.code === 'INPUT_CHANGED');
    await assert.rejects(finalizeConsolidation(root, 'f'.repeat(64), accepted, RECORDS_DIRECTORY),
      (error) => error.code === 'INPUT_CHANGED');

    const instructionsPath = join(root, '.opencode/agents/author-pattern-consolidator.md');
    const oldInstructions = await readFile(instructionsPath, 'utf8');
    await writeFile(instructionsPath, `${oldInstructions}\nstale finalizer method`);
    await assert.rejects(finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY),
      (error) => error.code === 'INPUT_CHANGED');
  });

  it('rejects missing, extra, malformed, and non-allowlisted datasets', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    await assert.rejects(prepareConsolidation(root, 'rhetorical', 'docs/author-extraction-results/not-allowed'),
      (error) => error.code === 'DATASET_INVALID');

    const recordPath = join(root, RECORDS_DIRECTORY, 'A12.json');
    const record = await readFile(recordPath, 'utf8');
    await rm(recordPath);
    await assert.rejects(prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY), (error) => error.code === 'DATASET_INVALID');
    await writeFile(recordPath, '{');
    await assert.rejects(prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY), (error) => error.code === 'DATASET_INVALID');
    await writeFile(recordPath, record);
    await writeFile(join(root, RECORDS_DIRECTORY, 'A21.json'), '{}');
    await assert.rejects(prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY), (error) => error.code === 'DATASET_INVALID');
  });

  it('rejects a valid record stored under another article filename at every core stage', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: () => ['rhetorical'] });
    const cleanAccepted = [];
    let cleanCorpusHash;
    for (const dimension of DIMENSIONS) {
      const prepared = await prepareConsolidation(root, dimension, RECORDS_DIRECTORY);
      cleanCorpusHash ??= prepared.corpus_hash;
      const candidate = dimension === 'rhetorical'
        ? featureCandidate(dimension, prepared)
        : { groups: [], unclustered_observations: [] };
      cleanAccepted.push(await acceptDimensionCandidate(
        root, dimension, prepared.corpus_hash, prepared.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY,
      ));
    }
    const acceptedPrepared = await prepareConsolidation(root, 'epistemic', RECORDS_DIRECTORY);
    const a01Path = join(root, RECORDS_DIRECTORY, 'A01.json');
    const a02Path = join(root, RECORDS_DIRECTORY, 'A02.json');
    const a02RecordJson = await readFile(a02Path, 'utf8');
    const validA02 = await verifyExtractionRecord(root, a02RecordJson);
    assert.equal(validA02.record.source.article_id, 'A02');
    assert.equal(validA02.processing_eligible, true);
    await writeFile(a01Path, a02RecordJson);
    const copiedA02 = await verifyExtractionRecord(root, await readFile(a01Path, 'utf8'));
    assert.equal(copiedA02.record.source.article_id, 'A02');
    assert.equal(copiedA02.processing_eligible, true);

    async function outcome(operation, success) {
      try {
        return success(await operation());
      } catch (error) {
        return `error:${error.code ?? 'UNCODED'}`;
      }
    }

    const preparationOutcome = await outcome(
      () => prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY),
      (result) => `returned:${result.status}`,
    );

    const acceptedOutcome = await outcome(
      () => acceptDimensionCandidate(
        root, 'epistemic', acceptedPrepared.corpus_hash, acceptedPrepared.input_hash,
        JSON.stringify({ groups: [], unclustered_observations: [] }), RECORDS_DIRECTORY,
      ),
      () => 'accepted',
    );
    const finalizationOutcome = await outcome(
      () => finalizeConsolidation(root, cleanCorpusHash, cleanAccepted, RECORDS_DIRECTORY),
      () => 'finalized',
    );

    assert.deepEqual(
      [preparationOutcome, acceptedOutcome, finalizationOutcome],
      ['error:DATASET_INVALID', 'error:DATASET_INVALID', 'error:DATASET_INVALID'],
      'filename/source article IDs must form a bijection before prepare, accept, or finalize can proceed',
    );
  });

  it('assigns rhetorical IDs from membership, independently of labels, scope, relevance, or proposal order', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const prepared = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    const original = featureCandidate('rhetorical', prepared);
    const accept = async (candidate) => JSON.parse(await acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY));
    const first = await accept(original);
    assert.deepEqual(first.groups.map((group) => group.id), ['APC::R0001', 'APC::R0002', 'APC::R0003', 'APC::R0004']);
    const changed = structuredClone(original);
    changed.groups.reverse();
    changed.groups.forEach((group) => {
      group.member_observation_ids.reverse();
      group.label = `Revised ${group.label}`;
      group.pattern_scope = 'editorial_format';
      group.author_relevance = 'uncertain';
    });
    const second = await accept(changed);
    assert.deepEqual(second.groups.map(({ id, support }) => ({ id, support })), first.groups.map(({ id, support }) => ({ id, support })));
    const { accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY));
    assert.deepEqual(bundle.author_patterns.rhetorical_groups.map((group) => group.id), first.groups.map((group) => group.id));
  });

  it('requires both rhetorical axes, permits editorial candidate relevance, and rejects generated IDs or legacy classification', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const prepared = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    const original = featureCandidate('rhetorical', prepared);
    const submit = (candidate) => acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY);
    const accepted = JSON.parse(await submit(original));
    assert.ok(accepted.groups.some((group) => group.pattern_scope === 'editorial_format' && group.author_relevance === 'candidate'));
    for (const change of [
      (group) => { group.id = 'APC::R0001'; },
      (group) => { group.classification = 'author_candidate'; },
      (group) => { delete group.pattern_scope; },
      (group) => { delete group.author_relevance; },
      (group) => { group.pattern_scope = 'author_candidate'; },
      (group) => { group.author_relevance = 'confirmed'; },
    ]) {
      const candidate = structuredClone(original);
      change(candidate.groups[0]);
      await rejectionWithCode(submit(candidate), 'CANDIDATE_SCHEMA_INVALID');
    }
  });

  it('rejects missing, duplicate, and reassigned accepted rhetorical IDs rather than reassigning them during finalization', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const { accepted, corpusHash } = await acceptedFeatureDimensions(root);
    for (const change of [
      (groups) => { delete groups[0].id; },
      (groups) => { groups[1].id = groups[0].id; },
      (groups) => { [groups[0].id, groups[1].id] = [groups[1].id, groups[0].id]; },
    ]) {
      const changed = accepted.map((json) => JSON.parse(json));
      change(changed[0].groups);
      await assert.rejects(finalizeConsolidation(root, corpusHash, changed.map(JSON.stringify), RECORDS_DIRECTORY),
        (error) => ['DIMENSION_INVALID', 'RECORD_DERIVED_INVALID'].includes(error.code));
    }
  });

  it('binds current preparation to its self-contained twenty-source schema', async (t) => {
    const root = await makeTrackedSyntheticRepository(t);
    const prepared = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    const schemaPath = join(root, '_scripts/author-extraction/patterns.v0.6.schema.json');
    await writeFile(schemaPath, ` ${await readFile(schemaPath, 'utf8')}`);
    const revised = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.notEqual(revised.method.schema_hash, prepared.method.schema_hash);
    assert.notEqual(revised.input_hash, prepared.input_hash);
    await rejectionWithCode(acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash,
      JSON.stringify({ groups: [], unclustered_observations: prepared.observations.map(({ observation_id }) => ({ observation_id, reason: 'Synthetic unclustered.' })) }), RECORDS_DIRECTORY), 'INPUT_CHANGED');
  });

  it('combines revised rhetorical data with untouched historical non-rhetorical dimensions using their exact contract snapshot', async (t) => {
    const recordsDirectory = TWELVE_RECORDS_DIRECTORY;
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions, recordsDirectory });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root, recordsDirectory);
    const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value !== null && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
    const canonical = (value) => JSON.stringify(canonicalize(value));
    const legacyMethod = {
      consolidation_version: 'consolidate/1', projection_version: 'observation-projection/1', instructions_version: 'author-pattern-consolidator/0.1',
      schema_hash: sha256(await readFile(join(root, '_scripts/author-extraction/patterns.schema.json'))),
      instructions_hash: sha256(await readFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.1.md'))),
    };
    const mixed = accepted.map((json, index) => {
      if (index === 0) return json;
      const record = JSON.parse(json);
      record.schema_version = 'author-pattern-dimension/0.1';
      if (['epistemic', 'semantic', 'decisional'].includes(record.dimension)) record.groups.forEach((group) => { delete group.id; });
      record.method = legacyMethod;
      record.input_hash = sha256(Buffer.from(canonical({ corpus_hash: corpusHash, dimension: record.dimension, observations: prepared.get(record.dimension).observations, method: legacyMethod })));
      return canonical(record);
    });
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, mixed, recordsDirectory));
    assert.equal(bundle.dimension_methods.rhetorical.instructions_version, 'author-pattern-consolidator/0.6');
    for (const dimension of ['epistemic', 'semantic', 'decisional']) assert.deepEqual(bundle.dimension_methods[dimension], legacyMethod);
    assert.deepEqual(bundle.author_patterns.rhetorical_groups.map((group) => group.id), JSON.parse(mixed[0]).groups.map((group) => group.id));
    const stale = mixed.map((json) => JSON.parse(json));
    stale[1].method = { ...legacyMethod, instructions_hash: 'e'.repeat(64) };
    await rejectionWithCode(finalizeConsolidation(root, corpusHash, stale.map(JSON.stringify), recordsDirectory), 'INPUT_CHANGED');
  });

  it('assigns independent concept/relation IDs from membership and preserves them in finalization', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const prepared = await prepareConsolidation(root, 'semantic', RECORDS_DIRECTORY);
    const proposal = candidatePartition(prepared, [
      { dimension: 'semantic', kind: 'relation', label: 'Relation one', articles: ['A03', 'A04'] },
      { dimension: 'semantic', kind: 'concept', label: 'Concept two', articles: ['A05', 'A06'] },
      { dimension: 'semantic', kind: 'relation', label: 'Relation two', articles: ['A07', 'A08'] },
      { dimension: 'semantic', kind: 'concept', label: 'Concept one', articles: ['A01', 'A02'] },
    ]);
    const accept = async (candidate) => JSON.parse(await acceptDimensionCandidate(root, 'semantic', prepared.corpus_hash, prepared.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY));
    const first = await accept(proposal);
    assert.deepEqual(first.groups.map((group) => group.id), ['SPC::C0001', 'SPC::C0002', 'SPC::R0001', 'SPC::R0002']);
    const changed = structuredClone(proposal);
    changed.groups.reverse();
    changed.groups.forEach((group) => { group.label = `Revised å ${group.label}`; group.member_observation_ids.reverse(); });
    const second = await accept(changed);
    assert.deepEqual(second.groups.map(({ id, support }) => ({ id, support })), first.groups.map(({ id, support }) => ({ id, support })));
    const { accepted, corpusHash } = await acceptedFeatureDimensions(root);
    accepted[2] = JSON.stringify(first);
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY));
    assert.deepEqual(bundle.semantic_recurrences.concepts.map((group) => group.id), ['SPC::C0001', 'SPC::C0002']);
    assert.deepEqual(bundle.semantic_recurrences.relations.map((group) => group.id), ['SPC::R0001', 'SPC::R0002']);
    const duplicated = JSON.parse(JSON.stringify(first));
    duplicated.groups[1].id = duplicated.groups[0].id;
    const duplicateIds = [...accepted];
    duplicateIds[2] = JSON.stringify(duplicated);
    await rejectionWithCode(finalizeConsolidation(root, corpusHash, duplicateIds, RECORDS_DIRECTORY), 'RECORD_DERIVED_INVALID');
    const relationOnly = structuredClone(proposal);
    relationOnly.groups = relationOnly.groups.filter((group) => group.semantic_kind === 'relation');
    const grouped = new Set(relationOnly.groups.flatMap((group) => group.member_observation_ids));
    relationOnly.unclustered_observations = prepared.observations.filter((observation) => !grouped.has(observation.observation_id))
      .map(({ observation_id }) => ({ observation_id, reason: 'Synthetic unclustered concept support.' }));
    assert.deepEqual((await accept(relationOnly)).groups.map((group) => group.id), ['SPC::R0001', 'SPC::R0002']);
  });

  it('rejects model-generated semantic IDs and forged accepted prefixes, counters, or missing IDs', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const projection = prepared.get('semantic');
    const proposal = featureCandidate('semantic', projection);
    proposal.groups[0].id = 'SPC::C0001';
    await rejectionWithCode(acceptDimensionCandidate(root, 'semantic', projection.corpus_hash, projection.input_hash, JSON.stringify(proposal), RECORDS_DIRECTORY), 'CANDIDATE_SCHEMA_INVALID');
    for (const change of [
      (groups) => { delete groups[0].id; },
      (groups) => { groups[0].id = 'SPC::R0001'; },
      (groups) => { groups[0].id = 'SPC::C0002'; },
      (groups) => { groups[0].id = 'SRC::S0001'; },
    ]) {
      const changed = accepted.map((json) => JSON.parse(json));
      change(changed[2].groups);
      await assert.rejects(finalizeConsolidation(root, corpusHash, changed.map(JSON.stringify), RECORDS_DIRECTORY),
        (error) => ['DIMENSION_INVALID', 'RECORD_DERIVED_INVALID'].includes(error.code));
    }
  });

  it('does not renumber retained semantic groups when a preceding local-only group is filtered', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, {
      dimensionsForArticle: (articleId) => [...featureDimensions(articleId), ...(articleId === 'A01' ? ['semantic'] : [])],
    });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const projection = prepared.get('semantic');
    const proposal = candidatePartition(projection, [
      { dimension: 'semantic', kind: 'concept', label: 'Local-only concept', articles: ['A01'] },
      { dimension: 'semantic', kind: 'concept', label: 'Cross-article concept', articles: ['A02', 'A03'] },
      { dimension: 'semantic', kind: 'relation', label: 'Cross-article relation', articles: ['A04', 'A05'] },
    ]);
    accepted[2] = await acceptDimensionCandidate(root, 'semantic', projection.corpus_hash, projection.input_hash, JSON.stringify(proposal), RECORDS_DIRECTORY);
    assert.equal(JSON.parse(accepted[2]).groups[0].id, 'SPC::C0001');
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY));
    assert.deepEqual(bundle.semantic_recurrences.concepts.map((group) => group.id), ['SPC::C0002']);
    assert.deepEqual(bundle.semantic_recurrences.relations.map((group) => group.id), ['SPC::R0001']);
    assert.equal(bundle.semantic_recurrences.unclustered_observations.filter((item) => item.reason === 'LOCAL_ONLY').length, 2);
  });

  it('combines current semantic IDs with retained rhetorical v0.2 and other v0.1 dimensions without relabelling them', async (t) => {
    const recordsDirectory = TWELVE_RECORDS_DIRECTORY;
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions, recordsDirectory });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root, recordsDirectory);
    const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value !== null && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
    const canonical = (value) => JSON.stringify(canonicalize(value));
    const baseHash = sha256(await readFile(join(root, '_scripts/author-extraction/patterns.schema.json')));
    const rhetoricalHash = sha256(await readFile(join(root, '_scripts/author-extraction/patterns.v0.2.schema.json')));
    const instructionHashes = Object.fromEntries(await Promise.all(['0.1', '0.2'].map(async (version) => [version,
      sha256(await readFile(join(root, `_scripts/author-extraction/author-pattern-consolidator.v${version}.md`))),
    ])));
    const mixed = accepted.map((json, index) => {
      if (index === 2) return json;
      const record = JSON.parse(json), version = index === 0 ? '0.2' : '0.1';
      record.schema_version = `author-pattern-dimension/${version}`;
      if (['epistemic', 'decisional'].includes(record.dimension)) record.groups.forEach((group) => { delete group.id; });
      record.method = {
        consolidation_version: index === 0 ? 'consolidate/2' : 'consolidate/1', projection_version: 'observation-projection/1',
        instructions_version: `author-pattern-consolidator/${version}`,
        schema_hash: index === 0 ? sha256(Buffer.from(canonical({ base_schema_hash: baseHash, extension_schema_hash: rhetoricalHash }))) : baseHash,
        instructions_hash: instructionHashes[version],
      };
      record.input_hash = sha256(Buffer.from(canonical({ corpus_hash: corpusHash, dimension: record.dimension, observations: prepared.get(record.dimension).observations, method: record.method })));
      return canonical(record);
    });
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, mixed, recordsDirectory));
    assert.equal(bundle.dimension_methods.rhetorical.instructions_version, 'author-pattern-consolidator/0.2');
    assert.equal(bundle.dimension_methods.semantic.instructions_version, 'author-pattern-consolidator/0.6');
    assert.equal(bundle.dimension_methods.epistemic.instructions_version, 'author-pattern-consolidator/0.1');
    assert.deepEqual(bundle.author_patterns.rhetorical_groups.map((group) => group.id), JSON.parse(mixed[0]).groups.map((group) => group.id));
    assert.equal(bundle.semantic_recurrences.concepts[0].id, 'SPC::C0001');
    assert.equal(bundle.semantic_recurrences.relations[0].id, 'SPC::R0001');
    await writeFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.2.md'), '# Changed frozen instructions\n');
    await rejectionWithCode(finalizeConsolidation(root, corpusHash, mixed, recordsDirectory), 'INPUT_CHANGED');
  });

  it('binds preparation to the semantic schema bytes and rejects a stale semantic candidate', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const prepared = await prepareConsolidation(root, 'semantic', RECORDS_DIRECTORY);
    const schemaPath = join(root, '_scripts/author-extraction/patterns.v0.6.schema.json');
    await writeFile(schemaPath, ` ${await readFile(schemaPath, 'utf8')}`);
    const changed = await prepareConsolidation(root, 'semantic', RECORDS_DIRECTORY);
    assert.notEqual(changed.method.schema_hash, prepared.method.schema_hash);
    assert.notEqual(changed.input_hash, prepared.input_hash);
    await rejectionWithCode(acceptDimensionCandidate(root, 'semantic', prepared.corpus_hash, prepared.input_hash,
      JSON.stringify(featureCandidate('semantic', prepared)), RECORDS_DIRECTORY), 'INPUT_CHANGED');
  });

  it('derives classification-coded decisional IDs with independent counters and preserves existing final routing', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const projection = prepared.get('decisional');
    const proposal = candidatePartition(projection, [
      { dimension: 'decisional', kind: 'thematic', label: 'Thematic two', articles: ['A11', 'A12'] },
      { dimension: 'decisional', kind: 'author_candidate', label: 'Author two', articles: ['A03', 'A04'] },
      { dimension: 'decisional', kind: 'editorial_format', label: 'Editorial one', articles: ['A05', 'A06'] },
      { dimension: 'decisional', kind: 'thematic', label: 'Thematic one', articles: ['A09', 'A10'] },
      { dimension: 'decisional', kind: 'author_candidate', label: 'Author one', articles: ['A01', 'A02'] },
      { dimension: 'decisional', kind: 'editorial_format', label: 'Editorial two', articles: ['A07', 'A08'] },
    ]);
    const accept = (candidate) => acceptDimensionCandidate(root, 'decisional', projection.corpus_hash, projection.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY);
    accepted[3] = await accept(proposal);
    const first = JSON.parse(accepted[3]);
    assert.deepEqual(first.groups.map((group) => group.id), ['DPC:A0001', 'DPC:A0002', 'DPC:E0001', 'DPC:E0002', 'DPC:T0001', 'DPC:T0002']);
    const changed = structuredClone(proposal);
    changed.groups.reverse();
    changed.groups.forEach((group) => { group.label = `Revised ${group.label}`; group.member_observation_ids.reverse(); });
    const repeated = JSON.parse(await accept(changed));
    assert.deepEqual(repeated.groups.map(({ id, support }) => ({ id, support })), first.groups.map(({ id, support }) => ({ id, support })));
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY));
    assert.deepEqual(bundle.author_patterns.patterns.filter((group) => group.dimension === 'decisional').map((group) => group.id), ['DPC:A0001', 'DPC:A0002']);
    assert.deepEqual(bundle.author_patterns.editorial_format.map((group) => group.id), ['DPC:E0001', 'DPC:E0002']);
    assert.deepEqual(bundle.author_patterns.thematic.map((group) => group.id), ['DPC:T0001', 'DPC:T0002']);
    const generated = structuredClone(proposal);
    generated.groups[0].id = 'DPC:T0001';
    await rejectionWithCode(accept(generated), 'CANDIDATE_SCHEMA_INVALID');
    for (const id of ['DPC::A0001', 'DPC:E0001', 'DPC:A0009', 'APC::D0001']) {
      const forged = accepted.map((json) => JSON.parse(json));
      forged[3].groups[0].id = id;
      await assert.rejects(finalizeConsolidation(root, corpusHash, forged.map(JSON.stringify), RECORDS_DIRECTORY),
        (error) => ['DIMENSION_INVALID', 'RECORD_DERIVED_INVALID'].includes(error.code));
    }
    const duplicated = accepted.map((json) => JSON.parse(json));
    duplicated[3].groups[1].id = duplicated[3].groups[0].id;
    await rejectionWithCode(finalizeConsolidation(root, corpusHash, duplicated.map(JSON.stringify), RECORDS_DIRECTORY), 'RECORD_DERIVED_INVALID');
  });

  it('supports current decisional IDs alongside retained v0.3 semantic records and rejects a stale decisional contract', async (t) => {
    const recordsDirectory = TWELVE_RECORDS_DIRECTORY;
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions, recordsDirectory });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root, recordsDirectory);
    const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value !== null && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
    const canonical = (value) => JSON.stringify(canonicalize(value));
    const semantic = JSON.parse(accepted[2]);
    semantic.schema_version = 'author-pattern-dimension/0.3';
    semantic.method = {
      consolidation_version: 'consolidate/3', projection_version: 'observation-projection/1', instructions_version: 'author-pattern-consolidator/0.3',
      schema_hash: sha256(Buffer.from(canonical({
        base_schema_hash: sha256(await readFile(join(root, '_scripts/author-extraction/patterns.schema.json'))),
        rhetorical_schema_hash: sha256(await readFile(join(root, '_scripts/author-extraction/patterns.v0.2.schema.json'))),
        semantic_schema_hash: sha256(await readFile(join(root, '_scripts/author-extraction/patterns.v0.3.schema.json'))),
      }))),
      instructions_hash: sha256(await readFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.3.md'))),
    };
    semantic.input_hash = sha256(Buffer.from(canonical({ corpus_hash: corpusHash, dimension: 'semantic', observations: prepared.get('semantic').observations, method: semantic.method })));
    const mixed = [...accepted];
    mixed[2] = canonical(semantic);
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, mixed, recordsDirectory));
    assert.equal(bundle.dimension_methods.semantic.instructions_version, 'author-pattern-consolidator/0.3');
    assert.equal(bundle.dimension_methods.decisional.instructions_version, 'author-pattern-consolidator/0.6');
    assert.equal(bundle.semantic_recurrences.concepts[0].id, 'SPC::C0001');
    const projection = prepared.get('decisional');
    const schemaPath = join(root, '_scripts/author-extraction/patterns.v0.6.schema.json');
    await writeFile(schemaPath, ` ${await readFile(schemaPath, 'utf8')}`);
    const revised = await prepareConsolidation(root, 'decisional', recordsDirectory);
    assert.notEqual(revised.input_hash, projection.input_hash);
    await rejectionWithCode(acceptDimensionCandidate(root, 'decisional', corpusHash, projection.input_hash,
      JSON.stringify(featureCandidate('decisional', projection)), recordsDirectory), 'INPUT_CHANGED');
  });

  it('derives epistemic subtype IDs with independent counters and preserves them in their final buckets', async (t) => {
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root);
    const projection = prepared.get('epistemic');
    const specs = ['author_candidate', 'editorial_format', 'thematic'].flatMap((kind, kindIndex) => [0, 1].map((index) => ({
      dimension: 'epistemic', kind, label: `${kind} ${index + 1}`,
      articles: [kindIndex * 4 + index * 2 + 1, kindIndex * 4 + index * 2 + 2].map((n) => `A${String(n).padStart(2, '0')}`),
    })));
    const proposal = candidatePartition(projection, specs);
    const accept = (candidate) => acceptDimensionCandidate(root, 'epistemic', projection.corpus_hash, projection.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY);
    accepted[1] = await accept(proposal);
    const first = JSON.parse(accepted[1]);
    assert.deepEqual(first.groups.map((group) => group.id), ['EPC:A0001', 'EPC:A0002', 'EPC:E0001', 'EPC:E0002', 'EPC:T0001', 'EPC:T0002']);
    const changed = structuredClone(proposal);
    changed.groups.reverse();
    changed.groups.forEach((group) => { group.label = `Revised ${group.label}`; group.member_observation_ids.reverse(); });
    assert.deepEqual(JSON.parse(await accept(changed)).groups.map(({ id, support }) => ({ id, support })), first.groups.map(({ id, support }) => ({ id, support })));
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, accepted, RECORDS_DIRECTORY));
    for (const [bucket, code] of [['patterns', 'A'], ['editorial_format', 'E'], ['thematic', 'T']]) {
      assert.deepEqual(bundle.author_patterns[bucket].filter((group) => group.dimension === 'epistemic').map((group) => group.id), [`EPC:${code}0001`, `EPC:${code}0002`]);
    }
    proposal.groups[0].id = 'EPC:A0001';
    await rejectionWithCode(accept(proposal), 'CANDIDATE_SCHEMA_INVALID');
    for (const id of ['EPC::A0001', 'EPC:E0001', 'EPC:A0009', 'DPC:A0001']) {
      const forged = accepted.map((json) => JSON.parse(json));
      forged[1].groups[0].id = id;
      await assert.rejects(finalizeConsolidation(root, corpusHash, forged.map(JSON.stringify), RECORDS_DIRECTORY),
        (error) => ['DIMENSION_INVALID', 'RECORD_DERIVED_INVALID'].includes(error.code));
    }
    const duplicated = accepted.map((json) => JSON.parse(json));
    duplicated[1].groups[1].id = duplicated[1].groups[0].id;
    await rejectionWithCode(finalizeConsolidation(root, corpusHash, duplicated.map(JSON.stringify), RECORDS_DIRECTORY), 'RECORD_DERIVED_INVALID');
  });

  it('combines new epistemic IDs with retained v0.4 decisional provenance and rejects stale epistemic schema bytes', async (t) => {
    const recordsDirectory = TWELVE_RECORDS_DIRECTORY;
    const root = await makeTrackedSyntheticRepository(t, { dimensionsForArticle: featureDimensions, recordsDirectory });
    const { prepared, accepted, corpusHash } = await acceptedFeatureDimensions(root, recordsDirectory);
    const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value !== null && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
    const canonical = (value) => JSON.stringify(canonicalize(value));
    const decisional = JSON.parse(accepted[3]);
    decisional.schema_version = 'author-pattern-dimension/0.4';
    const names = ['patterns.schema.json', 'patterns.v0.2.schema.json', 'patterns.v0.3.schema.json', 'patterns.v0.4.schema.json'];
    const keys = ['base_schema_hash', 'rhetorical_schema_hash', 'semantic_schema_hash', 'decisional_schema_hash'];
    const hashes = Object.fromEntries(await Promise.all(names.map(async (name, index) => [keys[index], sha256(await readFile(join(root, '_scripts/author-extraction', name)))])));
    decisional.method = {
      consolidation_version: 'consolidate/4', projection_version: 'observation-projection/1', instructions_version: 'author-pattern-consolidator/0.4',
      schema_hash: sha256(Buffer.from(canonical(hashes))),
      instructions_hash: sha256(await readFile(join(root, '_scripts/author-extraction/author-pattern-consolidator.v0.4.md'))),
    };
    decisional.input_hash = sha256(Buffer.from(canonical({ corpus_hash: corpusHash, dimension: 'decisional', observations: prepared.get('decisional').observations, method: decisional.method })));
    const mixed = [...accepted];
    mixed[3] = canonical(decisional);
    const bundle = JSON.parse(await finalizeConsolidation(root, corpusHash, mixed, recordsDirectory));
    assert.equal(bundle.dimension_methods.decisional.instructions_version, 'author-pattern-consolidator/0.4');
    assert.equal(bundle.dimension_methods.epistemic.instructions_version, 'author-pattern-consolidator/0.6');
    assert.equal(bundle.author_patterns.patterns.find((group) => group.dimension === 'epistemic').id, 'EPC:A0001');
    const projection = prepared.get('epistemic');
    const schemaPath = join(root, '_scripts/author-extraction/patterns.v0.6.schema.json');
    await writeFile(schemaPath, ` ${await readFile(schemaPath, 'utf8')}`);
    assert.notEqual((await prepareConsolidation(root, 'epistemic', recordsDirectory)).input_hash, projection.input_hash);
    await rejectionWithCode(acceptDimensionCandidate(root, 'epistemic', corpusHash, projection.input_hash,
      JSON.stringify(featureCandidate('epistemic', projection)), recordsDirectory), 'INPUT_CHANGED');
  });

  it('uses all twenty articles in one support group and rejects mixing old records into the expanded dataset', async (t) => {
    const root = await makeTrackedSyntheticRepository(t);
    const prepared = await prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY);
    assert.equal(prepared.observations.length, 20);
    assert.equal(prepared.observations.at(-1).article_id, 'A20');
    const candidate = { groups: [candidateGroup('Twenty-source fixture', prepared.observations.map((item) => item.observation_id))], unclustered_observations: [] };
    const accepted = JSON.parse(await acceptDimensionCandidate(root, 'rhetorical', prepared.corpus_hash, prepared.input_hash, JSON.stringify(candidate), RECORDS_DIRECTORY));
    assert.equal(accepted.groups[0].article_count, 20);
    assert.equal(accepted.groups[0].observation_count, 20);
    const historicalRoot = await makeTrackedSyntheticRepository(t, { recordsDirectory: TWELVE_RECORDS_DIRECTORY });
    const historical = await readFile(join(historicalRoot, TWELVE_RECORDS_DIRECTORY, 'A01.json'), 'utf8');
    assert.equal((await verifyExtractionRecord(root, historical)).processing_eligible, true);
    await writeFile(join(root, RECORDS_DIRECTORY, 'A01.json'), historical);
    await rejectionWithCode(prepareConsolidation(root, 'rhetorical', RECORDS_DIRECTORY), 'DATASET_INVALID');
  });
});
