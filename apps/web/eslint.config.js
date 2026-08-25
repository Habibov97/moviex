import globals from "globals";
import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    /*
     * `next.config.js` is evaluated by Next in Node, not in the browser, and it
     * reads `process.env.API_URL` to build the `/moviex/api/*` proxy
     * destination. The shared config only ships browser/service-worker globals,
     * so without this `process` is an undefined variable and `--max-warnings 0`
     * fails the lint.
     */
    files: ["next.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
