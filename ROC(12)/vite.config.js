import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = "oil-price";

export default defineConfig({
  plugins: [react()],
  base: isGithubActions ? `/${repoName}/ROC(12)/` : "/",
});
