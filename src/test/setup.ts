// Test setup file
import { beforeEach, afterEach } from 'bun:test'
import fs from 'fs'
import path from 'path'

const TEST_DB_PATH = path.join(__dirname, '../../test-tasks.json')

beforeEach(() => {
  // Set test database path
  process.env.TEST_DB_PATH = TEST_DB_PATH

  // Clean up test database before each test
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
  }
})

afterEach(() => {
  // Clean up after each test
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
  }
  delete process.env.TEST_DB_PATH
})
