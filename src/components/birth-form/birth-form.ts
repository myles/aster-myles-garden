import type { Place } from "@/lib/places";

/** One person's birth form fields, as the inputs hold them. */
export type BirthForm = {
  date: string;
  time: string;
  isTimeUnknown: boolean;
  place?: Place;
};

export function createBlankForm(): BirthForm {
  return { date: "", time: "", isTimeUnknown: false, place: undefined };
}
