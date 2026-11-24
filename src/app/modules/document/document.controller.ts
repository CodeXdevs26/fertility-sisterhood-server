import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { documentServices } from "./document.service.js";
import { TDocumentQuery } from "./document.validation.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await documentServices.create(req.user!.id, req.body, req.file);
  sendResponse(res, {
    status: 201,
    message: "Document uploaded successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { date } = req.query as TDocumentQuery;
  const data = await documentServices.getMy(
    req.user!.id,
    pick(req.query, ["page", "limit"]),
    date
  );
  sendResponse(res, { message: "Documents fetched successfully!", data });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await documentServices.update(
    req.user!.id,
    req.params.id as string,
    req.body,
    req.file
  );
  sendResponse(res, { message: "Document updated successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await documentServices.remove(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Document deleted successfully!", data });
});

export const documentController = { create, getMy, update, remove };
