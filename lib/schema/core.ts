import { pgTable, uuid, text, boolean, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// ─── Workspaces ──────────────────────────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  prefix: text('prefix').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Members ─────────────────────────────────────────────────────────────────

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  clerkUserId: text('clerk_user_id'),
  isApproved: boolean('is_approved').default(false),
  isClient: boolean('is_client').default(false),
  canTrackTime: boolean('can_track_time').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_members_clerk_user_id').on(table.clerkUserId),
]);

// ─── Statuses (Kanban Columns) ───────────────────────────────────────────────

export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  position: integer('position').notNull().default(0),
  wipLimit: integer('wip_limit'),
  isDone: boolean('is_done').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Services ────────────────────────────────────────────────────────────────

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#f59e0b'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Ticket Types ────────────────────────────────────────────────────────────

export const ticketTypes = pgTable('ticket_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  descriptionTemplate: text('description_template'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#6366f1'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Quick Reactions ─────────────────────────────────────────────────────────

export const quickReactions = pgTable('quick_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  label: text('label').notNull(),
  position: integer('position').default(0),
});
