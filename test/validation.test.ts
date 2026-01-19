import {afterEach, beforeEach, describe, expect, it} from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'

import {validateDirectoryPath, validateFilePath} from '../src/utils'

describe('File Path Validation', () => {
  let tempDir: string
  let tempFile: string

  beforeEach(() => {
    // Create a temporary directory and file for testing
    tempDir = path.join(process.cwd(), 'test', 'tmp-validation')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, {recursive: true})
    }

    tempFile = path.join(tempDir, 'test-file.txt')
    fs.writeFileSync(tempFile, 'test content')
  })

  afterEach(() => {
    // Clean up temporary files
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
    }

    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir)
    }
  })

  describe('validateFilePath', () => {
    it('should accept a valid existing file path', () => {
      expect(() => validateFilePath(tempFile)).not.toThrow()
    })

    it('should accept a valid existing file with relative path', () => {
      const relativePath = path.relative(process.cwd(), tempFile)
      expect(() => validateFilePath(relativePath)).not.toThrow()
    })

    it('should throw error for null path', () => {
      expect(() => validateFilePath(null as unknown as string)).toThrow('File path must be a non-empty string')
    })

    it('should throw error for undefined path', () => {
      expect(() => validateFilePath(undefined as unknown as string)).toThrow('File path must be a non-empty string')
    })

    it('should throw error for empty string path', () => {
      expect(() => validateFilePath('')).toThrow('File path must be a non-empty string')
    })

    it('should throw error for whitespace-only path', () => {
      expect(() => validateFilePath('   ')).toThrow('File path must be a non-empty string')
    })

    it('should throw error for non-existent file', () => {
      expect(() => validateFilePath('/path/to/nonexistent/file.txt')).toThrow('File not found')
    })

    it('should throw error for directory when file expected', () => {
      expect(() => validateFilePath(tempDir)).toThrow('Expected a file but got a directory')
    })

    it('should throw error for path traversal with ../', () => {
      expect(() => validateFilePath('../../../etc/passwd')).toThrow('path traversal detected')
    })

    it('should throw error for path traversal in middle of path', () => {
      expect(() => validateFilePath('test/../../../etc/passwd')).toThrow('path traversal detected')
    })

    it('should not check existence when checkExists is false', () => {
      expect(() => validateFilePath('/nonexistent/file.txt', {checkExists: false})).not.toThrow()
    })

    it('should allow directories when allowDirectories is true', () => {
      expect(() => validateFilePath(tempDir, {allowDirectories: true})).not.toThrow()
    })

    it('should accept a file path with special characters', () => {
      const specialFile = path.join(tempDir, 'test file with spaces.txt')
      fs.writeFileSync(specialFile, 'test')
      expect(() => validateFilePath(specialFile)).not.toThrow()
      fs.unlinkSync(specialFile)
    })

    it('should return trimmed path for path with leading whitespace', () => {
      const pathWithLeadingWhitespace = `  ${tempFile}`
      const trimmedPath = validateFilePath(pathWithLeadingWhitespace)
      expect(trimmedPath).toBe(tempFile)
      expect(trimmedPath).not.toBe(pathWithLeadingWhitespace)
    })

    it('should return trimmed path for path with trailing whitespace', () => {
      const pathWithTrailingWhitespace = `${tempFile}  `
      const trimmedPath = validateFilePath(pathWithTrailingWhitespace)
      expect(trimmedPath).toBe(tempFile)
      expect(trimmedPath).not.toBe(pathWithTrailingWhitespace)
    })

    it('should return trimmed path for path with both leading and trailing whitespace', () => {
      const pathWithWhitespace = `  ${tempFile}  `
      const trimmedPath = validateFilePath(pathWithWhitespace)
      expect(trimmedPath).toBe(tempFile)
      expect(trimmedPath).not.toBe(pathWithWhitespace)
    })

    it('should accept file with double dots in filename (not path traversal)', () => {
      const fileWithDots = path.join(tempDir, 'test..file.txt')
      fs.writeFileSync(fileWithDots, 'test')
      expect(() => validateFilePath(fileWithDots)).not.toThrow()
      fs.unlinkSync(fileWithDots)
    })

    it('should accept file starting with double dots (not path traversal)', () => {
      const hiddenFile = path.join(tempDir, '..hidden')
      fs.writeFileSync(hiddenFile, 'test')
      expect(() => validateFilePath(hiddenFile)).not.toThrow()
      fs.unlinkSync(hiddenFile)
    })

    it('should accept file with double dots in middle of filename', () => {
      const fileWithDots = path.join(tempDir, 'version..1.data')
      fs.writeFileSync(fileWithDots, 'test')
      expect(() => validateFilePath(fileWithDots)).not.toThrow()
      fs.unlinkSync(fileWithDots)
    })

    it('should still reject actual path traversal with ../ as directory segment', () => {
      expect(() => validateFilePath('test/../file.txt')).toThrow('path traversal detected')
    })
  })

  describe('validateDirectoryPath', () => {
    it('should accept a valid existing directory path', () => {
      expect(() => validateDirectoryPath(tempDir)).not.toThrow()
    })

    it('should accept a valid existing directory with relative path', () => {
      const relativePath = path.relative(process.cwd(), tempDir)
      expect(() => validateDirectoryPath(relativePath)).not.toThrow()
    })

    it('should throw error for null path', () => {
      expect(() => validateDirectoryPath(null as unknown as string)).toThrow(
        'Directory path must be a non-empty string',
      )
    })

    it('should throw error for undefined path', () => {
      expect(() => validateDirectoryPath(undefined as unknown as string)).toThrow(
        'Directory path must be a non-empty string',
      )
    })

    it('should throw error for empty string path', () => {
      expect(() => validateDirectoryPath('')).toThrow('Directory path must be a non-empty string')
    })

    it('should throw error for whitespace-only path', () => {
      expect(() => validateDirectoryPath('   ')).toThrow('Directory path must be a non-empty string')
    })

    it('should throw error for non-existent directory', () => {
      expect(() => validateDirectoryPath('/path/to/nonexistent/dir')).toThrow('Directory not found')
    })

    it('should throw error for file when directory expected', () => {
      expect(() => validateDirectoryPath(tempFile)).toThrow('Expected a directory but got a file')
    })

    it('should throw error for path traversal with ../', () => {
      expect(() => validateDirectoryPath('../../../etc')).toThrow('path traversal detected')
    })

    it('should throw error for path traversal in middle of path', () => {
      expect(() => validateDirectoryPath('test/../../../etc')).toThrow('path traversal detected')
    })

    it('should not check existence when checkExists is false', () => {
      expect(() => validateDirectoryPath('/nonexistent/directory', {checkExists: false})).not.toThrow()
    })

    it('should accept current directory', () => {
      expect(() => validateDirectoryPath('.')).not.toThrow()
    })

    it('should accept a directory path with special characters', () => {
      const specialDir = path.join(tempDir, 'test dir with spaces')
      fs.mkdirSync(specialDir, {recursive: true})
      expect(() => validateDirectoryPath(specialDir)).not.toThrow()
      fs.rmdirSync(specialDir)
    })

    it('should return trimmed path for path with leading whitespace', () => {
      const pathWithLeadingWhitespace = `  ${tempDir}`
      const trimmedPath = validateDirectoryPath(pathWithLeadingWhitespace)
      expect(trimmedPath).toBe(tempDir)
      expect(trimmedPath).not.toBe(pathWithLeadingWhitespace)
    })

    it('should return trimmed path for path with trailing whitespace', () => {
      const pathWithTrailingWhitespace = `${tempDir}  `
      const trimmedPath = validateDirectoryPath(pathWithTrailingWhitespace)
      expect(trimmedPath).toBe(tempDir)
      expect(trimmedPath).not.toBe(pathWithTrailingWhitespace)
    })

    it('should return trimmed path for path with both leading and trailing whitespace', () => {
      const pathWithWhitespace = `  ${tempDir}  `
      const trimmedPath = validateDirectoryPath(pathWithWhitespace)
      expect(trimmedPath).toBe(tempDir)
      expect(trimmedPath).not.toBe(pathWithWhitespace)
    })

    it('should accept directory with double dots in name (not path traversal)', () => {
      const dirWithDots = path.join(tempDir, 'test..dir')
      fs.mkdirSync(dirWithDots, {recursive: true})
      expect(() => validateDirectoryPath(dirWithDots)).not.toThrow()
      fs.rmdirSync(dirWithDots)
    })

    it('should accept directory starting with double dots (not path traversal)', () => {
      const hiddenDir = path.join(tempDir, '..hidden')
      fs.mkdirSync(hiddenDir, {recursive: true})
      expect(() => validateDirectoryPath(hiddenDir)).not.toThrow()
      fs.rmdirSync(hiddenDir)
    })

    it('should still reject actual path traversal with ../ as directory segment', () => {
      expect(() => validateDirectoryPath('test/../dir')).toThrow('path traversal detected')
    })
  })

  describe('Integration with existing file operations', () => {
    it('should work with test fixtures directory', () => {
      const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'samples')
      expect(() => validateDirectoryPath(fixturesDir)).not.toThrow()
    })

    it('should work with test fixture image file', () => {
      const imagePath = path.join(process.cwd(), 'test', 'fixtures', 'samples', 'image', 'ai overlords.jpg')
      expect(() => validateFilePath(imagePath)).not.toThrow()
    })
  })
})
