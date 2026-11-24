import ApiError from "../../classes/ApiError.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TCreateQuote, TUpdateQuote } from "./quote.validation.js";

const select = {
  id: true,
  text: true,
  author: true,
  isActive: true,
  createdAt: true,
};
const DAY_MS = 24 * 60 * 60 * 1000;

// validate() does not replace req.body, so values are normalised here
const cleanAuthor = (author?: string | null) => author?.trim() || null;

const create = async (payload: TCreateQuote) =>
  prisma.quote.create({
    data: { text: payload.text.trim(), author: cleanAuthor(payload.author) },
    select,
  });

const getAll = async (options: TPaginationOptions) => {
  const { page, take, skip } = calculatePagination(options);
  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select,
    }),
    prisma.quote.count(),
  ]);
  return { meta: { page, limit: take, total }, quotes };
};

/** Same active quote for everyone on a given UTC day; rotates daily. */
const getToday = async () => {
  const where = { isActive: true };
  const count = await prisma.quote.count({ where });
  if (!count) return null;

  const dayNumber = Math.floor(Date.now() / DAY_MS);
  return prisma.quote.findFirst({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: dayNumber % count,
    select,
  });
};

const ensureExists = async (id: string) => {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!quote) throw new ApiError(404, "Quote not found");
};

const update = async (id: string, payload: TUpdateQuote) => {
  await ensureExists(id);
  return prisma.quote.update({
    where: { id },
    data: {
      ...(payload.text !== undefined ? { text: payload.text.trim() } : {}),
      ...(payload.author !== undefined
        ? { author: cleanAuthor(payload.author) }
        : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    select,
  });
};

const remove = async (id: string) => {
  await ensureExists(id);
  return prisma.quote.delete({ where: { id }, select });
};

export const quoteServices = { create, getAll, getToday, update, remove };
