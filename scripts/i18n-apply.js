/**
 * Apply exact string replacements to a file.
 * Usage: node apply.js <file> <edits.json>
 * edits.json: [[from, to], ...]
 *
 * Line-ending aware (some files in this repo are CRLF) and idempotent —
 * an edit whose `to` is already present is counted as done, not missed.
 */
const fs = require('fs');
const [, , file, editsFile] = process.argv;
let c = fs.readFileSync(file, 'utf8');
const edits = JSON.parse(fs.readFileSync(editsFile, 'utf8'));
const crlf = c.includes('\r\n');
const nl = (s) => (crlf ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r\n/g, '\n'));

let missed = 0, already = 0;
for (const [rawFrom, rawTo] of edits) {
  const from = nl(rawFrom), to = nl(rawTo);
  if (!c.includes(from)) {
    if (c.includes(to)) { already++; continue; }
    console.error('MISS: ' + JSON.stringify(rawFrom.slice(0, 90)));
    missed++;
    continue;
  }
  c = c.split(from).join(to);
}
fs.writeFileSync(file, c);
console.log(`applied ${edits.length - missed - already}/${edits.length}` +
  (already ? ` (${already} already applied)` : ''));
process.exit(missed ? 1 : 0);
