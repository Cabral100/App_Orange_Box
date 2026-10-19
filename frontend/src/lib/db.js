// Mantém o nome legado para não apagar fotos já salvas em versões anteriores.
const DB_NAME = "orange-box-field";
const DB_VERSION = 1;
const DETECTIONS = "detections";
const PLOTS = "plots";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DETECTIONS)) {
        const store = db.createObjectStore(DETECTIONS, { keyPath: "id" });
        store.createIndex("capturedAt", "capturedAt");
      }
      if (!db.objectStoreNames.contains(PLOTS)) {
        db.createObjectStore(PLOTS, { keyPath: "id" });
      }
    };
  });
}

async function transaction(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result?.result ?? result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Transação cancelada"));
    };
  });
}

async function getAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

export async function listDetections() {
  const rows = await getAll(DETECTIONS);
  return rows.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
}

export function saveDetection(record) {
  return transaction(DETECTIONS, "readwrite", (store) => store.put(record));
}

export function removeDetection(id) {
  return transaction(DETECTIONS, "readwrite", (store) => store.delete(id));
}

export function clearDetections() {
  return transaction(DETECTIONS, "readwrite", (store) => store.clear());
}

export async function listPlots() {
  return getAll(PLOTS);
}

export function savePlot(plot) {
  return transaction(PLOTS, "readwrite", (store) => store.put(plot));
}

export function removePlot(id) {
  return transaction(PLOTS, "readwrite", (store) => store.delete(id));
}
