export type DeployEvent = "pull_request" | "push_main" | "other";

export type DeployStep = "skip" | "preview" | "production";

/**
 * Preview and production are separate Workers.
 * The production Worker uses a Durable Object, so a pull request cannot
 * publish a version URL on that Worker. Missing Cloudflare credentials skip
 * both steps so GitHub Actions stays green before the owner adds them.
 * The production step is also gated by the GitHub Environment named production.
 */
export function deployStep(event: DeployEvent, credentialsPresent: boolean): DeployStep {
  if (!credentialsPresent) return "skip";
  switch (event) {
    case "pull_request":
      return "preview";
    case "push_main":
      return "production";
    case "other":
      return "skip";
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}
