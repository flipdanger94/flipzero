import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("icon v2 and SuperFlip theme contracts",()=>{
  it("uses one semantic icon component with currentColor and a shared stroke width",async()=>{
    const source=await readFile("components/app-icon.tsx","utf8");
    expect(source).toContain("export type AppIconName");
    expect(source).toContain('strokeWidth={1.8}');
    expect(source).toContain('color="currentColor"');
    expect(source).toContain('aria-hidden={label ? undefined : true}');
    expect(source).toContain('focusable="false"');
    for(const name of ["store","inventory","buy","equip","unequip","preview","search","filter","sort","superflip","close"])expect(source).toContain(`"${name}"`);
  });

  it("migrates the primary product surfaces away from direct Lucide imports",async()=>{
    const [store,superflip]=await Promise.all([
      readFile("components/personal-economy.tsx","utf8"),
      readFile("app/superflip/page.tsx","utf8"),
    ]);
    expect(store).toContain('import { AppIcon } from "./app-icon"');
    expect(store).not.toContain('from "lucide-react"');
    expect(superflip).toContain('import { AppIcon, type AppIconName } from "@/components/app-icon"');
    expect(superflip).not.toContain('from "lucide-react"');
  });

  it("scopes SuperFlip palette to data-theme and sf tokens only",async()=>{
    const [page,styles]=await Promise.all([
      readFile("app/superflip/page.tsx","utf8"),
      readFile("app/superflip/superflip.module.css","utf8"),
    ]);
    expect(page).toContain('data-theme="superflip"');
    expect(styles).toContain('.page[data-theme="superflip"]');
    for(const token of ["--sf-bg-base","--sf-bg-elevated","--sf-gradient-primary","--sf-text-primary","--sf-text-secondary","--sf-accent","--sf-accent-hover","--sf-border","--sf-shadow-glow","--sf-radius-card"])expect(styles).toContain(token);
    expect(styles).not.toContain("var(--accent");
    expect(styles).not.toContain("var(--theme-");
  });

  it("documents the icon/theme audit before implementation",async()=>{
    const audit=await readFile("AUDIT_ICONS_THEME.md","utf8");
    expect(audit).toContain("lucide-react");
    expect(audit).toContain("user_preferences.accent_color");
    expect(audit).toContain('data-theme="superflip"');
    expect(audit).toContain("Карта замены");
  });
});
