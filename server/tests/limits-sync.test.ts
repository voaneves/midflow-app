import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COPY_LIMITS } from '../../src/lib/limits.ts'
import { LIMITS } from '../ai/prompt.ts'

test('editor copy limits match the server quality gate', () => {
  assert.deepEqual({ ...COPY_LIMITS }, { ...LIMITS })
})
