import { SupportStatus } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TSendSupport } from "./support.validation.js";

const send = async (payload: TSendSupport) =>
  prisma.support.create({
    data: payload,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

const getAll = async (options: TPaginationOptions) => {
  const { page, take, skip } = calculatePagination(options);
  const where = {};
  const [supports, total] = await Promise.all([
    prisma.support.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.support.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, supports };
};

const updateStatus = async (id: string, status: SupportStatus) => {
  const support = await prisma.support.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!support) throw new ApiError(404, "Support request not found");
  return prisma.support.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });
};

export const supportServices = { send, getAll, updateStatus };
