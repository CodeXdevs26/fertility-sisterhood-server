import { z } from "zod";

export const updateAppSettingZod = z.object({
  supportEmail: z.string().trim().toLowerCase().email("Invalid email"),
  supportPhone: z
    .string()
    .trim()
    .regex(
      /^[0-9+()\s-]{6,20}$/,
      "Phone must be 6-20 characters: digits, spaces, + ( ) -"
    ),
  communityLink: z
    .string()
    .trim()
    .url("Invalid URL")
    .refine(url => url.startsWith("https://"), "Link must start with https://"),
});

export type TUpdateAppSetting = z.infer<typeof updateAppSettingZod>;
