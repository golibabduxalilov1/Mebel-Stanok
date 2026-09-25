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

  onSocketReady((socket) => {
    // Events emitted while the socket was down are lost - re-sync from REST on every reconnect.
    let connectedBefore = false;
    socket.on('connect', () => {
      if (connectedBefore && loaded) load();
      connectedBefore = true;
    });
    socket.on(`${opts.entity}:created`, (item: T) => {
      upsert(fromSocket(item));
      notify();
    });
    socket.on(`${opts.entity}:updated`, (item: T) => {
      upsert(fromSocket(item));
      notify();
    });
    socket.on(`${opts.entity}:deleted`, (payload: { id: string }) => {
      remove(payload.id);
      notify();
    });
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
