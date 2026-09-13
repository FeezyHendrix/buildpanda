/**
 * Practical completion and the defects-liability end are contract dates with
 * liquidated-damages consequences. The programme cascade must never nudge one:
 * only an awarded extension of time moves them, and the form says so rather
 * than letting a PM discover it (findings #50, F55).
 */
export const CONTRACTUAL_LOCK_HINT =
  "A contractual date moves only through an approved extension of time — the programme cascade leaves it where it is.";

export const KEY_DATE_LINK_HINT =
  "Linking the activity that delivers this date lets a delay on it move the date too.";
