import { UserRole } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import prisma from "../../utils/prisma.js";
import { TCreatePackage, TUpdatePackage } from "./package.validation.js";

export const packageSelect = {
  id: true,
  title: true,
  billingCycle: true,
  revenueCatProductId: true,
  entitlementId: true,
  description: true,
  price: true,
  currency: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

// routes use validate({ replace: true }), so the body is already parsed
const create = async (payload: TCreatePackage) =>
  prisma.package.create({ data: payload, select: packageSelect });

/** Users see live packages only; admins can include soft-deleted ones. */
const getAll = async (role: UserRole, includeDeleted: boolean) =>
  prisma.package.findMany({
    where:
      role === UserRole.ADMIN && includeDeleted ? {} : { isDeleted: false },
    orderBy: [{ price: "asc" }, { createdAt: "asc" }],
    select: packageSelect,
  });

const getById = async (id: string, role: UserRole) => {
  const pkg = await prisma.package.findFirst({
    where: role === UserRole.ADMIN ? { id } : { id, isDeleted: false },
    select: packageSelect,
  });
  if (!pkg) throw new ApiError(404, "Package not found");
  return pkg;
};

const ensureLive = async (id: string) => {
  const pkg = await prisma.package.findFirst({
    where: { id, isDeleted: false },
    select: { id: true },
  });
  if (!pkg) throw new ApiError(404, "Package not found");
};

const update = async (id: string, payload: TUpdatePackage) => {
  await ensureLive(id);
  return prisma.package.update({
    where: { id },
    data: payload,
    select: packageSelect,
  });
};

/** Soft delete: existing subscriptions keep their package reference. */
const remove = async (id: string) => {
  await ensureLive(id);
  return prisma.package.update({
    where: { id },
    data: { isDeleted: true },
    select: packageSelect,
  });
};

/**
 * Local package for a RevenueCat product id. Play Store ids can arrive as
 * `subscriptionId:basePlanId`, so the part before `:` is tried too.
 * Soft-deleted packages still match: existing subscribers keep renewing.
 */
export const findPackageByProduct = async (productId?: string | null) => {
  if (!productId) return null;
  const candidates = [productId];
  const base = productId.split(":")[0];
  if (base && base !== productId) candidates.push(base);

  const packages = await prisma.package.findMany({
    where: { revenueCatProductId: { in: candidates } },
    select: { id: true, entitlementId: true, revenueCatProductId: true },
  });
  return (
    packages.find(p => p.revenueCatProductId === productId) ??
    packages[0] ??
    null
  );
};

export const packageServices = { create, getAll, getById, update, remove };
