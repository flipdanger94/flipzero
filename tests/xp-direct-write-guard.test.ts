import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await files(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) output.push(path);
  }
  return output;
}

describe("XP write guard", () => {
  it("keeps personal XP writes behind lib/xp.ts", async () => {
    const candidates = [...await files("app"), ...await files("components"), ...await files("lib")];
    const violations: string[] = [];
    for (const path of candidates) {
      if (path.replaceAll("\\", "/") === "lib/xp.ts") continue;
      const source = await readFile(path, "utf8");
      if (/insert\(xpEvents\)/.test(source)) violations.push(`${path}: direct xpEvents insert`);
      if (/globalXp\s*:\s*sql/.test(source)) violations.push(`${path}: direct globalXp increment`);
      if (/update\(users\)[\s\S]{0,180}globalXp/.test(source)) violations.push(`${path}: direct users.globalXp update`);
    }
    expect(violations).toEqual([]);
  });
});
