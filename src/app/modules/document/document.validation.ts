import { z } from "zod";

export const createDocumentZod = z.object({
  date: z.coerce.date().optional(),
  note: z.string().trim().optional(),
});

export const updateDocumentZod = createDocumentZod;

export const documentQueryZod = z.object({
  date: z.coerce.date().optional(),
});

export type TCreateDocument = z.infer<typeof createDocumentZod>;
export type TUpdateDocument = z.infer<typeof updateDocumentZod>;
export type TDocumentQuery = z.infer<typeof documentQueryZod>;
