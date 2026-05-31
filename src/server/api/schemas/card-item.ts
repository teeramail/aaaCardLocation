import { z } from "zod";

export const cardItemMediaSchema = z
  .object({
    fileName: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: z.string().min(1),
    fileSize: z.number().min(0),
    storageKey: z.string().min(1),
    url: z.string().url(),
    subfolder: z.string().optional()
  })
  .nullable();

export const cardItemIdSchema = z.object({
  id: z.string().uuid()
});

export const cardItemListByCardIdSchema = z.object({
  cardId: z.string().uuid()
});

export const cardItemCreateSchema = z.object({
  cardId: z.string().uuid(),
  nameTitle: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(4000).optional().nullable(),
  linkUrl: z.string().url().max(2000).optional().nullable(),
  value: z.number().min(0).optional(),
  itemDate: z.coerce.date().optional().nullable(),
  media: cardItemMediaSchema.optional()
});

export const cardItemUpdateSchema = z.object({
  id: z.string().uuid(),
  nameTitle: z.string().trim().min(1).max(1000).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  linkUrl: z.string().url().max(2000).optional().nullable(),
  value: z.number().min(0).optional(),
  itemDate: z.coerce.date().optional().nullable(),
  media: cardItemMediaSchema.optional()
});

export const cardItemUploadMediaSchema = z.object({
  cardId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileBase64: z.string().min(1)
});

export type CardItemMediaInput = z.infer<typeof cardItemMediaSchema>;
