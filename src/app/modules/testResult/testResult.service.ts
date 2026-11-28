import ApiError from "../../classes/ApiError.js";
import { TFile } from "../../interface/file.interface.js";
import { safeDeleteFromS3, uploadToS3 } from "../../utils/awss3.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import {
  TCreateTestResult,
  TUpdateTestResult,
} from "./testResult.validation.js";

const testResultSelect = {
  id: true,
  category: true,
  name: true,
  date: true,
  value: true,
  unit: true,
  note: true,
  attachmentUrl: true,
  attachmentName: true,
  mimeType: true,
  createdAt: true,
};

const findOwnOrThrow = async (authId: string, id: string) => {
  const testResult = await prisma.testResult.findFirst({
    where: { id, authId },
    select: { id: true, attachmentUrl: true },
  });
  if (!testResult) throw new ApiError(404, "Test result not found");
  return testResult;
};

const create = async (authId: string, payload: TCreateTestResult) =>
  prisma.testResult.create({
    data: { authId, ...payload },
    select: testResultSelect,
  });

const getMy = async (
  authId: string,
  options: TPaginationOptions,
  category?: string
) => {
  const { page, take, skip } = calculatePagination(options);
  const where = { authId, ...(category ? { category } : {}) };
  const [testResults, total] = await Promise.all([
    prisma.testResult.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: testResultSelect,
    }),
    prisma.testResult.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, testResults };
};

const getSingle = async (authId: string, id: string) => {
  const testResult = await prisma.testResult.findFirst({
    where: { id, authId },
    select: testResultSelect,
  });
  if (!testResult) throw new ApiError(404, "Test result not found");
  return testResult;
};

const update = async (
  authId: string,
  id: string,
  payload: TUpdateTestResult
) => {
  await findOwnOrThrow(authId, id);
  return prisma.testResult.update({
    where: { id },
    data: payload,
    select: testResultSelect,
  });
};

/** Adds or replaces the result's attachment (PDF / image). */
const setAttachment = async (authId: string, id: string, file?: TFile) => {
  if (!file)
    throw new ApiError(
      400,
      "Please attach a file in the 'attachment' field (PDF, JPG, PNG, WEBP or HEIC)"
    );
  const testResult = await findOwnOrThrow(authId, id);

  const attachmentUrl = await uploadToS3(file);
  let updated;
  try {
    updated = await prisma.testResult.update({
      where: { id },
      data: {
        attachmentUrl,
        attachmentName: file.originalname,
        mimeType: file.mimetype,
      },
      select: testResultSelect,
    });
  } catch (error) {
    await safeDeleteFromS3(attachmentUrl); // don't orphan the upload
    throw error;
  }
  await safeDeleteFromS3(testResult.attachmentUrl);
  return updated;
};

const removeAttachment = async (authId: string, id: string) => {
  const testResult = await findOwnOrThrow(authId, id);
  const updated = await prisma.testResult.update({
    where: { id },
    data: { attachmentUrl: null, attachmentName: null, mimeType: null },
    select: testResultSelect,
  });
  await safeDeleteFromS3(testResult.attachmentUrl);
  return updated;
};

const remove = async (authId: string, id: string) => {
  await findOwnOrThrow(authId, id);
  const deleted = await prisma.testResult.delete({
    where: { id },
    select: testResultSelect,
  });
  await safeDeleteFromS3(deleted.attachmentUrl);
  return deleted;
};

export const testResultServices = {
  create,
  getMy,
  getSingle,
  update,
  setAttachment,
  removeAttachment,
  remove,
};
