import z from "zod";

export const profileUpdateZod = z.object({
  name: z.string().min(1, "Name is required").trim().optional(),
});

export type TProfileUpdate = z.infer<typeof profileUpdateZod>;

export const updateConsentZod = z.object({
  healthData: z.boolean(),
  marketing: z.boolean(),
  cookies: z.boolean(),
});

export type TUpdateConsent = z.infer<typeof updateConsentZod>;
