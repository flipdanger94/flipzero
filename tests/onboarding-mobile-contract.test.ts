import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("onboarding and mobile layout contract", () => {
  it("keeps onboarding reversible, reports errors, and opens the joined space", async () => {
    const wizard = await readFile("components/onboarding-wizard.tsx", "utf8");
    const app = await readFile("components/flipzero-app.tsx", "utf8");
    const route = await readFile("app/api/v1/onboarding/route.ts", "utf8");

    expect(wizard).toContain('window.addEventListener("popstate"');
    expect(wizard).toContain("onboarding-back");
    expect(wizard).toContain("onboarding-avatar-preview");
    expect(wizard).toContain('role="alert"');
    expect(route).toContain("DEMO_SPACE_NOT_FOUND");
    expect(route).toContain("spaceId: joinedSpaceId");
    expect(app).toContain("await openJoinedSpace(spaceId)");
  });

  it("uses distinct creation copy and a single mobile store scroller", async () => {
    const app = await readFile("components/flipzero-app.tsx", "utf8");
    const dialog = await readFile("components/create-space-dialog.tsx", "utf8");
    const mobile = await readFile("app/mobile-discord.css", "utf8");

    expect(dialog).toContain('id="create-space-title">Новое пространство');
    expect(dialog).toContain(': "Создать"');
    expect(app).toContain("Соберите здесь каналы, роли и участников.");
    expect(mobile).toContain("social-main-v2.social-main-economy");
    expect(mobile).toContain("grid-template-rows:auto minmax(0,1fr)");
  });
});
