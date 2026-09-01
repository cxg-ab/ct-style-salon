import { Readable } from "node:stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { requireSalonManager } from "./salon";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields." });
    return;
  }

  const { name, size, contentType } = parsed.data;
  if (!IMAGE_TYPES.has(contentType) || size > MAX_IMAGE_SIZE) {
    res.status(400).json({ error: "Employee photos must be images no larger than 5 MB." });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json(RequestUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    }));
  } catch (error) {
    req.log.error({ err: error }, "Error generating employee photo upload URL");
    res.status(500).json({ error: "Failed to generate upload URL." });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const rawPath = req.params.path;
    const wildcardPath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    const objectFile = await objectStorageService.getObjectEntityFile(`/objects/${wildcardPath}`);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found." });
      return;
    }
    req.log.error({ err: error }, "Error serving employee photo");
    res.status(500).json({ error: "Failed to serve object." });
  }
});

export default router;