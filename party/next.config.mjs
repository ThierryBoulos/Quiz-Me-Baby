/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* the shared engine lives one level up (../engine) — Classic and Party play by one rulebook */
  experimental: { externalDir: true },
};
export default nextConfig;
