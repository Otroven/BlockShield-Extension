import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function copyPhashJsAssets() {
  return {
    name: "copy-phash-js-assets",
    buildStart() {
      const srcDir = resolve(root, "node_modules/phash-js/dist");
      const destDir = resolve(root, "public");
      mkdirSync(destDir, { recursive: true });
      for (const name of ["phash.js", "magick.js", "magick.wasm"]) {
        const src = resolve(srcDir, name);
        if (!existsSync(src)) {
          throw new Error(
            `Missing ${name}. Run npm install in frontend so phash-js@0.3.0 is available.`
          );
        }
        copyFileSync(src, resolve(destDir, name));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPhashJsAssets()],
});
