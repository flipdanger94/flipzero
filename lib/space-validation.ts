import { z } from "zod";

export const createSpaceSchema = z.object({
  name: z.string().trim().min(2).max(48),
  description: z.string().trim().max(240).optional().default(""),
  visibility: z.enum(["private", "application", "public", "invite_only"]).default("invite_only"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ff5c70"),
});

export const updateSpaceSchema = createSpaceSchema.pick({ name: true, description: true, visibility: true, accentColor: true });

export const spaceTemplateSchema = z.object({
  version: z.literal(1),
  categories: z.array(z.object({ name: z.string().trim().min(2).max(32) })).max(30),
  channels: z.array(z.object({
    name: z.string().trim().min(2).max(48),
    topic: z.string().trim().max(240).nullable().optional(),
    kind: z.enum(["text", "forum", "voice", "stage", "announcement", "board"]),
    category: z.string().trim().nullable(),
  })).min(1).max(100),
});

export const createChannelSchema = z.object({
  name: z.string().trim().min(2).max(48).transform((value) => value.replace(/\s+/g, "-")),
  topic: z.string().trim().max(240).optional().default(""),
  kind: z.enum(["text", "forum", "voice", "stage", "announcement", "board"]),
  parentId: z.string().uuid().nullable().optional().default(null),
});

export const createCategorySchema = z.object({ name: z.string().trim().min(2).max(32) });
