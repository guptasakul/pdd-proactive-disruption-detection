// Markdown-subset -> styled .docx technical specification builder
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, HeadingLevel, LevelFormat, Header, Footer,
  PageNumber, TableOfContents, PageBreak, TabStopType
} = require('docx');

const FONT = 'Calibri', MONO = 'Consolas';
const NAVY = '1F3A5F', ACCENT = '2E75B6', GREY = '595959', LIGHT = 'EAF1F8', CODEBG = 'F3F4F6', CALLBG = 'FFF7E6';
const PAGE_W = 11906, MARGIN = 1134, CONTENT_W = PAGE_W - 2 * MARGIN; // A4, 2cm margins

function inline(text, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) runs.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else runs.push(new TextRun({ text: t.slice(1, -1), font: MONO, size: (base.size || 20) - 2, color: '9B2C2C', ...base, ...{ font: MONO } }));
    last = m.index + t.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...base }));
  return runs;
}

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'BFC9D4' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function table(rows) {
  const n = rows[0].length;
  rows = rows.map(r => { while (r.length < n) r.push(''); return r.slice(0, n); });
  // proportional widths from content length (sqrt-damped), min share
  const lens = Array.from({ length: n }, (_, c) => Math.max(...rows.map(r => r[c].length), 4));
  const w = lens.map(l => Math.sqrt(Math.min(l, 400)));
  const tot = w.reduce((a, b) => a + b, 0);
  let widths = w.map(x => Math.max(900, Math.round(CONTENT_W * x / tot)));
  const s = widths.reduce((a, b) => a + b, 0);
  widths = widths.map(x => Math.round(x * CONTENT_W / s));
  widths[n - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      cantSplit: true,
      children: r.map((cell, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        borders,
        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' }
          : (ri % 2 === 0 ? { type: ShadingType.CLEAR, fill: 'F7F9FC', color: 'auto' } : undefined),
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: cell.split('<br>').map(part => new Paragraph({
          spacing: { before: 0, after: 0, line: 252 },
          children: inline(part.trim(), ri === 0 ? { bold: true, color: 'FFFFFF', size: 18 } : { size: 18 })
        }))
      }))
    }))
  });
}

function codeBlock(lines) {
  return lines.map((l, i) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODEBG, color: 'auto' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 6 },
      ...(i === 0 ? { top: { style: BorderStyle.SINGLE, size: 2, color: CODEBG, space: 2 } } : {}),
    },
    spacing: { before: 0, after: i === lines.length - 1 ? 160 : 0, line: 240 },
    indent: { left: 120 },
    children: [new TextRun({ text: l.length ? l.replace(/\t/g, '  ').replace(/(\S)\s{3,}(#|\/\/)/g, '$1  $2') : ' ', font: MONO, size: 15, color: '1F2937' })]
  }));
}

function callout(text) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CALLBG, color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'D9822B', space: 8 } },
    spacing: { before: 120, after: 160 },
    indent: { left: 160, right: 160 },
    children: inline(text, { size: 19 })
  });
}

