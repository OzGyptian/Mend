import type { Project } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ProjectRepository {
  get(projectId: string): Promise<Project | null>;
  list(enterpriseId: string, userEmail: string): Promise<Project[]>;
  subscribe(projectId: string, callback: (project: Project | null) => void): Unsubscribe;
  subscribeByEnterprise(enterpriseId: string, userEmail: string, callback: (projects: Project[]) => void): Unsubscribe;
  create(data: Omit<Project, 'id' | 'dateCreated' | 'dateLastModified'>): Promise<Project>;
  update(projectId: string, data: Partial<Project>): Promise<void>;
  delete(projectId: string): Promise<void>;
  checkProjectCodeExists(enterpriseId: string, projectCode: string): Promise<boolean>;
}
