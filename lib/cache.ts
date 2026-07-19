import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import type { DecisionDocument } from "./bedesten";

const directory = process.env.CACHE_DIR ?? path.join(os.homedir(), ".ictihat-asistani", "cache");

function fileFor(documentId: string): string {
  const key = createHash("sha256").update(documentId).digest("hex");
  return path.join(directory, `${key}.json`);
}

export async function readDecisionCache(documentId: string): Promise<DecisionDocument | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(fileFor(documentId), "utf8")) as DecisionDocument;
    return typeof parsed.text === "string" && typeof parsed.mimeType === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeDecisionCache(documentId: string, value: DecisionDocument): Promise<void> {
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(fileFor(documentId), JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
  } catch {
    // Vercel gibi kalıcı diski olmayan ortamlarda önbelleksiz devam eder.
  }
}
