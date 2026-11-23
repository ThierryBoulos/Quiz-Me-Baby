/* 3-8 teams, the real referee (lib/many/useTvMany.ts) through reloads, sleeps and takeovers: sim/manytv.jsx.
   Run: node sim/manytv.mjs            every check
        node sim/manytv.mjs roulette   one game's (see, stakes, majority, roulette, fool, pin, ...) */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".out/manytv.mjs");
await build({
  entryPoints: [join(here, "manytv.jsx")], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic",
  packages: "external", logLevel: "error", define: { "process.env.NEXT_PUBLIC_BUILD": '"sim"' }, alias: { "@": join(here, "..") },
  plugins: [{ name: "fake-supabase", setup(b) {
    b.onResolve({ filter: /^(\.{1,2}\/)+(lib\/)?supabase$|^@\/lib\/supabase$/ }, () => ({ path: join(here, "fakeSupabase.js") }));
    b.onResolve({ filter: /^@supabase\// }, (a) => ({ errors: [{ text: `the simulator must not load ${a.path} (from ${a.importer})` }] }));
  } }],
});
const { run } = await import(pathToFileURL(out).href);
const lines = await run(process.argv[2]);
console.log(lines.join("\n"));
const bad = lines.filter((l) => l.startsWith("FAIL")).length;
console.log(`manytv: ${lines.length - bad} of ${lines.length} checks ok`);
process.exit(bad ? 1 : 0);
