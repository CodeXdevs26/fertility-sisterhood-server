import ApiError from "../../classes/ApiError.js";
import prisma from "../../utils/prisma.js";
import { TCreateCycle, TUpdateCycle } from "./cycle.validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const cycleSelect = {
  id: true,
  startDate: true,
  cyclePeriod: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
};

/** "YYYY-MM-DD" -> UTC midnight of that day */
const toUtcDay = (day: string) => new Date(`${day}T00:00:00.000Z`);

const todayUtc = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

const dayDiff = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

const formatDay = (date: Date) => date.toISOString().slice(0, 10);

const computeEndDate = (startDate: Date, cyclePeriod: number | null) =>
  cyclePeriod ? addDays(startDate, cyclePeriod - 1) : null;

/** "YYYY-MM" (or current month) -> first and last day of that month in UTC */
const monthBounds = (month?: string) => {
  const today = todayUtc();
  const [year, monthIndex] = month
    ? [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1]
    : [today.getUTCFullYear(), today.getUTCMonth()];

  return {
    monthStart: new Date(Date.UTC(year, monthIndex, 1)),
    monthEnd: new Date(Date.UTC(year, monthIndex + 1, 0)),
  };
};

/** 1-based position of the cycle among the user's cycles ordered by startDate */
const getCycleNumber = (authId: string, startDate: Date) =>
  prisma.cycle.count({ where: { authId, startDate: { lte: startDate } } });

/**
 * Throws 409 if [startDate, endDate] overlaps another cycle of the user.
 * Exception: if the only overlap is an ongoing cycle that started earlier,
 * it is returned so the caller can close it the day before the new one starts.
 */
const findOngoingToCloseOrThrow = async (
  authId: string,
  startDate: Date,
  endDate: Date | null,
  excludeId?: string
) => {
  const conflicts = await prisma.cycle.findMany({
    where: {
      authId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(endDate ? { startDate: { lte: endDate } } : {}),
      OR: [
        { endDate: null },
        { endDate: { isSet: false } },
        { endDate: { gte: startDate } },
      ],
    },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!conflicts.length) return null;

  const [conflict] = conflicts;
  if (
    conflicts.length === 1 &&
    conflict &&
    !conflict.endDate &&
    conflict.startDate < startDate
  ) {
    return conflict;
  }

  throw new ApiError(409, "This cycle overlaps with an existing cycle!");
};

const closeOngoingCycle = (
  cycle: { id: string; startDate: Date },
  nextStartDate: Date
) =>
  prisma.cycle.update({
    where: { id: cycle.id },
    data: {
      cyclePeriod: dayDiff(cycle.startDate, nextStartDate),
      endDate: addDays(nextStartDate, -1),
    },
  });

const create = async (authId: string, payload: TCreateCycle) => {
  const startDate = toUtcDay(payload.startDate);
  const cyclePeriod = payload.cyclePeriod ?? null;
  const endDate = computeEndDate(startDate, cyclePeriod);

  const ongoing = await findOngoingToCloseOrThrow(authId, startDate, endDate);
  if (ongoing) await closeOngoingCycle(ongoing, startDate);

  const cycle = await prisma.cycle.create({
    data: { authId, startDate, cyclePeriod, endDate },
    select: cycleSelect,
  });

  return { ...cycle, cycleNumber: await getCycleNumber(authId, startDate) };
};

const getMy = async (authId: string) => {
  const cycles = await prisma.cycle.findMany({
    where: { authId },
    orderBy: { startDate: "desc" },
    select: cycleSelect,
  });

  return cycles.map((cycle, index) => ({
    ...cycle,
    cycleNumber: cycles.length - index,
  }));
};

const getByDate = async (authId: string, month?: string) => {
  const { monthStart, monthEnd } = monthBounds(month);

  const cycles = await prisma.cycle.findMany({
    where: {
      authId,
      startDate: { lte: monthEnd },
      OR: [
        { endDate: null },
        { endDate: { isSet: false } },
        { endDate: { gte: monthStart } },
      ],
    },
    orderBy: { startDate: "asc" },
    select: { id: true, startDate: true, endDate: true },
  });

  const [firstCycle] = cycles;
  if (!firstCycle) return [];

  const firstNumber = await getCycleNumber(authId, firstCycle.startDate);
  const today = todayUtc();

  return cycles.flatMap((cycle, index) => {
    // ongoing cycles are only shown up to today
    const lastDay = cycle.endDate ?? today;
    const from = cycle.startDate > monthStart ? cycle.startDate : monthStart;
    const to = lastDay < monthEnd ? lastDay : monthEnd;

    const days = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      days.push({
        date: formatDay(day),
        cycleDay: dayDiff(cycle.startDate, day) + 1,
        cycleNumber: firstNumber + index,
        cycleId: cycle.id,
      });
    }
    return days;
  });
};

const update = async (authId: string, id: string, payload: TUpdateCycle) => {
  const cycle = await prisma.cycle.findFirst({
    where: { id, authId },
    select: { id: true, startDate: true, cyclePeriod: true },
  });
  if (!cycle) throw new ApiError(404, "Cycle not found!");

  const startDate = payload.startDate
    ? toUtcDay(payload.startDate)
    : cycle.startDate;
  const cyclePeriod =
    payload.cyclePeriod !== undefined
      ? payload.cyclePeriod
      : (cycle.cyclePeriod ?? null);
  const endDate = computeEndDate(startDate, cyclePeriod);

  const ongoing = await findOngoingToCloseOrThrow(
    authId,
    startDate,
    endDate,
    id
  );
  if (ongoing) await closeOngoingCycle(ongoing, startDate);

  const updated = await prisma.cycle.update({
    where: { id },
    data: { startDate, cyclePeriod, endDate },
    select: cycleSelect,
  });

  return { ...updated, cycleNumber: await getCycleNumber(authId, startDate) };
};

const remove = async (authId: string, id: string) => {
  const cycle = await prisma.cycle.findFirst({
    where: { id, authId },
    select: { id: true, startDate: true },
  });
  if (!cycle) throw new ApiError(404, "Cycle not found!");

  const cycleNumber = await getCycleNumber(authId, cycle.startDate);
  const deleted = await prisma.cycle.delete({
    where: { id },
    select: cycleSelect,
  });

  return { ...deleted, cycleNumber };
};

export const cycleServices = { create, getMy, getByDate, update, remove };
