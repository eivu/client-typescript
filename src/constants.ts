import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Flag to enable/disable active debugging mode
 */
export const ACTIVE_DEBUGGING = true

// Regex constants
export const TAG_REGEX = /\(\((?![psy] )([^)]+)\)\)/g
export const PERFORMER_REGEX = /\(\(p ([^)]+)\)\)/g
export const STUDIO_REGEX = /\(\(s ([^)]+)\)\)/g
export const YEAR_REGEX = /\(\(y ([^)]+)\)\)/g
export const RATING_500_475_REGEX = /^_+/g
export const RATING_425_REGEX = /^`/g

/* eslint-disable perfectionist/sort-enums, @typescript-eslint/no-duplicate-enum-values */
// ID3v2 frame identifiers
export enum V2_FRAMES {
  TALB = 'album',
  TAL = 'album',
  TP1 = 'artist',
  TPE1 = 'artist',
  WAR = 'artist url',
  WOAR = 'artist url',
  TP2 = 'band',
  TPE2 = 'band',
  TBP = 'beats per minute',
  TBPM = 'beats per minute',
  COM = 'comments',
  COMM = 'comments',
  WCM = 'commercial url',
  WCOM = 'commercial url',
  TCP = 'compilation',
  TCMP = 'compilation',
  TCM = 'composer',
  TCOM = 'composer',
  TP3 = 'conductor',
  TPE3 = 'conductor',
  TCR = 'copyright',
  TCOP = 'copyright',
  WCP = 'copyright url',
  WCOP = 'copyright url',
  TDA = 'date',
  TDAT = 'date',
  TPOS = 'disc_nr',
  TPA = 'disc_nr',
  TCO = 'genre',
  TCON = 'genre',
  TEN = 'encoded by',
  TENC = 'encoded by',
  // TSS = 'encoder settings',
  // TSSE = 'encoder settings',
  // TDEN = 'encoding time',
  TOWN = 'file owner',
  TFT = 'file type',
  TFLT = 'file type',
  WAF = 'file url',
  WOAF = 'file url',
  TT1 = 'grouping',
  GRP1 = 'grouping',
  TIT1 = 'grouping',
  // APIC = 'image',
  // PIC = 'image',
  TRC = 'isrc',
  TSRC = 'isrc',
  TKE = 'initial key',
  TKEY = 'initial key',
  TRSN = 'internet radio station name',
  TRSO = 'internet radio station owner',
  WORS = 'internet radio station url',
  TP4 = 'interpreted by',
  TPE4 = 'interpreted by',
  IPL = 'involved people',
  IPLS = 'involved people',
  TIPL = 'involved people',
  TLA = 'language',
  TLAN = 'language',
  TLE = 'length',
  TLEN = 'length',
  TXT = 'lyricist',
  TEXT = 'lyricist',
  ULT = 'lyrics',
  USLT = 'lyrics',
  TMT = 'media',
  TMED = 'media',
  TMOO = 'mood',
  MVNM = 'movement name',
  MVIN = 'movement number',
  MCDI = 'music cd identifier',
  TMCL = 'musician credits',
  XOLY = 'olympus dss',
  TOT = 'original album',
  TOAL = 'original album',
  TOA = 'original artist',
  TOPE = 'original artist',
  TOF = 'original file name',
  TOFN = 'original file name',
  TOL = 'original lyricist',
  TOLY = 'original lyricist',
  XDOR = 'original release time',
  TDOR = 'original release time',
  TOR = 'original release year',
  TORY = 'original release year',
  OWNE = 'ownership',
  WPAY = 'payment url',
  PCS = 'podcast?',
  PCST = 'podcast?',
  TCAT = 'podcast category',
  TDES = 'podcast description',
  TGID = 'podcast id',
  TKWD = 'podcast keywords',
  WFED = 'podcast url',
  POP = 'popularimeter',
  POPM = 'popularimeter',
  // PRIV = 'private',
  TPRO = 'produced notice',
  TPB = 'publisher',
  TPUB = 'publisher',
  WPB = 'publisher url',
  WPUB = 'publisher url',
  TRD = 'recording dates',
  TRDA = 'recording dates',
  // TDRC = 'recording time',
  RVA = 'relative volume adjustment',
  RVA2 = 'relative volume adjustment',
  TDRL = 'release time',
  TSST = 'set subtitle',
  TSI = 'size',
  TSIZ = 'size',
  WAS = 'source url',
  WOAS = 'source url',
  TT3 = 'subtitle',
  TIT3 = 'subtitle',
  SLT = 'syn lyrics',
  SYLT = 'syn lyrics',
  TDTG = 'tagging time',
  USER = 'terms of use',
  TIM = 'time',
  TIME = 'time',
  TT2 = 'title',
  TIT2 = 'title',
  TRK = 'track_nr',
  TRCK = 'track_nr',
  TXX = 'user defined text',
  TXXX = 'user defined text',
  WXX = 'user defined url',
  WXXX = 'user defined url',
  // TDRC = 'year',
  TYE = 'year',
  TYER = 'year',
  ITU = 'iTunesU?',
  ITNU = 'iTunesU?',
}
/* eslint-enable */

/** Prefix used for cover art identification */
export const COVERART_PREFIX = 'coverart-extractedByEivu'
export const COVERART_AUDIO_PREFIX = `${COVERART_PREFIX}-forAudio`
export const COVERART_COMIC_PREFIX = `${COVERART_PREFIX}-forComic`

/**
 * Root directory for temporary files, normalized for cross-platform compatibility
 * Uses the OS-specific temp directory (e.g., /tmp on Linux, /var/folders on macOS, %TEMP% on Windows)
 * Resolves symlinks to ensure compatibility with temp file paths returned by the tmp library
 */
export const TEMP_FOLDER_ROOT = (() => {
  try {
    // Resolve symlinks (e.g., /var/folders -> /private/var/folders on macOS)
    return path.normalize(fs.realpathSync(os.tmpdir()) + path.sep)
  } catch {
    // Fallback to os.tmpdir() if realpathSync fails
    return path.normalize(os.tmpdir() + path.sep)
  }
})()
