import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { checklistTemplateServices } from "./checklistTemplate.service.js";

const getAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const category =
    typeof req.query.category === "string"
      ? req.query.category.toUpperCase()
      : undefined;
  const data = await checklistTemplateServices.getAll(category);
  sendResponse(res, {
    message: "Checklist template fetched successfully!",
    data,
  });
});

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await checklistTemplateServices.create(req.body);
  sendResponse(res, {
    status: 201,
    message: "Checklist template item created successfully!",
    data,
  });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await checklistTemplateServices.update(
    req.params.id as string,
    req.body
  );
  sendResponse(res, {
    message: "Checklist template item updated successfully!",
    data,
  });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await checklistTemplateServices.remove(req.params.id as string);
  sendResponse(res, {
    message: "Checklist template item deleted successfully!",
    data,
  });
});

export const checklistTemplateController = { getAll, create, update, remove };
