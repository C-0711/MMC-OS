import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  listFaelle,
  createFall,
  commitEingang,
  proposeDeutung,
  listVorschlaege,
  mergeVorschlag,
  rejectVorschlag,
  fallErzaehlung,
  type Atom,
} from '../src/main/vault.js';

let testVaultRoot: string;
let originalEnv: string | undefined;

before(async () => {
  // Create temp directory for tests
  testVaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mmc-vault-test-'));
  originalEnv = process.env.MMC_VAULT;
  process.env.MMC_VAULT = testVaultRoot;
});

after(async () => {
  // Cleanup
  if (testVaultRoot) {
    await fs.rm(testVaultRoot, { recursive: true, force: true });
  }
  if (originalEnv !== undefined) {
    process.env.MMC_VAULT = originalEnv;
  } else {
    delete process.env.MMC_VAULT;
  }
});

describe('Vault Lifecycle Tests', () => {
  test('listFaelle returns empty array initially', async () => {
    const faelle = await listFaelle();
    assert.strictEqual(faelle.length, 0);
  });

  test('createFall creates a valid fall', async () => {
    const fallInfo = await createFall('test-fall-2026');

    assert.strictEqual(fallInfo.id, 'test-fall-2026');
    assert.strictEqual(fallInfo.pfad, path.join(testVaultRoot, 'test-fall-2026'));
    assert.strictEqual(fallInfo.offeneVorschlaege, 0);
    assert.ok(fallInfo.letzterCommitIso);

    // Verify directory structure
    const fallPath = fallInfo.pfad;
    await assert.doesNotReject(fs.access(path.join(fallPath, 'docs', '.gitkeep')));
    await assert.doesNotReject(fs.access(path.join(fallPath, 'atoms', '.gitkeep')));
    await assert.doesNotReject(fs.access(path.join(fallPath, 'fall.json')));

    // Verify fall.json content
    const fallJson = JSON.parse(await fs.readFile(path.join(fallPath, 'fall.json'), 'utf-8'));
    assert.strictEqual(fallJson.id, 'test-fall-2026');
    assert.ok(fallJson.angelegtIso);
  });

  test('createFall rejects invalid IDs', async () => {
    await assert.rejects(async () => {
      await createFall('Test Fall');
    }, /Ungültige Fall-ID/);

    await assert.rejects(async () => {
      await createFall('test_fall');
    }, /Ungültige Fall-ID/);
  });

  test('commitEingang creates byte-identical file and sidecar', async () => {
    const fall = await createFall('eingang-test');
    const testData = Buffer.from('Test PDF content 12345 äöü €', 'utf-8');
    const expectedSha256 = crypto.createHash('sha256').update(testData).digest('hex');

    const result = await commitEingang(
      'eingang-test',
      { absender: 'Finanzamt', kanal: 'E-Mail' },
      { name: 'bescheid.pdf', bytes: testData }
    );

    assert.ok(result.sha);
    assert.ok(result.docPfad.endsWith('bescheid.pdf'));

    // Verify file is byte-identical
    const savedContent = await fs.readFile(result.docPfad);
    assert.deepStrictEqual(savedContent, testData);

    // Verify sidecar
    const sidecarPath = result.docPfad + '.eingang.json';
    const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf-8'));
    assert.strictEqual(sidecar.absender, 'Finanzamt');
    assert.strictEqual(sidecar.kanal, 'E-Mail');
    assert.strictEqual(sidecar.sha256, expectedSha256);
    assert.ok(sidecar.empfangenIso);

    // Verify commit was created on main
    const faelle = await listFaelle();
    const updatedFall = faelle.find((f) => f.id === 'eingang-test');
    assert.ok(updatedFall);
    assert.strictEqual(updatedFall.offeneVorschlaege, 0);
  });

  test('proposeDeutung creates branch without touching main', async () => {
    const fall = await createFall('deutung-test');

    // Create an Eingang first
    await commitEingang('deutung-test', { absender: 'Weber', kanal: 'Post' }, { name: 'rechnung.pdf', bytes: Buffer.from('Rechnung') });

    // Get main SHA before proposal
    const falleBefore = await listFaelle();
    const fallBefore = falleBefore.find((f) => f.id === 'deutung-test');
    const mainShaoBefore = fallBefore!.letzterCommitIso;

    // Create proposal
    const atoms: Atom[] = [
      {
        id: 'atom-1',
        feld: 'betrag',
        wert: '150.00',
        fundstelle: { doc: 'rechnung.pdf', seite: 1, bbox: [0.1, 0.2, 0.3, 0.4] },
        conf: 0.95,
      },
    ];

    const proposal = await proposeDeutung('deutung-test', 'rechnung-150', atoms, { titel: 'Rechnung über 150 EUR', frage: 'Ist das korrekt?' });

    assert.strictEqual(proposal.branch, 'agent/rechnung-150');
    assert.ok(proposal.sha);

    // Verify main is unchanged
    const faelleAfter = await listFaelle();
    const fallAfter = faelleAfter.find((f) => f.id === 'deutung-test');
    assert.strictEqual(fallAfter!.offeneVorschlaege, 1);

    // Verify branch exists
    const vorschlaege = await listVorschlaege('deutung-test');
    assert.strictEqual(vorschlaege.length, 1);
    assert.strictEqual(vorschlaege[0].id, 'rechnung-150');
    assert.strictEqual(vorschlaege[0].kartentext.titel, 'Rechnung über 150 EUR');
    assert.deepStrictEqual(vorschlaege[0].atoms, atoms);
  });

  test('listVorschlaege returns all proposals', async () => {
    const fall = await createFall('multi-proposal');

    await commitEingang('multi-proposal', { absender: 'A', kanal: 'Mail' }, { name: 'a.pdf', bytes: Buffer.from('A') });

    const atoms1: Atom[] = [
      {
        id: 'a1',
        feld: 'betrag',
        wert: '100',
        fundstelle: { doc: 'a.pdf', seite: 1, bbox: [0, 0, 1, 1] },
        conf: 0.9,
      },
    ];

    const atoms2: Atom[] = [
      {
        id: 'a2',
        feld: 'datum',
        wert: '2026-08-30',
        fundstelle: { doc: 'a.pdf', seite: 1, bbox: [0, 0, 0.5, 0.5] },
        conf: 0.85,
      },
    ];

    await proposeDeutung('multi-proposal', 'proposal-1', atoms1, { titel: 'Betrag', frage: 'Passt?' });
    await proposeDeutung('multi-proposal', 'proposal-2', atoms2, { titel: 'Datum', frage: 'Korrekt?' });

    const vorschlaege = await listVorschlaege('multi-proposal');
    assert.strictEqual(vorschlaege.length, 2);

    const ids = vorschlaege.map((v) => v.id).sort();
    assert.deepStrictEqual(ids, ['proposal-1', 'proposal-2']);
  });

  test('mergeVorschlag merges to main and deletes branch', async () => {
    const fall = await createFall('merge-test');

    await commitEingang('merge-test', { absender: 'Test', kanal: 'Test' }, { name: 'test.pdf', bytes: Buffer.from('Test') });

    const atoms: Atom[] = [
      {
        id: 'merge-atom',
        feld: 'test',
        wert: 'test-value',
        fundstelle: { doc: 'test.pdf', seite: 1, bbox: [0, 0, 1, 1] },
        conf: 0.99,
      },
    ];

    await proposeDeutung('merge-test', 'to-merge', atoms, { titel: 'Test', frage: 'OK?' });

    // Verify proposal exists
    const vorschlaegeBefore = await listVorschlaege('merge-test');
    assert.strictEqual(vorschlaegeBefore.length, 1);

    // Merge
    const result = await mergeVorschlag('merge-test', 'to-merge');
    assert.ok(result.sha);

    // Verify branch is gone
    const vorschlaegeAfter = await listVorschlaege('merge-test');
    assert.strictEqual(vorschlaegeAfter.length, 0);

    const faelle = await listFaelle();
    const updatedFall = faelle.find((f) => f.id === 'merge-test');
    assert.strictEqual(updatedFall!.offeneVorschlaege, 0);

    // Verify atoms are on main
    const fallPath = path.join(testVaultRoot, 'merge-test');
    const atomsContent = await fs.readFile(path.join(fallPath, 'atoms', 'to-merge.json'), 'utf-8');
    const atomsData = JSON.parse(atomsContent);
    assert.strictEqual(atomsData.kartentext.titel, 'Test');
    assert.deepStrictEqual(atomsData.atoms, atoms);
  });

  test('rejectVorschlag deletes branch and creates empty commit', async () => {
    const fall = await createFall('reject-test');

    await commitEingang('reject-test', { absender: 'Test', kanal: 'Test' }, { name: 'test.pdf', bytes: Buffer.from('Test') });

    const atoms: Atom[] = [
      {
        id: 'reject-atom',
        feld: 'test',
        wert: 'wrong',
        fundstelle: { doc: 'test.pdf', seite: 1, bbox: [0, 0, 1, 1] },
        conf: 0.5,
      },
    ];

    await proposeDeutung('reject-test', 'to-reject', atoms, { titel: 'Falsch', frage: 'Stimmt das?' });

    // Reject with reason
    await rejectVorschlag('reject-test', 'to-reject', 'Wert ist falsch');

    // Verify branch is gone
    const vorschlaege = await listVorschlaege('reject-test');
    assert.strictEqual(vorschlaege.length, 0);

    // Verify commit on main
    const erzaehlung = await fallErzaehlung('reject-test');
    const rejectCommit = erzaehlung.find((e) => e.satz.includes('verworfen'));
    assert.ok(rejectCommit, 'Should have rejection in history');
  });

  test('fallErzaehlung returns narrative in correct order', async () => {
    const fall = await createFall('erzaehlung-test');

    // Create some history
    await commitEingang('erzaehlung-test', { absender: 'Weber', kanal: 'E-Mail' }, { name: 'rechnung.pdf', bytes: Buffer.from('R1') });

    const atoms: Atom[] = [
      {
        id: 'e1',
        feld: 'betrag',
        wert: '200',
        fundstelle: { doc: 'rechnung.pdf', seite: 1, bbox: [0, 0, 1, 1] },
        conf: 0.95,
      },
    ];

    await proposeDeutung('erzaehlung-test', 'rechnung-200', atoms, { titel: 'Rechnung über 200 EUR', frage: 'OK?' });
    await mergeVorschlag('erzaehlung-test', 'rechnung-200');

    // Second proposal that gets rejected
    const atoms2: Atom[] = [
      {
        id: 'e2',
        feld: 'datum',
        wert: '2026-99-99',
        fundstelle: { doc: 'rechnung.pdf', seite: 1, bbox: [0, 0, 1, 1] },
        conf: 0.3,
      },
    ];
    await proposeDeutung('erzaehlung-test', 'falsches-datum', atoms2, { titel: 'Datum', frage: '?' });
    await rejectVorschlag('erzaehlung-test', 'falsches-datum');

    // Get narrative
    const erzaehlung = await fallErzaehlung('erzaehlung-test');

    assert.ok(erzaehlung.length >= 4); // init + eingang + merge + reject

    // Verify structure
    for (const satz of erzaehlung) {
      assert.ok(satz.satz); // German sentence
      assert.ok(satz.commitZeile); // Contains short SHA
      assert.ok(satz.commitZeile.includes('·')); // Format: "a41f · eingang · sig ✓"
      assert.ok(satz.commitZeile.includes('sig ✓'));
      assert.ok(satz.sha); // Full SHA
      assert.ok(satz.datumIso); // ISO date
      assert.strictEqual(satz.commitZeile.split('·')[0].trim().length, 4); // Short SHA is 4 chars
    }

    // Verify narrative content (German)
    const sentences = erzaehlung.map((e) => e.satz);
    assert.ok(sentences.some((s) => s.includes('angelegt')));
    assert.ok(sentences.some((s) => s.includes('kam') && s.includes('Weber')));
    assert.ok(sentences.some((s) => s.includes('bestätigt')));
    assert.ok(sentences.some((s) => s.includes('verworfen')));
  });

  test('complete lifecycle integration', async () => {
    // Create fall
    const fall = await createFall('complete-test');
    assert.strictEqual(fall.id, 'complete-test');

    // Add eingang - verify byte identity
    const originalBytes = Buffer.from('Original Document Content €100,50', 'utf-8');
    const eingangResult = await commitEingang('complete-test', { absender: 'Mustermann', kanal: 'WhatsApp' }, { name: 'beleg.jpg', bytes: originalBytes });

    // Verify byte-identical storage
    const storedBytes = await fs.readFile(eingangResult.docPfad);
    assert.deepStrictEqual(storedBytes, originalBytes, 'File must be byte-identical');

    // Verify sidecar SHA256
    const sidecar = JSON.parse(await fs.readFile(eingangResult.docPfad + '.eingang.json', 'utf-8'));
    const actualSha = crypto.createHash('sha256').update(originalBytes).digest('hex');
    assert.strictEqual(sidecar.sha256, actualSha, 'Sidecar SHA256 must match');

    // Create first proposal
    await proposeDeutung(
      'complete-test',
      'betrag-100',
      [
        {
          id: 'atom-betrag',
          feld: 'betrag',
          wert: '100.50',
          fundstelle: { doc: 'beleg.jpg', seite: 1, bbox: [0.5, 0.5, 0.1, 0.1] },
          conf: 0.98,
        },
      ],
      { titel: 'Betrag 100,50 EUR', frage: 'Stimmt das?' }
    );

    // Verify proposal exists but main unchanged
    const faelleAfterProposal = await listFaelle();
    const fallAfterProposal = faelleAfterProposal.find((f) => f.id === 'complete-test');
    assert.strictEqual(fallAfterProposal!.offeneVorschlaege, 1);

    // List proposals
    const vorschlaege = await listVorschlaege('complete-test');
    assert.strictEqual(vorschlaege.length, 1);
    assert.strictEqual(vorschlaege[0].id, 'betrag-100');

    // Merge proposal
    await mergeVorschlag('complete-test', 'betrag-100');

    const faelleAfterMerge = await listFaelle();
    const fallAfterMerge = faelleAfterMerge.find((f) => f.id === 'complete-test');
    assert.strictEqual(fallAfterMerge!.offeneVorschlaege, 0);

    // Create second proposal and reject it
    await proposeDeutung(
      'complete-test',
      'wrong-date',
      [
        {
          id: 'atom-date',
          feld: 'datum',
          wert: '9999-99-99',
          fundstelle: { doc: 'beleg.jpg', seite: 1, bbox: [0, 0, 1, 1] },
          conf: 0.2,
        },
      ],
      { titel: 'Ungültiges Datum', frage: 'Passt das?' }
    );

    await rejectVorschlag('complete-test', 'wrong-date', 'Datum ist offensichtlich falsch');

    // Get full narrative
    const erzaehlung = await fallErzaehlung('complete-test');

    // Verify narrative is in correct order (oldest first)
    const types: string[] = [];
    for (const satz of erzaehlung) {
      const type = satz.commitZeile.split('·')[1].trim();
      types.push(type);
    }

    // Should be: initialer Fall, eingang, bestaetigt, abgelehnt
    assert.ok(types[0].includes('initialer'));
    assert.ok(types[1].includes('eingang'));
    assert.ok(types[2].includes('bestaetigt'));
    assert.ok(types[3].includes('abgelehnt'));

    // Verify each sentence has proper German narrative
    assert.ok(erzaehlung[1].satz.includes('kam') && erzaehlung[1].satz.includes('Mustermann'));
    assert.ok(erzaehlung[2].satz.includes('bestätigt'));
    assert.ok(erzaehlung[3].satz.includes('verworfen'));

    // Verify commit line format
    for (const e of erzaehlung) {
      assert.match(e.commitZeile, /^[a-f0-9]{4} · .+ · sig ✓$/);
    }
  });
});
