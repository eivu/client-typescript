import {afterEach, describe, expect, it, jest} from '@jest/globals'

import logger from '../src/logger'
import {preventSleep, withNoSleep} from '../src/no-sleep'

/** Temporarily override process.platform, returning a restore fn. */
function mockPlatform(value: NodeJS.Platform): () => void {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', {configurable: true, value})
  return () => {
    if (original) Object.defineProperty(process, 'platform', original)
  }
}

describe('no-sleep', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('withNoSleep', () => {
    it('runs fn and returns its value when disabled (no blocker)', async () => {
      const result = await withNoSleep(false, 'test', async () => 42)
      expect(result).toBe(42)
    })

    it('runs fn and releases the blocker when enabled (unsupported platform → no-op)', async () => {
      const restore = mockPlatform('aix') // unsupported → no spawn, just a warning
      try {
        const result = await withNoSleep(true, 'test', async () => 'ok')
        expect(result).toBe('ok')
      } finally {
        restore()
      }
    })

    it('still releases the blocker when fn throws', async () => {
      const restore = mockPlatform('aix')
      try {
        await expect(withNoSleep(true, 'test', async () => {
          throw new Error('boom')
        })).rejects.toThrow('boom')
      } finally {
        restore()
      }
    })
  })

  describe('preventSleep on an unsupported platform', () => {
    it('warns and returns a no-op blocker (warn-and-continue)', () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
      const restore = mockPlatform('sunos')
      try {
        const blocker = preventSleep('test reason')
        expect(warn).toHaveBeenCalledTimes(1)
        expect(() => blocker.release()).not.toThrow()
      } finally {
        restore()
      }
    })
  })
})
