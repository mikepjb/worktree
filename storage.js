(() => {
  "use strict";

  const DATABASE_NAME = "worktree";
  const DATABASE_VERSION = 1;
  const SETTINGS_STORE = "settings";
  const SNAPSHOTS_STORE = "snapshots";
  const INBOX_STORE = "inbox";
  const GITHUB_SETTINGS_KEY = "github";

  let databasePromise;

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), {
        once: true,
      });
      request.addEventListener("error", () => reject(request.error), {
        once: true,
      });
    });
  }

  function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener(
        "abort",
        () => reject(transaction.error ?? new Error("Transaction aborted")),
        { once: true },
      );
      transaction.addEventListener("error", () => reject(transaction.error), {
        once: true,
      });
    });
  }

  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.addEventListener("upgradeneeded", () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          const snapshots = database.createObjectStore(SNAPSHOTS_STORE, {
            keyPath: "id",
          });
          snapshots.createIndex("storedAt", "storedAt");
        }

        if (!database.objectStoreNames.contains(INBOX_STORE)) {
          const inbox = database.createObjectStore(INBOX_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          inbox.createIndex("createdAt", "createdAt");
        }
      });

      request.addEventListener("success", () => {
        const database = request.result;
        database.addEventListener("versionchange", () => {
          database.close();
          databasePromise = undefined;
        });
        resolve(database);
      });

      request.addEventListener("error", () => {
        databasePromise = undefined;
        reject(request.error);
      });

      request.addEventListener("blocked", () => {
        console.warn("Worktree database upgrade is blocked by another tab");
      });
    });

    return databasePromise;
  }

  async function useStore(storeName, mode, operation) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, mode);
    const completion = transactionComplete(transaction);

    try {
      const result = await operation(transaction.objectStore(storeName));
      await completion;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have completed or aborted.
      }
      try {
        await completion;
      } catch {
        // Preserve the error raised by the store operation.
      }
      throw error;
    }
  }

  function getSettings() {
    return useStore(SETTINGS_STORE, "readonly", async (store) => {
      const record = await requestResult(store.get(GITHUB_SETTINGS_KEY));
      if (!record) {
        return undefined;
      }

      const { key: _key, ...settings } = record;
      return settings;
    });
  }

  function saveSettings(settings) {
    if (!settings || typeof settings !== "object") {
      return Promise.reject(new TypeError("Settings must be an object"));
    }

    return useStore(SETTINGS_STORE, "readwrite", async (store) => {
      await requestResult(
        store.put({
          ...settings,
          key: GITHUB_SETTINGS_KEY,
        }),
      );
    });
  }

  function getSnapshot(repositoryId) {
    return useStore(SNAPSHOTS_STORE, "readonly", (store) =>
      requestResult(store.get(repositoryId)),
    );
  }

  function getLatestSnapshot() {
    return useStore(SNAPSHOTS_STORE, "readonly", async (store) => {
      const snapshots = await requestResult(store.getAll());
      return snapshots.sort((left, right) =>
        String(right.storedAt).localeCompare(String(left.storedAt)),
      )[0];
    });
  }

  function replaceSnapshot(repositoryId, snapshot) {
    if (!repositoryId || typeof repositoryId !== "string") {
      return Promise.reject(new TypeError("Repository ID is required"));
    }
    if (!snapshot || typeof snapshot !== "object") {
      return Promise.reject(new TypeError("Snapshot must be an object"));
    }

    const record = {
      ...snapshot,
      id: repositoryId,
      storedAt: new Date().toISOString(),
    };

    return useStore(SNAPSHOTS_STORE, "readwrite", async (store) => {
      await requestResult(store.put(record));
      return record;
    });
  }

  function listInboxItems() {
    return useStore(INBOX_STORE, "readonly", async (store) => {
      const items = await requestResult(store.getAll());
      return items.sort((left, right) =>
        String(left.createdAt).localeCompare(String(right.createdAt)),
      );
    });
  }

  function addInboxItem(text) {
    const normalizedText = String(text).trim();
    if (!normalizedText) {
      return Promise.reject(new TypeError("Inbox text is required"));
    }

    const item = {
      text: normalizedText,
      createdAt: new Date().toISOString(),
    };

    return useStore(INBOX_STORE, "readwrite", async (store) => {
      const id = await requestResult(store.add(item));
      return { ...item, id };
    });
  }

  function removeInboxItem(id) {
    return useStore(INBOX_STORE, "readwrite", async (store) => {
      await requestResult(store.delete(id));
    });
  }

  function clearInbox() {
    return useStore(INBOX_STORE, "readwrite", async (store) => {
      await requestResult(store.clear());
    });
  }

  async function clearAllData() {
    const database = await openDatabase();
    const transaction = database.transaction(
      [SETTINGS_STORE, SNAPSHOTS_STORE, INBOX_STORE],
      "readwrite",
    );
    const completion = transactionComplete(transaction);

    transaction.objectStore(SETTINGS_STORE).clear();
    transaction.objectStore(SNAPSHOTS_STORE).clear();
    transaction.objectStore(INBOX_STORE).clear();

    await completion;
  }

  window.worktreeStorage = Object.freeze({
    openDatabase,
    getSettings,
    saveSettings,
    getSnapshot,
    getLatestSnapshot,
    replaceSnapshot,
    listInboxItems,
    addInboxItem,
    removeInboxItem,
    clearInbox,
    clearAllData,
  });
})();
