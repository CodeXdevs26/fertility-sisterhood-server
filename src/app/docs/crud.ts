import {
  idParam,
  jsonBody,
  ok,
  op,
  paged,
  pageParams,
  ref,
  TOpenApiObject,
} from "./helpers.js";

type TCrudOptions = {
  tag: string;
  /** e.g. "/journals" (relative to /api/v1) */
  base: string;
  /** e.g. "Journal entry" */
  noun: string;
  /** e.g. "Journal entries" */
  plural: string;
  /** key of the list array in the response, e.g. "journals" */
  listKey: string;
  /** component schema name of one record */
  item: string;
  /** component schema name used for list items (defaults to `item`) */
  listItem?: string;
  createBody: TOpenApiObject;
  updateBody: TOpenApiObject;
  premium?: boolean;
  /** whether GET /{id} exists on the router */
  hasSingle?: boolean;
  /** whether DELETE /{id} exists (defaults true) */
  hasRemove?: boolean;
  listQuery?: TOpenApiObject[];
  listDescription?: string;
  createDescription?: string;
};

/**
 * Documents the standard user-owned CRUD endpoints:
 *   POST /, GET /, [GET /:id], PATCH /:id, DELETE /:id
 */
export const crud = ({
  tag,
  base,
  noun,
  plural,
  listKey,
  item,
  listItem,
  createBody,
  updateBody,
  premium = false,
  hasSingle = false,
  hasRemove = true,
  listQuery = [],
  listDescription,
  createDescription,
}: TCrudOptions) => {
  const lower = noun.toLowerCase();
  const root: TOpenApiObject = {
    post: op({
      tag,
      summary: `Create ${lower}`,
      description: createDescription,
      access: "user",
      premium,
      requestBody: jsonBody(createBody),
      responses: ok(`${noun} created successfully!`, ref(item), 201),
      errors: [400, 409],
    }),
    get: op({
      tag,
      summary: `List my ${plural.toLowerCase()}`,
      description: listDescription,
      access: "user",
      premium,
      parameters: [...pageParams, ...listQuery],
      responses: ok(
        `${plural} fetched successfully!`,
        paged(listKey, ref(listItem ?? item))
      ),
      errors: listQuery.length ? [422] : [],
    }),
  };

  const byId: TOpenApiObject = {};
  if (hasSingle) {
    byId.get = op({
      tag,
      summary: `Get ${lower} by id`,
      access: "user",
      premium,
      parameters: [idParam()],
      responses: ok(`${noun} fetched successfully!`, ref(item)),
      errors: [404],
    });
  }
  byId.patch = op({
    tag,
    summary: `Update ${lower}`,
    description: "All body fields are optional - send only what changes.",
    access: "user",
    premium,
    parameters: [idParam()],
    requestBody: jsonBody(updateBody),
    responses: ok(`${noun} updated successfully!`, ref(item)),
    errors: [400, 404, 409],
  });
  if (hasRemove) {
    byId.delete = op({
      tag,
      summary: `Delete ${lower}`,
      access: "user",
      premium,
      parameters: [idParam()],
      responses: ok(`${noun} deleted successfully!`, ref(item)),
      errors: [404],
    });
  }

  return { [base]: root, [`${base}/{id}`]: byId };
};
