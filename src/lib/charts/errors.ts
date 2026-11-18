// Errors that are the asker's to fix, such as a year before the birth,
// as opposed to a calculation that failed. The page shows any error's
// message; the API answers these with a 400 and the rest with a 500.

/**
 * A chart that can't be made from what was asked. Its message says what
 * to change, and is shown to whoever asked, so it must never quote
 * anyone else's birth details.
 */
export class ChartInputError extends Error {
  override name = "ChartInputError";
}
