import { pgTable, uuid, text, boolean, timestamp, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { workspaces, members } from './core';
import { projects, boards } from './tickets';

// ─── Org Roles ───────────────────────────────────────────────────────────────

export const orgRoles = pgTable('org_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_org_roles').on(table.workspaceId, table.memberId),
]);

// ─── Project Roles ───────────────────────────────────────────────────────────

export const projectRoles = pgTable('project_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_project_roles').on(table.projectId, table.memberId),
]);

// ─── Board Roles ─────────────────────────────────────────────────────────────

export const boardRoles = pgTable('board_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_board_roles').on(table.boardId, table.memberId),
]);

// ─── Permission Groups ───────────────────────────────────────────────────────

export const permissionGroups = pgTable('permission_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_perm_groups').on(table.workspaceId, table.name),
]);

// ─── Permissions ─────────────────────────────────────────────────────────────

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  displayName: text('display_name').notNull(),
  groupId: uuid('group_id').references(() => permissionGroups.id),
  scope: text('scope').notNull().default('both'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_permissions').on(table.workspaceId, table.key),
]);

// ─── Role Permissions ────────────────────────────────────────────────────────

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleName: text('role_name').notNull(),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_role_permissions').on(table.roleName, table.permissionId),
]);

// ─── Teams ───────────────────────────────────────────────────────────────────

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').default('#6366f1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Team Members ────────────────────────────────────────────────────────────

export const teamMembers = pgTable('team_members', {
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  role: text('role').default('member'),
}, (table) => [
  primaryKey({ columns: [table.teamId, table.memberId] }),
]);

// ─── Approval Requests ───────────────────────────────────────────────────────

export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  requesterId: uuid('requester_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  requestData: text('request_data').default('{}'),
  reviewerId: uuid('reviewer_id').references(() => members.id, { onDelete: 'set null' }),
  reviewerNote: text('reviewer_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
