/** Edge-safe: no Node crypto. Used by middleware only. */
export const DASHBOARD_COOKIE = 'am_dashboard';

export function dashboardAuthConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD?.length);
}
