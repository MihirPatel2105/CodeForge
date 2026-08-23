/**
 * Where to reach the people who run this instance.
 *
 * One definition, because these strings appear on the contact page and again in the
 * footer of every page. Two copies of a postal address drift the first time one of them
 * is corrected.
 */

export const CONTACT_EMAIL = "codeforge.sdlc@gmail.com";

export const CONTACT_PHONE = "+91 9313928398";

/** Digits only, for the `tel:` href — a dialler cannot parse spaces reliably. */
export const CONTACT_PHONE_HREF = "tel:+919313928398";

export const CONTACT_ADDRESS = [
  "CHARUSAT Campus, Off Nadiad–Petlad Highway",
  "Changa, Ta. Petlad, Dist. Anand",
  "Gujarat 388421, India",
] as const;
