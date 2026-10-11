import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const filePath = ".next/types/routes.d.ts";
if (!existsSync(filePath)) {
  mkdirSync(".next/types", { recursive: true });
  writeFileSync(filePath, "export {};\n");
}
