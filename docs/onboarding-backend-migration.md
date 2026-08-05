# Onboarding — Backend Migration Guide

When the backend team adds an `isOnboarded` field to the user record, this document
describes the exact changes needed to replace the temporary `localStorage` strategy.

---

## Current strategy (localStorage)

**Key:** `buildpanda:onboarding-complete:{userId}`  
**Set:** `markOnboardingComplete(userId)` in `src/lib/route-guards.tsx`  
**Read:** `isOnboardingComplete(userId)` in the same file  

The key is scoped to `userId` so multiple users on the same device don't share state.
It survives page refreshes and browser restarts for the same user on the same device,
but does **not** roam to other devices.

---

## One function to change

Everything routes through `isOnboardingComplete` in `packages/frontend/src/lib/route-guards.tsx`.

```ts
// CURRENT — reads localStorage
export function isOnboardingComplete(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`buildpanda:onboarding-complete:${userId}`) === "true";
  } catch {
    return false;
  }
}
```

Replace the body with a check against the session flag:

```ts
// FUTURE — reads backend flag from the session user object
export function isOnboardingComplete(userId: string | null | undefined): boolean {
  // userId is kept in the signature for API symmetry, but the flag comes
  // from the session object which already knows the current user.
  //
  // The session hook (authClient.useSession) must expose the new field.
  // See "auth-client.ts changes" below for how to surface it.
  return Boolean((window.__BP_SESSION_USER__ as { isOnboarded?: boolean } | undefined)?.isOnboarded);
}
```

In practice, replace with whatever pattern `authClient.useSession()` provides
(e.g. `data?.user?.isOnboarded`). The point is: **one function body to swap.**

---

## auth-client.ts changes

`better-auth` requires explicit field declarations to forward custom user fields
through the session payload. When the backend migration ships, add `isOnboarded`
to `inferAdditionalFields` in `packages/frontend/src/lib/auth-client.ts`:

```ts
// packages/frontend/src/lib/auth-client.ts
export const authClient = createAuthClient({
  // ...existing config...
  plugins: [
    inferAdditionalFields<{
      user: {
        accountType: string;
        isOnboarded: boolean;   // ← add this
      };
    }>(),
  ],
});
```

Once this is done, `session?.user?.isOnboarded` will be typed and available everywhere
the session is consumed, including inside `isOnboardingComplete`.

---

## markOnboardingComplete — keep or remove

`markOnboardingComplete(userId)` is called at the end of Step 3 (`use-of-buildpanda.tsx`)
before navigating to `/dashboard`. When the backend owns the flag, this call should
trigger a PATCH/POST to the backend to set `isOnboarded = true`, then navigate.

Example replacement:

```ts
// packages/frontend/src/lib/route-guards.ts
export async function markOnboardingComplete(userId: string): Promise<void> {
  await api.patch(`/users/${userId}/onboarding-complete`);
  // localStorage write can stay for instant feedback while the session refreshes:
  try { localStorage.setItem(`buildpanda:onboarding-complete:${userId}`, "true"); } catch {}
}
```

Update the call-site in `use-of-buildpanda.tsx` to `await` the async function and
show a loading state on the Continue button during the request.

---

## Files to touch (summary)

| File | Change |
|---|---|
| `packages/frontend/src/lib/route-guards.tsx` | Replace body of `isOnboardingComplete`; make `markOnboardingComplete` async |
| `packages/frontend/src/lib/auth-client.ts` | Add `isOnboarded: boolean` to `inferAdditionalFields` |
| `packages/frontend/src/pages/onboarding/use-of-buildpanda.tsx` | Await async `markOnboardingComplete`; add button loading state |
| `packages/backend/src/modules/auth/` | Add `isOnboarded` column migration + PATCH endpoint |

---

## localStorage key (for cleanup)

Once the backend flag is the source of truth, you can delete all stored keys:

```ts
// One-time cleanup, run in a migration script or on first successful login
localStorage.removeItem(`buildpanda:onboarding-complete:${userId}`);
```

Or just leave them — they're harmless once `isOnboardingComplete` no longer reads them.
