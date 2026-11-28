import { ChecklistStatus } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import {
  getUserTimeZone,
  getUserToday,
  rangesForLocalDate,
  sameDayWhere,
  toCalendarDay,
  withCalendarDays,
} from "../../utils/userDay.js";
import {
  TChecklistListQuery,
  TChecklistQuery,
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

/** `isCompleted` mirrors `status` for the app's tick box. */
const withIsCompleted = <T extends { status: ChecklistStatus }>(item: T) => ({
  ...item,
  isCompleted: item.status === ChecklistStatus.COMPLETED,
});

/**
 * Copies the admin's default checklist (ChecklistTemplate) into the user's
 * own checklist, dated `day`. Runs once per user; the claim is atomic, so
 * parallel requests cannot copy twice. A user whose claim was taken while no
 * templates existed (or who has no items left) is seeded again.
 */
const seedFromTemplates = async (authId: string, day: Date) => {
  const templates = await prisma.checklistTemplate.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }],
    select: { title: true, category: true },
  });
  if (!templates.length) return;

  const auth = await prisma.auth.findUnique({
    where: { id: authId },
    select: { checklistSeededAt: true },
  });
  if (auth?.checklistSeededAt) {
    const itemCount = await prisma.checklist.count({ where: { authId } });
    if (itemCount > 0) return;
    // claimed earlier but nothing was copied: release that exact claim
    await prisma.auth.updateMany({
      where: { id: authId, checklistSeededAt: auth.checklistSeededAt },
      data: { checklistSeededAt: null },
    });
  }

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
  const item = await prisma.checklist.create({
    data: {
      authId,
      title: payload.title,
      category: payload.category,
      date: payload.date
        ? toCalendarDay(payload.date, timeZone)
        : getUserToday(timeZone).day,
      description: payload.description,
    },
    select: itemSelect,
  });
  return withIsCompleted(item);
};

/** All of the user's checklist items, filterable by category, status and day. */
const getMy = async (
  authId: string,
  options: TPaginationOptions,
  query: TChecklistListQuery
) => {
  const timeZone = await getUserTimeZone(authId);
  await seedFromTemplates(authId, getUserToday(timeZone).day);

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
  return {
    meta: { page, limit: take, total },
    checklists: checklists.map(withIsCompleted),
  };
};

/**
 * The user's checklist as of today (or `date`, the app's local "YYYY-MM-DD").
 * The checklist is persistent, not per day: every item dated on or before
 * that day is returned, so the default items (dated the day they were copied)
 * stay visible and keep their ticked state. Items planned for a later day
 * appear from that day on.
 */
const getToday = async (
  authId: string,
  options: TPaginationOptions,
  query: TChecklistQuery
) => {
  const timeZone = await getUserTimeZone(authId);
  const today = query.date
    ? rangesForLocalDate(query.date, timeZone)
    : getUserToday(timeZone);
  await seedFromTemplates(authId, today.day);

  // the whole checklist fits in one page unless the app asks otherwise
  const { page, take, skip } = calculatePagination({ limit: 100, ...options });
  // the later bound also covers older items stored as raw timestamps
  const before = new Date(
    Math.max(today.dayRange.lt.getTime(), today.instantRange.lt.getTime())
  );
  const where = {
    authId,
    date: { lt: before },
    ...(query.category ? { category: query.category } : {}),
  };
  const [checklists, total] = await Promise.all([
    prisma.checklist.findMany({
      where,
      skip,
      take,
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
      select: itemSelect,
    }),
    prisma.checklist.count({ where }),
  ]);
  return {
    meta: { page, limit: take, total },
    checklists: checklists.map(withIsCompleted),
  };
};

const findOwnOrThrow = async (authId: string, id: string) => {
  const item = await prisma.checklist.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!item) throw new ApiError(404, "Checklist item not found");
};

const markDone = async (authId: string, id: string) => {
  await findOwnOrThrow(authId, id);
  const item = await prisma.checklist.update({
    where: { id },
    data: { status: ChecklistStatus.COMPLETED },
    select: itemSelect,
  });
  return withIsCompleted(item);
};

const update = async (
  authId: string,
  id: string,
  payload: TUpdateChecklist
) => {
  await findOwnOrThrow(authId, id);

  const { isCompleted, ...fields } = await withCalendarDays(authId, payload, [
    "date",
  ]);
  const item = await prisma.checklist.update({
    where: { id },
    data: {
      ...fields,
      // the app's tick (true/false); wins over `status` when both are sent
      ...(isCompleted !== undefined
        ? {
            status: isCompleted
              ? ChecklistStatus.COMPLETED
              : ChecklistStatus.PENDING,
          }
        : {}),
    },
    select: itemSelect,
  });
  return withIsCompleted(item);
};

const remove = async (authId: string, id: string) => {
  await findOwnOrThrow(authId, id);
  const item = await prisma.checklist.delete({
    where: { id },
    select: itemSelect,
  });
  return withIsCompleted(item);
};

export const checklistServices = {
  create,
  getMy,
  getToday,
  markDone,
  update,
  remove,
};
