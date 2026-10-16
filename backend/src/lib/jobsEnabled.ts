export function jobsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DISABLE_JOBS?.trim().toLowerCase() !== "true";
}
