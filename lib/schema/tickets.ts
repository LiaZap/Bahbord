import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, primaryKey, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces, members, statuses, services, categories, ticketTypes, clients } from './core';

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  description: text('description'),
  color: text('color').default('#3b82f6'),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Boards ──────────────────────────────────────────────────────────────────

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').default('kanban'),
  filterQuery: text('filter_query'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Sprints ─────────────────────────────────────────────────────────────────

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').default(false),
  isCompleted: boolean('is_completed').default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  autoRollover: boolean('auto_rollover').default(false),
  cadenceDays: integer('cadence_days'),
  rolloverStrategy: text('rollover_strategy').default('move_incomplete'),
  parentSprintId: uuid('parent_sprint_id'),
  rolledOverAt: timestamp('rolled_over_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Tickets ─────────────────────────────────────────────────────────────────

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  ticketTypeId: uuid('ticket_type_id').references(() => ticketTypes.id),
  statusId: uuid('status_id').references(() => statuses.id),
  serviceId: uuid('service_id').references(() => services.id),
  categoryId: uuid('category_id').references(() => categories.id),
  assigneeId: uuid('assignee_id').references(() => members.id),
  reporterId: uuid('reporter_id').references(() => members.id),
  clientId: uuid('client_id').references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id),
  boardId: uuid('board_id').references(() => boards.id),
  sprintId: uuid('sprint_id').references(() => sprints.id),
  parentId: uuid('parent_id'),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').default('medium'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
  slaAlertSentAt: timestamp('sla_alert_sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  sequenceNumber: integer('sequence_number').default(1),
  isArchived: boolean('is_archived').default(false),
  subtaskCount: integer('subtask_count').notNull().default(0),
  subtaskDoneCount: integer('subtask_done_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  attachmentCount: integer('attachment_count').notNull().default(0),
  customerRequestCount: integer('customer_request_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Subtasks ────────────────────────────────────────────────────────────────

export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  isDone: boolean('is_done').default(false),
  position: integer('position').default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Ticket Assignees (Multi-assign) ─────────────────────────────────────────

export const ticketAssignees = pgTable('ticket_assignees', {
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').default(false),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  addedBy: uuid('added_by').references(() => members.id, { onDelete: 'set null' }),
}, (table) => [
  primaryKey({ columns: [table.ticketId, table.memberId] }),
]);

// ─── Ticket Relations ────────────────────────────────────────────────────────

export const ticketRelations = pgTable('ticket_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceTicketId: uuid('source_ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  targetTicketId: uuid('target_ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => members.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('uq_ticket_relations').on(table.sourceTicketId, table.targetTicketId, table.relationType),
]);

// ─── Attachments ─────────────────────────────────────────────────────────────

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').references(() => members.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Time Entries ────────────────────────────────────────────────────────────

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  minutes: integer('minutes').notNull(),
  description: text('description'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  isRunning: boolean('is_running').default(false),
  isBillable: boolean('is_billable').default(true),
  externalId: text('external_id'),
  loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
