const COMIC_ARCHIVE_SUFFIXES = ['.cbr', '.cbz'] as const

export function isComicArchivePath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return COMIC_ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

export class IncorrectFileTypeError extends Error {
  constructor(public readonly filePath: string) {
    const expected = COMIC_ARCHIVE_SUFFIXES.join(' or ')
    super(`Incorrect file type: ${filePath}. Expected a path ending in ${expected}.`)
    this.name = 'IncorrectFileTypeError'
  }
}
