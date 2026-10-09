import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const sqliteDir = dirname(require.resolve('expo-sqlite/package.json'));

// Execute the installed worker's actual serializer without starting a browser worker.
function loadWorkerModule(file) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, require: (name) => loadWorkerModule(resolve(dirname(file), `${name}.ts`)),
    SharedArrayBuffer, Uint8Array, Uint32Array, Int32Array, TextEncoder, TextDecoder, Atomics,
    __DEV__: false,
  });
  return exports;
}

test('SQLite worker preserves the complete UTF-8 response length above 255 and 65535 bytes', () => {
  const { sendWorkerResult } = loadWorkerModule(resolve(sqliteDir, 'web/WorkerChannel.ts'));
  for (const size of [300, 70_000]) {
    const body = 'Site work · 工程'.repeat(size);
    const syncTrait = { lockBuffer: new SharedArrayBuffer(4), resultBuffer: new SharedArrayBuffer(2_000_000) };
    sendWorkerResult({ id: 1, result: { body }, error: null, syncTrait });
    const length = new Uint32Array(syncTrait.resultBuffer, 0, 1)[0];
    const expected = new TextEncoder().encode(JSON.stringify({ result: { body } }));
    assert.equal(length, expected.length);
    assert.equal(Atomics.load(new Int32Array(syncTrait.lockBuffer), 0), 2);
    const decoded = JSON.parse(new TextDecoder().decode(new Uint8Array(syncTrait.resultBuffer, 4, length)));
    assert.equal(decoded.result.body, body);
  }
});
