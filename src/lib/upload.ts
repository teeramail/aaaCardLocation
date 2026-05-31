import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { isObjectStorageEnabled, serverEnv } from "@/env-server";

const globalForS3 = globalThis as typeof globalThis & {
  objectStorageClient?: S3Client;
};

function getClient() {
  if (!isObjectStorageEnabled) {
    throw new Error("Object storage is not configured.");
  }

  const client =
    globalForS3.objectStorageClient ??
    new S3Client({
      region: serverEnv.AWS_REGION,
      endpoint: serverEnv.AWS_ENDPOINT,
      credentials: {
        accessKeyId: serverEnv.AWS_ACCESS_KEY_ID!,
        secretAccessKey: serverEnv.AWS_SECRET_ACCESS_KEY!
      }
    });

  globalForS3.objectStorageClient = client;
  return client;
}

export function getPublicObjectUrl(key: string) {
  const baseUrl = serverEnv.AWS_ENDPOINT!.replace(/\/$/, "");
  const bucketSegment = serverEnv.AWS_ENDPOINT!.includes(serverEnv.AWS_S3_BUCKET!) ? "" : `/${serverEnv.AWS_S3_BUCKET}`;

  return `${baseUrl}${bucketSegment}/${key}`;
}

export async function uploadUserFile(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  subfolder?: string;
}) {
  const client = getClient();
  let fileName = params.fileName.replace(/\s+/g, "-").toLowerCase();
  if (params.mimeType === "image/webp" && !fileName.endsWith(".webp")) {
    fileName = fileName.replace(/\.[^.]+$/, ".webp");
  }
  const keyPrefix = serverEnv.AWS_S3_ROOT_FOLDER ? `${serverEnv.AWS_S3_ROOT_FOLDER}/` : "";
  const normalizedSubfolder = params.subfolder?.replace(/^\/+|\/+$/g, "");
  const key = normalizedSubfolder
    ? `${keyPrefix}${params.userId}/${normalizedSubfolder}/${Date.now()}-${fileName}`
    : `${keyPrefix}${params.userId}/${Date.now()}-${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: serverEnv.AWS_S3_BUCKET,
      Key: key,
      Body: params.fileBuffer,
      ContentType: params.mimeType,
      ACL: "public-read"
    })
  );

  return {
    key,
    fileUrl: getPublicObjectUrl(key)
  };
}

export async function deleteStoredFile(key: string) {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: serverEnv.AWS_S3_BUCKET,
      Key: key
    })
  );
}

export async function uploadPlaceImage(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) {
  const { key, fileUrl } = await uploadUserFile(params);

  return {
    key,
    imageUrl: fileUrl
  };
}
