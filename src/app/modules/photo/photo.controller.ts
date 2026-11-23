import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { photoServices } from "./photo.service.js";
import { TCreatePhoto, TPhotoQuery } from "./photo.validation.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await photoServices.create(
    req.user!.id,
    req.body as TCreatePhoto,
    req.file
  );
  sendResponse(res, {
    status: 201,
    message: "Photo added successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const { category } = req.query as TPhotoQuery;
  const data = await photoServices.getMy(
    req.user!.id,
    pick(req.query, ["page", "limit"]),
    category
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
