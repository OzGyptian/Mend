import type { Enterprise, Project, ProjectCostElement } from './types';

/**
 * Resolves a project's effective settings by inheriting from enterprise for
 * any field the project has not explicitly overridden (null = inherit).
 *
 * Pure function — no I/O. Called by the adapter after fetching both rows.
 * When departments arrive, this becomes resolveProjectSettings(project, dept, enterprise)
 * with an extra COALESCE level — no schema change required.
 */
export function resolveProjectSettings(project: Project, enterprise: Enterprise): Project {
  return {
    ...project,
    categories:             project.categories             ?? enterprise.categories,
    controlAccounts:        project.controlAccounts        ?? enterprise.controlAccounts,
    orderNumbers:           project.orderNumbers           ?? enterprise.orderNumbers,
    changeTypes:            project.changeTypes            ?? enterprise.changeTypes,
    riskTypes:              project.riskTypes              ?? enterprise.riskTypes,
    costElements:           project.costElements           ?? enterpriseCostElements(enterprise),
    resourceRates:          project.resourceRates          ?? enterprise.resourceRates,
    costCodeAttributes:     project.costCodeAttributes     ?? enterprise.costCodeAttributes,
    subcontractAttributes:  project.subcontractAttributes  ?? enterprise.subcontractAttributes,
    changeAttributes:       project.changeAttributes       ?? enterprise.changeAttributes,
    riskAttributes:         project.riskAttributes         ?? enterprise.riskAttributes,
    procurementAttributes:  project.procurementAttributes  ?? enterprise.procurementAttributes,
    progressAttributes:     project.progressAttributes     ?? enterprise.progressAttributes,
    lineItemAttributes:     project.lineItemAttributes     ?? enterprise.lineItemAttributes,
  };
}

// Enterprise uses CostElement; Project uses ProjectCostElement (superset with
// optional enterpriseCostElementId). Cast is safe — extra field is optional.
function enterpriseCostElements(enterprise: Enterprise): ProjectCostElement[] | undefined {
  return enterprise.costElements as ProjectCostElement[] | undefined;
}
