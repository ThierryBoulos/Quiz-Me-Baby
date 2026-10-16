import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";

/* Next's recommended rules (React hooks, accessibility basics, Next's own) plus TypeScript's */
const here = path.dirname(new URL(import.meta.url).pathname);
const compat = new FlatCompat({ baseDirectory: here });
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: ["node_modules/**", ".next/**", "public/**", "next-env.d.ts"] },
];
export default config;
