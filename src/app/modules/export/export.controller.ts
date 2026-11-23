import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { exportServices } from "./export.service.js";
import { TExportQuery } from "./export.validation.js";

const exportData = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await exportServices.exportData(
    req.user!.id,
    req.query as TExportQuery
  );
  sendResponse(res, { message: "Data exported successfully!", data });
});

export const exportController = { exportData };
