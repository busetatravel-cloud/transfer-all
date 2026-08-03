// `server-only` is resolved by Next.js's bundler via an internal alias
// (next/dist/compiled/server-only) and is never a real, plain-Node-resolvable
// package in node_modules. Raw `node --test` runs (via jiti, outside Next's
// build pipeline) cannot resolve the bare specifier "server-only" at all.
// This stub is aliased in place of it for tests that import server-only
// modules directly (see website-builder-persistence.test.mjs).
export {};
