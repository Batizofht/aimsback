import fs from "fs";
import path from "path";
import crypto from "crypto";

export function saveTempBase64(base64: string): string {
  const buffer = Buffer.from(base64.split(",")[1], "base64");
  const tempPath = path.join("uploads/temp", `${crypto.randomUUID()}.jpg`);
  fs.mkdirSync("uploads/temp", { recursive: true });
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}
