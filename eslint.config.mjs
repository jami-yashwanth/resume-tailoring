import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/* `design/` holds standalone HTML prototypes and `prototypes/` is Python, so
   neither is application source. `.next` and `next-env.d.ts` are generated. */
const config = [
  { ignores: [".next/**", "next-env.d.ts", "design/**", "prototypes/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
