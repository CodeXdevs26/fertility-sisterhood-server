import { SubscriptionStatus } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { TProfileUpdate, TUpdateConsent } from "./profile.validation.js";

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
  const result = await prisma.auth.update({
    where: {
      id: authId,
    },
    data: payload,
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

export const profileServices = {
  getProfile,
  updateProfile,
  updateConsent,
};
