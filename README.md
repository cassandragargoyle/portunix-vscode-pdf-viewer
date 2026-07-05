# pdf

Display pdf in VSCode.

![screenshot](https://user-images.githubusercontent.com/3643499/84454816-98fcd600-ac96-11ea-822c-3ae1e1599a13.gif)

## Contribute

### Upgrade PDF.js

Since PDF.js 4.0 the prebuilt is ESM-only (`pdf.mjs`, `pdf.worker.mjs`,
`viewer.mjs`). This extension renders the stock `lib/web/viewer.html` at
runtime and rewrites its resource references to webview URIs, so the viewer
HTML no longer has to be hand-ported into `pdfPreview.ts`.

1. Download the latest [Prebuilt (older browsers)](https://mozilla.github.io/pdf.js/getting_started/#download).
1. Extract the ZIP file.
1. Overwrite `./lib/build/*` and `./lib/web/*` with the extracted directories.
1. To not use the sample pdf:
   - Remove the sample pdf `lib/web/compressed.tracemonkey-pldi-09.pdf`.
   - Blank the sample url in `lib/web/viewer.mjs`:
     ```js
     defaultOptions.defaultUrl = {
       value: "", // "compressed.tracemonkey-pldi-09.pdf"
       kind: OptionKind.VIEWER
     };
     ```
1. Re-check `lib/main.js` against the new viewer internals: it sets the
   `cMapUrl`, `standardFontDataUrl`, `wasmUrl`, `iccUrl` and `workerSrc`
   options to absolute webview URIs (pdf.js resolves relative worker/wasm/icc
   paths against the document, which fails in a webview) and reworks the
   flicker-free reload hack (`_resetView` + `Promise.withResolvers()`).
1. If read-only actions reappear in the toolbar, hide their button ids in
   `lib/pdf.css`.

## Change log
See [CHANGELOG.md](CHANGELOG.md).

## License
Please see [LICENSE](./LICENSE)
