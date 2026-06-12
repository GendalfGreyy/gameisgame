import { z } from 'zod';

import { REPORT_STATUSES, REPORT_TARGET_TYPES } from '../types/enums.js';

export const createReportRequestSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1),
  reason: z.string().min(10).max(500),
});

export const reviewReportRequestSchema = z.object({
  status: z.enum(['dismissed', 'actioned']),
  note: z.string().max(500).optional(),
});

export const reportSummarySchema = z.object({
  id: z.string(),
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string(),
  reason: z.string(),
  status: z.enum(REPORT_STATUSES),
  reporter: z.object({
    id: z.string(),
    firstName: z.string(),
    username: z.string().nullable(),
  }),
  createdAt: z.string().datetime(),
});

export const reportsListResponseSchema = z.object({
  items: z.array(reportSummarySchema),
});

export const createReportResponseSchema = z.object({
  id: z.string(),
  status: z.enum(REPORT_STATUSES),
});

export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type ReviewReportRequest = z.infer<typeof reviewReportRequestSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type ReportsListResponse = z.infer<typeof reportsListResponseSchema>;
