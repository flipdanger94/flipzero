import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type Theme={id:string;surface:string;panel:string;deep:string;raised:string;accent:string;text:string;muted:string;appBackground?:string};

function luminance(hex:string){
  const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
}
function contrast(a:string,b:string){
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+0.05)/(lo+0.05);
}

describe("runtime appearance themes",()=>{
  it("loads the account theme layer last and gives every built-in theme an app background",async()=>{
    const [layout,rawThemes]=await Promise.all([
      readFile("app/layout.tsx","utf8"),
      readFile("config/themes.json","utf8"),
    ]);
    const themes=JSON.parse(rawThemes) as Theme[];
    expect(layout.indexOf('import "./themes.css";')).toBeGreaterThan(layout.indexOf('import "./runtime-theme.css";'));
    expect(themes.length).toBeGreaterThanOrEqual(3);
    for(const theme of themes)expect(theme.appBackground).toContain("gradient");
  });

  it("owns accent at theme level and ignores legacy user accent input",async()=>{
    const [provider,settings,route,css,profile]=await Promise.all([
      readFile("components/preferences-provider.tsx","utf8"),
      readFile("components/personalization-settings.tsx","utf8"),
      readFile("app/api/v1/preferences/route.ts","utf8"),
      readFile("app/themes.css","utf8"),
      readFile("components/user-profile-popover.tsx","utf8"),
    ]);
    expect(provider).toContain('const accentColor=theme.accent');
    expect(provider).toContain('setProperty("--accent-color",accentColor)');
    expect(provider).toContain('setProperty("--accent",accentColor)');
    expect(settings).toContain("applyPreview(value,themes)");
    expect(settings).toContain('setProperty("--accent-color",theme.accent)');
    expect(settings).toContain('setProperty("--accent",theme.accent)');
    expect(settings).not.toContain('type="color"');
    expect(settings).not.toContain("HEX цвета");
    expect(route).toContain("accentColor:theme.accent");
    expect(route).toContain("const raw=body as Record<string,unknown>");
    expect(route).not.toContain("Укажите цвет в формате #RRGGBB");
    expect(css).toContain("Theme-owned accent is shared by voice, clans and profile surfaces");
    expect(profile).toContain('"--profile-accent":"var(--accent,#8f70ff)"');
  });

  it("keeps primary and secondary text at WCAG AA contrast on built-in dark surfaces",async()=>{
    const themes=JSON.parse(await readFile("config/themes.json","utf8")) as Theme[];
    for(const theme of themes){
      for(const background of [theme.surface,theme.panel,theme.deep,theme.raised]){
        expect(contrast(theme.text,background),`${theme.id} text on ${background}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme.muted,background),`${theme.id} muted on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
