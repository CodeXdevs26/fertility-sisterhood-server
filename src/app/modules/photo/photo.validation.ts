import { PhotoMilestone } from "@prisma/client";
import { z } from "zod";

/** The client's milestone names, as shown in the app. */
export const PHOTO_MILESTONE_LABELS: Record<PhotoMilestone, string> = {
  CONSULTATION: "Consultations",
  STIMS: "Stims",
  TRIGGER: "Trigger time",
  EGG_RETRIEVAL: "Egg retrieval",
  HAPPY_MOMENTS: "Happy moments",
  OTHER: "Other memories",
};

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, " ");

/** Accepts the label ("Trigger time") or the key ("TRIGGER"), any case. */
const milestoneLookup = new Map<string, PhotoMilestone>(
  Object.entries(PHOTO_MILESTONE_LABELS).flatMap(([key, label]) => [
    [normalize(key), key as PhotoMilestone],
    [normalize(label), key as PhotoMilestone],
  ])
);
const milestoneZod = z.preprocess(
  value =>
    typeof value === "string"
      ? (milestoneLookup.get(normalize(value)) ?? value)
      : value,
  z.nativeEnum(PhotoMilestone, {
    message: `milestone must be one of: ${Object.values(PHOTO_MILESTONE_LABELS).join(", ")}`,
  })
);

const photoFields = {
  caption: z
    .string({ message: "caption is required" })
    .trim()
    .min(1, "caption is required"),
  milestone: milestoneZod,
  date: z.coerce.date({ message: "date must be a valid date (YYYY-MM-DD)" }),
};

export const createPhotoZod = z.object(photoFields);
export const updatePhotoZod = z.object(photoFields).partial();

export const photoQueryZod = z.object({
  category: milestoneZod.optional(),
});

export type TCreatePhoto = z.infer<typeof createPhotoZod>;
export type TUpdatePhoto = z.infer<typeof updatePhotoZod>;
export type TPhotoQuery = z.infer<typeof photoQueryZod>;
