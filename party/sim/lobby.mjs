/* The lobby checks (sim/lobby.jsx): node sim/lobby.mjs */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".out/lobby.mjs");
await build({
  entryPoints: [join(here, "lobby.jsx")], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic",
  packages: "external", logLevel: "error", define: { "process.env.NEXT_PUBLIC_BUILD": '"sim"' },
  plugins: [{ name: "fake-supabase", setup(b) {
    b.onResolve({ filter: /^(\.{1,2}\/)+(lib\/)?supabase$|^@\/lib\/supabase$/ }, () => ({ path: join(here, "fakeSupabase.js") }));
    b.onResolve({ filter: /^@supabase\// }, (a) => ({ errors: [{ text: `the simulator must not load ${a.path} (from ${a.importer})` }] }));
  } }],
});
const { run } = await import(pathToFileURL(out).href);
const lines = await run();
console.log(lines.join("\n"));
if (lines.some((l) => l.startsWith("FAIL"))) process.exit(1);
