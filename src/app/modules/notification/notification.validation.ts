import { z } from "zod";

export const createDummyNotificationZod = z.object({
  message: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
});
export type TCreateDummyNotification = z.infer<
  typeof createDummyNotificationZod
>;
