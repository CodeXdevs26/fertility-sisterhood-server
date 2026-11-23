import { z } from "zod";

const text = z.string().trim().min(1, "Text is required").max(300);
const author = z.string().trim().max(100).nullable();

export const createQuoteZod = z.object({
  text,
  author: author.optional(),
});

export const updateQuoteZod = z.object({
  text: text.optional(),
  author: author.optional(),
  isActive: z.boolean().optional(),
});

export type TCreateQuote = z.infer<typeof createQuoteZod>;
export type TUpdateQuote = z.infer<typeof updateQuoteZod>;
