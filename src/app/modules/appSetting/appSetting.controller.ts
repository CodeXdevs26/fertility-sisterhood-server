import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { appSettingServices } from "./appSetting.service.js";

const get = handleAsyncRequest(async (_req: TRequest, res: Response) => {
  const data = await appSettingServices.get();
  sendResponse(res, { message: "App settings fetched successfully!", data });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await appSettingServices.upsert(req.body);
  sendResponse(res, { message: "App settings updated successfully!", data });
});

export const appSettingController = { get, update };