function parse(md) {
  const meta = {};
  const out = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].startsWith('@')) {
    const m = lines[i].match(/^@(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2]; i++;
  }
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      out.push(...codeBlock(buf)); continue;
    }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--; out.push(table(rows)); out.push(new Paragraph({ spacing: { after: 80 }, children: [] })); continue;
    }
    if (l.startsWith('### ')) { out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(l.slice(4).replace(/`/g, ''))] })); continue; }
    if (l.startsWith('## ')) { out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(l.slice(3).replace(/`/g, ''))] })); continue; }
    if (l.startsWith('# ')) { const isPart = l.startsWith('# PART');
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, ...(isPart ? { shading: { type: ShadingType.CLEAR, fill: LIGHT, color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: NAVY, space: 6 } }, spacing: { before: 480, after: 200 } } : {}), children: [new TextRun(l.slice(2).replace(/`/g, ''))] })); continue; }
    if (l.startsWith('> ')) { out.push(callout(l.slice(2))); continue; }
    let m;
    if ((m = l.match(/^(\s*)- (.*)$/))) {
      out.push(new Paragraph({ numbering: { reference: 'bul', level: m[1].length >= 2 ? 1 : 0 }, spacing: { after: 40 }, children: inline(m[2]) })); continue;
    }
    if ((m = l.match(/^(\s*)\d+\. (.*)$/))) {
      out.push(new Paragraph({ numbering: { reference: 'num-' + (meta._numSeq || 0), level: 0 }, spacing: { after: 40 }, children: inline(m[2]) })); continue;
    }
    if (l.trim() === '') { // reset numbered list on blank line following list
      if (out.length && lines[i - 1] && /^\s*\d+\. /.test(lines[i - 1])) meta._numSeq = (meta._numSeq || 0) + 1;
      continue;
    }
    out.push(new Paragraph({ spacing: { after: 120 }, children: inline(l) }));
  }
  return { meta, body: out };
}

function coverAndControl(meta, md) {
  const p = [];
  p.push(new Paragraph({ spacing: { before: 1800, after: 120 }, children: [new TextRun({ text: 'TECHNICAL SPECIFICATION', color: ACCENT, bold: true, size: 22, characterSpacing: 40 })] }));
  p.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: meta.id, color: GREY, bold: true, size: 32 })] }));
  p.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: meta.title, color: NAVY, bold: true, size: 48 })] }));
  p.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 4 } }, spacing: { after: 240 }, children: [] }));
  p.push(new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: meta.summary || '', color: GREY, size: 22, italics: true })] }));
  p.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Proactive Infrastructure Disruption Detection & Automated Incident Response', bold: true, size: 20, color: NAVY })] }));
  p.push(table([
    ['Field', 'Value'],
    ['Specification ID', meta.id],
    ['Version / Status', '1.0 / Draft for architecture review'],
    ['Date', '14 October 2026'],
    ['Author', 'Sakul Gupta'],
    ['Source white paper sections', meta.sources || '—'],
    ['Depends on', meta.depends || '—'],
    ['Deployment context', 'Industry-neutral; regulated-industry controls exposed as configuration'],
    ['Document structure', 'Part A — Design-level specification · Part B — Low-level (build-ready) specification'],
  ]));
  p.push(new Paragraph({ children: [new PageBreak()] }));
  p.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Contents')] }));
  for (const line of md.split('\n')) {
    if (line.startsWith('# ')) {
      const isPart = line.startsWith('# PART');
      p.push(new Paragraph({ spacing: { before: isPart ? 200 : 60, after: 20 }, children: [new TextRun({ text: line.slice(2).replace(/`/g, ''), bold: isPart, size: isPart ? 20 : 19, color: isPart ? NAVY : '1F2937' })] }));
    } else if (line.startsWith('## ')) {
      p.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 10 }, children: [new TextRun({ text: line.slice(3).replace(/`/g, ''), size: 17, color: GREY })] }));
    }
  }
  p.push(new Paragraph({ children: [new PageBreak()] }));
  return p;
}

function build(file, outDir) {
  const md = fs.readFileSync(file, 'utf8');
  const { meta, body } = parse(md);
  const numConfigs = [{ reference: 'bul', levels: [
    { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } },
  ] }];
  for (let k = 0; k <= (meta._numSeq || 0) + 1; k++) numConfigs.push({ reference: 'num-' + k, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] });
  const doc = new Document({
    creator: 'Sakul Gupta', title: `${meta.id} ${meta.title}`,
    
    styles: {
      default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: ACCENT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 22, bold: true, color: '333F4F' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
      ]
    },
    numbering: { config: numConfigs },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFC9D4', space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [new TextRun({ text: `${meta.id} · ${meta.title}`, size: 16, color: GREY }), new TextRun({ text: '\tTechnical Specification v1.0', size: 16, color: GREY })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [new TextRun({ text: 'Sakul Gupta · Confidential', size: 16, color: GREY }), new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: GREY })] })] }) },
      children: [...coverAndControl(meta, md), ...body]
    }]
  });
  const name = `${meta.id}_${meta.title.replace(/&/g, 'and').replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '')}.docx`;
  return Packer.toBuffer(doc).then(buf => { fs.writeFileSync(path.join(outDir, name), buf); return name; });
}

const [, , outDir, ...files] = process.argv;
Promise.all(files.map(f => build(f, outDir))).then(n => console.log(n.join('\n'))).catch(e => { console.error(e); process.exit(1); });
