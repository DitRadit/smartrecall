/**
 * indexedDbCache.js - Wrapper IndexedDB untuk cache data offline siswa.
 *
 * PENTING (ARCHITECTURE.md prinsip #3): IndexedDB di sini HANYA cache.
 * Data utama (source of truth) selalu di SQLite via backend-api. Saat
 * online, data di IndexedDB selalu ditimpa ulang dengan response terbaru
 * dari backend-api (lihat services/api.js).
 */

import { openDB } from 'idb';

const DB_NAME = 'smartrecall-offline';
const DB_VERSION = 2; // v2: tambah store soal, rangkuman, quiz_queue

const STORE_MATERI = 'materi';
const STORE_GROUPS = 'groups'; // cache folder
const STORE_FLASHCARDS = 'flashcards';
const STORE_REVIEW_SCHEDULE = 'review_schedule';
const STORE_REVIEW_QUEUE = 'review_queue'; // offline queue untuk submit skor (lih. syncManager.js)
const STORE_SOAL = 'soal'; // cache bank soal per materi (FR-13)
const STORE_RANGKUMAN = 'rangkuman'; // cache rangkuman per materi
const STORE_QUIZ_QUEUE = 'quiz_queue'; // offline queue untuk submit hasil kuis

async function getDb() {
  return openDB(DB_NAME, DB_VERSION + 1, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE_MATERI)) {
        db.createObjectStore(STORE_MATERI, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_GROUPS)) {
        db.createObjectStore(STORE_GROUPS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FLASHCARDS)) {
        db.createObjectStore(STORE_FLASHCARDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_REVIEW_SCHEDULE)) {
        db.createObjectStore(STORE_REVIEW_SCHEDULE, { keyPath: 'siswaId' });
      }
      if (!db.objectStoreNames.contains(STORE_REVIEW_QUEUE)) {
        db.createObjectStore(STORE_REVIEW_QUEUE, { keyPath: 'localId', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_SOAL)) {
        db.createObjectStore(STORE_SOAL, { keyPath: 'materiId' });
      }
      if (!db.objectStoreNames.contains(STORE_RANGKUMAN)) {
        db.createObjectStore(STORE_RANGKUMAN, { keyPath: 'materiId' });
      }
      if (!db.objectStoreNames.contains(STORE_QUIZ_QUEUE)) {
        db.createObjectStore(STORE_QUIZ_QUEUE, { keyPath: 'localId', autoIncrement: true });
      }
    },
  });
}

// --- Materi cache ---
export async function cacheMateriList(materiList) {
  const db = await getDb();
  const tx = db.transaction(STORE_MATERI, 'readwrite');
  await Promise.all(materiList.map((m) => tx.store.put(m)));
  await tx.done;
}

export async function getCachedMateriList() {
  const db = await getDb();
  return db.getAll(STORE_MATERI);
}

// --- Group (Folder) cache ---
export async function cacheGroupList(groupList) {
  const db = await getDb();
  const tx = db.transaction(STORE_GROUPS, 'readwrite');
  await Promise.all(groupList.map((g) => tx.store.put(g)));
  await tx.done;
}

export async function getCachedGroupList() {
  const db = await getDb();
  return db.getAll(STORE_GROUPS);
}

// --- Flashcards cache ---
export async function cacheFlashcards(flashcards) {
  const db = await getDb();
  const tx = db.transaction(STORE_FLASHCARDS, 'readwrite');
  await Promise.all(flashcards.map((f) => tx.store.put(f)));
  await tx.done;
}

export async function getCachedFlashcards(materiId) {
  const db = await getDb();
  const all = await db.getAll(STORE_FLASHCARDS);
  return materiId ? all.filter((f) => f.materiId === materiId) : all;
}

// --- Review schedule cache ---
export async function cacheReviewSchedule(siswaId, schedule) {
  const db = await getDb();
  await db.put(STORE_REVIEW_SCHEDULE, { siswaId, ...schedule });
}

export async function getCachedReviewSchedule(siswaId) {
  const db = await getDb();
  return db.get(STORE_REVIEW_SCHEDULE, siswaId);
}

// --- Offline queue untuk submit review (dipakai syncManager.js) ---
export async function enqueueReview(reviewPayload) {
  const db = await getDb();
  return db.add(STORE_REVIEW_QUEUE, {
    ...reviewPayload,
    queuedAt: new Date().toISOString(),
  });
}

export async function getQueuedReviews() {
  const db = await getDb();
  return db.getAll(STORE_REVIEW_QUEUE);
}

export async function removeQueuedReview(localId) {
  const db = await getDb();
  return db.delete(STORE_REVIEW_QUEUE, localId);
}

// --- Soal (kuis) cache ---
export async function cacheSoal(materiId, soalData) {
  const db = await getDb();
  await db.put(STORE_SOAL, { materiId, ...soalData });
}

export async function getCachedSoal(materiId) {
  const db = await getDb();
  return db.get(STORE_SOAL, materiId);
}

// --- Rangkuman cache ---
export async function cacheRangkuman(materiId, rangkumanData) {
  const db = await getDb();
  await db.put(STORE_RANGKUMAN, { materiId, ...rangkumanData });
}

export async function getCachedRangkuman(materiId) {
  const db = await getDb();
  return db.get(STORE_RANGKUMAN, materiId);
}

// --- Offline queue untuk submit hasil kuis (pola sama dengan review queue) ---
export async function enqueueQuizSubmit(payload) {
  const db = await getDb();
  return db.add(STORE_QUIZ_QUEUE, {
    ...payload,
    queuedAt: new Date().toISOString(),
  });
}

export async function getQueuedQuizSubmits() {
  const db = await getDb();
  return db.getAll(STORE_QUIZ_QUEUE);
}

export async function removeQueuedQuizSubmit(localId) {
  const db = await getDb();
  return db.delete(STORE_QUIZ_QUEUE, localId);
}

export const STORES = {
  STORE_MATERI,
  STORE_GROUPS,
  STORE_FLASHCARDS,
  STORE_REVIEW_SCHEDULE,
  STORE_REVIEW_QUEUE,
  STORE_SOAL,
  STORE_RANGKUMAN,
  STORE_QUIZ_QUEUE,
};