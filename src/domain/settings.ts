import type { Enterprise, Project, ProjectCostElement } from './types';

/**
 * Resolves a project's effective settings by inheriting from enterprise for
 * any ENUM field the project has not explicitly overridden (null = inherit).
 *
 * Pure function — no I/O. Called by the adapter after fetching both rows.
 * When departments arrive, this becomes resolveProjectSettings(project, dept, enterprise)
 * with an extra COALESCE level — no schema change required.
 *
 * ENUM fields (categories, riskTypes, etc.) use COALESCE: project overrides
 * enterprise if set, otherwise inherits. They're mutually exclusive lists.
 *
 * ATTRIBUTE fields (*Attributes) are NOT coalesced here. They're additive:
 * components display enterprise attributes AND project attributes as separate
 * column groups (E_ and P_ prefixes). Coalescing would duplicate enterprise
 * columns when both sources are read. Project null = "no project-specific attrs".
 */
export function resolveProjectSettings(project: Project, enterprise: Enterprise): Project {
  return {
    ...project,
    categories:      project.categories      ?? enterprise.categories,
    controlAccounts: project.controlAccounts ?? enterprise.controlAccounts,
    orderNumbers:    project.orderNumbers    ?? enterprise.orderNumbers,
    changeTypes:     project.changeTypes     ?? enterprise.changeTypes,
    riskTypes:       project.riskTypes       ?? enterprise.riskTypes,
    costElements:    project.costElements    ?? enterpriseCostElements(enterprise),
    resourceRates:   project.resourceRates   ?? enterprise.resourceRates,
  };
}

// Enterprise uses CostElement; Project uses ProjectCostElement (superset with
// optional enterpriseCostElementId). Cast is safe — extra field is optional.
function enterpriseCostElements(enterprise: Enterprise): ProjectCostElement[] | undefined {
  return enterprise.costElements as ProjectCostElement[] | undefined;
}
