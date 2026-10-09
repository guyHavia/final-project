/** Runs a document's schema validation; resolves to the ValidationError, or undefined when valid. */
export const validationError = (doc) => doc.validate().then(() => undefined, (err) => err);
