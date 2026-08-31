/**
 * scripts/release-notes.js — Release-Notiz aus dem dmg (T13).
 *
 * Liest Version, berechnet SHA256, schreibt RELEASE-NOTES.md mit
 * Changelog aus den Commit-Titeln seit dem letzten Tag.
 * Versions-Nummer = `git describe --tags` (oder package.json).
 */

const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
  } catch (e) {
    return '';
  }
}

const version = sh('git', ['describe', '--tags', '--abbrev=0']) || require('../package.json').version;
const datum = new Date().toISOString().slice(0, 10);

// Changelog: Commits seit letztem Tag
const letzteTags = sh('git', ['tag', '--sort=-creatordate']).split('\n').filter(Boolean);
const seit = letzteTags[1] ?? '';
const log = seit
  ? sh('git', ['log', `${seit}..HEAD`, '--oneline', '--', 'app'])
  : sh('git', ['log', '-20', '--oneline', '--', 'app']);

// dmg finden + SHA256
const releaseDir = path.join(__dirname, '..', 'release');
const dmg = fs.readdirSync(releaseDir).find(f => f.endsWith('.dmg'));
const sha = dmg
  ? createHash('sha256').update(fs.readFileSync(path.join(releaseDir, dmg))).digest('hex')
  : '— kein dmg gefunden —';

const notiz = `# MMC-OS ${version} · ${datum}

## Downloads
- \`${dmg ?? '—'}\`
- SHA256: \`${sha}\`

## Changelog${seit ? ` (seit ${seit})` : ''}
\`\`\`
${log || '— keine app-Commits —'}
\`\`\`

## Checkliste (vor dem Upload)
- [ ] npm test grün (46/46)
- [ ] Signiert (codesign --verify)
- [ ] Notarisiert (spctl -a -vv)
- [ ] SHA256 oben stimmt (shasum -a 256 nachgerechnet)
- [ ] latest-mac.json in den Update-Feed hochgeladen (registry.gl.0711.io)
`;

const ziel = path.join(releaseDir, 'RELEASE-NOTES.md');
fs.writeFileSync(ziel, notiz);
console.log(notiz);
console.log(`→ ${ziel}`);
