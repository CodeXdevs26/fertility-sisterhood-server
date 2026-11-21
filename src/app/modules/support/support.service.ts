import {
  NotificationModelType,
  Prisma,
  SupportStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import { notify } from "../notification/notification.utils.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TSendSupport } from "./support.validation.js";

const send = async (authId: string, payload: TSendSupport) => {
  const support = await prisma.support.create({
    data: { authId, title: payload.title, description: payload.description },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

  // T5: in-app only for admins (no push)
  prisma.auth
    .findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    })
    .then(admins =>
      admins.forEach(admin =>
        notify({
          receiverId: admin.id,
          message: "New support request",
          description: support.title,
          modelType: NotificationModelType.SUPPORT,
          referenceId: support.id,
          push: false,
        })
      )
    )
    .catch(error => console.error("Failed to notify admins:", error));

  return support;
};

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
    select: { id: true, authId: true, status: true },
  });
  if (!support) throw new ApiError(404, "Support request not found");
  const updated = await prisma.support.update({
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

  // T4: tell the user only when it actually moves PENDING -> RESOLVED
  if (
    support.authId &&
    support.status === SupportStatus.PENDING &&
    status === SupportStatus.RESOLVED
  ) {
    notify({
      receiverId: support.authId,
      message: "Your support request has been resolved",
      description: updated.title,
      modelType: NotificationModelType.SUPPORT,
      referenceId: support.id,
      dedupeKey: `support-resolved:${support.id}`,
    });
  }

  return updated;
};

export const supportServices = { send, getAll, getSingle, updateStatus };
