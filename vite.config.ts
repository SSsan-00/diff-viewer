import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const minifyMode = process.env.MINIFY === "true" ? "full" : "readable";
const isFullMinify = minifyMode === "full";
const minify = isFullMinify ? "esbuild" : "terser";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [viteSingleFile()],
  build: {
    outDir: process.env.OUT_DIR ?? "dist",
    modulePreload: false,
    assetsInlineLimit: 10_000_000,
    cssCodeSplit: false,
    minify,
    esbuild: {
      legalComments: "none",
    },
    terserOptions: {
      compress: false,
      mangle: false,
      format: {
        beautify: true,
        comments: false,
      },
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
