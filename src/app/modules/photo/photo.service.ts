import ApiError from "../../classes/ApiError.js";
import { TFile } from "../../interface/file.interface.js";
import { deleteFromS3, uploadToS3 } from "../../utils/awss3.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TCreatePhoto } from "./photo.validation.js";
import { PhotoMilestone } from "@prisma/client";

const create = async (authId: string, payload: TCreatePhoto, file?: TFile) => {
  if (!file) throw new ApiError(400, "Photo file is required");
  const fileUrl = await uploadToS3(file);
  return prisma.photo.create({
    data: {
      authId,
      caption: payload.caption,
      milestone: payload.milestone,
      date: payload.date,
      file: fileUrl,
      fileSize: file.size,
    },
    select: {
      id: true,
      authId: true,
      caption: true,
      milestone: true,
      date: true,
      file: true,
      fileSize: true,
    },
  });
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
      select: { caption: true, fileSize: true, file: true, date: true },
    }),
    prisma.photo.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, photos };
};

const getSingle = async (authId: string, id: string) => {
  const photo = await prisma.photo.findFirst({
    where: { id, authId },
    select: {
      id: true,
      authId: true,
      caption: true,
      milestone: true,
      date: true,
      file: true,
      fileSize: true,
    },
  });
  if (!photo) throw new ApiError(404, "Photo not found");
  return photo;
};

const remove = async (authId: string, id: string) => {
  const photo = await prisma.photo.findFirst({
    where: { id, authId },
    select: {
      id: true,
      caption: true,
      milestone: true,
      date: true,
      file: true,
      fileSize: true,
    },
  });
  if (!photo) throw new ApiError(404, "Photo not found");

  await deleteFromS3(photo.file);
  await prisma.photo.delete({ where: { id } });

  return {
    id: photo.id,
    caption: photo.caption,
    milestone: photo.milestone,
    date: photo.date,
    fileSize: photo.fileSize,
  };
};

export const photoServices = { create, getMy, getSingle, remove };
