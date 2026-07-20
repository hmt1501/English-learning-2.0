import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * eslint-config-next 16 xuất sẵn flat config nên dùng thẳng, không cần FlatCompat.
 *
 * Các quy tắc của React Compiler nằm trong eslint-plugin-react-hooks v7
 * (purity = không gọi Date.now()/Math.random() khi render, refs = không đọc
 * ref khi render, ...). Ở đây đẩy tất cả lên mức "error" để không lọt cảnh báo.
 */
const REACT_COMPILER_RULES = {
  "react-hooks/purity": "error",
  "react-hooks/refs": "error",
  "react-hooks/set-state-in-render": "error",
  "react-hooks/set-state-in-effect": "error",
  "react-hooks/immutability": "error",
  "react-hooks/globals": "error",
  "react-hooks/static-components": "error",
  "react-hooks/preserve-manual-memoization": "error",
  "react-hooks/use-memo": "error",
  "react-hooks/error-boundaries": "error",
  "react-hooks/exhaustive-deps": "error",
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/incompatible-library": "error",
  "react-hooks/unsupported-syntax": "error",
};

const eslintConfig = [
  {
    ignores: ["**/.next/**", "**/out/**", "**/node_modules/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  {
    rules: REACT_COMPILER_RULES,
  },
];

export default eslintConfig;
