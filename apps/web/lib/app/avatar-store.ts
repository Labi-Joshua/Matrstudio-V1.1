/**
 * The signed-in learner's profile photo URL for the shell (top bar, menu, sidebar card): read once
 * from GET /api/me/profile and shared by every Avatar. The API's URL carries `?v=<updated>`, so a
 * changed photo is a new URL and the browser cache needs no help. Any failure leaves the URL null
 * (initials show) and is not retried until the profile changes. The store belongs to one learner:
 * a different owner key (the email) starts over, so a second sign-in in the same tab never shows
 * the first learner's photo.
 */
export const PROFILE_CHANGE_EVENT = "matr:profile-change";

export type AvatarSnapshot = { owner: string | null; url: string | null };

export function createAvatarStore(fetchUrl: () => Promise<string | null>) {
  let snapshot: AvatarSnapshot = { owner: null, url: null };
  let loading: string | null = null;
  let wanted: string | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  function load(owner: string) {
    wanted = owner;
    if (snapshot.owner === owner || loading === owner) return;
    loading = owner;
    fetchUrl()
      .catch(() => null)
      .then((url) => {
        if (loading !== owner) return;
        loading = null;
        snapshot = { owner, url };
        emit();
      });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Starts the read for `owner` unless it already has an answer (or one is on its way). */
    load,
    /** The photo may have changed: read it again for whoever is showing it. */
    refresh() {
      snapshot = { owner: null, url: snapshot.url };
      loading = null;
      if (wanted !== null) load(wanted);
    },
  };
}
