/**
 * Rôles RBAC CarbonCo.
 *
 * Le payload JWT (lib/verify-jwt.ts) contient déjà `role: string`. On formalise
 * ici les valeurs autorisées et leurs capacités. Toute API qui sert des données
 * sensibles doit appeler `assertCan(payload, "..." )` avant de répondre.
 */

export const ROLES = ["admin", "auditor", "reader", "daf"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  auditor: "Auditeur",
  reader: "Lecteur",
  daf: "DAF / Direction financière",
};

/** Capacités élémentaires demandées par les routes / composants. */
export const CAPABILITIES = [
  "view:dashboard",
  "view:data",
  "edit:data",
  "validate:data",
  "manage:users",
  "manage:billing",
  "export:report",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const CAPABILITY_MATRIX: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set([
    "view:dashboard",
    "view:data",
    "edit:data",
    "validate:data",
    "manage:users",
    "manage:billing",
    "export:report",
  ]),
  auditor: new Set([
    "view:dashboard",
    "view:data",
    "validate:data",
    "export:report",
  ]),
  reader: new Set(["view:dashboard", "view:data"]),
  daf: new Set([
    "view:dashboard",
    "view:data",
    "manage:billing",
    "export:report",
  ]),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: string | undefined, capability: Capability): boolean {
  if (!role || !isRole(role)) return false;
  return CAPABILITY_MATRIX[role].has(capability);
}

export function assertCan(role: string | undefined, capability: Capability): void {
  if (!can(role, capability)) {
    const r = role ?? "anonyme";
    throw new Error(`Capacité refusée : ${r} ne peut pas ${capability}`);
  }
}
