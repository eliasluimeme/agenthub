# docs-site

Static documentation generator. Zero dependencies: a small Markdown renderer, a page builder and a CLI.

```sh
npm run build        # builds ./docs into ./dist
npm test
```

- `src/markdown.ts`: Markdown to HTML, with escaping and safe links only
- `src/build.ts`: shared navigation, per-page table of contents, `.md` link rewriting
- `src/cli.ts`: walks a folder and writes the site

The docs in `docs/` are built with this tool. Search with keyboard shortcuts is planned (#41).
