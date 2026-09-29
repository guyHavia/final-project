// DOM-free state machine behind the "saving… / saved / error" indicator used
// by the reporter's editing form. States: idle, dirty, saving, saved, error.
// There is no Save button anywhere — this is the only thing deciding when a
// save actually happens.

const DEBOUNCE_MS = 800;

/**
 * `save(snapshot)` performs one autosave call and should reject on failure.
 * `onStateChange({ state, savedAt, errorMessage })` is called on every
 * transition. `debounceMs` is overridable for tests.
 */
export function createSaveIndicator({ save, onStateChange, debounceMs = DEBOUNCE_MS }) {
  let state = 'idle';
  let savedAt = null;
  let errorMessage = null;
  let debounceTimer = null;
  let inFlight = false;
  let coalesced = false;
  let getSnapshot = null;

  function emit(next, extra = {}) {
    state = next;
    if ('savedAt' in extra) savedAt = extra.savedAt;
    if ('errorMessage' in extra) errorMessage = extra.errorMessage;
    onStateChange?.({ state, savedAt, errorMessage });
  }

  async function runSave() {
    inFlight = true;
    emit('saving');
    try {
      const result = await save(getSnapshot());
      inFlight = false;
      if (coalesced) {
        coalesced = false;
        return runSave();
      }
      emit('saved', { savedAt: result?.savedAt ? new Date(result.savedAt) : new Date() });
    } catch (err) {
      inFlight = false;
      if (coalesced) {
        coalesced = false;
        return runSave();
      }
      emit('error', { errorMessage: err?.message || 'save failed' });
    }
  }

  function debounceThenSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (inFlight) {
        coalesced = true;
      } else {
        runSave();
      }
    }, debounceMs);
  }

  return {
    /** Call on every form input. `snapshot` returns the current field values. */
    notify(snapshot) {
      getSnapshot = snapshot;
      emit('dirty');
      debounceThenSave();
    },

    /** Manual retry after an error (e.g. a "retry" click), reusing the last snapshot. */
    retry() {
      if (inFlight) {
        coalesced = true;
        return;
      }
      clearTimeout(debounceTimer);
      runSave();
    },

    /**
     * Forces a final best-effort save right now — submit, the tab being
     * hidden, or the page unloading. A no-op when there is nothing pending.
     */
    async flush() {
      clearTimeout(debounceTimer);
      if (inFlight) {
        coalesced = true;
        return;
      }
      if (state !== 'dirty' && state !== 'error') return;
      await runSave();
    },

    getState() {
      return { state, savedAt, errorMessage };
    },
  };
}
