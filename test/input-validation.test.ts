import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import nock from 'nock'

import {Client} from '../src/client'
import {CloudFile} from '../src/cloud-file'

describe('Input Validation for File Operations', () => {
  beforeEach(() => {
    nock.cleanAll()
    jest.clearAllMocks()
  })

  describe('Client.uploadFile', () => {
    it('should throw error for null pathToFile', async () => {
      const client = new Client()
      await expect(client.uploadFile({pathToFile: null as unknown as string})).rejects.toThrow(
        'File path must be a non-empty string',
      )
    })

    it('should throw error for undefined pathToFile', async () => {
      const client = new Client()
      await expect(client.uploadFile({pathToFile: undefined as unknown as string})).rejects.toThrow(
        'File path must be a non-empty string',
      )
    })

    it('should throw error for empty string pathToFile', async () => {
      const client = new Client()
      await expect(client.uploadFile({pathToFile: ''})).rejects.toThrow('File path must be a non-empty string')
    })

    it('should throw error for non-existent file', async () => {
      const client = new Client()
      await expect(client.uploadFile({pathToFile: '/path/to/nonexistent.txt'})).rejects.toThrow('File not found')
    })

    it('should throw error for path traversal attack', async () => {
      const client = new Client()
      await expect(client.uploadFile({pathToFile: '../../../etc/passwd'})).rejects.toThrow('path traversal detected')
    })

    it('should throw error for directory instead of file', async () => {
      const client = new Client()
      await expect(client.uploadFile({pathToFile: 'test/fixtures/samples'})).rejects.toThrow(
        'Expected a file but got a directory',
      )
    })
  })

  describe('Client.uploadFolder', () => {
    it('should throw error for null pathToFolder', async () => {
      const client = new Client()
      await expect(client.uploadFolder({pathToFolder: null as unknown as string})).rejects.toThrow(
        'Directory path must be a non-empty string',
      )
    })

    it('should throw error for undefined pathToFolder', async () => {
      const client = new Client()
      await expect(client.uploadFolder({pathToFolder: undefined as unknown as string})).rejects.toThrow(
        'Directory path must be a non-empty string',
      )
    })

    it('should throw error for empty string pathToFolder', async () => {
      const client = new Client()
      await expect(client.uploadFolder({pathToFolder: ''})).rejects.toThrow('Directory path must be a non-empty string')
    })

    it('should throw error for non-existent directory', async () => {
      const client = new Client()
      await expect(client.uploadFolder({pathToFolder: '/path/to/nonexistent'})).rejects.toThrow('Directory not found')
    })

    it('should throw error for path traversal attack', async () => {
      const client = new Client()
      await expect(client.uploadFolder({pathToFolder: '../../../etc'})).rejects.toThrow('path traversal detected')
    })

    it('should throw error for file instead of directory', async () => {
      const client = new Client()
      await expect(client.uploadFolder({pathToFolder: 'test/fixtures/samples/image/ai overlords.jpg'})).rejects.toThrow(
        'Expected a directory but got a file',
      )
    })
  })

  describe('Client.verifyUpload', () => {
    it('should throw error for null pathToFile', async () => {
      const client = new Client()
      await expect(client.verifyUpload(null as unknown as string)).rejects.toThrow(
        'File path must be a non-empty string',
      )
    })

    it('should throw error for non-existent file', async () => {
      const client = new Client()
      await expect(client.verifyUpload('/path/to/nonexistent.txt')).rejects.toThrow('File not found')
    })

    it('should throw error for path traversal attack', async () => {
      const client = new Client()
      await expect(client.verifyUpload('../../../etc/passwd')).rejects.toThrow('path traversal detected')
    })
  })

  describe('CloudFile.reserve', () => {
    it('should throw error when both md5 and pathToFile are not provided', async () => {
      await expect(CloudFile.reserve({})).rejects.toThrow(
        'CloudFile#reserve requires either md5 or pathToFile to be set',
      )
    })

    it('should throw error for non-existent file', async () => {
      await expect(CloudFile.reserve({pathToFile: '/path/to/nonexistent.txt'})).rejects.toThrow('File not found')
    })

    it('should throw error for path traversal attack', async () => {
      await expect(CloudFile.reserve({pathToFile: '../../../etc/passwd'})).rejects.toThrow('path traversal detected')
    })
  })

  describe('CloudFile.fetchOrReserveBy', () => {
    it('should throw error when both md5 and pathToFile are not provided', async () => {
      await expect(CloudFile.fetchOrReserveBy({})).rejects.toThrow(
        'CloudFile#fetchOrReserveBy requires either md5 or pathToFile to be set',
      )
    })

    it('should throw error when both md5 and pathToFile are provided', async () => {
      await expect(CloudFile.fetchOrReserveBy({md5: '1234567890', pathToFile: '/path/to/file.txt'})).rejects.toThrow(
        'CloudFile#fetchOrReserveBy requires only one of md5 or pathToFile to be set',
      )
    })

    it('should throw error for non-existent file', async () => {
      await expect(CloudFile.fetchOrReserveBy({pathToFile: '/path/to/nonexistent.txt'})).rejects.toThrow(
        'File not found',
      )
    })

    it('should throw error for path traversal attack', async () => {
      await expect(CloudFile.fetchOrReserveBy({pathToFile: '../../../etc/passwd'})).rejects.toThrow(
        'path traversal detected',
      )
    })
  })

  describe('Static uploadFile method', () => {
    it('should throw error for null pathToFile', async () => {
      await expect(Client.uploadFile({pathToFile: null as unknown as string})).rejects.toThrow(
        'File path must be a non-empty string',
      )
    })

    it('should throw error for path traversal attack', async () => {
      await expect(Client.uploadFile({pathToFile: '../../../etc/passwd'})).rejects.toThrow('path traversal detected')
    })
  })

  describe('Static uploadFolder method', () => {
    it('should throw error for null pathToFolder', async () => {
      await expect(Client.uploadFolder({pathToFolder: null as unknown as string})).rejects.toThrow(
        'Directory path must be a non-empty string',
      )
    })

    it('should throw error for path traversal attack', async () => {
      await expect(Client.uploadFolder({pathToFolder: '../../../etc'})).rejects.toThrow('path traversal detected')
    })
  })
})
