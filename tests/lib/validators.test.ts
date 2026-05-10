import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  prioritySchema,
  createTicketSchema,
  createCommentSchema,
  createProjectSchema,
  createSprintSchema,
  validateBody,
} from '@/lib/validators';

const VALID_UUID = '11111111-2222-4333-8444-555555555555';

describe('lib/validators', () => {
  describe('uuidSchema', () => {
    it('accepts valid UUID v4', () => {
      expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true);
    });

    it('rejects non-uuid strings', () => {
      expect(uuidSchema.safeParse('123').success).toBe(false);
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    });
  });

  describe('prioritySchema', () => {
    it('accepts allowed values', () => {
      for (const p of ['urgent', 'high', 'medium', 'low'] as const) {
        expect(prioritySchema.safeParse(p).success).toBe(true);
      }
    });

    it('rejects unknown priority', () => {
      expect(prioritySchema.safeParse('critical').success).toBe(false);
      expect(prioritySchema.safeParse('').success).toBe(false);
    });
  });

  describe('createTicketSchema', () => {
    it('accepts a minimal valid input (only title) and applies default priority', () => {
      const r = createTicketSchema.safeParse({ title: 'fix login bug' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.priority).toBe('medium');
    });

    it('accepts a full valid input', () => {
      const r = createTicketSchema.safeParse({
        title: 'Implement OAuth',
        description: 'long description',
        priority: 'high',
        ticket_type_id: VALID_UUID,
        status_id: VALID_UUID,
        service_id: VALID_UUID,
        category_id: VALID_UUID,
        assignee_id: VALID_UUID,
        reporter_id: VALID_UUID,
        client_id: VALID_UUID,
        project_id: VALID_UUID,
        board_id: VALID_UUID,
        sprint_id: VALID_UUID,
        parent_id: VALID_UUID,
        due_date: '2026-12-31',
      });
      expect(r.success).toBe(true);
    });

    it('rejects empty title', () => {
      const r = createTicketSchema.safeParse({ title: '' });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
      }
    });

    it('rejects title longer than 500 chars', () => {
      const r = createTicketSchema.safeParse({ title: 'a'.repeat(501) });
      expect(r.success).toBe(false);
    });

    it('rejects non-uuid in id fields', () => {
      const r = createTicketSchema.safeParse({
        title: 'X',
        assignee_id: 'not-a-uuid',
      });
      expect(r.success).toBe(false);
    });

    it('rejects invalid priority', () => {
      const r = createTicketSchema.safeParse({ title: 'X', priority: 'bogus' });
      expect(r.success).toBe(false);
    });

    it('accepts null for nullable id fields', () => {
      const r = createTicketSchema.safeParse({
        title: 'X',
        assignee_id: null,
        sprint_id: null,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('createCommentSchema', () => {
    it('accepts valid comment', () => {
      const r = createCommentSchema.safeParse({
        ticket_id: VALID_UUID,
        content: 'looks good',
      });
      expect(r.success).toBe(true);
    });

    it('rejects empty content', () => {
      const r = createCommentSchema.safeParse({
        ticket_id: VALID_UUID,
        content: '',
      });
      expect(r.success).toBe(false);
    });

    it('rejects content > 10000 chars', () => {
      const r = createCommentSchema.safeParse({
        ticket_id: VALID_UUID,
        content: 'x'.repeat(10_001),
      });
      expect(r.success).toBe(false);
    });

    it('rejects missing/invalid ticket_id', () => {
      const r = createCommentSchema.safeParse({
        ticket_id: 'nope',
        content: 'hi',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('createProjectSchema', () => {
    it('accepts minimal valid input', () => {
      const r = createProjectSchema.safeParse({ name: 'Ruflo', prefix: 'RUF' });
      expect(r.success).toBe(true);
    });

    it('accepts hex color and template_id', () => {
      const r = createProjectSchema.safeParse({
        name: 'Ruflo',
        prefix: 'RUF',
        color: '#1a2b3c',
        template_id: VALID_UUID,
      });
      expect(r.success).toBe(true);
    });

    it('rejects prefix shorter than 2 or longer than 10', () => {
      expect(createProjectSchema.safeParse({ name: 'X', prefix: 'A' }).success).toBe(false);
      expect(
        createProjectSchema.safeParse({ name: 'X', prefix: 'ABCDEFGHIJK' }).success
      ).toBe(false);
    });

    it('rejects malformed color', () => {
      const r = createProjectSchema.safeParse({
        name: 'X',
        prefix: 'XX',
        color: 'red',
      });
      expect(r.success).toBe(false);
    });

    it('rejects empty name', () => {
      const r = createProjectSchema.safeParse({ name: '', prefix: 'XX' });
      expect(r.success).toBe(false);
    });
  });

  describe('createSprintSchema', () => {
    it('accepts minimal (just name)', () => {
      const r = createSprintSchema.safeParse({ name: 'Sprint 1' });
      expect(r.success).toBe(true);
    });

    it('accepts full payload', () => {
      const r = createSprintSchema.safeParse({
        name: 'Sprint 1',
        goal: 'Ship onboarding',
        start_date: '2026-05-01',
        end_date: '2026-05-15',
        project_id: VALID_UUID,
      });
      expect(r.success).toBe(true);
    });

    it('rejects empty name', () => {
      const r = createSprintSchema.safeParse({ name: '' });
      expect(r.success).toBe(false);
    });

    it('rejects invalid project_id', () => {
      const r = createSprintSchema.safeParse({ name: 'Sprint 1', project_id: 'no' });
      expect(r.success).toBe(false);
    });
  });

  describe('validateBody', () => {
    function makeRequest(body: unknown, brokenJson = false): Request {
      return {
        json: async () => {
          if (brokenJson) throw new SyntaxError('Unexpected token');
          return body;
        },
      } as unknown as Request;
    }

    it('returns parsed data when body matches schema', async () => {
      const req = makeRequest({ title: 'hi' });
      const result = await validateBody(req, createTicketSchema);
      expect('data' in result).toBe(true);
      if ('data' in result) expect(result.data.title).toBe('hi');
    });

    it('returns 400 + zod error message on schema mismatch', async () => {
      const req = makeRequest({ title: '' });
      const result = await validateBody(req, createTicketSchema);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.status).toBe(400);
        expect(result.error).toContain('title');
      }
    });

    it('returns 400 "Invalid JSON body" when JSON parsing throws', async () => {
      const req = makeRequest(null, true);
      const result = await validateBody(req, createTicketSchema);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.status).toBe(400);
        expect(result.error).toBe('Invalid JSON body');
      }
    });
  });
});
