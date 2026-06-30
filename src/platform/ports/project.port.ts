import type { Project, Sheet } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ProjectRepository {
  get(projectId: string): Promise<Project | null>;
  list(enterpriseId: string, userEmail: string): Promise<Project[]>;
  subscribe(projectId: string, callback: (project: Project | null) => void): Unsubscribe;
  subscribeByEnterprise(enterpriseId: string, userEmail: string, callback: (projects: Project[]) => void): Unsubscribe;
  listByEnterprise(enterpriseId: string): Promise<Project[]>;
  create(data: Omit<Project, 'id' | 'dateCreated' | 'dateLastModified'>): Promise<Project>;
  update(projectId: string, data: Partial<Project>): Promise<void>;
  delete(projectId: string): Promise<void>;
  checkProjectCodeExists(enterpriseId: string, projectCode: string): Promise<boolean>;
  deleteProjectWithSheets(projectId: string): Promise<void>;
  createSheet(data: Record<string, unknown>): Promise<{ id: string }>;
  createSheetRow(sheetId: string, data: Record<string, unknown>): Promise<void>;
  findSheetsByName(projectId: string, sheetName: string): Promise<Array<{ id: string }>>;
  subscribeSheet(sheetId: string, callback: (sheet: Sheet | null) => void): Unsubscribe;
}
