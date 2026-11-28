import z from "zod";
import { timezoneZod } from "../auth/auth.validation.js";

export const profileUpdateZod = z.object({
  name: z.string().min(1, "Name is required").trim().optional(),
  // devices rotate FCM tokens and users change timezone; before this they
  // were only saved at login, so pushes / local-hour jobs went stale
  fcmToken: z.string().trim().min(1).optional(),
  timezone: timezoneZod.optional(),
});

export type TProfileUpdate = z.infer<typeof profileUpdateZod>;

export const updateConsentZod = z.object({
  healthData: z.boolean(),
  marketing: z.boolean(),
  cookies: z.boolean(),
});

export type TUpdateConsent = z.infer<typeof updateConsentZod>;

export const deleteAccountZod = z.object({
  // required for email accounts; Google sign-in accounts have no password
  password: z
    .string({ message: "Password is required" })
    .min(1, "Password is required")
    .optional(),
});

export type TDeleteAccount = z.infer<typeof deleteAccountZod>;
