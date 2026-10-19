/**
 * Deterministic job ids, one builder per enqueue site.
 *
 * **Ids use hyphens, never colons — job *names* keep their colons.** BullMQ v6
 * refuses a custom id that contains `:` (`Custom Id cannot contain :`), with one
 * legacy exception: an id that splits into exactly three parts is still accepted
 * for old repeatable-job compatibility, and that exception is marked for removal
 * in the library's next breaking release. So `injunction:${dossierId}` (two
 * parts) failed every enqueue in production while the three-part email ids kept
 * working only by accident. One builder per id keeps them all colon-free and
 * gives the regression test something to assert against.
 *
 * The ids are dedupe keys: enqueueing the same id twice collapses into one job,
 * which is what makes a page-load retry cheap.
 */
export const injunctionJobId = (dossierId: string) => `injunction-${dossierId}`;

export const verdictEmailJobId = (dossierId: string) => `email-verdict-${dossierId}`;

export const appealRulingEmailJobId = (appealId: string) => `email-appeal-ruling-${appealId}`;

export const informantTipEmailJobId = (dossierId: string) => `email-informant-tip-${dossierId}`;
