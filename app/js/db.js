// Tiny IndexedDB wrapper. Everything stays on this device.
const DB_NAME = 'gastos';
const VERSION = 4;
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['expenses', 'recurring', 'receipts', 'income', 'goals', 'debts']) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const out = fn(t.objectStore(store));
        t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const db = {
  all: (store) => tx(store, 'readonly', (s) => s.getAll()),
  keys: (store) => tx(store, 'readonly', (s) => s.getAllKeys()),
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  put: (store, val, key) => tx(store, 'readwrite', (s) => (key !== undefined ? s.put(val, key) : s.put(val))),
  del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
  bulkPut: (store, vals) => tx(store, 'readwrite', (s) => { vals.forEach((v) => s.put(v)); }),
  bulkDel: (store, keys) => tx(store, 'readwrite', (s) => { keys.forEach((k) => s.delete(k)); }),
};
