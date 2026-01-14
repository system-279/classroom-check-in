import type { Timestamp } from "@google-cloud/firestore";

export function toDate(value: Timestamp | Date | undefined): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  return value.toDate();
}
