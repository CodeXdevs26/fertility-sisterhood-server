import z from "zod";
import { emailZod, passwordZod } from "../../validation/global.validation.js";
import { UserStatus } from "@prisma/client";

export const userSignupZod = z.object({
  email: emailZod,
  password: passwordZod,
  name: z.string().min(1, "Name is required").trim(),
});

export type TSignup = z.infer<typeof userSignupZod>;

const isValidTimezone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const loginZodSchema = z.object({
  email: emailZod,
  password: passwordZod,
  fcmToken: z.string().trim().min(1).optional(),
  timezone: z
    .string()
    .refine(isValidTimezone, "timezone must be a valid IANA timezone!")
    .optional(),
  isMobileApp: z.boolean().default(false),
});

export type TLoginInput = z.infer<typeof loginZodSchema>;

export const googleLoginSchema = z.object({
  email: emailZod,
  name: z.string(),
  image: z.string(),
  fcmToken: z.string(),
  role: z.enum(["WORKER", " EMPLOYER"]),
});

export type TGoogleLoginInput = z.infer<typeof googleLoginSchema>;

export const resetPasswordZod = z.object({
  email: emailZod,
  password: passwordZod,
  resetToken: z.string().min(1, "Reset token is required"),
});

export type TResetPasswordInput = z.infer<typeof resetPasswordZod>;

export const changePasswordZod = z.object({
  oldPassword: passwordZod,
  newPassword: passwordZod,
});

export type TChangePasswordInput = z.infer<typeof changePasswordZod>;

export const changeAccountStatusZod = z.object({
  status: z
    .enum([UserStatus.ACTIVE, UserStatus.DELETED, UserStatus.BLOCKED])
    .default("ACTIVE")
    .transform(val => val.toUpperCase()),
});
