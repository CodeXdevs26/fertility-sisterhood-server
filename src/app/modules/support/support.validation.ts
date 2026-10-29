import { SupportStatus } from "@prisma/client";
import { z } from "zod";

export const sendSupportZod = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

export const updateSupportStatusZod = z.object({
  status: z.nativeEnum(SupportStatus),
});

export type TSendSupport = z.infer<typeof sendSupportZod>;
export type TUpdateSupportStatus = z.infer<typeof updateSupportStatusZod>;
