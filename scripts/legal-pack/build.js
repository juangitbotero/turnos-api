/**
 * Builds the Word pack for the law firm: docs/legal/pack-advogados/*.docx
 *
 *   cd scripts/legal-pack && npm install && npm run build
 *
 * Sources — edit these, never the .docx:
 *   docs/legal/brief-advogados.md, termos-trabalhadores.md, termos-empresas.md,
 *   pay-link-legal-brief.md, docs/policies/cancellation-and-noshow-policy.md,
 *   and the privacy policy straight from apps/web-admin/app/privacidade/content.ts
 *   (the text users actually see), so the lawyer reviews exactly what is live.
 *
 * The Markdown converter handles what these files use — headings, paragraphs,
 * bullet and numbered lists, tables, `>` notes (shaded boxes; the ⚖️ questions
 * for the lawyer live there), `---` rules and inline **bold** / *italic* /
 * `code` / [links]. It is not a general Markdown renderer.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, Header, Footer,
  PageNumber, TableLayoutType,
} = require('docx');

const ROOT = path.resolve(__dirname, '../..');
const OUT  = path.join(ROOT, 'docs/legal/pack-advogados');

// A4 with 2 cm margins → 9638 DXA of usable width
const PAGE = { width: 11906, height: 16838 };
const MARGIN = 1134;
const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;

const BRAND = '3F4BC4';      // darker brand indigo — readable when printed
const NOTE_FILL = 'FFF7E0';  // ⚖️ / > notes
const HEAD_FILL = 'EEF0FF';  // table headers
const FONT = 'Calibri';

// ── Inline Markdown → TextRuns ────────────────────────────────────────────────

function runs(text, base = {}) {
  const out = [];
  // Links become their text; the URL is noise on paper.
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
    else if (tok.startsWith('`')) out.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', size: 19, ...base }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...base }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

// ── Block builders ────────────────────────────────────────────────────────────

const noteShading = { type: ShadingType.CLEAR, color: 'auto', fill: NOTE_FILL };
const noteBorder = {
  left: { style: BorderStyle.SINGLE, size: 18, color: 'E0A800', space: 8 },
};

function para(text, opts = {}) {
  return new Paragraph({
    children: runs(text),
    spacing: { after: 120, line: 288 },
    ...opts,
  });
}

function heading(level, text) {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
  return new Paragraph({ heading: map[level] ?? HeadingLevel.HEADING_3, children: runs(text) });
}

function listItem(text, { ordered = false, note = false, level = 0 } = {}) {
  return new Paragraph({
    children: runs(text),
    numbering: { reference: ordered ? 'numbered' : 'bullets', level },
    spacing: { after: 60, line: 276 },
    ...(note ? { shading: noteShading, border: noteBorder } : {}),
  });
}

function rule() {
  return new Paragraph({
    children: [],
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
  });
}

function table(rows) {
  const cols = Math.max(...rows.map(r => r.length));
  // First column narrower when it is a label column in a wide table
  const widths = Array(cols).fill(Math.floor(CONTENT_WIDTH / cols));
  widths[cols - 1] += CONTENT_WIDTH - widths.reduce((a, b) => a + b, 0);

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D0D4E4' };
  const borders = { top: border, bottom: border, left: border, right: border };

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: rows.map((cells, i) => new TableRow({
      tableHeader: i === 0,
      children: Array.from({ length: cols }, (_, c) => new TableCell({
        width: { size: widths[c], type: WidthType.DXA },
        borders,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: i === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: HEAD_FILL } : undefined,
        children: [new Paragraph({
          children: runs(cells[c] ?? '', i === 0 ? { bold: true, size: 19 } : { size: 19 }),
          spacing: { after: 0, line: 264 },
        })],
      })),
    })),
  });
}

// ── Markdown → blocks ─────────────────────────────────────────────────────────

function markdownToBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  const isTableRow = l => /^\s*\|.*\|\s*$/.test(l);
  const splitRow = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Fenced code → monospace paragraphs
    if (line.startsWith('```')) {
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        blocks.push(new Paragraph({ children: [new TextRun({ text: lines[i] || ' ', font: 'Consolas', size: 18 })], spacing: { after: 0 } }));
        i++;
      }
      i++;
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { blocks.push(heading(h[1].length, h[2])); i++; continue; }

    if (/^-{3,}\s*$/.test(line)) { blocks.push(rule()); i++; continue; }

    // Blockquote: group consecutive `>` lines; inner bullets stay bullets
    if (line.startsWith('>')) {
      const inner = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        inner.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      let buf = [];
      const flush = () => {
        if (!buf.length) return;
        blocks.push(new Paragraph({
          children: runs(buf.join(' ')),
          shading: noteShading, border: noteBorder,
          spacing: { after: 0, line: 276 },
        }));
        buf = [];
      };
      for (let k = 0; k < inner.length; k++) {
        const l = inner[k];
        const b = /^\s*[-*]\s+(.*)$/.exec(l);
        if (!l.trim()) { flush(); continue; }
        if (b) {
          flush();
          let text = b[1];
          while (k + 1 < inner.length && /^\s{2,}\S/.test(inner[k + 1]) && !/^\s*[-*]\s/.test(inner[k + 1])) {
            text += ' ' + inner[++k].trim();
          }
          blocks.push(listItem(text, { note: true }));
          continue;
        }
        buf.push(l.trim());
      }
      flush();
      blocks.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      continue;
    }

    if (isTableRow(line)) {
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = splitRow(lines[i]);
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push(table(rows));
      blocks.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const m = bullet ?? numbered;
      const level = m[1].length >= 2 ? 1 : 0;
      let text = m[2];
      i++;
      // Continuation lines: indented, not a new list item
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        text += ' ' + lines[i].trim();
        i++;
      }
      blocks.push(listItem(text, { ordered: !!numbered, level }));
      continue;
    }

    // Plain paragraph: join until a blank line or another block starts
    const buf = [line.trim()];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|>|```|\s*[-*]\s|\s*\d+\.\s|-{3,}\s*$)/.test(lines[i]) && !isTableRow(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push(para(buf.join(' ')));
  }
  return blocks;
}

// ── Privacy policy from the live page's content.ts ───────────────────────────

function loadPrivacyPolicy() {
  const ts = require(require.resolve('typescript', { paths: [ROOT] }));
  const file = path.join(ROOT, 'apps/web-admin/app/privacidade/content.ts');
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  // Compile as if it lived at its real path, so '@turnos/shared' resolves
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(js, file);
  return m.exports.POLICY.pt;
}

function policyToBlocks(doc) {
  const blocks = [
    heading(1, doc.title),
    para(`*${doc.updated}*`),
    new Paragraph({
      children: runs('Texto publicado em **/privacidade** (PT e EN). Versão provisória, em revisão jurídica. Os campos [[…]] são dados da sociedade ainda por preencher.'),
      shading: noteShading, border: noteBorder, spacing: { after: 200 },
    }),
    para(doc.lede),
  ];
  for (const s of doc.sections) {
    blocks.push(heading(2, s.heading));
    for (const p of s.paragraphs ?? []) blocks.push(para(p));
    if (s.table) {
      blocks.push(table([s.table.head, ...s.table.rows]));
      blocks.push(new Paragraph({ children: [], spacing: { after: 120 } }));
    }
    for (const b of s.bullets ?? []) blocks.push(listItem(b));
  }
  return blocks;
}

