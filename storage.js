// storage.js — 抽象ストレージ API (localStorage + IndexedDB)
// Phase 3: この層を Supabase 実装に差し替える。UI 側は一切変更不要にする。

const Storage = (() => {
  const SHEETS_KEY = 'blog.sheets';
  const FLAGS_KEY = 'blog.flags';
  const DB_NAME = 'blog-photos';
  const DB_VERSION = 1;
  const STORE = 'photos';

  // ── IndexedDB (写真) ──────────────────────────────
  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  // Phase 3: Supabase Storage への put に差し替え
  async function savePhoto(key, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve(key);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getPhotoBlob(key) {
    if (!key) return null;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  const _urlCache = new Map();

  // Phase 3: Supabase Storage の署名URLを返すように差し替え
  async function getPhotoURL(key) {
    if (!key) return null;
    if (_urlCache.has(key)) return _urlCache.get(key);
    const blob = await getPhotoBlob(key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    _urlCache.set(key, url);
    return url;
  }

  async function deletePhoto(key) {
    if (!key) return;
    const cached = _urlCache.get(key);
    if (cached) {
      URL.revokeObjectURL(cached);
      _urlCache.delete(key);
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listPhotoKeys() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ── localStorage (シート) ─────────────────────────
  // Phase 3: Supabase DB (sheets テーブル) への呼び出しに差し替え
  function _loadAll() {
    try {
      return JSON.parse(localStorage.getItem(SHEETS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }
  function _saveAll(sheets) {
    localStorage.setItem(SHEETS_KEY, JSON.stringify(sheets));
  }

  function listSheets() {
    return _loadAll().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  function getSheet(id) {
    return _loadAll().find((s) => s.id === id) || null;
  }

  function saveSheet(sheet) {
    const sheets = _loadAll();
    const idx = sheets.findIndex((s) => s.id === sheet.id);
    if (idx >= 0) sheets[idx] = sheet;
    else sheets.push(sheet);
    _saveAll(sheets);
    return sheet;
  }

  async function deleteSheet(id) {
    const sheet = getSheet(id);
    if (sheet && Array.isArray(sheet.cells)) {
      for (const c of sheet.cells) {
        if (c.photoKey) {
          try { await deletePhoto(c.photoKey); } catch (e) { /* ignore */ }
        }
      }
    }
    _saveAll(_loadAll().filter((s) => s.id !== id));
  }

  // ── フラグ (オンボーディング等) ────────────────────
  function _loadFlags() {
    try {
      return JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  function _saveFlags(flags) {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  }
  function getFlag(key) {
    return _loadFlags()[key];
  }
  function setFlag(key, value) {
    const flags = _loadFlags();
    flags[key] = value;
    _saveFlags(flags);
  }

  return {
    saveSheet, getSheet, listSheets, deleteSheet,
    savePhoto, getPhotoURL, deletePhoto, listPhotoKeys,
    getFlag, setFlag,
  };
})();

window.Storage = Storage;

// debugStore: 全状態をコンソールに出す
window.debugStore = async function debugStore() {
  const sheets = Storage.listSheets();
  const photoKeys = await Storage.listPhotoKeys();
  const flags = {
    onboarding_done: Storage.getFlag('onboarding_done'),
    photo_warning_seen: Storage.getFlag('photo_warning_seen'),
  };
  const reserved = sheets.map((s) => ({
    id: s.id,
    ownerId: s.ownerId,
    isPublic: s.isPublic,
    sourceSheetId: s.sourceSheetId,
    stats: s.stats,
    cellChildren: s.cells.map((c) => ({ id: c.id, children: c.children, referenceCell: c.referenceCell })),
  }));
  console.group('B·log debugStore');
  console.log('sheets:', sheets);
  console.log('photoKeys:', photoKeys);
  console.log('flags:', flags);
  console.log('reserved fields:', reserved);
  console.groupEnd();
  return { sheets, photoKeys, flags, reserved };
};
