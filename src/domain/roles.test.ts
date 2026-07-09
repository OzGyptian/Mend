import { describe, it, expect } from 'vitest';
import { getProjectRole } from './roles';

describe('getProjectRole', () => {
  it('returns null for undefined users map', () => {
    expect(getProjectRole(undefined, 'u1')).toBeNull();
  });

  it('returns null when user is not in the map', () => {
    expect(getProjectRole({ 'u2': 'Project Admin' }, 'u1')).toBeNull();
  });

  it('maps legacy "Project Admin" string to project_admin', () => {
    expect(getProjectRole({ 'u1': 'Project Admin' }, 'u1')).toBe('project_admin');
  });

  it('maps legacy "Project Writer" string to project_writer', () => {
    expect(getProjectRole({ 'u1': 'Project Writer' }, 'u1')).toBe('project_writer');
  });

  it('maps legacy "Project Reader" string to project_reader', () => {
    expect(getProjectRole({ 'u1': 'Project Reader' }, 'u1')).toBe('project_reader');
  });

  it('maps legacy "Project Guest" string to project_guest', () => {
    expect(getProjectRole({ 'u1': 'Project Guest' }, 'u1')).toBe('project_guest');
  });

  it('also accepts canonical project_admin key directly', () => {
    expect(getProjectRole({ 'u1': 'project_admin' }, 'u1')).toBe('project_admin');
  });

  it('also accepts canonical project_reader key directly', () => {
    expect(getProjectRole({ 'u1': 'project_reader' }, 'u1')).toBe('project_reader');
  });

  it('returns null for an unrecognized role string', () => {
    expect(getProjectRole({ 'u1': 'some_unknown_role' }, 'u1')).toBeNull();
  });

  it('picks the correct user when map has multiple users', () => {
    const users = { 'u1': 'Project Admin', 'u2': 'Project Reader' };
    expect(getProjectRole(users, 'u1')).toBe('project_admin');
    expect(getProjectRole(users, 'u2')).toBe('project_reader');
  });
});
