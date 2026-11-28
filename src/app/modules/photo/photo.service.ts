import { PhotoMilestone } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import { TFile } from "../../interface/file.interface.js";
import { safeDeleteFromS3, uploadToS3 } from "../../utils/awss3.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { withCalendarDays } from "../../utils/userDay.js";
import {
  PHOTO_MILESTONE_LABELS,
  TCreatePhoto,
  TUpdatePhoto,
} from "./photo.validation.js";

const photoSelect = {
  id: true,
  caption: true,
  milestone: true,
  date: true,
  file: true,
  fileSize: true,
};

/** Adds the client's display name of the milestone ("Trigger time"). */
const withLabel = <T extends { milestone: PhotoMilestone }>(photo: T) => ({
  ...photo,
  milestoneLabel: PHOTO_MILESTONE_LABELS[photo.milestone],
});

const create = async (authId: string, payload: TCreatePhoto, file?: TFile) => {
  if (!file)
    throw new ApiError(
      400,
      "Please choose a photo to upload (field 'file': JPG, PNG, WEBP or HEIC, max 10 MB)"
    );
  payload = await withCalendarDays(authId, payload, ["date"]);
  const fileUrl = await uploadToS3(file);
  try {
    const photo = await prisma.photo.create({
      data: {
        authId,
        caption: payload.caption,
        milestone: payload.milestone,
        date: payload.date,
        file: fileUrl,
        fileSize: file.size,
      },
      select: photoSelect,
    });
    return withLabel(photo);
  } catch (error) {
    await safeDeleteFromS3(fileUrl); // don't orphan the upload
    throw error;
  }
};

const getMy = async (
  authId: string,
  options: TPaginationOptions,
  category?: PhotoMilestone
) => {
  const { page, take, skip } = calculatePagination(options);
  const where = { authId, ...(category ? { milestone: category } : {}) };
  const [photos, total] = await Promise.all([
    prisma.photo.findMany({
      where,
      skip,
      take,
      orderBy: { date: "desc" },
      select: photoSelect,
    }),
    prisma.photo.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, photos: photos.map(withLabel) };
};

const getSingle = async (authId: string, id: string) => {
  const photo = await prisma.photo.findFirst({
    where: { id, authId },
    select: photoSelect,
  });
  if (!photo) throw new ApiError(404, "Photo not found");
  return withLabel(photo);
};

/** Caption / milestone / date, and optionally a new image (`file`). */
const update = async (
  authId: string,
  id: string,
  payload: TUpdatePhoto,
  file?: TFile
) => {
  const photo = await prisma.photo.findFirst({
    where: { id, authId },
    select: { id: true, file: true },
  });
  if (!photo) throw new ApiError(404, "Photo not found");

  payload = await withCalendarDays(authId, payload, ["date"]);
  const newFileUrl = file ? await uploadToS3(file) : undefined;
  let updated;
  try {
    updated = await prisma.photo.update({
      where: { id },
      data: {
        ...payload,
        ...(newFileUrl && file
          ? { file: newFileUrl, fileSize: file.size }
          : {}),
      },
      select: photoSelect,
    });
  } catch (error) {
    await safeDeleteFromS3(newFileUrl); // don't orphan the new upload
    throw error;
  }
  if (newFileUrl) await safeDeleteFromS3(photo.file);
  return withLabel(updated);
};

const remove = async (authId: string, id: string) => {
  const photo = await prisma.photo.findFirst({
    where: { id, authId },
    select: photoSelect,
  });
  if (!photo) throw new ApiError(404, "Photo not found");

  // DB first: a failed S3 delete must not leave a record pointing at a
  // missing file, nor make the photo undeletable
  await prisma.photo.delete({ where: { id } });
  await safeDeleteFromS3(photo.file);

  const { file: _file, ...rest } = photo;
  return withLabel(rest);
};

export const photoServices = { create, getMy, getSingle, update, remove };
