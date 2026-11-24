import { executePlan } from "@/lib/db/execute";
import { createPlanClient, type PlanExecutor } from "@/lib/db/plan";
import type { DbIdentity } from "@/lib/db/pool";
import { objectStorage } from "@/lib/object-storage";

// The service role: what the mpe-worker and the scripts act as.
const SERVICE: DbIdentity = { userId: null, role: "service_role", anonymous: false };

const execute: PlanExecutor = (plan, signal) => executePlan(plan, SERVICE, signal);

export function createAdminClient() {
  const database = createPlanClient(execute);
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    storage: objectStorage(),
  };
}
