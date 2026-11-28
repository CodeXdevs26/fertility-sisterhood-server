import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { symptomServices } from "./symptom.service.js";
import { TSymptomTodayQuery } from "./symptom.validation.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { symptom, created } = await symptomServices.create(
    req.user!.id,
    req.body
  );
  // one entry per day: a second POST for the same day updates it (200)
  sendResponse(res, {
    status: created ? 201 : 200,
    message: created
      ? "Symptom created successfully!"
      : "Today's symptom updated successfully!",
    data: symptom,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await symptomServices.getMy(
    req.user!.id,
    pick(req.query, ["page", "limit"])
  );
  sendResponse(res, { message: "Symptoms fetched successfully!", data });
});

const getToday = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { date } = req.query as TSymptomTodayQuery;
  const data = await symptomServices.getToday(req.user!.id, date);
  sendResponse(res, {
    message: data
      ? "Today's symptom fetched successfully!"
      : "No symptom logged for this day yet",
    data,
  });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await symptomServices.update(
    req.user!.id,
    req.params.id as string,
    req.body
  );
  sendResponse(res, { message: "Symptom updated successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await symptomServices.remove(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Symptom deleted successfully!", data });
});

export const symptomController = { create, getMy, getToday, update, remove };
