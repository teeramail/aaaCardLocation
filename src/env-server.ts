import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  VALID_EMAIL: z.string().email(),
  VALID_PASSWORD: z.string().min(1),
  ALLOWED_EMAILS: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ENDPOINT: z.string().url().optional(),
  AWS_S3_ROOT_FOLDER: z.string().optional()
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server environment variables: ${parsed.error.message}`);
}

export const serverEnv = parsed.data;
export const isGoogleAuthEnabled = Boolean(
  serverEnv.AUTH_GOOGLE_ID && serverEnv.AUTH_GOOGLE_SECRET
);
export const isObjectStorageEnabled = Boolean(
  serverEnv.AWS_ACCESS_KEY_ID &&
    serverEnv.AWS_SECRET_ACCESS_KEY &&
    serverEnv.AWS_S3_BUCKET &&
    serverEnv.AWS_REGION &&
    serverEnv.AWS_ENDPOINT
);

/**
 * Parsed list of allowed emails. Empty array means all emails are allowed.
 */
export const allowedEmails: string[] = serverEnv.ALLOWED_EMAILS
  ? serverEnv.ALLOWED_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

/**
 * Check if an email is allowed to sign in.
 * If ALLOWED_EMAILS is empty/not set, all emails are allowed.
 */
export function isEmailAllowed(email: string): boolean {
  if (allowedEmails.length === 0) return true;
  return allowedEmails.includes(email.toLowerCase());
}
