import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function luminance(hex:string){
  const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
}
function contrast(a:string,b:string){
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+0.05)/(lo+0.05);
}
function cssHex(source:string,name:string){
  const match=source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if(!match)throw new Error(`Missing CSS token ${name}`);
  return match[1];
}

describe("icon v2 and SuperFlip theme contracts",()=>{
  it("uses one semantic icon component with currentColor and a shared stroke width",async()=>{
    const source=await readFile("components/app-icon.tsx","utf8");
    expect(source).toContain("export type AppIconName");
    expect(source).toContain('viewBox={APP_ICON_VIEWBOX}');
    expect(source).toContain('export const APP_ICON_VIEWBOX = "0 0 24 24"');
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
    expect(store).toContain('import { AppIcon, type AppIconName } from "./app-icon"');
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
  it("keeps primary and secondary SuperFlip text at WCAG AA contrast",async()=>{
    const styles=await readFile("app/superflip/superflip.module.css","utf8");
    const primary=cssHex(styles,"--sf-text-primary");
    const secondary=cssHex(styles,"--sf-text-secondary");
    for(const background of ["--sf-bg-base","--sf-bg-elevated","--sf-bg-card","--sf-bg-card-strong"].map(name=>cssHex(styles,name))){
      expect(contrast(primary,background),`primary on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(secondary,background),`secondary on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
    const page=await readFile("app/superflip/page.tsx","utf8");
    expect(page).not.toContain("style={{");
  });

  it("migrates profile surfaces and normalizes any remaining legacy Lucide rendering",async()=>{
    const [popover,visit,globals]=await Promise.all([
      readFile("components/user-profile-popover.tsx","utf8"),
      readFile("components/profile-visit-card.tsx","utf8"),
      readFile("app/globals.css","utf8"),
    ]);
    expect(popover).toContain('import { AppIcon } from "./app-icon"');
    expect(popover).not.toContain('from "lucide-react"');
    expect(visit).toContain('import { AppIcon } from "./app-icon"');
    expect(visit).not.toContain('from "lucide-react"');
    expect(globals).toContain("svg.lucide,.fz-icon{stroke-width:1.8;color:currentColor");
  });

  it("covers every current inventory equipment slot with a semantic icon",async()=>{
    const store=await readFile("components/personal-economy.tsx","utf8");
    for(const slot of ["avatar_decoration","profile_effect","profile_banner","nameplate","chat_style","badge","app_theme"]){
      expect(store).toContain(slot);
    }
    expect(store).toContain("const slotIcons:Record<string,AppIconName>");
    expect(store).toContain('name="buy"');
    expect(store).toContain('name="equip"');
    expect(store).toContain('name="unequip"');
  });

});
