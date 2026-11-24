import bcrypt from "bcrypt";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import prisma from "../../utils/prisma.js";
import { safeDeleteFromS3 } from "../../utils/awss3.js";
import { deleteSubscriber } from "../../utils/revenuecat.js";
import {
  TDeleteAccount,
  TProfileUpdate,
  TUpdateConsent,
} from "./profile.validation.js";

const consentSelect = {
  healthData: true,
  healthDataUpdatedAt: true,
  marketing: true,
  cookies: true,
};

const getProfile = async (authId: string) => {
  const profile = await prisma.auth.findUniqueOrThrow({
    where: {
      id: authId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      loginProvider: true,
      consent: { select: consentSelect },
      subscription: { select: { status: true } },
    },
  });

  const { subscription, loginProvider, consent, ...rest } = profile;
  return {
    ...rest,
    provider: loginProvider,
    consent: consent ?? null,
    isPremiumUser: subscription?.status === SubscriptionStatus.ACTIVE,
  };
};

const updateProfile = async (authId: string, payload: TProfileUpdate) => {
  // explicit fields only: never pass a request body straight to Prisma
  const data = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.fcmToken !== undefined ? { fcmToken: payload.fcmToken } : {}),
    ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
  };
  // a device token belongs to one account at a time (same rule as login)
  if (payload.fcmToken) {
    await prisma.auth.updateMany({
      where: { fcmToken: payload.fcmToken, id: { not: authId } },
      data: { fcmToken: null },
    });
  }
  const result = await prisma.auth.update({
    where: {
      id: authId,
    },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return result;
};

/** Save / change the "Your consent matters" choices. healthData: false = withdraw. */
const updateConsent = async (authId: string, payload: TUpdateConsent) => {
  const { consent: existing } = await prisma.auth.findUniqueOrThrow({
    where: { id: authId },
    select: { consent: true },
  });

  const now = new Date();
  const healthDataUpdatedAt =
    existing && existing.healthData === payload.healthData
      ? existing.healthDataUpdatedAt
      : now;

  const { consent } = await prisma.auth.update({
    where: { id: authId },
    data: {
      consent: {
        set: {
          healthData: payload.healthData,
          healthDataUpdatedAt,
          marketing: payload.marketing,
          cookies: payload.cookies,
          updatedAt: now,
        },
      },
    },
    select: { consent: { select: consentSelect } },
  });
  return consent;
};

/**
 * Self-service account deletion (UK GDPR right to erasure): permanently
 * deletes the account and all of its data, including uploaded files.
 * Payment rows are kept for accounting but unlinked from the user.
 * A store subscription is NOT cancelled - the user must cancel it in the
 * App Store / Play Store.
 */
const deleteAccount = async (authId: string, payload: TDeleteAccount) => {
  const auth = await prisma.auth.findUnique({
    where: { id: authId },
    select: { id: true, role: true, password: true },
  });
  if (!auth) throw new ApiError(404, "User not found!");
  if (auth.role === UserRole.ADMIN)
    throw new ApiError(400, "Admin account cannot be deleted!");
  if (!(await bcrypt.compare(payload.password, auth.password)))
    throw new ApiError(400, "Password is incorrect!");

  const [documents, photos] = await Promise.all([
    prisma.document.findMany({ where: { authId }, select: { file: true } }),
    prisma.photo.findMany({ where: { authId }, select: { file: true } }),
  ]);

  // children first: MongoDB has no cascading deletes
  await prisma.$transaction([
    prisma.medicationChecklist.deleteMany({
      where: { medication: { is: { authId } } },
    }),
    prisma.supplementChecklist.deleteMany({
      where: { supplement: { is: { authId } } },
    }),
    prisma.question.deleteMany({ where: { authId } }),
    prisma.appointment.deleteMany({ where: { authId } }),
    prisma.medication.deleteMany({ where: { authId } }),
    prisma.supplement.deleteMany({ where: { authId } }),
    prisma.symptom.deleteMany({ where: { authId } }),
    prisma.journal.deleteMany({ where: { authId } }),
    prisma.checklist.deleteMany({ where: { authId } }),
    prisma.cost.deleteMany({ where: { authId } }),
    prisma.cycle.deleteMany({ where: { authId } }),
    prisma.testResult.deleteMany({ where: { authId } }),
    prisma.note.deleteMany({ where: { authId } }),
    prisma.document.deleteMany({ where: { authId } }),
    prisma.photo.deleteMany({ where: { authId } }),
    prisma.support.deleteMany({ where: { authId } }),
    // own notifications, and admin notifications about this user (they
    // contain the user's name and email)
    prisma.notification.deleteMany({
      where: { OR: [{ receiverId: authId }, { referenceId: authId }] },
    }),
    prisma.subscription.deleteMany({ where: { authId } }),
    prisma.oTP.deleteMany({ where: { authId } }),
    prisma.payment.updateMany({ where: { authId }, data: { authId: null } }),
    prisma.auth.delete({ where: { id: authId } }),
  ]);

  // after the DB commit; failures are logged, never block the deletion
  await Promise.all(
    [...documents, ...photos].map(({ file }) => safeDeleteFromS3(file))
  );
  await deleteSubscriber(authId);
};

export const profileServices = {
  getProfile,
  updateProfile,
  updateConsent,
  deleteAccount,
};
