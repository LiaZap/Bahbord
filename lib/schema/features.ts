import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces, members, services, categories, ticketTypes } from './core';
import { projects, boards, tickets } from './tickets';

// ─── Automations ─────────────────────────────────────────────────────────────

export const automations = pgTable('automations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  triggerEvent: text('trigger_event').notNull(),
  triggerConditions: jsonb('trigger_conditions').default({}),
  actionType: text('action_type').notNull(),
  actionParams: jsonb('action_params').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => members.id, { onDelete: 'set null' }),
});

// ─── Ticket Templates ────────────────────────────────────────────────────────

export const ticketTemplates = pgTable('ticket_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ticketTypeId: uuid('ticket_type_id').references(() => ticketTypes.id, { onDelete: 'set null' }),
  titleTemplate: text('title_template'),
  descriptionHtml: text('description_html'),
  priority: text('priority'),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  subtasks: jsonb('subtasks').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => members.id, { onDelete: 'set null' }),
});

// ─── Recurring Tickets ───────────────────────────────────────────────────────

export const recurringTickets = pgTable('recurring_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  titleTemplate: text('title_template').notNull(),
  descriptionHtml: text('description_html'),
  ticketTypeId: uuid('ticket_type_id').references(() => ticketTypes.id, { onDelete: 'set null' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
  assigneeId: uuid('assignee_id').references(() => members.id, { onDelete: 'set null' }),
  priority: text('priority').default('medium'),
  cronExpression: text('cron_expression').notNull(),
  isActive: boolean('is_active').default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => members.id, { onDelete: 'set null' }),
});

// ─── SLA Policies ────────────────────────────────────────────────────────────

export const slaPolicies = pgTable('sla_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  priority: text('priority').notNull(),
  hoursToResolve: integer('hours_to_resolve').notNull(),
  alertHoursBefore: integer('alert_hours_before').default(24),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_sla_policies').on(table.workspaceId, table.priority),
]);

// ─── Integrations ────────────────────────────────────────────────────────────

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_integrations').on(table.workspaceId, table.provider),
]);

// ─── Webhook Subscriptions ───────────────────────────────────────────────────

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret'),
  events: text('events').array().notNull().default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Share Links ─────────────────────────────────────────────────────────────

export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').references(() => boards.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  viewsCount: integer('views_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => members.id, { onDelete: 'set null' }),
});

// ─── Initiatives ─────────────────────────────────────────────────────────────

export const initiatives = pgTable('initiatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  goal: text('goal'),
  health: text('health').notNull().default('on_track'),
  healthSetAt: timestamp('health_set_at', { withTimezone: true }).defaultNow(),
  healthSetBy: uuid('health_set_by').references(() => members.id, { onDelete: 'set null' }),
  healthNote: text('health_note'),
  startDate: timestamp('start_date', { withTimezone: true }),
  targetDate: timestamp('target_date', { withTimezone: true }),
  color: text('color').default('#3b6cf5'),
  icon: text('icon'),
  ownerId: uuid('owner_id').references(() => members.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => members.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Saved Views ─────────────────────────────────────────────────────────────

export const savedViews = pgTable('saved_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  scope: text('scope').notNull().default('board'),
  filters: jsonb('filters').default({}),
  position: integer('position').default(0),
  isShared: boolean('is_shared').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
