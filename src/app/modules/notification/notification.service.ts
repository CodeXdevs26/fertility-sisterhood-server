import { NotificationModelType } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import config from "../../config/index.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import {
  createNotification,
  notificationSelect,
} from "./notification.utils.js";
import { TCreateDummyNotification } from "./notification.validation.js";

const createDummy = async (
  authId: string,
  payload: TCreateDummyNotification
) => {
  if (config.env === "production") throw new ApiError(404, "Route not found!");

  return createNotification({
    receiverId: authId,
    message: payload.message || "Test notification",
    description: payload.description || "This is a test push notification.",
    modelType: NotificationModelType.SYSTEM,
  });
};

const getMy = async (authId: string, options: TPaginationOptions) => {
  const { page, take, skip } = calculatePagination(options);
  const where = { receiverId: authId };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        message: true,
        description: true,
        modelType: true,
        referenceId: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, read: false } }),
  ]);

  return { meta: { page, limit: take, total, unreadCount }, notifications };
};

const markAllRead = async (authId: string) => {
  const { count } = await prisma.notification.updateMany({
    where: { receiverId: authId, read: false },
    data: { read: true },
  });
  return { count };
};

const remove = async (authId: string, id: string) => {
  const notification = await prisma.notification.findFirst({
    where: { id, receiverId: authId },
    select: { id: true },
  });
  if (!notification) throw new ApiError(404, "Notification not found!");

  return prisma.notification.delete({
    where: { id },
    select: notificationSelect,
  });
};

const clearAll = async (authId: string) => {
  const { count } = await prisma.notification.deleteMany({
    where: { receiverId: authId },
  });
  return { count };
};

export const notificationServices = {
  createDummy,
  getMy,
  markAllRead,
  remove,
  clearAll,
};
