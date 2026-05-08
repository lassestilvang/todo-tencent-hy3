import { z } from 'zod'

const envSchema = z.object({
  TEST_DB_PATH: z.string().optional(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

const envResult = envSchema.safeParse(process.env)
if (!envResult.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(envResult.error.format())}`
  )
}
export const env = envResult.data
