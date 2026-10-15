import assert from 'node:assert/strict';
import { test } from 'node:test';
import { richTextDocument } from '../../src/components/rich-text/html-document.ts';

test('Enriched HTML round-trips durable image IDs and formatting without saving temporary URLs', () => {
  const images = [{ fileId: 'file-photo', name: 'Beam', source: 'blob:ephemeral', width: 280, height: 160 }];
  const raw = '<p><strong>Beam</strong> <em>ready</em></p><codeblock>const x = 1;</codeblock><img src="blob:ephemeral">';
  const stored = richTextDocument(raw, images);
  assert.match(stored, /data-file-id="file-photo"/); assert.doesNotMatch(stored, /blob:|codeblock/); assert.match(stored, /<pre>const x = 1;<\/pre>/);
  const display = richTextDocument(stored, images, true); assert.match(display, /blob:ephemeral/); assert.match(display, /codeblock/);
  assert.equal(richTextDocument(display, images), stored);
  const unsafe = richTextDocument('<script>secret()</script><iframe>hidden</iframe><a href="javascript:alert(1)">link</a><img src="https://unknown.invalid/tracker.png"><p>safe</p>');
  assert.doesNotMatch(unsafe, /secret|hidden|javascript|tracker/); assert.match(unsafe, /safe/);
});
