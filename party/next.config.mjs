/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* the shared engine lives one level up (../engine) — Classic and Party play by one rulebook */
  experimental: { externalDir: true },
  /* Classic, copied into public/classic by scripts/copy-classic.mjs before each build */
  async rewrites() { return [{ source: "/classic", destination: "/classic/index.html" }]; },
};
export default nextConfig;
