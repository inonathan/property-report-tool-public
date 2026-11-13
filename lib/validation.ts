import { z } from "zod";

const nzPhone = z
  .string()
  .trim()
  .min(7, "Please enter a valid phone number")
  .max(24)
  .regex(/^[+()\d][\d\s()+-]{5,}$/, "Please enter a valid phone number");

export const estimateRequestSchema = z.object({
  addressId: z.string().trim().min(3).max(400),
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Please enter a valid email address")),
  phone: nzPhone,
  privacyAccepted: z.literal(true, { error: "Please accept the privacy statement to continue" }),
  marketingConsent: z.boolean().default(false),
  source: z.string().trim().max(500).optional(),
  brand: z.string().trim().max(40).optional(),
  // hidden field, only bots fill it in
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(4000).optional(),
});

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
