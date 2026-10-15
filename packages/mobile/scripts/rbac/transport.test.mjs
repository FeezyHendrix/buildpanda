import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { registerHooks } from 'node:module';
import { authorize, scope, snapshot, tick } from './fixtures.mjs';
import { projectAccess, configureAccessLifecycle } from '../../src/lib/project-access-store.ts';
import { createAccessSession } from '../../src/lib/access-session.ts';

const source = new URL('../../src/', import.meta.url);
const code = (text) => ({ url: `data:text/javascript,${encodeURIComponent(text)}`, shortCircuit: true });
// Exercise the real API clients; only native platform, auth-cookie and HTTP I/O are fixtures.
registerHooks({ resolve(specifier, context, next) {
  const path = specifier.startsWith('@/') ? new URL(specifier.slice(2), source).pathname : specifier.startsWith('.') ? new URL(specifier, context.parentURL).pathname : '';
  if (/\/lib\/auth-client(?:\.ts)?$/.test(path)) return code('export const API_BASE_URL="http://fixture"; export const authClient={getCookie:()=>"fixture"};');
  if (/\/lib\/payload-session(?:\.ts)?$/.test(path)) return code('export const payloadSession=async()=>null; export const randomBytes=()=>new Uint8Array(); export const resetPayloadSession=()=>{}; export const isStaleKeyError=()=>false;');
  if (specifier === 'react-native') return code('export const Platform={get OS(){return globalThis.fixturePlatform??"ios"}};');
  if (specifier === 'expo-file-system') return { url: new URL('../voice/filesystem.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'expo-file-system/legacy') return code('export const FileSystemUploadType={MULTIPART:1}; export const uploadAsync=async()=>globalThis.fixtureUpload; export const createUploadTask=()=>({uploadAsync,cancelAsync:async()=>{}});');
  return next(specifier, context);
} });
const { request, ApiError } = await import('../../src/api/client.ts');
const { uploadProjectFile } = await import('../../src/api/files.ts');
const { requestVoiceReport } = await import('../../src/api/voice-report.ts');
const { streamChat } = await import('../../src/api/panda-ai.ts');
const grants = { project: ['view'], buildings: ['view'], documents: ['view', 'upload'], tasks: ['view', 'add'] };
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
const failure = (code = 'feature_disabled') => ({ error: 'Feature is currently disabled', code });

test('disabled feature fails its request without revoking unrelated project access or offline eligibility', async () => {
  authorize(grants);
  let purged = 0;
  const session = createAccessSession({ scope, store: projectAccess, saved: snapshot(grants),
    fetch: async () => snapshot(grants), save: () => {}, purge: async () => { purged++; },
  });
  const close = configureAccessLifecycle(session);
  session.connectivity(true, true); await session.refresh();
  globalThis.fetch = async (url) => new Response(JSON.stringify(url.endsWith('/buildings') ? failure() : { id: 'site' }), { status: url.endsWith('/buildings') ? 403 : 200 });
  try {
    await assert.rejects(request('/projects/site/buildings'), (error) => error instanceof ApiError && error.code === 'feature_disabled');
    assert.equal((await request('/projects/site')).id, 'site');
    session.connectivity(false, false);
    assert.equal(projectAccess.can('site', 'project', 'view'), true);
    assert.equal(purged, 0);
  } finally { session.close(); close(); }
});

test('real and unrecognized access denials still revoke immediately and clear offline access', async () => {
  for (const [status, body] of [[403, failure('forbidden')], [403, { error: 'Denied' }], [403, '<html>Denied</html>'], [401, failure()]]) {
    authorize(grants); let calls = 0, purged = 0;
    const session = createAccessSession({ scope, store: projectAccess, saved: snapshot(grants),
      fetch: async () => snapshot(grants), save: () => {}, purge: async () => { purged++; },
    });
    const close = configureAccessLifecycle(session);
    globalThis.fetch = async () => { calls++; return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }); };
    try {
      await assert.rejects(request('/projects/site/buildings'));
      assert.equal(projectAccess.getState().status, 'denied');
      session.connectivity(false, false);
      assert.equal(projectAccess.can('site', 'project', 'view'), false);
      await assert.rejects(request('/projects/site'));
      assert.equal(calls, 1); await tick(); assert.equal(purged, 1);
    } finally { session.close(); close(); }
  }
});

test('a late rejection cannot revoke another selected scope', async () => {
  authorize(grants);
  globalThis.fetch = async () => {
    const next = { ...scope, projectId: 'other' };
    projectAccess.setScope(next);
    projectAccess.accept(snapshot(grants, next), projectAccess.getState().generation);
    return new Response(JSON.stringify(failure('forbidden')), { status: 403 });
  };
  await assert.rejects(request('/projects/site/buildings'), /changed/);
  assert.equal(projectAccess.can('other', 'project', 'view'), true);
});

test('file uploads, voice uploads and AI responses use the same typed failure policy', async () => {
  for (const reason of ['feature_disabled', 'forbidden']) {
    const body = JSON.stringify(failure(reason));
    globalThis.fixtureUpload = { status: 403, body };
    globalThis.fetch = async (url) => new Response(String(url).startsWith('data:') ? 'image' : body, { status: String(url).startsWith('data:') ? 200 : 403 });
    for (const platform of ['ios', 'web']) {
      globalThis.fixturePlatform = platform; authorize(grants);
      await assert.rejects(uploadProjectFile('site', platform === 'web' ? 'data:image/png;base64,AA==' : 'file:///image.png', 'image.png', 'image/png'), (error) => error.code === reason);
      assert.equal(projectAccess.can('site', 'project', 'view'), reason === 'feature_disabled');
    }
    globalThis.fixturePlatform = 'ios'; authorize(grants);
    await assert.rejects(requestVoiceReport('site', 'file:///voice.m4a'), (error) => error.code === reason);
    assert.equal(projectAccess.can('site', 'project', 'view'), reason === 'feature_disabled');
    authorize(grants); const errors = [];
    await streamChat('site', [], new AbortController().signal, () => {}, () => {}, () => {}, (error) => errors.push(error));
    assert.deepEqual(errors, ['Feature is currently disabled']);
    assert.equal(projectAccess.can('site', 'project', 'view'), reason === 'feature_disabled');
  }
});
