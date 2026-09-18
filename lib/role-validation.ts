import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  permissions: z.number().int().min(0).max(2 ** 31 - 1),
});
