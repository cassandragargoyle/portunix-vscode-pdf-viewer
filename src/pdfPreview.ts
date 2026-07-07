import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable } from './disposable';

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/"/g, '&quot;');
}

type PreviewState = 'Disposed' | 'Visible' | 'Active';

export class PdfPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel
  ) {
    super();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
        switch (message.type) {
          case 'reopen-as-text': {
            vscode.commands.executeCommand(
              'vscode.openWith',
              resource,
              'default',
              webviewEditor.viewColumn
            );
            break;
          }
        }
      })
    );

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = 'Disposed';
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(resource.fsPath)
    );
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    this.webviewEditor.webview.html = this.getWebviewContents();
    this.update();
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage({ type: 'reload' });
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }

    if (this.webviewEditor.active) {
      this._previewState = 'Active';
      return;
    }
    this._previewState = 'Visible';
  }

  private getWebviewContents(): string {
    const webview = this.webviewEditor.webview;
    const docPath = webview.asWebviewUri(this.resource);
    const cspSource = webview.cspSource;
    const resolveAsUri = (...p: string[]): vscode.Uri => {
      const uri = vscode.Uri.file(path.join(this.extensionRoot.fsPath, ...p));
      return webview.asWebviewUri(uri);
    };

    const config = vscode.workspace.getConfiguration('pdf-preview');
    const settings = {
      cMapUrl: resolveAsUri('lib', 'web', 'cmaps/').toString(),
      standardFontDataUrl: resolveAsUri(
        'lib',
        'web',
        'standard_fonts/'
      ).toString(),
      wasmUrl: resolveAsUri('lib', 'web', 'wasm/').toString(),
      iccUrl: resolveAsUri('lib', 'web', 'iccs/').toString(),
      workerSrc: resolveAsUri('lib', 'build', 'pdf.worker.mjs').toString(),
      path: docPath.toString(),
      defaults: {
        cursor: config.get('default.cursor') as string,
        scale: config.get('default.scale') as string,
        sidebar: config.get('default.sidebar') as boolean,
        scrollMode: config.get('default.scrollMode') as string,
        spreadMode: config.get('default.spreadMode') as string,
      },
    };

    // pdf.js 6.x ships an ESM viewer; use the stock viewer.html as the single
    // source of truth and rewrite its resource references to webview URIs
    const viewerHtmlPath = path.join(
      this.extensionRoot.fsPath,
      'lib',
      'web',
      'viewer.html'
    );
    // Strip a leading UTF-8 BOM (U+FEFF) so injected tags land at the top of <head>
    let html = fs.readFileSync(viewerHtmlPath, 'utf8');
    if (html.charCodeAt(0) === 0xfeff) {
      html = html.slice(1);
    }

    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${cspSource} blob: data:; script-src 'unsafe-inline' 'wasm-unsafe-eval' ${cspSource}; style-src 'unsafe-inline' ${cspSource}; img-src blob: data: ${cspSource}; media-src blob:; font-src ${cspSource} data: blob:; worker-src ${cspSource} blob:;">`;
    html = html.replace(
      /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
      csp
    );

    // Rewrite the stock relative references to absolute webview URIs
    html = html.replace(
      'href="locale/locale.json"',
      `href="${resolveAsUri('lib', 'web', 'locale', 'locale.json')}"`
    );
    html = html.replace(
      'src="../build/pdf.mjs"',
      `src="${resolveAsUri('lib', 'build', 'pdf.mjs')}"`
    );
    html = html.replace(
      'href="viewer.css"',
      `href="${resolveAsUri('lib', 'web', 'viewer.css')}"`
    );
    html = html.replace(
      'src="viewer.mjs"',
      `src="${resolveAsUri('lib', 'web', 'viewer.mjs')}"`
    );

    // Inject our config, extra stylesheet and glue script; the glue script must
    // run after viewer.mjs, so it is placed last before </head>
    const configMeta = `<meta id="pdf-preview-config" data-config="${escapeAttribute(
      JSON.stringify(settings)
    )}">`;
    const pdfCss = `<link rel="stylesheet" href="${resolveAsUri(
      'lib',
      'pdf.css'
    )}">`;
    const mainScript = `<script src="${resolveAsUri(
      'lib',
      'main.js'
    )}" type="module"></script>`;
    html = html.replace(
      '</head>',
      `${configMeta}\n${pdfCss}\n${mainScript}\n</head>`
    );

    return html;
  }
}
