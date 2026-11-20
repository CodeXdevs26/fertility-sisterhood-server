import { DATE_EXAMPLE, ID_EXAMPLE, TOpenApiObject } from "./helpers.js";

/** Short builders for request-body property schemas. */
export const str = (example: string, description?: string): TOpenApiObject => ({
  type: "string",
  minLength: 1,
  example,
  ...(description ? { description } : {}),
});

export const optStr = (example: string, description?: string) => ({
  type: "string",
  example,
  ...(description ? { description } : {}),
});

export const dateTime = (description = "ISO date or date-time string") => ({
  type: "string",
  format: "date-time",
  example: DATE_EXAMPLE,
  description,
});

export const objectId = (description = "Id of the related record") => ({
  type: "string",
  example: ID_EXAMPLE,
  description,
});

/** Builds `{ type: object, required, properties }`. */
export const obj = (
  properties: Record<string, TOpenApiObject>,
  required: string[] = []
): TOpenApiObject => ({
  type: "object",
  ...(required.length ? { required } : {}),
  properties,
});

/** Same object but with nothing required (PATCH bodies). */
export const partial = (
  properties: Record<string, TOpenApiObject>
): TOpenApiObject => obj(properties, []);
