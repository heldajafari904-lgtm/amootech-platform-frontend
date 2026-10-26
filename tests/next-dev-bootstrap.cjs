// Bound Next's optional npm version lookup in offline integration environments.
// Application, Django and provider requests retain their actual fetch behavior.
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) => originalFetch(url,
  String(url).startsWith('https://registry.npmjs.org/')
    ? { ...options, signal: AbortSignal.timeout(2000) }
    : options);
