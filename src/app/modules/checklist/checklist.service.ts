import { ChecklistCategory, ChecklistStatus } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import {
  getUserTimeZone,
  getUserToday,
  sameDayWhere,
  toCalendarDay,
  withCalendarDays,
} from "../../utils/userDay.js";
import {
  TChecklistListQuery,
  TCreateChecklist,
  TUpdateChecklist,
} from "./checklist.validation.js";

const itemSelect = {
  id: true,
  title: true,
  category: true,
  date: true,
  description: true,
  status: true,
};

/**
 * Copies the admin's default checklist (ChecklistTemplate) into the user's
 * own checklist once, the first time they open it. Items are dated today.
 * The claim is atomic, so parallel requests cannot copy twice.
 */
const seedFromTemplates = async (authId: string, timeZone: string) => {
  const claimed = await prisma.auth.updateMany({
    where: {
      id: authId,
      OR: [
        { checklistSeededAt: null },
        { checklistSeededAt: { isSet: false } },
      ],
    },
    data: { checklistSeededAt: new Date() },
  });
  if (claimed.count === 0) return;

  const templates = await prisma.checklistTemplate.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }],
    select: { title: true, category: true },
  });
  if (!templates.length) return;
  const day = getUserToday(timeZone).day;
  await prisma.checklist.createMany({
    data: templates.map(template => ({
      authId,
      title: template.title,
      category: template.category,
      date: day,
    })),
  });
};

const create = async (authId: string, payload: TCreateChecklist) => {
  // calendar day at UTC midnight; defaults to the user's local today
  const timeZone = await getUserTimeZone(authId);
  return prisma.checklist.create({
    data: {
      authId,
      title: payload.title,
      category: payload.category,
      date: payload.date
        ? toCalendarDay(payload.date, timeZone)
        : getUserToday(timeZone).day,
      description: payload.description,
    },
    select: { id: true, title: true, category: true, date: true, status: true },
  });
};

/** All of the user's checklist items, filterable by category, status and day. */
const getMy = async (
  authId: string,
  options: TPaginationOptions,
  query: TChecklistListQuery
) => {
  const timeZone = await getUserTimeZone(authId);
  await seedFromTemplates(authId, timeZone);

  const { page, take, skip } = calculatePagination(options);
  const where = {
    authId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.date
      ? { OR: sameDayWhere(toCalendarDay(query.date, timeZone), timeZone) }
      : {}),
  };
  const [checklists, total] = await Promise.all([
    prisma.checklist.findMany({
      where,
      skip,
      take,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: itemSelect,
    }),
    prisma.checklist.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, checklists };
};

const getToday = async (
  authId: string,
  options: TPaginationOptions,
  category?: ChecklistCategory
) => {
  const timeZone = await getUserTimeZone(authId);
  await seedFromTemplates(authId, timeZone);

  const { page, take, skip } = calculatePagination(options);
  const where = {
    authId,
    // the user's local today (items may also hold older raw timestamps)
    OR: sameDayWhere(getUserToday(timeZone).day, timeZone),
    ...(category ? { category } : {}),
  };
  const [checklists, total] = await Promise.all([
    prisma.checklist.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, status: true },
    }),
    prisma.checklist.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, checklists };
};

const markDone = async (authId: string, id: string) => {
  const item = await prisma.checklist.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!item) throw new ApiError(404, "Checklist item not found");
  return prisma.checklist.update({
    where: { id },
    data: { status: ChecklistStatus.COMPLETED },
    select: { id: true, title: true, status: true },
  });
};

const update = async (
  authId: string,
  id: string,
  payload: TUpdateChecklist
) => {
  const item = await prisma.checklist.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!item) throw new ApiError(404, "Checklist item not found");

  payload = await withCalendarDays(authId, payload, ["date"]);
  return prisma.checklist.update({
    where: { id },
    data: payload,
    select: { id: true, title: true, category: true, date: true, status: true },
  });
};

const remove = async (authId: string, id: string) => {
  const item = await prisma.checklist.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!item) throw new ApiError(404, "Checklist item not found");

  return prisma.checklist.delete({
    where: { id },
    select: { id: true, title: true, category: true, date: true, status: true },
  });
};

export const checklistServices = {
  create,
  getMy,
  getToday,
  markDone,
  update,
  remove,
};
