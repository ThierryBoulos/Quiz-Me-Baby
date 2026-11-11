import { execSync } from "node:child_process";

/* which deploy this is: the commit (the same for every part of one build, unlike a timestamp) */
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA || (() => { try { return execSync("git rev-parse HEAD").toString().trim(); } catch { return "dev"; } })();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* the screen check (npm run screens) runs its own dev server with QMB_SCREENS=1: only then are the files ending
     ".screens.tsx" / ".screens.ts" pages (app/screens), and it builds in a folder of its own. Every other run and
     every deploy: no /screens */
  ...(process.env.QMB_SCREENS === "1" ? { pageExtensions: ["screens.tsx", "screens.ts", "tsx", "ts", "jsx", "js"], distDir: ".next-screens",
    /* (the types and the lint rules have their own checks: npm run typecheck, npm run lint) */
    typescript: { ignoreBuildErrors: true }, eslint: { ignoreDuringBuilds: true } } : {}),
  /* the shared engine lives one level up (../engine) — Classic and Party play by one rulebook */
  experimental: { externalDir: true },
  /* which deploy this page came from: a TV or phone left open across a deploy reloads itself (lib/fresh.ts) */
  env: { NEXT_PUBLIC_BUILD: BUILD, NEXT_PUBLIC_BUILD_DATE: new Date().toISOString() },
  /* Classic is retired (3 Nov: "Play without TV" took its place): an old link to it lands on the home screen */
  async redirects() { return [{ source: "/classic", destination: "/", permanent: false }, { source: "/classic/:p*", destination: "/", permanent: false }]; },
  /* flags (their names change only with the key) and maps keep in the phone's cache: no second download */
  async headers() {
    return [
      { source: "/fx/:f*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/maps/:f*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};
export default nextConfig;
