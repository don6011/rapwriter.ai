import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: rootDir, recommendedConfig: js.configs.recommended });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "supabase/.temp/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-page-custom-font": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message: "Use the existing RapWriter server helpers instead of importing this directly.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
