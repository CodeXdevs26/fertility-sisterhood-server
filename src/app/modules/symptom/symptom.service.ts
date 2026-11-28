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
} from "../../utils/userDay.js";
import { TCreateSymptom, TUpdateSymptom } from "./symptom.validation.js";

const symptomSelect = {
  id: true,
  symptomName: true,
  moods: true,
  note: true,
  date: true,
};

/**
 * One symptom entry per calendar day (user's timezone, stored at UTC
 * midnight). Posting again for a day that already has an entry updates that
 * entry instead of failing; `created` tells which happened.
 */
const create = async (authId: string, payload: TCreateSymptom) => {
  const timeZone = await getUserTimeZone(authId);
  const date = payload.date
    ? toCalendarDay(payload.date, timeZone)
    : getUserToday(timeZone).day;
  const existing = await prisma.symptom.findFirst({
    where: { authId, OR: sameDayWhere(date, timeZone) },
    select: { id: true },
  });

  const data = {
    symptomName: payload.symptomName,
    moods: payload.moods,
    note: payload.note,
    date,
  };
  if (existing) {
    const symptom = await prisma.symptom.update({
      where: { id: existing.id },
      data,
      select: symptomSelect,
    });
    return { symptom, created: false };
  }

  const symptom = await prisma.symptom.create({
    data: { authId, ...data },
    select: symptomSelect,
  });
  return { symptom, created: true };
};

const getMy = async (authId: string, options: TPaginationOptions) => {
  const { page, take, skip } = calculatePagination(options);
  const where = { authId };
  const [symptoms, total] = await Promise.all([
    prisma.symptom.findMany({
      where,
      skip,
      take,
      orderBy: { date: "desc" },
      select: {
        id: true,
        symptomName: true,
        moods: true,
        note: true,
        date: true,
      },
    }),
    prisma.symptom.count({ where }),
  ]);
  return { meta: { page, limit: take, total }, symptoms };
};

/** Today's entry (or `date`, the app's local "YYYY-MM-DD"); null if none. */
const getToday = async (authId: string, date?: string) => {
  const timeZone = await getUserTimeZone(authId);
  const day = date
    ? new Date(`${date}T00:00:00.000Z`)
    : getUserToday(timeZone).day;
  return prisma.symptom.findFirst({
    where: { authId, OR: sameDayWhere(day, timeZone) },
    orderBy: { date: "desc" },
    select: {
      id: true,
      symptomName: true,
      moods: true,
      note: true,
      date: true,
    },
  });
};

const update = async (authId: string, id: string, payload: TUpdateSymptom) => {
  const symptom = await prisma.symptom.findFirst({
    where: { id, authId },
    select: { id: true, date: true },
  });
  if (!symptom) throw new ApiError(404, "Symptom not found");

  let date: Date | undefined;
  if (payload.date) {
    const timeZone = await getUserTimeZone(authId);
    date = toCalendarDay(payload.date, timeZone);
    const existing = await prisma.symptom.findFirst({
      where: { authId, id: { not: id }, OR: sameDayWhere(date, timeZone) },
      select: { id: true },
    });
    if (existing)
      throw new ApiError(
        409,
        "There is already a symptom entry for this day. Please edit that entry instead."
      );
  }

  return prisma.symptom.update({
    where: { id },
    data: { ...payload, ...(date ? { date } : {}) },
    select: {
      id: true,
      symptomName: true,
      moods: true,
      note: true,
      date: true,
    },
  });
};

const remove = async (authId: string, id: string) => {
  const symptom = await prisma.symptom.findFirst({
    where: { id, authId },
    select: { id: true },
  });
  if (!symptom) throw new ApiError(404, "Symptom not found");

  return prisma.symptom.delete({
    where: { id },
    select: {
      id: true,
      symptomName: true,
      moods: true,
      note: true,
      date: true,
    },
  });
};

export const symptomServices = { create, getMy, getToday, update, remove };
