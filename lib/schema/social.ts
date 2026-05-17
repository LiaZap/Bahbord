import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { members, workspaces } from './core';
import { tickets } from './tickets';

// ─── Comments ────────────────────────────────────────────────────────────────

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Comment Reactions ───────────────────────────────────────────────────────

export const commentReactions = pgTable('comment_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_comment_reactions').on(table.commentId, table.memberId, table.emoji),
]);

// ─── Activity Log ────────────────────────────────────────────────────────────

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
  actorId: uuid('actor_id').references(() => members.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  fieldName: text('field_name'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Audit Log ───────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => members.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  changes: jsonb('changes').default({}),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => members.id, { onDelete: 'set null' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title'),
  message: text('message'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  link: text('link'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Notification Preferences ────────────────────────────────────────────────

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  event: text('event').notNull(),
  isEnabled: boolean('is_enabled').default(true),
}, (table) => [
  uniqueIndex('uq_notification_pref').on(table.memberId, table.channel, table.event),
]);

// ─── Ticket Viewers ──────────────────────────────────────────────────────────

export const ticketViewers = pgTable('ticket_viewers', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('uq_ticket_viewers').on(table.ticketId, table.memberId),
]);
