/* The simulator's build of the TV (sim/night.jsx) for Node, with the fake Supabase in place of the real one.
   Used by sim/run.mjs and the screen check (sim/screens/run.mjs). */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export async function bundleNight(outfile) {
  await build({
    entryPoints: [join(here, "night.jsx")], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic",
    packages: "external", logLevel: "error", define: { "process.env.NEXT_PUBLIC_BUILD": '"sim"' },
    /* the app's Supabase client becomes the fake one */
    plugins: [{ name: "fake-supabase", setup(b) {
      b.onResolve({ filter: /^(\.{1,2}\/)+(lib\/)?supabase$|^@\/lib\/supabase$/ }, () => ({ path: join(here, "fakeSupabase.js") }));
      /* never the real one, whatever the path */
      b.onResolve({ filter: /^@supabase\// }, (a) => ({ errors: [{ text: `the simulator must not load ${a.path} (from ${a.importer})` }] }));
    } }],
  });
}
