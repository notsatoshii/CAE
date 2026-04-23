/**
 * /build/* subtab fallback — re-export root Pikachu loader so every
 * deep /build route (queue, agents, workflows, changes, schedule,
 * skills, security/*, admin/roles, ...) shows the same loader on
 * server-render suspense.
 */
export { default } from "../loading";
