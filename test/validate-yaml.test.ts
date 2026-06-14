import {describe, expect, it} from '@jest/globals'
import {sanitizeYamlValues, summarizeIssues, validateEivuYaml, type ValidationCode} from '@src/ai/validate-yaml'
import * as fs from 'node:fs'
import path from 'node:path'

const VALID_FIXTURES_DIR = path.join('test', 'fixtures', 'eivu_yml_files', 'valid')
const INVALID_FIXTURES_DIR = path.join('test', 'fixtures', 'eivu_yml_files', 'invalid')

const MINIMAL_VALID_YAML = `name: Test Book
year: 2024
metadata_list:
  - writer: Test Author
  - ai:rating: 4.0
  - ai:rating_reasoning: Strong critical reception.`

/** Extracts the validation codes from a failed result; throws if it succeeded. */
function codesFor(yaml: string): ValidationCode[] {
  const result = validateEivuYaml(yaml)
  if (!('errors' in result)) {
    throw new Error(`expected validation failure for:\n${yaml}`)
  }

  return result.errors.map((i) => i.code)
}

describe('Validate YAML', () => {
  describe('sanitizeYamlValues', () => {
    it('quotes values containing space-hash (comment indicator)', () => {
      const input = `name: Test
collects: Madrox (2004) #1-5
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain('collects: "Madrox (2004) #1-5"')
    })

    it('quotes values containing colon-space (nested mapping)', () => {
      const input = `name: Test
description: Limit the number of entries (default: 10)
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain('description: "Limit the number of entries (default: 10)"')
    })

    it('quotes values starting with [', () => {
      const input = `name: Test
note: [see issue tracker for details
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain('note: "[see issue tracker for details"')
    })

    it('quotes values starting with {', () => {
      const input = `name: Test
note: {incomplete mapping
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain('note: "{incomplete mapping"')
    })

    it('quotes metadata_list values that need quoting', () => {
      const input = `name: Test
metadata_list:
  - tag: Eisner Award Winner: Best Series #1`
      const result = sanitizeYamlValues(input)
      expect(result).toContain('  - tag: "Eisner Award Winner: Best Series #1"')
    })

    it('does NOT modify already double-quoted values', () => {
      const input = `name: Test
collects: "Madrox (2004) #1-5"
metadata_list:
  - writer: Someone`
      expect(sanitizeYamlValues(input)).toBe(input)
    })

    it('does NOT modify already single-quoted values', () => {
      const input = `name: Test
collects: 'Madrox (2004) #1-5'
metadata_list:
  - writer: Someone`
      expect(sanitizeYamlValues(input)).toBe(input)
    })

    it('does NOT modify block scalar content', () => {
      const input = `name: Test
description: |
  This has a colon: in it and a #hash
  Another line with special: chars
metadata_list:
  - writer: Someone`
      expect(sanitizeYamlValues(input)).toBe(input)
    })

    it('does NOT modify safe values', () => {
      const input = `name: Test Book
year: 2024
metadata_list:
  - writer: Kurt Busiek
  - character: Samaritan (Asa Martin)
  - genre: Superhero
  - ai:rating: 4.5`
      expect(sanitizeYamlValues(input)).toBe(input)
    })

    it('does NOT modify lines without key-value pairs', () => {
      const input = `name: Test
metadata_list:
  - plain list item
  - another item`
      expect(sanitizeYamlValues(input)).toBe(input)
    })

    it('escapes existing double quotes when quoting', () => {
      const input = `name: Test
note: He said "hello" to everyone: welcome
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain(String.raw`note: "He said \"hello\" to everyone: welcome"`)
    })

    it('escapes existing backslashes when quoting', () => {
      const input = `name: Test
note: path\\to\\file has a #comment
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain(String.raw`note: "path\\to\\file has a #comment"`)
    })

    it('handles keys containing colons (like ai:rating_reasoning)', () => {
      const input = `name: Test
metadata_list:
  - ai:rating_reasoning: Strong rating: 4.5 based on reviews #1 through #10`
      const result = sanitizeYamlValues(input)
      expect(result).toContain(
        '  - ai:rating_reasoning: "Strong rating: 4.5 based on reviews #1 through #10"',
      )
    })

    it('resumes normal processing after block scalar ends', () => {
      const input = `name: Test
description: |
  Block content here
collects: Batman (2016) #1-5
metadata_list:
  - writer: Someone`
      const result = sanitizeYamlValues(input)
      expect(result).toContain('collects: "Batman (2016) #1-5"')
      expect(result).toContain('  Block content here')
    })

    it('leaves valid fixture files unchanged or still valid', () => {
      const files = fs.readdirSync(VALID_FIXTURES_DIR)
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(VALID_FIXTURES_DIR, file), 'utf8')
        const sanitized = sanitizeYamlValues(content)
        expect(sanitized).toBe(content)
      }
    })
  })

  describe('validateEivuYaml — successes', () => {
    it('returns sanitizedYaml for minimal valid YAML', () => {
      const result = validateEivuYaml(MINIMAL_VALID_YAML)
      expect(result).toEqual({sanitizedYaml: MINIMAL_VALID_YAML})
    })

    it('accepts all production-shape fixtures', () => {
      const files = fs.readdirSync(VALID_FIXTURES_DIR)
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(VALID_FIXTURES_DIR, file), 'utf8')
        const result = validateEivuYaml(content)
        expect(result).toHaveProperty('sanitizedYaml')
      }
    })

    it('accepts ai:rating without ai:rating_reasoning when rating is absent entirely', () => {
      const yaml = `name: Test
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toHaveProperty('sanitizedYaml')
    })

    it('accepts a block scalar (|) for ai:rating_reasoning', () => {
      const yaml = `name: Test
metadata_list:
  - ai:rating: 4.5
  - ai:rating_reasoning: |
      Multi-line block scalar reasoning.

      Including a second paragraph.`
      expect(validateEivuYaml(yaml)).toHaveProperty('sanitizedYaml')
    })

    it('accepts a quoted numeric ai:rating ("4.5")', () => {
      const yaml = `name: Test
metadata_list:
  - ai:rating: "4.5"
  - ai:rating_reasoning: Reasoning text.`
      expect(validateEivuYaml(yaml)).toHaveProperty('sanitizedYaml')
    })

    it('accepts every half-step rating from 0 to 5', () => {
      for (let rating = 0; rating <= 5; rating += 0.5) {
        const yaml = `name: Test
metadata_list:
  - ai:rating: ${rating}
  - ai:rating_reasoning: text`
        expect(validateEivuYaml(yaml)).toHaveProperty('sanitizedYaml')
      }
    })

    it('accepts YAML with ai:engine and ai:skill_version present (postprocess rewrites them)', () => {
      const yaml = `name: Test
metadata_list:
  - writer: Someone
  - ai:rating: 4.0
  - ai:rating_reasoning: text
  - ai:skill_version: 1.0.0
  - ai:engine: claude-opus-4-6`
      expect(validateEivuYaml(yaml)).toHaveProperty('sanitizedYaml')
    })

    it('accepts YAML with no ai:engine or ai:skill_version (postprocess inserts them)', () => {
      const yaml = `name: Test
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toHaveProperty('sanitizedYaml')
    })

    it('runs sanitization before validation so YAML with #-containing values passes', () => {
      const yaml = `name: Test
collects: Batman (2016) #1-5
metadata_list:
  - writer: Someone`
      const result = validateEivuYaml(yaml)
      expect(result).toHaveProperty('sanitizedYaml')
      if ('sanitizedYaml' in result) {
        expect(result.sanitizedYaml).toContain('collects: "Batman (2016) #1-5"')
      }
    })
  })

  describe('validateEivuYaml — failure codes', () => {
    it('missing_name when top-level name: is absent', () => {
      expect(codesFor(`year: 2024
metadata_list:
  - writer: Someone`)).toEqual(['missing_name'])
    })

    it('missing_name when name: is indented (not top-level)', () => {
      expect(codesFor(`metadata:
  name: Nested Name
metadata_list:
  - writer: Someone`)).toEqual(['missing_name'])
    })

    it('name_invalid_type when name is a non-string', () => {
      expect(codesFor(`name: 42
metadata_list:
  - writer: Someone`)).toEqual(['name_invalid_type'])
    })

    it('name_invalid_type when name is an empty string', () => {
      const yaml = `name: ""
metadata_list:
  - writer: Someone`
      expect(codesFor(yaml)).toEqual(['name_invalid_type'])
    })

    it('missing_metadata_list when metadata_list: is absent', () => {
      expect(codesFor(`name: Test Book
year: 2024`)).toEqual(['missing_metadata_list'])
    })

    it('metadata_list_invalid_type when metadata_list is a string', () => {
      const yaml = `name: Test
metadata_list: "should be an array"`
      expect(codesFor(yaml)).toEqual(['metadata_list_invalid_type'])
    })

    it('non_mapping_item for a string item inside metadata_list', () => {
      const yaml = `name: Test
metadata_list:
  - plain string item`
      expect(codesFor(yaml)).toEqual(['non_mapping_item'])
    })

    it('non_mapping_item for a nested-array item inside metadata_list', () => {
      const yaml = `name: Test
metadata_list:
  - - nested
    - array`
      expect(codesFor(yaml)).toEqual(['non_mapping_item'])
    })

    it('rating_out_of_range when ai:rating exceeds 5', () => {
      expect(codesFor(`name: Test
metadata_list:
  - ai:rating: 6
  - ai:rating_reasoning: text`)).toEqual(['rating_out_of_range'])
    })

    it('rating_out_of_range when ai:rating is negative', () => {
      expect(codesFor(`name: Test
metadata_list:
  - ai:rating: -1
  - ai:rating_reasoning: text`)).toEqual(['rating_out_of_range'])
    })

    it('rating_off_step when ai:rating is not a half-step value', () => {
      expect(codesFor(`name: Test
metadata_list:
  - ai:rating: 2.7
  - ai:rating_reasoning: text`)).toEqual(['rating_off_step'])
    })

    it('rating_invalid_type when ai:rating is a non-numeric string', () => {
      expect(codesFor(`name: Test
metadata_list:
  - ai:rating: not a number
  - ai:rating_reasoning: text`)).toEqual(['rating_invalid_type'])
    })

    it('missing_reasoning when ai:rating is present but ai:rating_reasoning is absent', () => {
      expect(codesFor(`name: Test
metadata_list:
  - ai:rating: 4.0`)).toEqual(['missing_reasoning'])
    })

    it('reasoning_invalid_type when ai:rating_reasoning is empty', () => {
      // An empty value triggers reasoning_invalid_type AND missing_reasoning, since
      // we don't count empty values as a "present" reasoning.
      const codes = codesFor(`name: Test
metadata_list:
  - ai:rating: 4.0
  - ai:rating_reasoning: ""`)
      expect(codes).toContain('reasoning_invalid_type')
      expect(codes).toContain('missing_reasoning')
    })

    it('yaml_syntax_error for unparseable YAML', () => {
      expect(codesFor(`name: Test
metadata_list:
  - writer: Someone
  bad_indent: [unterminated`)).toEqual(['yaml_syntax_error'])
    })

    it('reports both missing_name and missing_metadata_list when YAML parses to a non-mapping', () => {
      expect(codesFor(`- a list at the top level`)).toEqual(['missing_name', 'missing_metadata_list'])
    })

    it('reports both missing_name and missing_metadata_list when YAML is empty', () => {
      expect(codesFor('')).toEqual(['missing_name', 'missing_metadata_list'])
    })

    it('rejects fixture files in the invalid directory', () => {
      const files = fs.readdirSync(INVALID_FIXTURES_DIR).filter((f) => f.endsWith('.yml'))
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(INVALID_FIXTURES_DIR, file), 'utf8')
        expect(validateEivuYaml(content)).toHaveProperty('errors')
      }
    })
  })

  describe('validateEivuYaml — issue shape', () => {
    it('marks every issue retriable=true for Phase 3', () => {
      const result = validateEivuYaml(`name: Test
metadata_list:
  - ai:rating: 6
  - ai:rating_reasoning: text`)
      if (!('errors' in result)) throw new Error('expected failure')
      for (const issue of result.errors) {
        expect(issue.retriable).toBe(true)
      }
    })

    it('preserves rawYaml on failure so callers can save the AI output for debugging', () => {
      const raw = `name: Test
metadata_list:
  - ai:rating: 6
  - ai:rating_reasoning: text`
      const result = validateEivuYaml(raw)
      if (!('errors' in result)) throw new Error('expected failure')
      expect(result.rawYaml).toBe(raw)
    })

    it('emits a path that points at the offending field for rating issues', () => {
      const result = validateEivuYaml(`name: Test
metadata_list:
  - writer: x
  - ai:rating: 6
  - ai:rating_reasoning: text`)
      if (!('errors' in result)) throw new Error('expected failure')
      expect(result.errors[0].path).toBe('metadata_list[1].ai:rating')
    })

    it('summarizeIssues joins messages with "; "', () => {
      const result = validateEivuYaml(`name: Test
metadata_list:
  - ai:rating: 6`)
      if (!('errors' in result)) throw new Error('expected failure')
      const summary = summarizeIssues(result.errors)
      expect(summary).toContain('must be in [0, 5]')
      expect(summary).toContain('missing')
      expect(summary).toContain('; ')
    })
  })
})
