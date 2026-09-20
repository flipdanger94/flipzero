import { z } from "zod";
export const registerSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), username: z.string().trim().min(3).max(24).regex(/^[a-z0-9_]+$/i), displayName: z.string().trim().min(2).max(40), password: z.string().min(10).max(128) });
export const loginSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(128), otp: z.string().trim().max(20).optional() });
