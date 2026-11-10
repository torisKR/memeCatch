import nextWorker from "../.open-next/worker.js";
import { dispatchScheduledCron } from "../lib/cloudflare-cron";
import { releaseShaForWorker, withReleaseSha, wwwToApexRedirect } from "../lib/cloudflare-host";

export { DOQueueHandler } from "../.open-next/worker.js";

type VersionMetadata = { id?: string };

type WorkerEnv = {
  CRON_SECRET?: string;
  RELEASE_SHA?: string;
  CF_VERSION_METADATA?: VersionMetadata;
};

type WorkerContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const worker = nextWorker as {
  fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response>;
};

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
    const redirect = wwwToApexRedirect(request);
    if (redirect) return redirect;
    const response = await worker.fetch(request, env, ctx);
    return withReleaseSha(response, releaseShaForWorker(env));
  },
  async scheduled(event: { cron: string }, env: WorkerEnv, ctx: WorkerContext): Promise<void> {
    ctx.waitUntil(dispatchScheduledCron(
      (cronRequest) => worker.fetch(cronRequest, env, ctx),
      event.cron,
      env.CRON_SECRET,
    ).then(() => undefined));
  },
};
