import prisma from "../../utils/prisma.js";
import { TUpdateAppSetting } from "./appSetting.validation.js";

const select = {
  supportEmail: true,
  supportPhone: true,
  communityLink: true,
  updatedAt: true,
};

const get = async () => prisma.appSetting.findFirst({ select });

const upsert = async (payload: TUpdateAppSetting) => {
  const existing = await prisma.appSetting.findFirst({ select: { id: true } });
  const data = {
    supportEmail: payload.supportEmail.trim().toLowerCase(),
    supportPhone: payload.supportPhone.trim(),
    communityLink: payload.communityLink.trim(),
  };

  if (!existing) return prisma.appSetting.create({ data, select });
  return prisma.appSetting.update({
    where: { id: existing.id },
    data,
    select,
  });
};

export const appSettingServices = { get, upsert };
