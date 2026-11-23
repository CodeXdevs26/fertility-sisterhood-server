import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import config from "../config/index.js";
import multer, { memoryStorage } from "multer";
import ApiError from "../classes/ApiError.js";
import { TFile } from "../interface/file.interface.js";

const { accessKeyId, secretAccessKey } = config.aws;

if (!accessKeyId || !secretAccessKey) {
  console.warn(
    "S3_BUCKET_ACCESS_KEY / S3_BUCKET_SECRET_ACCESS_KEY not set; falling back to the AWS default credential chain (env, IAM role)"
  );
}

export const s3Client = new S3Client({
  region: config.aws.region,
  // explicit keys when set; otherwise the SDK default chain, so an IAM role works
  // instead of sending the literal string "undefined" as a key
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

export const upload = multer({
  storage: memoryStorage(),
});

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const uploadImage = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, "Only jpeg, png, and webp images are allowed"));
      return;
    }
    cb(null, true);
  },
});

//upload a single file
export const uploadToS3 = async (file: TFile): Promise<string> => {
  if (!file) throw new ApiError(400, "File is required");
  const fileName = `fertility-sisterhood/${Date.now()}-${file.originalname}`;

  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  try {
    const key = await s3Client.send(command);
    if (!key) {
      throw new ApiError(400, "File Upload failed");
    }
    const url = `${config?.aws?.s3BaseUrl}${fileName}`;
    if (!url) throw new ApiError(400, "File Upload failed");

    return url;
  } catch (error) {
    console.log(error);
    throw new ApiError(400, "File Upload failed");
  }
};

export const deleteFromS3 = async (url: string) => {
  const baseUrl = config.aws.s3BaseUrl;
  if (!baseUrl || !url.startsWith(baseUrl)) {
    throw new ApiError(400, "Invalid S3 file URL");
  }

  const key = decodeURIComponent(url.slice(baseUrl.length));
  if (!key) throw new ApiError(400, "Invalid S3 file URL");

  const command = new DeleteObjectCommand({
    Bucket: config.aws.bucket,
    Key: key,
  });
  await s3Client.send(command);
};
