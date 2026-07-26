import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next 16 ships flat configs directly. The previous setup piped it
// through @eslint/eslintrc's FlatCompat, which crashes on ESLint 9 while
// validating the legacy schema ("Converting circular structure to JSON").
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "app/generated/**",
    ],
  },
  ...nextCoreWebVitals,
];

export default eslintConfig;
