import ApiError from "../../classes/ApiError.js";
import { TFile } from "../../interface/file.interface.js";
import { getDayBounds } from "../../utils/getDayBounds.js";
import { safeDeleteFromS3, uploadToS3 } from "../../utils/awss3.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TCreateDocument, TUpdateDocument } from "./document.validation.js";

const create = async (
  authId: string,
  payload: TCreateDocument,
  file?: TFile
) => {
  if (!file) throw new ApiError(400, "File is required");
  const fileUrl = await uploadToS3(file);
  try {
    return await prisma.document.create({
      data: {
        authId,
        file: fileUrl,
        date: payload.date ?? new Date(),
        note: payload.note,
      },
      select: { id: true, date: true, note: true, file: true },
    });
  } catch (error) {
    await safeDeleteFromS3(fileUrl); // don't orphan the upload
    throw error;
  }
};

const getMy = async (
  authId: string,
  options: TPaginationOptions,
  date?: Date
) => {
  const { page, take, skip } = calculatePagination(options);
  const where = {
    authId,
    ...(date ? { date: getDayBounds(date) } : {}),
  };
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take,
      orderBy: { date: "desc" },
      select: { id: true, date: true, note: true, file: true },
    }),
    prisma.document.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, documents };
};

const update = async (
  authId: string,
  id: string,
  payload: TUpdateDocument,
  file?: TFile
) => {
  const document = await prisma.document.findFirst({
    where: { id, authId },
    select: { id: true, file: true },
  });
  if (!document) throw new ApiError(404, "Document not found");

  const newFileUrl = file ? await uploadToS3(file) : undefined;
  let updated;
  try {
    updated = await prisma.document.update({
      where: { id },
      data: { ...payload, ...(newFileUrl ? { file: newFileUrl } : {}) },
      select: { id: true, date: true, note: true, file: true },
    });
  } catch (error) {
    await safeDeleteFromS3(newFileUrl); // don't orphan the new upload
    throw error;
  }
  if (newFileUrl) await safeDeleteFromS3(document.file);
  return updated;
};

const remove = async (authId: string, id: string) => {
  const document = await prisma.document.findFirst({
    where: { id, authId },
    select: { id: true, date: true, note: true, file: true },
  });
  if (!document) throw new ApiError(404, "Document not found");
  await prisma.document.delete({ where: { id } });
  await safeDeleteFromS3(document.file);
  return { id: document.id, date: document.date, note: document.note };
};

export const documentServices = { create, getMy, update, remove };
