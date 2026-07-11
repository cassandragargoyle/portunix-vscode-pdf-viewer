// Mocha runner executed inside the VS Code Extension Test Host
// Discovers and runs all *.test.js files in this directory

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    // Generous timeout: the webview must download nothing, but pdf.js parsing
    // and first-page render inside the test host can take several seconds
    timeout: 60000,
  });

  const testsRoot = path.resolve(__dirname);
  const files = await glob('**/*.test.js', { cwd: testsRoot });

  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed`));
      } else {
        resolve();
      }
    });
  });
}
