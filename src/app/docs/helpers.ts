/* eslint-disable @typescript-eslint/no-explicit-any */
// Small helpers used by every <module>.swagger.ts to keep the docs consistent.

export type TOpenApiObject = Record<string, any>;

export const ref = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

export const ID_EXAMPLE = "665f1c2a9b1e8a0012a3b4c5";
export const DATE_EXAMPLE = "2026-01-15T00:00:00.000Z";

export const idParam = (name = "id", description = "Record id (ObjectId)") => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", example: ID_EXAMPLE },
});

export const queryParam = (
  name: string,
  description: string,
  schema: TOpenApiObject = { type: "string" },
  required = false
) => ({ name, in: "query", required, description, schema });

export const pageParams = [
  queryParam("page", "Page number (default 1)", {
    type: "integer",
    minimum: 1,
    default: 1,
  }),
  queryParam("limit", "Items per page (default 10)", {
    type: "integer",
    minimum: 1,
    default: 10,
  }),
];

export const jsonBody = (schema: TOpenApiObject, required = true) => ({
  required,
  content: { "application/json": { schema } },
});

export const formBody = (schema: TOpenApiObject, required = true) => ({
  required,
  content: { "multipart/form-data": { schema } },
});

/** Standard `{ success, message, data }` envelope produced by sendResponse(). */
export const envelope = (message: string, data?: TOpenApiObject) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: message },
    data: data ?? { nullable: true, example: null },
  },
});

export const ok = (
  message: string,
  data?: TOpenApiObject,
  status: 200 | 201 = 200
) => ({
  [status]: {
    description: message,
    content: { "application/json": { schema: envelope(message, data) } },
  },
});

/** `{ meta, [key]: items[] }` - shape returned by every paginated list. */
export const paged = (key: string, item: TOpenApiObject) => ({
  type: "object",
  properties: {
    meta: ref("PaginationMeta"),
    [key]: { type: "array", items: item },
  },
});

const errorRef = (code: number) => ({
  [code]: { $ref: `#/components/responses/Error${code}` },
});

type TAccess = "public" | "any" | "user" | "admin";

type TOperation = {
  tag: string;
  summary: string;
  description?: string;
  access?: TAccess;
  premium?: boolean;
  parameters?: TOpenApiObject[];
  requestBody?: TOpenApiObject;
  responses: TOpenApiObject;
  /** extra error codes to document, e.g. [400, 404, 409] */
  errors?: number[];
};

const ACCESS_TEXT: Record<TAccess, string> = {
  public: "**Access:** public (no token required).",
  any: "**Access:** any logged-in user (`ADMIN` or `USER`).",
  user: "**Access:** logged-in `USER` only.",
  admin: "**Access:** `ADMIN` only.",
};

/** Builds one OpenAPI operation object (auth, premium and error docs included). */
export const op = ({
  tag,
  summary,
  description,
  access = "public",
  premium = false,
  parameters,
  requestBody,
  responses,
  errors = [],
}: TOperation) => {
  const codes = new Set<number>(errors);
  codes.add(500);
  if (access !== "public") {
    codes.add(401);
    if (access !== "any") codes.add(403);
  }
  if (premium) codes.add(403);
  if (requestBody) codes.add(422);

  const notes = [
    description,
    ACCESS_TEXT[access],
    premium
      ? "**Premium:** requires an `ACTIVE` subscription, otherwise `403`."
      : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    tags: [tag],
    summary,
    description: notes,
    ...(access !== "public" ? { security: [{ bearerAuth: [] }] } : {}),
    ...(parameters?.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: {
      ...responses,
      ...[...codes].sort().reduce((acc, c) => ({ ...acc, ...errorRef(c) }), {}),
    },
  };
};
