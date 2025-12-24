import { z } from 'zod';

export const PatternTypeSchema = z.enum(['literal', 'glob', 'regex']);

export const PatternSchema = z.object({
  type: PatternTypeSchema,
  value: z.string().min(1, "Pattern value cannot be empty"),
  reason: z.string().min(1, "Reason is mandatory for each pattern"),
});

export const PolicySchema = z.object({
  category: z.string().min(1, "Category name is mandatory"),
  patterns: z.array(PatternSchema).min(1, "At least one pattern is required per category"),
});

export const ConfigSchema = z.object({
  policies: z.array(PolicySchema).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type Pattern = z.infer<typeof PatternSchema>;
export type PatternType = z.infer<typeof PatternTypeSchema>;
