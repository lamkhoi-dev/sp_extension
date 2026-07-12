/**
 * Detects transient network errors — Zalo/undici "fetch failed", socket resets,
 * DNS blips, OS buffer exhaustion, connect/read timeouts.
 *
 * These are EXPECTED on a flaky connection to Zalo's servers and should be
 * LOGGED, not emailed — otherwise every network hiccup spams alert mail.
 * Genuine bugs (non-network) still fall through and are reported as before.
 */
const TRANSIENT_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENOBUFS', 'EAI_AGAIN',
  'ECONNREFUSED', 'EPIPE', 'ECONNABORTED', 'EHOSTUNREACH', 'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT',
]);

const TRANSIENT_PATTERN =
  /fetch failed|socket hang up|network|timeout|econnreset|etimedout|enotfound|enobufs|eai_again|und_err|econnrefused|read econn|write econn/i;

/**
 * @param {unknown} reason - an Error, string, or rejection reason
 * @returns {boolean} true if it looks like a transient network error
 */
function isTransientNetworkError(reason) {
  if (!reason) return false;

  // undici wraps the real cause under err.cause; also check errno/code.
  const code = reason.code || reason.cause?.code || reason.errno || '';
  if (code && TRANSIENT_CODES.has(String(code))) return true;

  const msg = reason.message || (typeof reason === 'string' ? reason : '');
  const causeMsg = reason.cause?.message || '';
  return TRANSIENT_PATTERN.test(`${msg} ${causeMsg}`);
}

module.exports = { isTransientNetworkError };
