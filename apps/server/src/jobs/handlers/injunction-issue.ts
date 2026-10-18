import type { JobContext } from '../types.js';
import type { JobHandler } from './index.js';
import { issueInjunction } from '../../injunction.js';

/**
 * Issue the environmental injunction for an accepted verdict.
 *
 * A throw is deliberate: `issueInjunction` only throws when the attempt *failed*
 * (model error, unparseable JSON, unusable checklist), and letting it escape is
 * what makes BullMQ retry with the queue's exponential backoff. The filed flag is
 * written only on success, so a retry starts from scratch; a checklist with no
 * actions is a success ("no corrective orders") and settles here.
 */
export const makeIssueInjunction =
  (ctx: JobContext): JobHandler<'injunction:issue'> =>
  async ({ dossierId, userId }) => {
    const result = await issueInjunction({
      repositories: ctx.repositories,
      userId,
      dossierId,
    });
    console.log(
      `[Injunction] ${dossierId}: ${result.status}` +
        (result.status === 'skipped' ? '' : ` (${result.issued} actions, ${result.source})`)
    );
  };
