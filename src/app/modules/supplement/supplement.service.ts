import ApiError from "../../classes/ApiError.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import { getDayBounds } from "../../utils/getDayBounds.js";
import prisma from "../../utils/prisma.js";
import {
  TCreateSupplement,
  TUpdateSupplement,
} from "./supplement.validation.js";

const create = async (authId: string, payload: TCreateSupplement) =>
  prisma.supplement.create({
    data: { authId, ...payload },
    select: {
      id: true,
      name: true,
      dose: true,
      frequency: true,
      type: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });

const getMy = async (authId: string, options: TPaginationOptions) => {
  const { page, take, skip } = calculatePagination(options);
  const where = { authId };
  const today = getDayBounds(new Date());
  const [supplements, total] = await Promise.all([
    prisma.supplement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        dose: true,
        frequency: true,
        supplementChecklists: {
          where: { date: today },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.supplement.count({ where }),
  ]);
  return {
    meta: { page, limit: take, total },
    supplements: supplements.map(({ supplementChecklists, ...supplement }) => ({
      ...supplement,
      isTakenToday: supplementChecklists.length > 0,
    })),
  };
};

const markTakenToday = async (authId: string, id: string) => {
  const supplement = await prisma.supplement.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!supplement) throw new ApiError(404, "Supplement not found");

  const date = getDayBounds(new Date());
  const existingChecklist = await prisma.supplementChecklist.findFirst({
    where: { supplementId: id, date },
    select: { id: true, supplementId: true, date: true },
  });
  if (existingChecklist) return existingChecklist;

  return prisma.supplementChecklist.create({
    data: { supplementId: id },
    select: { id: true, supplementId: true, date: true },
  });
};

const getSingle = async (authId: string, id: string) => {
  const supplement = await prisma.supplement.findFirst({
    where: { id, authId },
    select: {
      id: true,
      name: true,
      dose: true,
      frequency: true,
      type: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });
  if (!supplement) throw new ApiError(404, "Supplement not found");
  return supplement;
};

const update = async (
  authId: string,
  id: string,
  payload: TUpdateSupplement
) => {
  const supplement = await prisma.supplement.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!supplement) throw new ApiError(404, "Supplement not found");

  return prisma.supplement.update({
    where: { id },
    data: payload,
    select: {
      id: true,
      name: true,
      dose: true,
      frequency: true,
      type: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });
};

const remove = async (authId: string, id: string) => {
  const supplement = await prisma.supplement.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!supplement) throw new ApiError(404, "Supplement not found");

  await prisma.supplementChecklist.deleteMany({ where: { supplementId: id } });
  return prisma.supplement.delete({
    where: { id },
    select: {
      id: true,
      name: true,
      dose: true,
      frequency: true,
      type: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });
};

export const supplementServices = {
  create,
  getMy,
  markTakenToday,
  getSingle,
  update,
  remove,
};
