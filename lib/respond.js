/**
 * Standard success envelope. Every JSON endpoint replies `{ data: <payload> }`;
 * every error replies `{ error: { message, code } }` (see middleware/error.js).
 */
export function sendData(res, data, status = 200) {
  return res.status(status).json({ data });
}
