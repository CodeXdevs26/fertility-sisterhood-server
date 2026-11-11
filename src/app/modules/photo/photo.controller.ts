import { PhotoMilestone } from "@prisma/client";
import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { photoServices } from "./photo.service.js";
import { createPhotoZod, photoQueryZod } from "./photo.validation.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const payload = createPhotoZod.parse(req.body);
  const data = await photoServices.create(req.user!.id, payload, req.file);
  sendResponse(res, {
    status: 201,
    message: "Photo added successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { category } = photoQueryZod.parse(req.query);
  const data = await photoServices.getMy(
    req.user!.id,
    pick(req.query, ["page", "limit"]),
    category as PhotoMilestone | undefined
  );
  sendResponse(res, { message: "Photos fetched successfully!", data });
});

const getSingle = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await photoServices.getSingle(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Photo fetched successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await photoServices.remove(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Photo deleted successfully!", data });
});

export const photoController = { create, getMy, getSingle, remove };
