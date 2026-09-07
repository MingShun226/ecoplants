/**
 * Teaches plain `node` the `@/…` import alias that `tsconfig.json` defines.
 *
 * Next resolves the alias through its own bundler, so nothing in the
 * application needs this. The tests run outside Next — `node --test` with
 * type stripping, no build step and no dependency to install — and without a
 * hook they cannot follow the first import they meet.
 *
 * Kept deliberately small: map the prefix to the project root, then let Node do
 * the rest. The extension guess exists because TypeScript source omits it.
 */
import { pathToFileURL } from "node:url";

const root = pathToFileURL(`${process.cwd()}/`).href;

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = root + specifier.slice(2);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      return await next(candidate, context);
    } catch {
      // Try the next shape. If none resolve, the final throw below reports the
      // original specifier, which is the one worth seeing in the failure.
    }
  }

  throw new Error(`Cannot resolve ${specifier} from ${context.parentURL}`);
}
