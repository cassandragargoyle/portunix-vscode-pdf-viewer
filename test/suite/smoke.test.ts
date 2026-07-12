// End-to-end smoke check (issue 084): open a known-good PDF in the real webview
// and assert the viewer loads without surfacing the diagnostic error overlay

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { PdfExtensionApi } from '../../src/extension';
import { PdfWebviewMessage } from '../../src/pdfPreview';

suite('PDF viewer smoke check (issue 084)', () => {
  test('opens a fixture PDF and reaches documentloaded without the error overlay', async function () {
    this.timeout(45000);

    const ext = vscode.extensions.getExtension<PdfExtensionApi>(
      'cassandragargoyle.portunix-pdf-viewer'
    );
    assert.ok(ext, 'pdf extension not found');
    const api = await ext.activate();
    assert.ok(
      api && api.onDidReceiveWebviewMessage,
      'extension did not export the webview message API'
    );

    // The fixture lives in the source tree; tsc does not copy it into out/, so
    // resolve it relative to the plugin root (three levels up from out/test/suite)
    const fixture = vscode.Uri.file(
      path.resolve(__dirname, '../../../test/fixtures/sample.pdf')
    );

    // Race the viewer's own lifecycle messages: documentloaded means the viewer
    // rendered the document end-to-end; pdf-viewer-error means the 1.3.1
    // diagnostic overlay appeared, which must fail the check
    const outcome = new Promise<'loaded'>((resolve, reject) => {
      const sub = api.onDidReceiveWebviewMessage((m: PdfWebviewMessage) => {
        if (m.type === 'documentloaded') {
          sub.dispose();
          resolve('loaded');
        } else if (m.type === 'pdf-viewer-error') {
          sub.dispose();
          reject(
            new Error(
              `viewer reported an error overlay: ${m.kind ?? ''} ${
                m.detail ?? ''
              }`.trim()
            )
          );
        }
      });
    });

    await vscode.commands.executeCommand('vscode.openWith', fixture, 'pdf.preview');

    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error('viewer did not reach documentloaded within 30s')),
        30000
      );
    });

    try {
      const result = await Promise.race([outcome, timeout]);
      assert.strictEqual(result, 'loaded');
    } finally {
      clearTimeout(timer!);
    }
  });
});
