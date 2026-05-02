import { z } from 'zod'

const envSchema = z.object({
  TEST_DB_PATH: z.string().optional(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

export const env = envSchema.parse(process.env)
