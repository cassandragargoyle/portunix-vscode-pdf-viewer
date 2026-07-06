# pdf

Display pdf in VSCode.

![screenshot](https://user-images.githubusercontent.com/3643499/84454816-98fcd600-ac96-11ea-822c-3ae1e1599a13.gif)

## About this fork

This is a fork of [tomoki1207/vscode-pdfviewer](https://github.com/tomoki1207/vscode-pdfviewer),
maintained by CassandraGargoyle as the PDF viewer plugin bundled with
[portunix-vscode](https://github.com/CassandraGargoyle/portunix-vscode).

It is **not** a verbatim copy — the viewer has been reworked on top of the
upstream code. The main addition (see [CHANGELOG.md](CHANGELOG.md) → 1.3.0) is
the upgrade of PDF.js from 3.1.81 to 6.1.200:

- Switch the bundled viewer to the ESM prebuilt (`pdf.mjs`, `pdf.worker.mjs`,
  `viewer.mjs`) loaded as `type="module"`.
- Render the stock `web/viewer.html` at runtime and rewrite its resource
  references to webview URIs, instead of the hand-ported HTML template.
- Resolve worker/wasm/icc assets to absolute webview URIs, widen the CSP for
  module scripts, and replace the removed `createPromiseCapability` with
  `Promise.withResolvers()`.

See [CHANGELOG.md](CHANGELOG.md) for the full list of changes relative to
upstream.

## Maintenance

### Upgrade PDF.js

This fork renders the stock `lib/web/viewer.html` at runtime (see
[About this fork](#about-this-fork)), so upgrading PDF.js no longer means
hand-porting the viewer HTML into `pdfPreview.ts` — you only refresh the
prebuilt assets and re-check the glue in `lib/main.js`:

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
