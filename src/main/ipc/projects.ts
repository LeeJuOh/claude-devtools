/**
 * IPC Handlers for Project Operations.
 *
 * Handlers:
 * - get-projects: List all projects
 * - get-repository-groups: List projects grouped by git repository
 * - get-worktree-sessions: List sessions for a specific worktree
 * - refresh-repository-group: Re-scan a single repo's worktrees
 */

import { createLogger } from '@shared/utils/logger';
import { type IpcMain, type IpcMainInvokeEvent } from 'electron';

import { type Project, type RepositoryGroup, type Session } from '../types';

import { validateProjectId } from './guards';

import type { ServiceContextRegistry } from '../services';

const logger = createLogger('IPC:projects');

// Service registry - set via initialize
let registry: ServiceContextRegistry;

/**
 * Initializes project handlers with service registry.
 */
export function initializeProjectHandlers(contextRegistry: ServiceContextRegistry): void {
  registry = contextRegistry;
}

/**
 * Registers all project-related IPC handlers.
 */
export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-projects', handleGetProjects);
  ipcMain.handle('get-repository-groups', handleGetRepositoryGroups);
  ipcMain.handle('get-worktree-sessions', handleGetWorktreeSessions);
  ipcMain.handle('refresh-repository-group', handleRefreshRepositoryGroup);

  logger.info('Project handlers registered');
}

/**
 * Removes all project IPC handlers.
 */
export function removeProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler('get-projects');
  ipcMain.removeHandler('get-repository-groups');
  ipcMain.removeHandler('get-worktree-sessions');
  ipcMain.removeHandler('refresh-repository-group');

  logger.info('Project handlers removed');
}

// =============================================================================
// Handler Implementations
// =============================================================================

/**
 * Handler for 'get-projects' IPC call.
 * Lists all projects from ~/.claude/projects/
 */
async function handleGetProjects(_event: IpcMainInvokeEvent): Promise<Project[]> {
  try {
    const { projectScanner } = registry.getActive();
    const projects = await projectScanner.scan();
    return projects;
  } catch (error) {
    logger.error('Error in get-projects:', error);
    return [];
  }
}

/**
 * Handler for 'get-repository-groups' IPC call.
 * Lists all projects grouped by git repository.
 * Worktrees of the same repo are grouped together.
 */
async function handleGetRepositoryGroups(_event: IpcMainInvokeEvent): Promise<RepositoryGroup[]> {
  try {
    const { projectScanner } = registry.getActive();
    const groups = await projectScanner.scanWithWorktreeGrouping();
    return groups;
  } catch (error) {
    logger.error('Error in get-repository-groups:', error);
    return [];
  }
}

/**
 * Handler for 'get-worktree-sessions' IPC call.
 * Lists all sessions for a specific worktree within a repository group.
 */
async function handleGetWorktreeSessions(
  _event: IpcMainInvokeEvent,
  worktreeId: string
): Promise<Session[]> {
  try {
    const validatedProject = validateProjectId(worktreeId);
    if (!validatedProject.valid) {
      logger.error(
        `get-worktree-sessions rejected: ${validatedProject.error ?? 'Invalid worktreeId'}`
      );
      return [];
    }

    const { projectScanner } = registry.getActive();
    const sessions = await projectScanner.listWorktreeSessions(validatedProject.value!);
    return sessions;
  } catch (error) {
    logger.error(`Error in get-worktree-sessions for ${worktreeId}:`, error);
    return [];
  }
}

/**
 * Handler for 'refresh-repository-group' IPC call.
 * Re-scans only directories matching the given base project ID prefix
 * and returns an updated RepositoryGroup.
 */
async function handleRefreshRepositoryGroup(
  _event: IpcMainInvokeEvent,
  repoBaseId: string
): Promise<RepositoryGroup | null> {
  try {
    const validated = validateProjectId(repoBaseId);
    if (!validated.valid) {
      logger.error(`refresh-repository-group rejected: ${validated.error ?? 'Invalid repoBaseId'}`);
      return null;
    }

    const { projectScanner } = registry.getActive();
    return await projectScanner.refreshRepositoryGroup(validated.value!);
  } catch (error) {
    logger.error(`Error in refresh-repository-group for ${repoBaseId}:`, error);
    return null;
  }
}
