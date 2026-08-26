/**
 * Assert a condition, throwing with a clear message when it does not hold.
 *
 * The project convention is `assert` from `node:assert`, and the filesystem
 * wrappers still use it. This layer cannot: a bundler externalizes `node:`
 * imports for the browser, so `node:assert` would break the page at runtime,
 * which is exactly what this layer exists to avoid. Same contract, no
 * builtin. Enforced by a test that fails if any `node:` import appears here.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
