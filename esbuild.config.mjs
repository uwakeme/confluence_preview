import * as esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const watch = process.argv.includes("--watch");
const isDev = process.env.NODE_ENV !== "production";

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: true,
  minify: !isDev && !watch,
  external: ["vscode"],
  logLevel: "info",
  treeShaking: true,
};

async function copyWebviewAssets() {
  if (!existsSync("dist/media")) {
    await mkdir("dist/media", { recursive: true });
  }
  await copyFile("src/media/preview.html", "dist/media/preview.html");
  await copyFile("src/media/style.css", "dist/media/style.css");
  await copyFile("src/media/script.js", "dist/media/script.js");
  await copyFile("src/media/highlight.min.js", "dist/media/highlight.min.js");
}

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    await copyWebviewAssets();
    console.log("[esbuild] watching for changes...");
  } else {
    await esbuild.build(buildOptions);
    await copyWebviewAssets();
    console.log("[esbuild] build complete");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});