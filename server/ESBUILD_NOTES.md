# esbuild / Cloudflare Workers Bundling Notes

## Circular Dependencies

**Problem**: esbuild (used by PartyKit/miniflare) handles ES module circular dependencies differently from Node.js.

Node.js resolves circular deps at runtime via lazy evaluation — a class imported before its module finishes loading gets `undefined` initially but resolves by the time it's used at runtime. esbuild performs static bundling: if module A imports B and B imports A, one of them will see `undefined` for the other at class definition time, causing:

```
TypeError: Class extends value undefined is not a constructor or null
```

### Example that was broken

`abstractRole.ts` imported `Jailor`, and `Jailor` extended `Role` from `abstractRole.ts`:

```
abstractRole.ts → import Jailor → jailor.ts → import Role → abstractRole.ts (circular!)
```

This worked fine under Node.js (Socket.IO server) but crashed esbuild bundles (PartyKit).

### Fix applied

Removed the downward dependency from `abstractRole.ts` to `Jailor` by:

1. Changing `jailed: Jailor | null` → `jailed: Role | null` (only `.player` was needed anyway)
2. Moving Jailor-specific `handleMessage` logic into a `Jailor.handleMessage()` override
3. Removing the `instanceof Jailor` check from the base class entirely

**Principle**: base classes must never import their own subclasses. If you find yourself needing `instanceof SubClass` in a base class method, override the method in the subclass instead.

## Other esbuild Considerations

- esbuild targets Cloudflare Workers (no Node.js APIs): `fs`, `path`, `net`, `crypto` (Node built-ins) are not available unless polyfilled via `compatibility_flags` in `partykit.json`.
- Top-level `await` is supported in Workers but can cause issues if a module with it is imported before the worker's `fetch` handler is registered.
- Avoid dynamic `require()` — esbuild cannot statically analyse it; use `import()` instead.
