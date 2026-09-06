/**
 * Structured JSON logger. One line per event, machine-parseable.
 * Requirement: keep logs of errors and meaningful events.
 */
export function createLogger(sink = process.stdout) {
  function emit(level, event, meta = {}) {
    const record = { ts: new Date().toISOString(), level, event, ...meta };
    sink.write(`${JSON.stringify(record)}\n`);
  }

  return {
    info: (event, meta) => emit('info', event, meta),
    warn: (event, meta) => emit('warn', event, meta),
    error: (event, meta) => emit('error', event, meta),
  };
}

const DISCARD = { write: () => {} };

/** Shared instance. Silent under tests so runner output stays clean. */
export const logger = createLogger(
  process.env.NODE_ENV === 'test' ? DISCARD : process.stdout,
);
