import {
  NotificationModelType,
  Prisma,
  UserRole,
  UserStatus,
} from "@prisma/client";
import prisma from "../../utils/prisma.js";
import {
  getFirebaseMessaging,
  INVALID_FCM_TOKEN_CODES,
} from "../../utils/firebase.js";

export type TNotifyInput = {
  receiverId: string;
  message: string;
  description?: string | null;
  modelType: NotificationModelType;
  referenceId?: string | null;
  /** Unique key - a second notification with the same key is silently skipped. */
  dedupeKey?: string;
  /** false = in-app only, no FCM push */
  push?: boolean;
};

/** Reminder-type pushes are capped per user per 24h; account-critical ones are not. */
const CAPPED_TYPES: NotificationModelType[] = [
  NotificationModelType.DIGEST,
  NotificationModelType.APPOINTMENT,
];
const DAILY_PUSH_CAP = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const notificationSelect = {
  id: true,
  message: true,
  description: true,
  modelType: true,
  referenceId: true,
  read: true,
  pushed: true,
  createdAt: true,
};

type TCreatedNotification = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

const sendPush = async (
  receiverId: string,
  notification: TCreatedNotification
) => {
  const messaging = getFirebaseMessaging();
  if (!messaging) return false;

  const receiver = await prisma.auth.findUnique({
    where: { id: receiverId },
    select: { status: true, fcmToken: true },
  });
  if (!receiver?.fcmToken || receiver.status !== UserStatus.ACTIVE)
    return false;

  if (CAPPED_TYPES.includes(notification.modelType)) {
    const pushedToday = await prisma.notification.count({
      where: {
        receiverId,
        pushed: true,
        modelType: { in: CAPPED_TYPES },
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    });
    if (pushedToday >= DAILY_PUSH_CAP) return false;
  }

  try {
    await messaging.send({
      token: receiver.fcmToken,
      notification: {
        title: notification.message,
        ...(notification.description ? { body: notification.description } : {}),
      },
      data: {
        notificationId: notification.id,
        modelType: notification.modelType,
        referenceId: notification.referenceId ?? "",
      },
    });
  } catch (error: any) {
    if (INVALID_FCM_TOKEN_CODES.has(error?.code)) {
      // device uninstalled / token rotated - stop trying to push to it
      await prisma.auth.updateMany({
        where: { id: receiverId, fcmToken: receiver.fcmToken },
        data: { fcmToken: null },
      });
    } else {
      console.error("FCM push failed:", error?.message ?? error);
    }
    return false;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { pushed: true },
  });
  return true;
};

/**
 * Creates an in-app notification and (optionally) sends an FCM push.
 * Returns null when the dedupeKey already exists.
 */
export const createNotification = async ({
  receiverId,
  message,
  description,
  modelType,
  referenceId,
  dedupeKey,
  push = true,
}: TNotifyInput) => {
  let notification: TCreatedNotification;
  try {
    notification = await prisma.notification.create({
      data: {
        receiverId,
        message,
        description: description ?? null,
        modelType,
        referenceId: referenceId ?? null,
        ...(dedupeKey ? { dedupeKey } : {}),
      },
      select: notificationSelect,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return null;
    throw error;
  }

  if (!push) return notification;
  const pushed = await sendPush(receiverId, notification);
  return { ...notification, pushed };
};

/** Fire-and-forget wrapper: never throws and never blocks the caller. */
export const notify = (input: TNotifyInput) => {
  createNotification(input).catch(error =>
    console.error("Failed to create notification:", error)
  );
};

/**
 * Fire-and-forget in-app notification (no push) to every active admin.
 * `dedupeKey` is suffixed with the admin id so each admin gets one copy.
 */
export const notifyAdmins = (
  input: Omit<TNotifyInput, "receiverId" | "push">
) => {
  prisma.auth
    .findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    })
    .then(admins =>
      admins.forEach(admin =>
        notify({
          ...input,
          receiverId: admin.id,
          push: false,
          ...(input.dedupeKey
            ? { dedupeKey: `${input.dedupeKey}:${admin.id}` }
            : {}),
        })
      )
    )
    .catch(error => console.error("Failed to notify admins:", error));
};
