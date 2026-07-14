/**
 * setup.js - Global test setup untuk Vitest.
 *
 * Menyediakan polyfill IndexedDB (fake-indexeddb) supaya modul yang
 * bergantung pada IndexedDB (src/offline/indexedDbCache.js) bisa dites
 * di lingkungan Node tanpa browser sungguhan.
 */
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
