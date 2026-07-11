import * as vscode from 'vscode';
import { PdfCustomProvider } from './pdfProvider';
import { PdfWebviewMessage } from './pdfPreview';

// Public extension API returned from activate(); lets an integration test observe
// viewer lifecycle messages posted from the webview (smoke check, issue 084)
export interface PdfExtensionApi {
  onDidReceiveWebviewMessage: vscode.Event<PdfWebviewMessage>;
}

export function activate(context: vscode.ExtensionContext): PdfExtensionApi {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  // Register our custom editor provider
  const provider = new PdfCustomProvider(extensionRoot);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PdfCustomProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false, // default
          retainContextWhenHidden: true,
        },
      }
    )
  );

  return { onDidReceiveWebviewMessage: provider.onDidReceiveWebviewMessage };
}

export function deactivate(): void {}
