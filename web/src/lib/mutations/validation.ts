import { MAX_SCHEDULE_MS } from '../schedule';

export function required<T>(value: T | undefined, field: string) {
  if (value === undefined) throw new Error(`Campo ausente: ${field}.`);
  return value;
}

export function checkScheduleWindow(scheduledAt: Date | null) {
  if (scheduledAt && scheduledAt.getTime() > Date.now() + MAX_SCHEDULE_MS)
    throw new Error('Agende para o futuro, em até 30 dias.');
}
