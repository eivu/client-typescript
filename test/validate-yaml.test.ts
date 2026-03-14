import {describe, expect, it} from '@jest/globals'
import {sanitizeYamlValues, validateEivuYaml} from '@src/ai/validate-yaml'
import * as fs from 'node:fs'
import path from 'node:path'

const VALID_FIXTURES_DIR = path.join('test', 'fixtures', 'eivu_yml_files', 'valid')
const INVALID_FIXTURES_DIR = path.join('test', 'fixtures', 'eivu_yml_files', 'invalid')

const MINIMAL_VALID_YAML = `name: Test Book
year: 2024
metadata_list:
  - writer: Test Author`

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
    expect(result).toContain('note: "He said \\"hello\\" to everyone: welcome"')
  })

  it('escapes existing backslashes when quoting', () => {
    const input = `name: Test
note: path\\to\\file has a #comment
metadata_list:
  - writer: Someone`
    const result = sanitizeYamlValues(input)
    expect(result).toContain('note: "path\\\\to\\\\file has a #comment"')
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

describe('validateEivuYaml', () => {
  describe('valid YAML', () => {
    it('returns yaml for minimal valid YAML', () => {
      const result = validateEivuYaml(MINIMAL_VALID_YAML)
      expect(result).toEqual({yaml: MINIMAL_VALID_YAML})
    })

    it('returns yaml for valid fixture files', () => {
      const files = fs.readdirSync(VALID_FIXTURES_DIR)
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(VALID_FIXTURES_DIR, file), 'utf8')
        const result = validateEivuYaml(content)
        expect(result).toHaveProperty('yaml')
      }
    })
  })

  describe('missing name:', () => {
    it('returns error when name: line is absent', () => {
      const yaml = `year: 2024
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toEqual({error: 'Missing required top-level key: name'})
    })

    it('returns error when name: is indented (not top-level)', () => {
      const yaml = `metadata:
  name: Nested Name
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toEqual({error: 'Missing required top-level key: name'})
    })
  })

  describe('missing metadata_list:', () => {
    it('returns error when metadata_list: line is absent', () => {
      const yaml = `name: Test Book
year: 2024
description: A test book`
      expect(validateEivuYaml(yaml)).toEqual({error: 'Missing required top-level key: metadata_list'})
    })

    it('returns error when metadata_list: is indented (not top-level)', () => {
      const yaml = `name: Test Book
nested:
  metadata_list:
    - writer: Someone`
      expect(validateEivuYaml(yaml)).toEqual({error: 'Missing required top-level key: metadata_list'})
    })
  })

  describe('invalid YAML syntax', () => {
    it('returns error for unparseable YAML', () => {
      const yaml = `name: Test
metadata_list:
  - writer: Someone
  bad_indent: [unterminated`
      const result = validateEivuYaml(yaml)
      expect(result).toHaveProperty('error')
      if ('error' in result) {
        expect(result.error).toContain('Invalid YAML')
      }
    })

    it('returns error for YAML with tab indentation issues', () => {
      const yaml = `name: Test
metadata_list:
\t- writer: Someone`
      const result = validateEivuYaml(yaml)
      if ('error' in result) {
        expect(result.error).toContain('Invalid YAML')
      }
    })
  })

  describe('invalid fixture files', () => {
    it('rejects fixture files in the invalid directory', () => {
      const files = fs.readdirSync(INVALID_FIXTURES_DIR).filter((f) => f.endsWith('.yml'))
      expect(files.length).toBeGreaterThan(0)

      for (const file of files) {
        const content = fs.readFileSync(path.join(INVALID_FIXTURES_DIR, file), 'utf8')
        expect(validateEivuYaml(content)).toHaveProperty('error')
      }
    })
  })

  describe('sanitization integration', () => {
    it('sanitizes and returns valid yaml when values contain comment indicators', () => {
      const yaml = `name: Test
collects: Batman (2016) #1-5
metadata_list:
  - writer: Someone`
      const result = validateEivuYaml(yaml)
      expect(result).toHaveProperty('yaml')
      if ('yaml' in result) {
        expect(result.yaml).toContain('collects: "Batman (2016) #1-5"')
      }
    })

    it('sanitizes and returns valid yaml when values contain colon-space', () => {
      const yaml = `name: Test
description: Limit the number of entries (default: 10)
metadata_list:
  - writer: Someone`
      const result = validateEivuYaml(yaml)
      expect(result).toHaveProperty('yaml')
      if ('yaml' in result) {
        expect(result.yaml).toContain('description: "Limit the number of entries (default: 10)"')
      }
    })
  })

  describe('edge cases', () => {
    it('returns error for empty string', () => {
      expect(validateEivuYaml('')).toEqual({error: 'Missing required top-level key: name'})
    })

    it('returns error for prose text that is not YAML', () => {
      const yaml = `- [Active Codename] (Civilian Name)
- [Active Codename]
- Civilian Name`
      expect(validateEivuYaml(yaml)).toEqual({error: 'Missing required top-level key: name'})
    })

    it('accepts name: with various value formats', () => {
      const yaml = `name: "Quoted Title"
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toHaveProperty('yaml')
    })

    it('accepts name: with no trailing space (null value)', () => {
      const yaml = `name:
metadata_list:
  - writer: Someone`
      expect(validateEivuYaml(yaml)).toHaveProperty('yaml')
    })
  })
})
