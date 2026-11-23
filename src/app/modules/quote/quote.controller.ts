import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { quoteServices } from "./quote.service.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await quoteServices.create(req.body);
  sendResponse(res, {
    status: 201,
    message: "Quote created successfully!",
    data,
  });
});

const getAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await quoteServices.getAll(pick(req.query, ["page", "limit"]));
  sendResponse(res, { message: "Quotes fetched successfully!", data });
});

const getToday = handleAsyncRequest(async (_req: TRequest, res: Response) => {
  const data = await quoteServices.getToday();
  sendResponse(res, {
    message: "Quote of the day fetched successfully!",
    data,
  });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await quoteServices.update(req.params.id as string, req.body);
  sendResponse(res, { message: "Quote updated successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await quoteServices.remove(req.params.id as string);
  sendResponse(res, { message: "Quote deleted successfully!", data });
});

export const quoteController = { create, getAll, getToday, update, remove };
