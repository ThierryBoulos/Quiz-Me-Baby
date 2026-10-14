import { execSync } from "node:child_process";

/* which deploy this is: the commit (the same for every part of one build, unlike a timestamp) */
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA || (() => { try { return execSync("git rev-parse HEAD").toString().trim(); } catch { return "dev"; } })();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* the shared engine lives one level up (../engine) — Classic and Party play by one rulebook */
  experimental: { externalDir: true },
  /* which deploy this page came from: a TV or phone left open across a deploy reloads itself (lib/fresh.ts) */
  env: { NEXT_PUBLIC_BUILD: BUILD },
  /* Classic, copied into public/classic by scripts/copy-classic.mjs before each build */
  async rewrites() { return [{ source: "/classic", destination: "/classic/index.html" }]; },
};
export default nextConfig;
