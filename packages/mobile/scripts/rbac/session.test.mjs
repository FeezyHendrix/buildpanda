import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectAccessStore } from '../../src/lib/project-access-store.ts';
import { createAccessSession } from '../../src/lib/access-session.ts';
import { scope, snapshot, tick, deferred } from './fixtures.mjs';

function setup(saved = snapshot({ rfis: ['view', 'create'] })) {
  const store = createProjectAccessStore(); store.setScope(scope);
  const pending = [];
  const state = { purges: 0, saved: null };
  const session = createAccessSession({ scope, store, saved,
    fetch: () => { const next = deferred(); pending.push(next); return next.promise; },
    save: (value) => { state.saved = value; }, purge: async () => { state.purges++; },
  });
  return { store, session, pending, state };
}

test('a cached login or unknown connectivity cannot authorize offline work', () => {
  const { store, session } = setup(null);
  session.connectivity(null, null);
  assert.equal(store.can('site', 'rfis', 'view'), false);
  session.connectivity(false, false);
  assert.equal(store.can('site', 'rfis', 'view'), false);
});

test('offline snapshot allows work; reconnect blocks until refreshed; revocation purges and cannot resurrect offline', async () => {
  const { store, session, pending, state } = setup();
  session.connectivity(false, false);
  assert.equal(store.can('site', 'rfis', 'create'), true);
  session.connectivity(true, true);
  assert.equal(store.can('site', 'rfis', 'view'), false);
  await tick(); pending[0].resolve(snapshot({ rfis: ['view'] })); await session.refresh();
  assert.equal(store.can('site', 'rfis', 'view'), true);
  assert.equal(store.can('site', 'rfis', 'create'), false);
  assert.equal(state.purges, 1);
  const refresh = session.refresh(); await tick(); pending[1].reject({ status: 403 }); await refresh; await tick();
  assert.equal(store.getState().status, 'denied');
  session.connectivity(false, false);
  assert.equal(store.can('site', 'rfis', 'view'), false);
  assert.equal(state.purges, 2);
});

test('late refreshes cannot authorize a different user, workspace or project', async () => {
  for (const key of ['userId', 'organizationId', 'projectId']) {
    const { store, session, pending, state } = setup();
    session.connectivity(true, true); await tick();
    store.setScope({ ...scope, [key]: 'different' });
    pending[0].resolve(snapshot()); await session.refresh();
    assert.equal(store.getState().snapshot, null);
    assert.equal(state.saved, null);
  }
});

test('disconnection during refresh preserves an eligible snapshot only for transport failures', async () => {
  for (const status of [0, 403]) {
    const { store, session, pending } = setup();
    session.connectivity(false, false);
    session.connectivity(true, true); await tick();
    session.connectivity(false, false); pending[0].reject({ status }); await session.refresh();
    assert.equal(store.can('site', 'rfis', 'create'), status === 0);
  }
});

test('reconnect supersedes an in-flight refresh and cleanup precedes permission restoration', async () => {
  const { store, session, pending } = setup();
  session.connectivity(true, true); await tick();
  session.connectivity(false, false); session.connectivity(true, true);
  pending[0].resolve(snapshot({ rfis: ['view', 'create'] })); await tick();
  assert.equal(store.can('site', 'rfis', 'view'), false);
  assert.equal(pending.length, 2);
  pending[1].resolve(snapshot({ rfis: ['view'] })); await session.refresh();
  assert.equal(store.can('site', 'rfis', 'create'), false);
});

test('a changed grant blocks old access immediately while disk cleanup is still pending', async () => {
  const store = createProjectAccessStore(); store.setScope(scope);
  const previous = snapshot({ rfis: ['view', 'create'] });
  const cleanup = deferred(); let fetched = previous;
  const session = createAccessSession({ scope, store, saved: previous,
    fetch: async () => fetched, save: () => {}, purge: () => cleanup.promise,
  });
  session.connectivity(true, true); await session.refresh();
  assert.equal(store.can('site', 'rfis', 'create'), true);
  fetched = snapshot({ rfis: ['view'] });
  const refreshed = session.refresh(); await tick();
  assert.equal(store.can('site', 'rfis', 'create'), false);
  assert.equal(store.can('site', 'rfis', 'view'), false);
  cleanup.resolve(); await refreshed;
  assert.equal(store.can('site', 'rfis', 'view'), true);
  assert.equal(store.can('site', 'rfis', 'create'), false);
});
