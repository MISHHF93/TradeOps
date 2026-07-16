import { z } from 'zod';

export const serviceStatusSchema = z.enum(['up', 'down', 'degraded']);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const dependencyHealthSchema = z.object({
  name: z.string(),
  status: serviceStatusSchema,
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
});
export type DependencyHealth = z.infer<typeof dependencyHealthSchema>;

export const healthResponseSchema = z.object({
  status: serviceStatusSchema,
  service: z.string(),
  version: z.string(),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  dependencies: z.array(dependencyHealthSchema),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
