import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const prioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);

export const createTicketSchema = z.object({
  title: z.string().min(1, 'Título obrigatório').max(500),
  description: z.string().optional(),
  priority: prioritySchema.optional().default('medium'),
  ticket_type_id: z.string().uuid().optional().nullable(),
  status_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  reporter_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  board_id: z.string().uuid().optional().nullable(),
  sprint_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const createCommentSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  prefix: z.string().min(2).max(10),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  template_id: z.string().uuid().optional(),
});

export const createSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
});

/**
 * Helper to validate request body and return typed result or error response.
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T } | { error: string; status: number }> {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { error: msg, status: 400 };
    }
    return { data: parsed.data };
  } catch {
    return { error: 'Invalid JSON body', status: 400 };
  }
}
