import { z } from "zod";

const title = z.string().trim().min(1);
const description = z.string().trim().optional();
const tags = z.array(z.string().trim().min(1));

export const createNoteZod = z.object({
  title,
  description,
  date: z.coerce.date(),
  tags: tags.default([]),
});
// no default here: in Zod 4 a default inside .partial() still applies,
// which would wipe the tags on every PATCH that omits them
export const updateNoteZod = z.object({
  title: title.optional(),
  description,
  date: z.coerce.date().optional(),
  tags: tags.optional(),
});
export type TCreateNote = z.infer<typeof createNoteZod>;
export type TUpdateNote = z.infer<typeof updateNoteZod>;
