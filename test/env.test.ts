import {describe, expect, it} from '@jest/globals'

import {getEnv, resetEnv} from '../src/env'

describe('Environment Variable Validation', () => {
  const originalEnv = {...process.env}

  afterEach(() => {
    // Restore original environment
    process.env = {...originalEnv}
    resetEnv()
  })

  it('should return validated environment variables when all are present', () => {
    const env = getEnv()

    expect(env.EIVU_ACCESS_KEY_ID).toBeDefined()
    expect(env.EIVU_BUCKET_NAME).toBeDefined()
    expect(env.EIVU_BUCKET_UUID).toBeDefined()
    expect(env.EIVU_ENDPOINT).toBeDefined()
    expect(env.EIVU_REGION).toBeDefined()
    expect(env.EIVU_SECRET_ACCESS_KEY).toBeDefined()
    expect(env.EIVU_UPLOAD_SERVER_HOST).toBeDefined()
    expect(env.EIVU_USER_TOKEN).toBeDefined()
  })

  it('should cache validated environment variables', () => {
    const env1 = getEnv()
    const env2 = getEnv()

    expect(env1).toBe(env2)
  })

  it('should throw error when EIVU_ACCESS_KEY_ID is missing', () => {
    resetEnv()
    delete process.env.EIVU_ACCESS_KEY_ID

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_ACCESS_KEY_ID')
  })

  it('should throw error when EIVU_BUCKET_NAME is missing', () => {
    resetEnv()
    delete process.env.EIVU_BUCKET_NAME

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_BUCKET_NAME')
  })

  it('should throw error when EIVU_BUCKET_UUID is missing', () => {
    resetEnv()
    delete process.env.EIVU_BUCKET_UUID

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_BUCKET_UUID')
  })

  it('should throw error when EIVU_ENDPOINT is missing', () => {
    resetEnv()
    delete process.env.EIVU_ENDPOINT

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_ENDPOINT')
  })

  it('should throw error when EIVU_REGION is missing', () => {
    resetEnv()
    delete process.env.EIVU_REGION

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_REGION')
  })

  it('should throw error when EIVU_SECRET_ACCESS_KEY is missing', () => {
    resetEnv()
    delete process.env.EIVU_SECRET_ACCESS_KEY

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_SECRET_ACCESS_KEY')
  })

  it('should throw error when EIVU_UPLOAD_SERVER_HOST is missing', () => {
    resetEnv()
    delete process.env.EIVU_UPLOAD_SERVER_HOST

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_UPLOAD_SERVER_HOST')
  })

  it('should throw error when EIVU_USER_TOKEN is missing', () => {
    resetEnv()
    delete process.env.EIVU_USER_TOKEN

    expect(() => getEnv()).toThrow('Missing required environment variables: EIVU_USER_TOKEN')
  })

  it('should throw error listing all missing variables when multiple are missing', () => {
    resetEnv()
    delete process.env.EIVU_ACCESS_KEY_ID
    delete process.env.EIVU_BUCKET_NAME
    delete process.env.EIVU_USER_TOKEN

    expect(() => getEnv()).toThrow(
      'Missing required environment variables: EIVU_ACCESS_KEY_ID, EIVU_BUCKET_NAME, EIVU_USER_TOKEN',
    )
  })

  it('should include helpful message in error', () => {
    resetEnv()
    delete process.env.EIVU_ACCESS_KEY_ID

    expect(() => getEnv()).toThrow('Please ensure all required EIVU environment variables are set')
  })
})
