import logger from '@src/logger'
import {type ChildProcess, spawn} from 'node:child_process'

/**
 * Handle for an active sleep-prevention session. Call {@link SleepBlocker.release}
 * (ideally in a `finally`) to stop keeping the machine awake.
 */
export type SleepBlocker = {
  /** Stops sleep prevention. Safe to call more than once. */
  release(): void
}

/** A blocker that does nothing — used when prevention is disabled or unsupported. */
const NOOP_BLOCKER: SleepBlocker = {release() {}}

/**
 * Spawns a long-lived helper process that keeps the OS awake, returning a blocker that kills it.
 * If the helper binary is missing, the `spawn` 'error' event fires (ENOENT); we warn — naming the
 * dependency to install — and continue. The work is never blocked over a power hint.
 */
function spawnBlocker(command: string, args: string[], missingHint: string): SleepBlocker {
  let child: ChildProcess | undefined
  try {
    child = spawn(command, args, {stdio: 'ignore'})
  } catch (error) {
    logger.warn({error: error instanceof Error ? error.message : String(error)}, missingHint)
    return NOOP_BLOCKER
  }

  child.on('error', (error: NodeJS.ErrnoException) => {
    // ENOENT means the binary isn't installed; anything else is unexpected but non-fatal.
    logger.warn({error: error.message}, missingHint)
  })

  let released = false
  return {
    release() {
      if (released) return
      released = true
      child?.kill()
    },
  }
}

/**
 * Prevents the system from sleeping for the duration of a long-running operation.
 *
 * - **macOS** → `caffeinate -i -w <pid>` (also self-exits when this process ends).
 * - **Linux** → `systemd-inhibit --what=sleep:idle …` (requires systemd's `systemd-inhibit`).
 * - **Other / missing tool** → logs a warning naming what to install, then returns a no-op blocker.
 *
 * @param reason - Short human-readable reason shown by the inhibitor (e.g. the command name).
 * @returns A {@link SleepBlocker}; call `release()` when the operation finishes.
 */
export function preventSleep(reason = 'eivu long-running operation'): SleepBlocker {
  switch (process.platform) {
    case 'darwin': {
      return spawnBlocker(
        'caffeinate',
        ['-i', '-w', String(process.pid)],
        'Could not start `caffeinate` to prevent sleep; it ships with macOS — continuing without sleep prevention.',
      )
    }

    case 'linux': {
      return spawnBlocker(
        'systemd-inhibit',
        ['--what=sleep:idle', '--who=eivu', `--why=${reason}`, 'sleep', 'infinity'],
        'Sleep prevention needs `systemd-inhibit` (install the `systemd` package) — continuing without it.',
      )
    }

    default: {
      logger.warn(
        {platform: process.platform},
        `Sleep prevention is not supported on ${process.platform} — continuing without it.`,
      )
      return NOOP_BLOCKER
    }
  }
}

/**
 * Runs `fn` while preventing the system from sleeping (when `enabled`), always releasing the blocker
 * afterward — even if `fn` throws. When `enabled` is false, simply runs `fn`.
 * @param enabled - Whether to keep the machine awake during `fn`.
 * @param reason - Short reason passed to {@link preventSleep}.
 * @param fn - The async work to run.
 */
export async function withNoSleep<T>(enabled: boolean, reason: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn()

  const blocker = preventSleep(reason)
  try {
    return await fn()
  } finally {
    blocker.release()
  }
}
