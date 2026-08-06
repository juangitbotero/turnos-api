/**
 * Verify every t('...') key used in the apps exists in the built catalogue.
 * A missing key renders as the raw key string on screen, which is exactly the
 * sort of thing that ruins a screen recording.
 *
 * Static keys are checked exactly. Template keys (t(`a.b.${x}`)) are reported
 * separately with their resolvable prefix so they can be eyeballed.
 */
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const s = require(path.join(root, 'packages/shared/dist/index.js'));

const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[p + k] = v;
    else flat(v, p + k + '.', out);
  }
  return out;
};
const PT = flat(s.pt);
const EN = flat(s.en);

function walkFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist' ||
        e.name.startsWith('.expo')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(full);
  }
  return acc;
}

const targets = [
  path.join(root, 'apps/mobile/app'),
  path.join(root, 'apps/mobile/components'),
  path.join(root, 'apps/mobile/lib'),
  path.join(root, 'apps/web-admin/app'),
  path.join(root, 'apps/web-admin/lib'),
  path.join(root, 'apps/web-admin/components'),
].filter(fs.existsSync);

const staticMissing = [];
const dynamic = [];
let staticCount = 0;

for (const file of targets.flatMap(d => walkFiles(d))) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);

  // t('a.b.c') / t("a.b.c")
  for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
    staticCount++;
    const key = m[1];
    if (!(key in PT) || !(key in EN)) {
      const line = src.slice(0, m.index).split('\n').length;
      staticMissing.push(`${rel}:${line}  ${key}` +
        (key in PT ? '  [missing in EN]' : key in EN ? '  [missing in PT]' : '  [missing in BOTH]'));
    }
  }

  // t(`a.b.${x}`) — record the static prefix
  for (const m of src.matchAll(/\bt\(\s*`([^`]*)`/g)) {
    const tpl = m[1];
    if (!tpl.includes('${')) {
      staticCount++;
      if (!(tpl in PT) || !(tpl in EN)) {
        const line = src.slice(0, m.index).split('\n').length;
        staticMissing.push(`${rel}:${line}  ${tpl}  [template, missing]`);
      }
      continue;
    }
    // The interpolation can start mid-segment — t(`home.roadmap.s${n}`) means
    // the real keys are home.roadmap.s0…s9. So resolve the prefix back to the
    // last '.' boundary and match on the literal head, otherwise we'd report a
    // false "no children" on a perfectly good key.
    const head = tpl.slice(0, tpl.indexOf('${'));       // e.g. "home.roadmap.s"
    const prefix = head.replace(/\.$/, '');
    const line = src.slice(0, m.index).split('\n').length;
    const children = Object.keys(PT).filter(k => k.startsWith(head.includes('.') ? head : prefix + '.'));
    dynamic.push({ where: `${rel}:${line}`, tpl, prefix, children: children.length });
  }
}

console.log(`Static keys checked: ${staticCount}`);
console.log(`Missing static keys: ${staticMissing.length}`);
staticMissing.forEach(l => console.log('  ✗ ' + l));

console.log(`\nDynamic (template) keys: ${dynamic.length}`);
const byPrefix = {};
for (const d of dynamic) (byPrefix[d.prefix] ??= { n: 0, children: d.children })._ = byPrefix[d.prefix].n++;
for (const [prefix, info] of Object.entries(byPrefix)) {
  const flag = info.children === 0 ? '  ✗ NO CHILDREN IN CATALOGUE' : '';
  console.log(`  ${prefix}  → ${info.children} keys under it, used ${info.n}×${flag}`);
}

process.exit(staticMissing.length || Object.values(byPrefix).some(i => i.children === 0) ? 1 : 0);
