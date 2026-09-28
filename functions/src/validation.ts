import { z } from 'zod';
import { HttpsError } from 'firebase-functions/v2/https';

export const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const named = z.object({ name: z.string().trim().min(1).max(100) });
export const contactInput = named.extend({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{8,25}$/, 'Informe um telefone válido.')
    .refine(
      (value) => /^\d{8,15}$/.test(value.replace(/\D/g, '')),
      'O telefone deve conter entre 8 e 15 dígitos.',
    ),
});
export const messageInput = z.object({
  text: z.string().trim().min(1).max(5000),
  scheduledAt: z.string().datetime().nullable(),
});
// Mirrors MAX_SCHEDULE_MS in web/src/lib/schedule.ts; the two sides are
// separate build targets and cannot share a module.
const MAX_SCHEDULE_MS = 30 * 86_400_000;

export function scheduleDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (date.getTime() <= Date.now() || date.getTime() > Date.now() + MAX_SCHEDULE_MS) {
    throw new HttpsError('invalid-argument', 'Agende para o futuro, em até 30 dias.');
  }
  return date;
}
