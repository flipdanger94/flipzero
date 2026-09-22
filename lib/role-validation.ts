import { z } from "zod";
import { ALL_PERMISSION_MASK } from "@/lib/permissions";

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  permissions: z.number().int().min(0).max(2 ** 31 - 1).refine((value) => (value & ~ALL_PERMISSION_MASK) === 0, "Unknown permission bits"),
});
