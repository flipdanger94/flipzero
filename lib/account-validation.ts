import { z } from "zod";

export const updateAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  username: z.string().trim().min(3).max(24).regex(/^[a-z0-9_]+$/i),
  bio: z.string().trim().max(500),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});
