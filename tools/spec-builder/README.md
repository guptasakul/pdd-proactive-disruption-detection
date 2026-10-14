# Spec builder

Converts the Markdown specification sources into styled A4 Word documents with a cover page, document-control table, contents list, running header and page numbers.

## Usage

```
npm install
node build.js <output_dir> <source.md> [<source.md> ...]
```

## Source format

Front matter (one per line at the top):

```
@id: TS-05
@title: ML Ensemble Detection Engine and Score Fusion
@sources: White paper sections covered
@depends: TS-04, TS-06
@summary: One-paragraph summary shown on the cover
```

Body supports: `#`/`##`/`###` headings (`# PART …` renders as a part band), paragraphs, `-` bullets (two-space indent for level 2), `1.` numbered lists, pipe tables (first row is the header), fenced code blocks, `> ` callouts, and inline `**bold**` and `` `code` ``. Use `<br>` for a line break inside a table cell.
