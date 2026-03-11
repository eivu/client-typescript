import {describe, expect, it} from '@jest/globals'
import {validateEivuYaml} from '@src/ai/validate-yaml'
import * as fs from 'node:fs'
import path from 'node:path'

const VALID_FIXTURES_DIR = path.join('test', 'fixtures', 'eivu_yml_files', 'valid')
const INVALID_FIXTURES_DIR = path.join('test', 'fixtures', 'eivu_yml_files', 'invalid')

const MINIMAL_VALID_YAML = `name: Test Book
year: 2024
metadata_list:
  - writer: Test Author`

describe('validateEivuYaml', () => {
  describe('valid YAML', () => {
    it('returns null for minimal valid YAML', () => {
      expect(validateEivuYaml(MINIMAL_VALID_YAML)).toBeNull()
    })

    it('returns null for valid fixture files', () => {
      const files = fs.readdirSync(VALID_FIXTURES_DIR)
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(VALID_FIXTURES_DIR, file), 'utf8')
        expect(validateEivuYaml(content)).toBeNull()
      }
    })
  })

  describe('missing name:', () => {
    it('returns error when name: line is absent', () => {
      const yaml = `year: 2024
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toBe('Missing required top-level key: name')
    })

    it('returns error when name: is indented (not top-level)', () => {
      const yaml = `metadata:
  name: Nested Name
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toBe('Missing required top-level key: name')
    })
  })

  describe('missing metadata_list:', () => {
    it('returns error when metadata_list: line is absent', () => {
      const yaml = `name: Test Book
year: 2024
description: A test book`
      expect(validateEivuYaml(yaml)).toBe('Missing required top-level key: metadata_list')
    })

    it('returns error when metadata_list: is indented (not top-level)', () => {
      const yaml = `name: Test Book
nested:
  metadata_list:
    - writer: Someone`
      expect(validateEivuYaml(yaml)).toBe('Missing required top-level key: metadata_list')
    })
  })

  describe('invalid YAML syntax', () => {
    it('returns error for unparseable YAML', () => {
      const yaml = `name: Test
metadata_list:
  - writer: Someone
  bad_indent: [unterminated`
      const result = validateEivuYaml(yaml)
      expect(result).not.toBeNull()
      expect(result).toContain('Invalid YAML')
    })

    it('returns error for YAML with tab indentation issues', () => {
      const yaml = `name: Test
metadata_list:
\t- writer: Someone`
      const result = validateEivuYaml(yaml)
      if (result !== null) {
        expect(result).toContain('Invalid YAML')
      }
    })
  })

  describe('invalid fixture files', () => {
    it('rejects fixture files in the invalid directory', () => {
      const files = fs.readdirSync(INVALID_FIXTURES_DIR).filter((f) => f.endsWith('.yml'))
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(INVALID_FIXTURES_DIR, file), 'utf8')
        expect(validateEivuYaml(content)).not.toBeNull()
      }
    })
  })

  describe('edge cases', () => {
    it('returns error for empty string', () => {
      expect(validateEivuYaml('')).toBe('Missing required top-level key: name')
    })

    it('returns error for prose text that is not YAML', () => {
      const yaml = `- [Active Codename] (Civilian Name)
- [Active Codename]
- Civilian Name`
      expect(validateEivuYaml(yaml)).toBe('Missing required top-level key: name')
    })

    it('accepts name: with various value formats', () => {
      const yaml = `name: "Quoted Title"
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toBeNull()
    })

    it('accepts name: with no trailing space (null value)', () => {
      const yaml = `name:
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toBeNull()
    })
  })
})
