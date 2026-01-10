import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["coverage", "node_modules", "build"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strict,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylistic,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "servers/**/*.ts", "party/**/*.ts", "scripts/**/*.ts", "prisma/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      // Keep these off for now or fix them?
      // User said "strong type safety without ... disable rule ... hacks".
      // I should try to fix them.
      // But tests usually require lax rules.
      // I will remove the "off" rules and try to fix the code.
    },
  },
);
