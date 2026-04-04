import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = "oil-price";

export default defineConfig({
  base: isGithubActions ? `/${repoName}/rally-oil-price/` : "/",
  plugins: [react()],
  server: {
    port: 5175,
  },
});
