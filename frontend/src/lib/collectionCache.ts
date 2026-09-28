import { onSocketReady } from './socket';

/**
 * Keeps a full in-memory copy of a backend collection, seeded by one REST fetch and
 * kept current via Socket.io `${entity}:created|updated|deleted` events. `subscribe()`
 * always hands its callback the *complete* current array (never a delta) - the same
 * contract the old Firestore `onSnapshot`-based subscribeTo* functions had, so
 * callers (App.tsx's setMachines/setBranches/etc.) don't need to change.
 */
export function createCollectionCache<T extends { id: string }>(opts: {
  entity: string;
  fetchAll: () => Promise<T[]>;
  sort?: (items: T[]) => T[];
  /** Normalizes a raw socket payload into T (fetchAll is expected to return already-mapped items). */
  map?: (raw: any) => T;
}) {
  const fromSocket = (raw: any): T => (opts.map ? opts.map(raw) : raw);
  let cache: T[] = [];
  let loaded = false;
  let loadPromise: Promise<void> | null = null;
  const listeners = new Set<(items: T[]) => void>();

  const snapshot = () => (opts.sort ? opts.sort([...cache]) : [...cache]);

  function notify() {
    const items = snapshot();
    listeners.forEach((cb) => cb(items));
  }

  function upsert(item: T) {
    const idx = cache.findIndex((c) => c.id === item.id);
    cache = idx === -1 ? [item, ...cache] : [...cache.slice(0, idx), item, ...cache.slice(idx + 1)];
  }

  function remove(id: string) {
    cache = cache.filter((c) => c.id !== id);
  }

  async function load(): Promise<void> {
    if (!loadPromise) {
      loadPromise = opts
        .fetchAll()
        .then((items) => {
          cache = items;
          loaded = true;
          notify();
        })
        .finally(() => {
          loadPromise = null;
        });
    }
    return loadPromise;
  }

  // Named handler refs so they can be removed before re-registration on a new socket,
  // preventing duplicates if connectSocket is called more than once in a session.
  let connectedBefore = false;
  const onConnect = () => { if (connectedBefore && loaded) load(); connectedBefore = true; };
  const onCreated = (item: T) => { upsert(fromSocket(item)); notify(); };
  const onUpdated = (item: T) => { upsert(fromSocket(item)); notify(); };
  const onDeleted = (payload: { id: string }) => { remove(payload.id); notify(); };

  onSocketReady((socket) => {
    // Remove stale listeners before re-registering on the new socket (guards against
    // duplicate handlers when connectSocket fires all onSocketReady callbacks again).
    socket.off('connect', onConnect);
    socket.off(`${opts.entity}:created`, onCreated);
    socket.off(`${opts.entity}:updated`, onUpdated);
    socket.off(`${opts.entity}:deleted`, onDeleted);

    // Events emitted while the socket was down are lost - re-sync from REST on every reconnect.
    socket.on('connect', onConnect);
    socket.on(`${opts.entity}:created`, onCreated);
    socket.on(`${opts.entity}:updated`, onUpdated);
    socket.on(`${opts.entity}:deleted`, onDeleted);
  });

  return {
    subscribe(cb: (items: T[]) => void): () => void {
      listeners.add(cb);
      if (loaded) cb(snapshot());
      else load();
      return () => listeners.delete(cb);
    },
    async refresh(): Promise<T[]> {
      await load();
      return cache;
    },
  };
}
