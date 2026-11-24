import { ChecklistCategory } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import prisma from "../../utils/prisma.js";
import {
  TCreateChecklistTemplate,
  TUpdateChecklistTemplate,
} from "./checklistTemplate.validation.js";

const select = {
  id: true,
  category: true,
  title: true,
  order: true,
  createdAt: true,
};

const nextOrder = async (category: ChecklistCategory) => {
  const last = await prisma.checklistTemplate.findFirst({
    where: { category },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? 0) + 1;
};

const CATEGORY_ORDER = Object.values(ChecklistCategory);

const getAll = async (category?: string) => {
  if (category && !CATEGORY_ORDER.includes(category as ChecklistCategory)) {
    throw new ApiError(
      400,
      `category must be one of: ${CATEGORY_ORDER.join(", ")}`
    );
  }

  const items = await prisma.checklistTemplate.findMany({
    where: category ? { category: category as ChecklistCategory } : {},
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select,
  });

  // without a filter, group by category in enum order, then by `order`
  return category
    ? items
    : items.sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category) -
            CATEGORY_ORDER.indexOf(b.category) || a.order - b.order
      );
};

const create = async (payload: TCreateChecklistTemplate) =>
  prisma.checklistTemplate.create({
    data: {
      category: payload.category,
      title: payload.title.trim(),
      order: await nextOrder(payload.category),
    },
    select,
  });

const findOrThrow = async (id: string) => {
  const item = await prisma.checklistTemplate.findUnique({
    where: { id },
    select: { id: true, category: true },
  });
  if (!item) throw new ApiError(404, "Checklist template item not found");
  return item;
};

const update = async (id: string, payload: TUpdateChecklistTemplate) => {
  const item = await findOrThrow(id);
  const movesCategory =
    payload.category !== undefined && payload.category !== item.category;

  return prisma.checklistTemplate.update({
    where: { id },
    data: {
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(movesCategory
        ? {
            category: payload.category,
            order: await nextOrder(payload.category as ChecklistCategory),
          }
        : {}),
    },
    select,
  });
};

/** Deletes the template only; users' own checklist copies are untouched. */
const remove = async (id: string) => {
  await findOrThrow(id);
  return prisma.checklistTemplate.delete({ where: { id }, select });
};

export const checklistTemplateServices = { getAll, create, update, remove };
