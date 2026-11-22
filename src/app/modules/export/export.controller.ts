import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { exportServices } from "./export.service.js";
import { exportQueryZod } from "./export.validation.js";

const exportData = handleAsyncRequest(async (req: TRequest, res: Response) => {
  // validate() only checks req.body, so the query is parsed here
  const query = exportQueryZod.parse(req.query);
  const data = await exportServices.exportData(req.user!.id, query);
  sendResponse(res, { message: "Data exported successfully!", data });
});

export const exportController = { exportData };
