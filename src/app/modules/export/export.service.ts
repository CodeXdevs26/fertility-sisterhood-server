import ApiError from "../../classes/ApiError.js";
import prisma from "../../utils/prisma.js";
import { TExportQuery, TExportSection } from "./export.validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;

type TRange = { gte?: Date; lt?: Date } | undefined;

/** "YYYY-MM-DD" days -> UTC range; `to` is inclusive (lt = next UTC midnight). */
const toRange = (from?: string, to?: string): TRange => {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to
      ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS) }
      : {}),
  };
};

/** `{ [field]: range }` or nothing when no range was given. */
const inRange = <K extends string>(field: K, range: TRange) =>
  (range ? { [field]: range } : {}) as Partial<Record<K, TRange>>;

/** Courses (medication/supplement) that overlap the range at all. */
const overlapsRange = (range: TRange) => ({
  ...(range?.lt ? { startDate: { lt: range.lt } } : {}),
  ...(range?.gte ? { endDate: { gte: range.gte } } : {}),
});

/**
 * A course is exported when it overlaps the range OR has an intake record
 * inside it (intake can be marked outside the course dates).
 */
const courseInRange = <K extends string>(
  checklistRelation: K,
  range: TRange
) =>
  range
    ? {
        OR: [
          overlapsRange(range),
          { [checklistRelation]: { some: { date: range } } } as Record<
            K,
            { some: { date: TRange } }
          >,
        ],
      }
    : {};

const courseSelect = {
  name: true,
  dose: true,
  frequency: true,
  type: true,
  startDate: true,
  endDate: true,
  createdAt: true,
} as const;

const sectionFetchers: Record<
  TExportSection,
  (authId: string, range: TRange) => Promise<unknown>
> = {
  profile: async authId => {
    const profile = await prisma.auth.findUnique({
      where: { id: authId },
      select: { name: true, email: true, timezone: true, createdAt: true },
    });
    if (!profile) throw new ApiError(404, "User not found");
    return profile;
  },

  symptoms: (authId, range) =>
    prisma.symptom.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: { date: true, symptomName: true, moods: true, note: true },
    }),

  cycles: (authId, range) =>
    prisma.cycle.findMany({
      where: { authId, ...inRange("startDate", range) },
      orderBy: { startDate: "asc" },
      select: { startDate: true, endDate: true, cyclePeriod: true },
    }),

  appointments: async (authId, range) => {
    const appointments = await prisma.appointment.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: {
        date: true,
        time: true,
        doctor: true,
        description: true,
        createdAt: true,
        questions: { orderBy: { createdAt: "asc" }, select: { text: true } },
      },
    });
    return appointments.map(({ questions, ...appointment }) => ({
      ...appointment,
      questions: questions.map(question => question.text),
    }));
  },

  medications: async (authId, range) => {
    const medications = await prisma.medication.findMany({
      where: { authId, ...courseInRange("medicationChecklists", range) },
      orderBy: { startDate: "asc" },
      select: {
        ...courseSelect,
        reminderTimes: true,
        medicationChecklists: {
          where: inRange("date", range),
          orderBy: { date: "asc" },
          select: { date: true },
        },
      },
    });
    return medications.map(({ medicationChecklists, ...medication }) => ({
      ...medication,
      takenDates: medicationChecklists.map(taken => taken.date),
    }));
  },

  supplements: async (authId, range) => {
    const supplements = await prisma.supplement.findMany({
      where: { authId, ...courseInRange("supplementChecklists", range) },
      orderBy: { startDate: "asc" },
      select: {
        ...courseSelect,
        supplementChecklists: {
          where: inRange("date", range),
          orderBy: { date: "asc" },
          select: { date: true },
        },
      },
    });
    return supplements.map(({ supplementChecklists, ...supplement }) => ({
      ...supplement,
      takenDates: supplementChecklists.map(taken => taken.date),
    }));
  },

  journals: (authId, range) =>
    prisma.journal.findMany({
      where: { authId, ...inRange("createdAt", range) },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, title: true, content: true },
    }),

  checklists: (authId, range) =>
    prisma.checklist.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: {
        date: true,
        title: true,
        category: true,
        status: true,
        description: true,
      },
    }),

  costs: (authId, range) =>
    prisma.cost.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: {
        date: true,
        amount: true,
        isPaid: true,
        ivfRound: true,
        type: true,
        category: true,
        description: true,
      },
    }),

  testResults: (authId, range) =>
    prisma.testResult.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: {
        date: true,
        category: true,
        name: true,
        value: true,
        unit: true,
        note: true,
      },
    }),

  notes: (authId, range) =>
    prisma.note.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: { date: true, title: true, description: true, tags: true },
    }),

  documents: (authId, range) =>
    prisma.document.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: { date: true, note: true, file: true },
    }),

  photos: (authId, range) =>
    prisma.photo.findMany({
      where: { authId, ...inRange("date", range) },
      orderBy: { date: "asc" },
      select: {
        date: true,
        caption: true,
        milestone: true,
        file: true,
        fileSize: true,
      },
    }),
};

const exportData = async (authId: string, query: TExportQuery) => {
  const range = toRange(query.from, query.to);

  const results = await Promise.all(
    query.sections.map(
      async section =>
        [section, await sectionFetchers[section](authId, range)] as const
    )
  );

  return {
    exportedAt: new Date(),
    range: { from: query.from ?? null, to: query.to ?? null },
    sections: Object.fromEntries(results),
  };
};

export const exportServices = { exportData };
