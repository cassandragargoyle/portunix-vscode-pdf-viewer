// Glue between the VS Code webview and the bundled pdf.js viewer
// applies default view settings, opens the document and preserves scroll on reload

"use strict";

(function () {
  function loadConfig() {
    const elem = document.getElementById('pdf-preview-config')
    if (elem) {
      return JSON.parse(elem.getAttribute('data-config'))
    }
    throw new Error('Could not load configuration.')
  }
  function cursorTools(name) {
    if (name === 'hand') {
      return 1
    }
    return 0
  }
  function scrollMode(name) {
    switch (name) {
      case 'vertical':
        return 0
      case 'horizontal':
        return 1
      case 'wrapped':
        return 2
      default:
        return -1
    }
  }
  function spreadMode(name) {
    switch (name) {
      case 'none':
        return 0
      case 'odd':
        return 1
      case 'even':
        return 2
      default:
        return -1
    }
  }
  // pdf.js wraps a cross-origin workerSrc in a blob that does `await import(src)`;
  // that dynamic import fails in the VS Code webview, where the worker bundle is
  // served from a different origin than the webview document. The bundle is
  // self-contained, so fetch it and run it from a same-origin blob URL, which
  // pdf.js then loads directly without the failing import wrapper
  async function sameOriginWorkerSrc(workerSrc) {
    const source = await (await fetch(workerSrc)).text()
    return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  }

  window.addEventListener('load', async function () {
    const config = loadConfig()
    // Resolve asset locations to absolute webview URIs; pdf.js 6.x resolves
    // relative worker/wasm/icc paths against the document, which fails in a webview
    const workerSrc = await sameOriginWorkerSrc(config.workerSrc)
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
    PDFViewerApplicationOptions.set('workerSrc', workerSrc)
    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
    PDFViewerApplicationOptions.set('standardFontDataUrl', config.standardFontDataUrl)
    PDFViewerApplicationOptions.set('wasmUrl', config.wasmUrl)
    PDFViewerApplicationOptions.set('iccUrl', config.iccUrl)

    // Apply the default view via pdf.js *OnLoad options; the viewer applies them
    // itself when the document loads. pdf.js 6.x no longer exposes the
    // pdfSidebar / pdfCursorTools objects the old glue poked, which threw on load
    const defaults = config.defaults
    PDFViewerApplicationOptions.set('cursorToolOnLoad', cursorTools(defaults.cursor))
    PDFViewerApplicationOptions.set('scrollModeOnLoad', scrollMode(defaults.scrollMode))
    PDFViewerApplicationOptions.set('spreadModeOnLoad', spreadMode(defaults.spreadMode))
    PDFViewerApplicationOptions.set('sidebarViewOnLoad', defaults.sidebar ? 1 : 0)
    if (defaults.scale) {
      PDFViewerApplicationOptions.set('defaultZoomValue', defaults.scale)
    }

    const loadOpts = {
      url: config.path,
      useWorkerFetch: false,
      cMapUrl: config.cMapUrl,
      cMapPacked: true,
      standardFontDataUrl: config.standardFontDataUrl,
      wasmUrl: config.wasmUrl,
      iccUrl: config.iccUrl
    }
    PDFViewerApplication.initializedPromise.then(() => {
      // load() cannot be called before pdf.js is initialized
      // open() makes sure pdf.js is initialized before load()
      PDFViewerApplication.open({ url: config.path }).then(async function () {
        const doc = await pdfjsLib.getDocument(loadOpts).promise
        doc._pdfInfo.fingerprints = [config.path]
        PDFViewerApplication.load(doc)
      })
    })

    window.addEventListener('message', async function () {
      // Prevents flickering of page when PDF is reloaded
      const oldResetView = PDFViewerApplication.pdfViewer._resetView
      PDFViewerApplication.pdfViewer._resetView = function () {
        this._firstPageCapability = Promise.withResolvers()
        this._onePageRenderedCapability = Promise.withResolvers()
        this._pagesCapability = Promise.withResolvers()

        this.viewer.textContent = ""
      }

      // Changing the fingerprint fools pdf.js into keeping scroll position
      const doc = await pdfjsLib.getDocument(loadOpts).promise
      doc._pdfInfo.fingerprints = [config.path]
      PDFViewerApplication.load(doc)

      PDFViewerApplication.pdfViewer._resetView = oldResetView
    });
  }, { once: true });

  // Diagnostic error reporting (issue 083): surface the real failure instead of
  // hiding every error behind a generic message. Renders a non-destructive
  // overlay and logs to the console so the actual cause is diagnosable
  function describeError(err) {
    if (!err) {
      return String(err)
    }
    if (err.stack) {
      return err.stack
    }
    return (err.name ? err.name + ': ' : '') + (err.message || String(err))
  }
  function reportError(kind, detail) {
    try {
      console.error('[pdf-viewer] ' + kind + ':', detail)
    } catch (_) {
      // console may be unavailable, keep going
    }
    let panel = document.getElementById('pdf-viewer-error')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'pdf-viewer-error'
      panel.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:2147483647', 'overflow:auto',
        'margin:0', 'padding:16px', 'font:12px/1.5 monospace',
        'white-space:pre-wrap', 'word-break:break-word',
        'color:#eaeaea', 'background:#1e1e1e'
      ].join(';'))
      const title = document.createElement('div')
      title.setAttribute('style', 'font-weight:bold;margin-bottom:12px')
      title.textContent = 'PDF viewer failed to load (issue 083). Real error:'
      panel.appendChild(title)
      ;(document.body || document.documentElement).appendChild(panel)
    }
    const entry = document.createElement('div')
    entry.setAttribute('style', 'margin-bottom:12px;padding-top:8px;border-top:1px solid #444')
    entry.textContent = kind + '\n' + detail
    panel.appendChild(entry)
  }

  // Uncaught synchronous exceptions
  window.onerror = function (message, source, lineno, colno, error) {
    reportError('window.onerror', [
      message,
      source ? 'at ' + source + ':' + lineno + ':' + colno : '',
      error ? describeError(error) : ''
    ].filter(Boolean).join('\n'))
    return false
  }

  // Resource load failures (module scripts, worker, css, wasm) — capture phase
  window.addEventListener('error', function (event) {
    const target = event.target
    if (target && target !== window && (target.src || target.href)) {
      reportError('resource load failed', (target.tagName || 'resource') + ' ' + (target.src || target.href))
    }
  }, true)

  // Async failures along the pdf.js load path
  window.addEventListener('unhandledrejection', function (event) {
    reportError('unhandledrejection', describeError(event.reason))
  })
}());
