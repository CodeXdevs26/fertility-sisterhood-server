import ApiError from "../../classes/ApiError.js";
import prisma from "../../utils/prisma.js";
import { getUserTimeZone, getUserToday } from "../../utils/userDay.js";
import { TCreateCycle, TUpdateCycle } from "./cycle.validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const cycleSelect = {
  id: true,
  startDate: true,
  cyclePeriod: true,
  periodLength: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "YYYY-MM-DD" -> UTC midnight of that day */
const toUtcDay = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** The user's local today as a UTC-midnight day (cycle days are stored so). */
const userTodayUtc = async (authId: string) =>
  getUserToday(await getUserTimeZone(authId)).day;

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

const dayDiff = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

const formatDay = (date: Date) => date.toISOString().slice(0, 10);

const computeEndDate = (startDate: Date, cyclePeriod: number | null) =>
  cyclePeriod ? addDays(startDate, cyclePeriod - 1) : null;

/** "YYYY-MM" -> first and last day of that month in UTC */
const monthBounds = (month: string) => {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return {
    monthStart: new Date(Date.UTC(year, monthIndex, 1)),
    monthEnd: new Date(Date.UTC(year, monthIndex + 1, 0)),
  };
};

const monthOf = (date: Date) => date.toISOString().slice(0, 7);

