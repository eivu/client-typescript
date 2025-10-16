import {describe, expect, it} from '@jest/globals'

import {md5AsFolders} from '../src/utils'

describe('md5AsFolders', () => {
  describe('image: ai overlords', () => {
    it('converts an MD5 hash into a folder structure', () => {
      expect(md5AsFolders('7ED971313D1AEA1B6E2BF8AF24BED64A')).toBe('7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A')
    })
  })

  describe('video: big buck bunny', () => {
    it('converts an MD5 hash into a folder structure', () => {
      expect(md5AsFolders('198918F40ECC7CAB0FC4231ADAF67C96')).toBe('19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96')
    })
  })
})
