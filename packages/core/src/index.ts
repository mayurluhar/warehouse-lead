/**
 * Public surface of the core package.
 *
 * Layers are exported separately so an importer's intent stays visible:
 * handlers legitimately need `infrastructure` because they are the Composition
 * Root, whereas anything inside `domains` must depend only on `common`,
 * `entities` and `ports`.
 */
export * from './common';
export * from './domains';
export * from './infrastructure';
