import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { cycleServices } from "./cycle.service.js";
import { TCycleMonthQuery } from "./cycle.validation.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await cycleServices.create(req.user!.id, req.body);
  sendResponse(res, {
    status: 201,
    message: "Cycle created successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await cycleServices.getMy(req.user!.id);
  sendResponse(res, { message: "Cycles fetched successfully!", data });
});

const getByDate = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { date } = req.query as TCycleMonthQuery;
  const data = await cycleServices.getByDate(req.user!.id, date);
  sendResponse(res, { message: "Cycle days fetched successfully!", data });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await cycleServices.update(
    req.user!.id,
    req.params.id as string,
    req.body
  );
  sendResponse(res, { message: "Cycle updated successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await cycleServices.remove(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Cycle deleted successfully!", data });
});

export const cycleController = { create, getMy, getByDate, update, remove };
