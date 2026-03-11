import YAML from 'yaml'

/**
 * Validates that a raw YAML string meets the minimum requirements for an .eivu.yml file.
 *
 * Checks (in order):
 *   1. A line starting with `name:` (required top-level key)
 *   2. A line starting with `metadata_list:` (required top-level key)
 *   3. Valid YAML syntax (parseable)
 *
 * @param yaml - Raw YAML string to validate
 * @returns null if valid, or an error message string describing the first validation failure
 */
export function validateEivuYaml(yaml: string): null | string {
  const lines = yaml.split('\n')

  if (!lines.some((line) => /^name:/.test(line))) {
    return 'Missing required top-level key: name'
  }

  if (!lines.some((line) => /^metadata_list:/.test(line))) {
    return 'Missing required top-level key: metadata_list'
  }

  try {
    YAML.parse(yaml)
  } catch (error) {
    return `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`
  }

  return null
}
