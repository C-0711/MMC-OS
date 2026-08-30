// Syntax-Check (Shebang entfernen, dann parsen)
const fs = require('fs');
const code = fs.readFileSync('/opt/data/gitchain-ref/server.js', 'utf8').replace(/^#!.*\n/, '');
try { new Function(code); console.log('server.js syntax: OK'); } catch (e) { console.log('SYNTAX-FEHLER:', e.message); process.exit(1); }
