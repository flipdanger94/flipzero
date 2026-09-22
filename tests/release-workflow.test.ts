import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("production deployment workflow", () => {
  it("can only deploy from main", async () => {
    const workflow = await readFile(".github/workflows/vercel-production.yml", "utf8");

    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain('--arg ref "main"');
    expect(workflow).toContain('RELEASE_SHA: ${{ github.sha }}');
    expect(workflow).toContain('--arg sha "$RELEASE_SHA"');
  });

  it("waits for a terminal Vercel deployment state", async () => {
    const workflow = await readFile(".github/workflows/vercel-production.yml", "utf8");

    expect(workflow).toContain("READY)");
    expect(workflow).toContain("ERROR|CANCELED)");
    expect(workflow).toContain("Timed out waiting for Vercel production deployment");
  });

  it("does not cancel an in-flight production deployment", async () => {
    const workflow = await readFile(".github/workflows/vercel-production.yml", "utf8");

    expect(workflow).toContain("group: vercel-production");
    expect(workflow).toContain("cancel-in-progress: false");
  });
});
