// Minimal IndexedDB queue for offline autosaves
export type QueuedSave = { id: string; url: string; method: string; headers?: Record<string, string>; body?: any; createdAt: number };

const DB_NAME = 'TrainerSavesDB';
const STORE = 'saves';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSave(save: Omit<QueuedSave, 'id' | 'createdAt'>) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await new Promise((res, rej) => {
      const r = store.add({ id, createdAt: Date.now(), ...save });
      r.onsuccess = () => res(null);
      r.onerror = () => rej(r.error);
    });
    tx.commit?.();
    db.close();
  } catch {}
}

export async function flushQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const items: QueuedSave[] = await new Promise((resolve) => {
    const all: QueuedSave[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (cursor) {
        all.push(cursor.value);
        cursor.continue();
      } else resolve(all);
    };
    req.onerror = () => resolve(all);
  });

  for (const it of items) {
    try {
      const res = await fetch(it.url, {
        method: it.method,
        headers: it.headers,
        body: it.body ? JSON.stringify(it.body) : undefined,
      });
      if (res.ok) {
        await new Promise((res2, rej2) => {
          const del = store.delete(it.id);
          del.onsuccess = () => res2(null);
          del.onerror = () => rej2(del.error);
        });
      }
    } catch {
      // keep in queue
    }
  }

  tx.commit?.();
  db.close();
}