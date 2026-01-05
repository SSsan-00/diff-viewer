import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const minifyMode = process.env.MINIFY === "true" ? "full" : "readable";
const isFullMinify = minifyMode === "full";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 10_000_000,
    cssCodeSplit: false,
    minify: "terser",
    terserOptions: isFullMinify
      ? {
          format: { comments: false },
        }
      : {
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
