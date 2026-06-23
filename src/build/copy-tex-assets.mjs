import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(__dirname, "../../node_modules/node-tikzjax/tex");
const targetDir = path.resolve(__dirname, "../../tex");

await fs.rm(targetDir, { recursive: true, force: true });
await fs.mkdir(targetDir, { recursive: true });

for (const file of ["core.dump.gz", "tex.wasm.gz", "tex_files.tar.gz"]) {
  await fs.copyFile(path.join(sourceDir, file), path.join(targetDir, file));
}