const monthLabel = (date: Date) =>
  `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** Cycles that START in the same calendar month as `startDate`. */
const findCycleStartingInMonth = (
  authId: string,
  startDate: Date,
  excludeId?: string
) => {
  const { monthStart, monthEnd } = monthBounds(monthOf(startDate));
  return prisma.cycle.findFirst({
    where: {
      authId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { gte: monthStart, lte: monthEnd },
    },
    select: { id: true },
  });
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
  excludeIds: string[] = []
) => {
  const conflicts = await prisma.cycle.findMany({
    where: {
      authId,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
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

  throw new ApiError(
    409,
    "These dates overlap another cycle. Please edit or delete that cycle first."
  );
};

/** Ends `cycle` the day before `nextStartDate`. */
const closeBefore = (
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

/**
 * PATCH /cycles/:id. Also used by POST when a cycle already starts in that
 * month (one cycle per calendar month: POST updates it instead).
 */
const update = async (authId: string, id: string, payload: TUpdateCycle) => {
  const cycle = await prisma.cycle.findFirst({
    where: { id, authId },
    select: {
      id: true,
      startDate: true,
      cyclePeriod: true,
      periodLength: true,
    },
  });
  if (!cycle) throw new ApiError(404, "Cycle not found!");

  const startDate = payload.startDate
    ? toUtcDay(payload.startDate)
    : cycle.startDate;
  const cyclePeriod =
    payload.cyclePeriod !== undefined
      ? payload.cyclePeriod
      : (cycle.cyclePeriod ?? null);
  const periodLength =
    payload.periodLength !== undefined
      ? payload.periodLength
      : (cycle.periodLength ?? null);
  if (cyclePeriod && periodLength && periodLength > cyclePeriod)
    throw new ApiError(400, "periodLength cannot be longer than cyclePeriod!");
  const endDate = computeEndDate(startDate, cyclePeriod);

  if (await findCycleStartingInMonth(authId, startDate, id))
    throw new ApiError(
      400,
      `You already have a cycle in ${monthLabel(startDate)}. Only one cycle per month is allowed.`
    );

  // the previous cycle that was auto-closed the day before this one follows
  // the new start date (no gap, no overlap)
  const previous = startDate.getTime() !== cycle.startDate.getTime()
    ? await prisma.cycle.findFirst({
        where: {
          authId,
          id: { not: id },
          endDate: addDays(cycle.startDate, -1),
          startDate: { lt: startDate },
        },
        select: { id: true, startDate: true },
      })
    : null;

  const ongoing = await findOngoingToCloseOrThrow(
    authId,
    startDate,
    endDate,
    [id, ...(previous ? [previous.id] : [])]
  );
  if (previous) await closeBefore(previous, startDate);
  if (ongoing) await closeBefore(ongoing, startDate);

  const updated = await prisma.cycle.update({
    where: { id },
    data: { startDate, cyclePeriod, periodLength, endDate },
    select: cycleSelect,
  });

  return { ...updated, cycleNumber: await getCycleNumber(authId, startDate) };
};

/**
 * One cycle per calendar month: if a cycle already starts in the month of
 * `startDate`, that cycle is updated (upsert) and `created` is false.
 */
const create = async (authId: string, payload: TCreateCycle) => {
  const startDate = toUtcDay(payload.startDate);

  const sameMonth = await findCycleStartingInMonth(authId, startDate);
  if (sameMonth) {
    const cycle = await update(authId, sameMonth.id, payload);
    return { cycle, created: false };
  }

  const cyclePeriod = payload.cyclePeriod ?? null;
  const periodLength = payload.periodLength ?? null;
  const endDate = computeEndDate(startDate, cyclePeriod);

  const ongoing = await findOngoingToCloseOrThrow(authId, startDate, endDate);
  if (ongoing) await closeBefore(ongoing, startDate);

  const cycle = await prisma.cycle.create({
    data: { authId, startDate, cyclePeriod, periodLength, endDate },
    select: cycleSelect,
  });

  return {
    cycle: {
      ...cycle,
      cycleNumber: await getCycleNumber(authId, startDate),
    },
    created: true,
  };
};

/** Newest first; `month` ("YYYY-MM") keeps cycles that overlap that month. */
const getMy = async (authId: string, month?: string) => {
  const [cycles, total] = await Promise.all([
    prisma.cycle.findMany({
      where: { authId },
      orderBy: { startDate: "desc" },
      select: cycleSelect,
    }),
    prisma.cycle.count({ where: { authId } }),
  ]);

  const numbered = cycles.map((cycle, index) => ({
    ...cycle,
    cycleNumber: total - index,
  }));
  if (!month) return numbered;

  const { monthStart, monthEnd } = monthBounds(month);
  return numbered.filter(
    cycle =>
      cycle.startDate <= monthEnd &&
      (!cycle.endDate || cycle.endDate >= monthStart)
  );
};

const getByDate = async (authId: string, month?: string) => {
  const today = await userTodayUtc(authId);
  const { monthStart, monthEnd } = monthBounds(month ?? monthOf(today));

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
    select: { id: true, startDate: true, endDate: true, periodLength: true },
  });

  const [firstCycle] = cycles;
  if (!firstCycle) return [];

  const firstNumber = await getCycleNumber(authId, firstCycle.startDate);

  return cycles.flatMap((cycle, index) => {
    // ongoing cycles are only shown up to today
    const lastDay = cycle.endDate ?? today;
    const from = cycle.startDate > monthStart ? cycle.startDate : monthStart;
    const to = lastDay < monthEnd ? lastDay : monthEnd;

    const days = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const cycleDay = dayDiff(cycle.startDate, day) + 1;
      days.push({
        date: formatDay(day),
        cycleDay,
        cycleNumber: firstNumber + index,
        cycleId: cycle.id,
        isPeriodDay: !!cycle.periodLength && cycleDay <= cycle.periodLength,
      });
    }
    return days;
  });
};

/**
 * The cycle day for today (or `date`, the app's local "YYYY-MM-DD").
 * Returns null when no cycle covers that day.
 */
const getToday = async (authId: string, date?: string) => {
  const day = date ? toUtcDay(date) : await userTodayUtc(authId);

  const cycle = await prisma.cycle.findFirst({
    where: {
      authId,
      startDate: { lte: day },
      OR: [
        { endDate: null },
        { endDate: { isSet: false } },
        { endDate: { gte: day } },
      ],
    },
    orderBy: { startDate: "desc" },
    select: cycleSelect,
  });
  if (!cycle) return null;

  const cycleDay = dayDiff(cycle.startDate, day) + 1;
  return {
    date: formatDay(day),
    cycleDay,
    cycleNumber: await getCycleNumber(authId, cycle.startDate),
    isPeriodDay: !!cycle.periodLength && cycleDay <= cycle.periodLength,
    cycle,
  };
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

export const cycleServices = {
  create,
  getMy,
  getByDate,
  getToday,
  update,
  remove,
};