// ── Document shell ────────────────────────────────────────────────────────────

function documentFor(title, children) {
  return new Document({
    creator: 'Turnos',
    title,
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 34, bold: true, color: BRAND, font: FONT },
          paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: BRAND, font: FONT },
          paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, color: '333333', font: FONT },
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 260 } } } },
        ] },
        { reference: 'numbered', levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 300 } } } },
          { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 300 } } } },
        ] },
      ],
    },
    sections: [{
      properties: { page: { size: PAGE, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `Turnos · ${title} · para revisão jurídica`, size: 16, color: '888888' })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: '888888' })],
      })] }) },
      children,
    }],
  });
}

// ── The pack ──────────────────────────────────────────────────────────────────

const PACK = [
  { out: '00 - Nota para os advogados.docx',            title: 'Nota para os advogados',         md: 'docs/legal/brief-advogados.md' },
  { out: '01 - Termos de Utilização - Trabalhadores.docx', title: 'Termos — Trabalhadores',      md: 'docs/legal/termos-trabalhadores.md' },
  { out: '02 - Termos de Utilização - Empresas.docx',   title: 'Termos — Empresas',              md: 'docs/legal/termos-empresas.md' },
  { out: '03 - Política de Privacidade.docx',           title: 'Política de Privacidade',        privacy: true },
  { out: '04 - Política de Cancelamento e Faltas.docx', title: 'Política de Cancelamento e Faltas', md: 'docs/policies/cancellation-and-noshow-policy.md' },
  { out: '05 - Turnos Pay Link - Brief Jurídico.docx',  title: 'Pay Link — brief jurídico',      md: 'docs/legal/pay-link-legal-brief.md' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const item of PACK) {
    const blocks = item.privacy
      ? policyToBlocks(loadPrivacyPolicy())
      : markdownToBlocks(fs.readFileSync(path.join(ROOT, item.md), 'utf8'));
    const buf = await Packer.toBuffer(documentFor(item.title, blocks));
    fs.writeFileSync(path.join(OUT, item.out), buf);
    console.log(`✓ ${item.out}  (${Math.round(buf.length / 1024)} KB)`);
  }
})().catch(err => { console.error(err); process.exit(1); });
