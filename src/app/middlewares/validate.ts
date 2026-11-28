import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import ApiError from "../classes/ApiError.js";

type TValidateOptions = {
  /**
   * multipart: validate `req.body.payload` (JSON string) when sent, else the
   * flat form fields; replaces `req.body` either way
   */
  formData?: boolean;
  /** validate `req.query` instead of the body and put the parsed values back */
  query?: boolean;
  /** @deprecated the body is always replaced with the parsed result now */
  replace?: boolean;
};

const validate =
  (
    schema: ZodTypeAny,
    { formData = false, query = false }: TValidateOptions = {}
  ) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (query) {
        const parsed = (await schema.parseAsync(req.query)) as Record<
          string,
          unknown
        >;
        // Express 5 exposes req.query as a getter, so it can't be assigned.
        // Shadow it with the parsed values; keys outside the schema
        // (page, limit, ...) are kept.
        Object.defineProperty(req, "query", {
          value: { ...req.query, ...parsed },
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else if (formData) {
        // multipart: fields as a `payload` JSON string, or as flat fields
        const raw = req?.body?.payload;
        let body: unknown = req.body ?? {};
        if (typeof raw === "string" && raw.trim()) {
          try {
            body = JSON.parse(raw);
          } catch {
            throw new ApiError(400, "payload must be a valid JSON string");
          }
        }
        req.body = await schema.parseAsync(body);
      } else {
        // Always replace the body with the parsed result: unknown keys are
        // stripped (services spread payloads into Prisma, so an unstripped
        // body allows nested writes like `auth: { update: { role } }`), and
        // trims/defaults/coercions reach the service.
        req.body = await schema.parseAsync(req.body ?? {});
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export default validate;
