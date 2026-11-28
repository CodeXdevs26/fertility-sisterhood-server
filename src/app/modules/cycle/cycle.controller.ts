import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { cycleServices } from "./cycle.service.js";
import {
  TCycleListQuery,
  TCycleMonthQuery,
  TCycleTodayQuery,
} from "./cycle.validation.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { cycle, created } = await cycleServices.create(req.user!.id, req.body);
  // one cycle per month: a second POST for the same month updates it (200)
  sendResponse(res, {
    status: created ? 201 : 200,
    message: created
      ? "Cycle created successfully!"
      : "Cycle for this month updated successfully!",
    data: cycle,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { month } = req.query as TCycleListQuery;
  const data = await cycleServices.getMy(req.user!.id, month);
  sendResponse(res, { message: "Cycles fetched successfully!", data });
});

const getByDate = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { date, month } = req.query as TCycleMonthQuery;
  const data = await cycleServices.getByDate(req.user!.id, date ?? month);
  sendResponse(res, { message: "Cycle days fetched successfully!", data });
});

const getToday = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { date } = req.query as TCycleTodayQuery;
  const data = await cycleServices.getToday(req.user!.id, date);
  sendResponse(res, {
    message: data
      ? "Today's cycle day fetched successfully!"
      : "No cycle covers this day",
    data,
  });
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

export const cycleController = {
  create,
  getMy,
  getByDate,
  getToday,
  update,
  remove,
};
