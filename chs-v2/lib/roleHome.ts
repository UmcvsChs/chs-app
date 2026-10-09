// Each role's own dashboard. "Back" links and notification fallbacks use this so nobody is sent to the general homepage.
export const ROLE_HOME: Record<string, string> = {
  admin: "/admin", owner: "/owner", host: "/host", agent: "/agent", manager: "/manager", tenant: "/tenant",
  buyer: "/my-offers", guest: "/guest", developer: "/developer", staff: "/staff", vendor: "/vendor", artisan: "/artisan",
};
export function roleHome(role?: string | null): string {
  return (role && ROLE_HOME[role]) || "/";
}
