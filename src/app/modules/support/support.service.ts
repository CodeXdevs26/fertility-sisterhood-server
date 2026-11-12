import { Prisma, SupportStatus } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TSendSupport } from "./support.validation.js";

const send = async (authId: string, payload: TSendSupport) =>
  prisma.support.create({
    data: { authId, ...payload },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

const getAll = async (options: TPaginationOptions, searchTerm?: string) => {
  const { page, take, skip } = calculatePagination(options);
  const where: Prisma.SupportWhereInput = searchTerm
    ? {
        OR: [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
          {
            auth: {
              is: { name: { contains: searchTerm, mode: "insensitive" } },
            },
          },
          {
            auth: {
              is: { email: { contains: searchTerm, mode: "insensitive" } },
            },
          },
        ],
      }
    : {
        status: { not: SupportStatus.RESOLVED },
      };
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
        auth: { select: { id: true, name: true, email: true, status: true } },
      },
    }),
    prisma.support.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, supports };
};

const getSingle = async (id: string) => {
  const support = await prisma.support.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      auth: { select: { id: true, name: true, email: true, status: true } },
    },
  });
  if (!support) throw new ApiError(404, "Support request not found");
  return support;
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

export const supportServices = { send, getAll, getSingle, updateStatus };
