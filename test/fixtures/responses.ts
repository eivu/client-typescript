/* eslint-disable camelcase */
import {type PutObjectCommandOutput} from '@aws-sdk/client-s3'

import {type MetadataPair} from '../../src/metadata-extraction'
import {CloudFileState, CloudFileType} from '../../src/types/cloud-file-type'

export const AI_OVERLORDS_RESERVATION: CloudFileType = {
  artists: [],
  artwork_url: null,
  asset: null,
  bucket_name: 'eivu-test',
  bucket_uuid: '889c685a-de30-4ead-9a96-b3784233e1e8',
  content_type: null,
  created_at: '2025-09-29T23:32:35.951Z',
  data_source_id: null,
  date_aquired_at: null,
  deletable: false,
  delicate: false,
  description: null,
  duration: 0,
  ext_id: null,
  filesize: 0,
  folder_uuid: null,
  info_url: null,
  last_viewed_at: null,
  md5: '7ED971313D1AEA1B6E2BF8AF24BED64A',
  metadata: [],
  name: '7ED971313D1AEA1B6E2BF8AF24BED64A (reserved)',
  nsfw: false,
  num_plays: 0,
  peepy: false,
  rating: null,
  release_pos: null,
  releases: [],
  secured: false,
  shared: true,
  state: CloudFileState.RESERVED,
  updated_at: '2025-09-29T23:32:35.951Z',
  url: 'https://eivu-test.s3.wasabisys.com/image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/',
  user_uuid: '0f703c04-b448-455c-8a26-4edc22bf76dd',
  uuid: '',
  year: null,
}

export const AI_OVERLORDS_S3_RESPONSE: PutObjectCommandOutput = {
  $metadata: {
    attempts: 1,
    cfId: undefined,
    extendedRequestId: 'AGUDJAmNF0dvmxE+gyRYef0Vunb8vN/IVxdSdsNyXA9ZQTaB3YHx6JY64pf5FiNaur0Us8dYnOsF',
    httpStatusCode: 200,
    requestId: '410C550F8648D56A:A',
    totalRetryDelay: 0,
  },
  ChecksumCRC32: 'e0Y0jQ==',
  ChecksumType: 'FULL_OBJECT',
  ETag: '"7ed971313d1aea1b6e2bf8af24bed64a"',
}

export const AI_OVERLORDS_TRANSFER: CloudFileType = {
  ...AI_OVERLORDS_RESERVATION,
  asset: 'ai_overlords.jpg',
  content_type: 'image/jpeg',
  filesize: 66_034,
  state: CloudFileState.TRANSFERRED,
}

export const AI_OVERLORDS_COMPLETE: CloudFileType = {
  ...AI_OVERLORDS_TRANSFER,
  metadata: [
    {
      id: 249_544,
      type: 'original_local_path_to_file',
      value: 'test/fixtures/samples/image/ai overlords.jpg',
    },
  ],
  name: 'ai_overlords.jpg',
  nsfw: false,
  secured: false,
  state: CloudFileState.COMPLETED,
  url: 'https://eivu-test.s3.wasabisys.com/image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/ai_overlords.jpg',
}

export const DREDD_RESERVATION: CloudFileType = {
  artists: [],
  artwork_url: null,
  asset: null,
  bucket_name: 'eivu-test',
  bucket_uuid: '889c685a-de30-4ead-9a96-b3784233e1e8',
  content_type: 'text/plain',
  created_at: '2024-09-07T21:11:48.722Z',
  data_source_id: null,
  date_aquired_at: null,
  deletable: false,
  delicate: false,
  description: null,
  duration: null,
  ext_id: null,
  filesize: 0,
  folder_uuid: null,
  info_url: null,
  last_viewed_at: null,
  md5: 'D3497D5E97E43933407237FF2CA46DCA',
  metadata: [],
  name: 'D3497D5E97E43933407237FF2CA46DCA (reserved)',
  nsfw: false,
  num_plays: 0,
  peepy: false,
  rating: null,
  release_pos: null,
  releases: [],
  secured: false,
  shared: true,
  state: CloudFileState.RESERVED,
  updated_at: '2024-09-11T04:02:02.833Z',
  url: 'https://eivu-test.s3.wasabisys.com/archive/D3/49/7D/5E/97/E4/39/33/40/72/37/FF/2C/A4/6D/CA/Dredd.txt',
  user_uuid: '0f703c04-b448-455c-8a26-4edc22bf76dd',
  uuid: '',
  year: null,
}

export const DREDD_S3_RESPONSE: PutObjectCommandOutput = {
  $metadata: {
    attempts: 1,
    cfId: undefined,
    extendedRequestId: 'AGUDJAmNF0dvmxE+gyRYef0Vunb8vN/IVxdSdsNyXA9ZQTaB3YHx6JY64pf5FiNaur0Us8dYnOsF',
    httpStatusCode: 200,
    requestId: '410C550F8648D56A:A',
    totalRetryDelay: 0,
  },
  ChecksumCRC32: 'e0Y0jQ==',
  ChecksumType: 'FULL_OBJECT',
  ETag: '"d3497d5e97e43933407237ff2ca46dca"',
}

export const DREDD_TRANSFER: CloudFileType = {
  ...DREDD_RESERVATION,
  asset: 'Dredd.txt',
  content_type: 'text/plain',
  filesize: 13,
  state: CloudFileState.TRANSFERRED,
}

export const DREDD_COMPLETE: CloudFileType = {
  ...DREDD_TRANSFER,
  metadata: [
    {
      id: 1896,
      type: 'original_local_path_to_file',
      value:
        '/Users/jinx/projects/eivu/client-ruby/spec/fixtures/samples/other/`Cowboy Bebop - Asteroid Blues ((anime)) ((script)) ((all time best)).txt',
    },
    {
      id: 1620,
      type: 'original_local_path_to_file',
      value:
        '/Users/jinx/projects/brashear_eivu/client-ruby/spec/fixtures/samples/other/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt',
    },
    {
      id: 1895,
      type: 'original_local_path_to_file',
      value:
        '/Users/jinx/projects/eivu/client-ruby/spec/fixtures/samples/other/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt',
    },
    {
      id: 1615,
      type: 'original_local_path_to_file',
      value:
        '/Users/jinx/projects/brashear_eivu/client-ruby/spec/fixtures/samples/other/`Cowboy Bebop - Asteroid Blues ((anime)) ((script)) ((all time best)).txt',
    },
    {id: 1617, type: 'performer', value: 'lena headey'},
    {id: 1616, type: 'performer', value: 'karl urban'},
    {id: 1618, type: 'studio', value: 'dna films'},
    {id: 1619, type: 'tag', value: 'comic book movie'},
    {id: 1611, type: 'tag', value: 'anime'},
    {id: 1614, type: 'tag', value: 'all time best'},
    {id: 1613, type: 'tag', value: 'script'},
  ],
}

export const DREDD_DATA_PROFILE = {
  artists: [],
  artwork_md5: null,
  duration: null,
  metadata_list: [
    {performer: 'karl urban'},
    {performer: 'lena headey'},
    {studio: 'dna films'},
    {tag: 'comic book movie'},
    {tag: 'script'},
    {
      original_local_path_to_file:
        'test/fixtures/samples/text/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt',
    },
  ],
  name: null,
  path_to_file:
    'test/fixtures/samples/text/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt',
  rating: 4.75,
  release: {
    artwork_md5: null,
    bundle_pos: null,
    name: null,
    position: null,
    primary_artist_name: null,
    year: 2012,
  },
  year: 2012,
}

export const FROG_PRINCE_COVER_ART_RESERVATION: CloudFileType = {
  artists: [],
  artwork_url: null,
  asset: null,
  bucket_name: 'eivu',
  bucket_uuid: '889c685a-de30-4ead-9a96-b3784233e1e8',
  content_type: 'image/jpeg',
  created_at: '2025-10-17T21:47:27.773Z',
  data_source_id: null,
  date_aquired_at: null,
  deletable: false,
  delicate: false,
  description: null,
  duration: null,
  ext_id: null,
  filesize: 125_446,
  folder_uuid: null,
  info_url: null,
  last_viewed_at: null,
  md5: 'F5B5DD551BD75A524BE57C0A5F1675A8',
  metadata: [],
  name: 'F5B5DD551BD75A524BE57C0A5F1675A8 (reserved)',
  nsfw: false,
  num_plays: 0,
  peepy: false,
  rating: null,
  release_pos: null,
  releases: [],
  secured: false,
  shared: true,
  state: CloudFileState.RESERVED,
  updated_at: '2025-10-17T21:47:27.773Z',
  url: 'https://eivu.s3.wasabisys.com/image/F5/B5/DD/55/1B/D7/5A/52/4B/E5/7C/0A/5F/16/75/A8/',
  user_uuid: '453bce24-395f-4564-88ee-bde6cc36fbdf',
  uuid: '',
  year: null,
}

export const FROG_PRINCE_COVER_ART_TRANSFER: CloudFileType = {
  ...FROG_PRINCE_COVER_ART_RESERVATION,
  asset: 'coverart-extractedByEivu.jpeg',
  content_type: 'image/jpeg',
  filesize: 125_446,
  state: CloudFileState.TRANSFERRED,
  updated_at: '2025-10-18T03:23:26.993Z',
}

export const FROG_PRINCE_COVER_ART_METADATA: MetadataPair[] = [
  {
    'id3:artist': 'The Brothers Grimm',
  },
  {
    'id3:album': 'The Frog Prince',
  },
  {
    'id3:genre': 'Audiobook Sample',
  },
  {
    'id3:track_nr': 0,
  },
  {
    'id3:disc_nr': 0,
  },
]

export const FROG_PRINCE_COVER_ART_DATA_PROFILE = {
  artists: [
    {
      name: 'The Brothers Grimm',
    },
  ],
  artwork_md5: null,
  duration: null,
  metadata_list: FROG_PRINCE_COVER_ART_METADATA,
  name: 'Cover Art for The Brothers Grimm - The Frog Prince',
  path_to_file:
    '/private/var/folders/hv/_ybbgb_s3kbd2vwkrkgvl04w0000gn/T/coverart-extractedByEivu--50540-I308Z07whFu4-.jpeg',
  rating: null,
  release: {
    artwork_md5: null,
    bundle_pos: null,
    name: 'The Frog Prince',
    position: null,
    primary_artist_name: null,
    year: 1811,
  },
  year: 1811,
}

export const FROG_PRINCE_COVER_ART_COMPLETE: CloudFileType = {
  ...FROG_PRINCE_COVER_ART_TRANSFER,
  metadata: FROG_PRINCE_COVER_ART_DATA_PROFILE.metadata_list,
  name: 'Cover Art for The Brothers Grimm - The Frog Prince',
  state: CloudFileState.COMPLETED,
}

export const FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO: MetadataPair[] = [
  {'acoustid:duration': 45.24},
  {
    'acoustid:fingerprint':
      'AQABWEo0sVIWBY_EKsIWNQ8QP5B_pAppPBitmHh4uMqC80KWh0dzT8dzHk0kR0OdCU8yHOdZnDH040obOHk2gl5y3MEfgUkoNDueNwV8COCZon4xMkuO-CROEn0e3PiOL0kHJ8Fz5MfzI7nSYXlCPIyPJ9xxP5jUPUET5zk-kUZ86Cf0CE-ZIf4jlIm8IcyOMxmmWINmIdTBJHlwHi1XYU_ECR-RkxIO9TEiJfkmCZdyPNHhPfjxsAjzEEqiC3G6InwYwj_OHroy5MlRHn6NB3-OblSOKU1SGs8dZA1UCkP4C1OegteC-Xj04zzaJOzxIfnsIOSPx_iG54LrJcXVJU0x50dyI7uOTTx-DX-DPz5KH0kSC1Gp4Tqa8GjX40vwoinloWZzPNmRPOuQRs_wY_mFLReeHXUWHc1F4yfyU9CSnEco6jke4zr8D_kPJUfY5tiSw3GVEXtwHp6SLEdaPUiU_PiJo5-OJsqi5MIsSdbx1EGfJcfR4-KLPEjYC2-J5spRPTEaa5TQBffxRBfSHfoYC3PXHHweROuLvBfUx0iTiAoeF1cO7xHOZQx-3EuF5EeYNCTaKAuu4I9xmfAVPMd5FU60lEb-QDzxHB8fhHkx_cLFq8jcVAqY8AlFVP6hKZcMM8lRi0K-nGjuoLyCR8OTNDgoJfjxLkeP5kTyCVmpH2_CoJkSyUF1JTIeBdoOR9_RRtrxPTgLn-CPI_kRXYvwtB0m_Wh6SfC64ML8o8l1JFOO60ezJEWfFP-I9PSIZ9aRn3iUaEF1Ds2f40d8bcETLulx7dhZnIGf4dFxxHlyImEu_OCPZpOjwM_R58MW5zSeR8gl5Gi2HPWPZ4ef42diXBc-pRoHLdayhPjRH3ew58elg1r2ED0URR_2Hb6CK8fjraCWGw9-hE-ERDl3zFmOZtfRfxPO5MN9Ck9wJD_OVCL0KG8QUgmlDJZxo1divPhzzLmM60i0NJElhMmTKejlYA-OpBPCJJFz9Dz6LJGI5riYLMN1fDnCXDnCN8eeC4uRXMhFR4SbHsdTHY8VJNUPAAygRAGiBAIAEAAZIYRoQgSxwhngCDCCKuARBYwoA4VggBCgFBCCCMQUAwBBJgAxAAktADGGUG2YlQoIggjBSJkgFBFCGAo8AAoYYoUQjCEACLFASSSYEgAYZAwjGAEqBDUGQKAccIIgBAxAmAghlMAEYCqIUoA5dQgBSAAmAlNGEUaAUAAKIhQQgigkhCHSEaWBZAA5AJSBHCCBASEACGIEMcoxhCgggEMQABJMASUIAkNIRhUBBggIoFCGAEegAQwYAQwgxAEBhGHWO4QQEcZBoJADBADg0BGKAUSMAVIgQCAighCDtBGEOCEgckYJxYwQBAgkIASCCWAFJIIAxIgwBAkoLFIMSaAYMIAbiCJwQgE',
  },
  {'eivu:duration': 45.24},
  {'eivu:name': 'Paragraph #1'},
  {'eivu:release_pos': '1'},
  {'eivu:year': 1811},
  {'eivu:release_name': 'The Frog Prince'},
  {'eivu:artist_name': 'The Brothers Grimm'},
  {'eivu:album_artist': 'brothers grimm'},
  {'id3:title': 'Paragraph #1'},
  {'id3:artist': 'The Brothers Grimm'},
  {'id3:album': 'The Frog Prince'},
  {'id3:genre': 'Audiobook Sample'},
  {
    'id3:comments': 'First paragraph of the story The Frog Prince by The Brothers Grimm',
  },
  {'id3:track_nr': '1'},
  {'id3:band': 'brothers grimm'},
  {'id3:year': 1811},
  {
    'id3:lyrics':
      'One fine evening a young princess put on her bonnet and clogs, and went out to take a walk by herself in a wood; and when she came to a cool spring of water, that rose in the midst of it, she sat herself down to rest a while. Now she had a golden ball in her hand, which was her favourite plaything; and she was always tossing it up into the air, and catching it again as it fell. After a time she threw it up so high that she missed catching it as it fell; and the ball bounded away, and rolled along upon the ground, till at last it fell down into the spring. The princess looked into the spring after her ball, but it was very deep, so deep that she could not see the bottom of it. Then she began to bewail her loss, and said, ’Alas! if I could only get my ball again, I would give all my fine clothes and jewels, and everything that I have in the world.',
  },
]

export const FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO_WITH_COVER_ART: MetadataPair[] = [
  ...FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO,
  {
    'eivu:artwork_md5': 'F5B5DD551BD75A524BE57C0A5F1675A8',
  },
]

export const FROG_PRINCE_PARAGRAPH_1_FINGERPRINT =
  'AQABWEo0sVIWBY_EKsIWNQ8QP5B_pAppPBitmHh4uMqC80KWh0dzT8dzHk0kR0OdCU8yHOdZnDH040obOHk2gl5y3MEfgUkoNDueNwV8COCZon4xMkuO-CROEn0e3PiOL0kHJ8Fz5MfzI7nSYXlCPIyPJ9xxP5jUPUET5zk-kUZ86Cf0CE-ZIf4jlIm8IcyOMxmmWINmIdTBJHlwHi1XYU_ECR-RkxIO9TEiJfkmCZdyPNHhPfjxsAjzEEqiC3G6InwYwj_OHroy5MlRHn6NB3-OblSOKU1SGs8dZA1UCkP4C1OegteC-Xj04zzaJOzxIfnsIOSPx_iG54LrJcXVJU0x50dyI7uOTTx-DX-DPz5KH0kSC1Gp4Tqa8GjX40vwoinloWZzPNmRPOuQRs_wY_mFLReeHXUWHc1F4yfyU9CSnEco6jke4zr8D_kPJUfY5tiSw3GVEXtwHp6SLEdaPUiU_PiJo5-OJsqi5MIsSdbx1EGfJcfR4-KLPEjYC2-J5spRPTEaa5TQBffxRBfSHfoYC3PXHHweROuLvBfUx0iTiAoeF1cO7xHOZQx-3EuF5EeYNCTaKAuu4I9xmfAVPMd5FU60lEb-QDzxHB8fhHkx_cLFq8jcVAqY8AlFVP6hKZcMM8lRi0K-nGjuoLyCR8OTNDgoJfjxLkeP5kTyCVmpH2_CoJkSyUF1JTIeBdoOR9_RRtrxPTgLn-CPI_kRXYvwtB0m_Wh6SfC64ML8o8l1JFOO60ezJEWfFP-I9PSIZ9aRn3iUaEF1Ds2f40d8bcETLulx7dhZnIGf4dFxxHlyImEu_OCPZpOjwM_R58MW5zSeR8gl5Gi2HPWPZ4ef42diXBc-pRoHLdayhPjRH3ew58elg1r2ED0URR_2Hb6CK8fjraCWGw9-hE-ERDl3zFmOZtfRfxPO5MN9Ck9wJD_OVCL0KG8QUgmlDJZxo1divPhzzLmM60i0NJElhMmTKejlYA-OpBPCJJFz9Dz6LJGI5riYLMN1fDnCXDnCN8eeC4uRXMhFR4SbHsdTHY8VJNUPAAygRAGiBAIAEAAZIYRoQgSxwhngCDCCKuARBYwoA4VggBCgFBCCCMQUAwBBJgAxAAktADGGUG2YlQoIggjBSJkgFBFCGAo8AAoYYoUQjCEACLFASSSYEgAYZAwjGAEqBDUGQKAccIIgBAxAmAghlMAEYCqIUoA5dQgBSAAmAlNGEUaAUAAKIhQQgigkhCHSEaWBZAA5AJSBHCCBASEACGIEMcoxhCgggEMQABJMASUIAkNIRhUBBggIoFCGAEegAQwYAQwgxAEBhGHWO4QQEcZBoJADBADg0BGKAUSMAVIgQCAighCDtBGEOCEgckYJxYwQBAgkIASCCWAFJIIAxIgwBAkoLFIMSaAYMIAbiCJwQgE'

export const FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE = {
  artists: [{name: 'The Brothers Grimm'}],
  artwork_md5: 'F5B5DD551BD75A524BE57C0A5F1675A8',
  duration: 45.24,
  metadata_list: FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO,
  name: 'Paragraph #1',
  path_to_file: 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3',
  rating: null,
  release: {
    artwork_md5: 'F5B5DD551BD75A524BE57C0A5F1675A8',
    bundle_pos: null,
    name: 'The Frog Prince',
    position: 1,
    primary_artist_name: 'brothers grimm',
    year: 1811,
  },
  year: 1811,
}

export const FROG_PRINCE_PARAGRAPH_1_RESERVATION: CloudFileType = {
  artists: [],
  artwork_url: null,
  asset: null,
  bucket_name: 'eivu-test',
  bucket_uuid: '889c685a-de30-4ead-9a96-b3784233e1e8',
  content_type: null,
  created_at: '2025-09-29T23:32:35.951Z',
  data_source_id: null,
  date_aquired_at: null,
  deletable: false,
  delicate: false,
  description: null,
  duration: 0,
  ext_id: null,
  filesize: 0,
  folder_uuid: null,
  info_url: null,
  last_viewed_at: null,
  md5: 'BC55A3994827BF6389BAC9EE6B62FC64',
  metadata: [],
  name: 'BC55A3994827BF6389BAC9EE6B62FC64 (reserved)',
  nsfw: false,
  num_plays: 0,
  peepy: false,
  rating: null,
  release_pos: null,
  releases: [],
  secured: false,
  shared: true,
  state: CloudFileState.RESERVED,
  updated_at: '2025-09-29T23:32:35.951Z',
  url: 'https://eivu-test.s3.wasabisys.com/image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/',
  user_uuid: '0f703c04-b448-455c-8a26-4edc22bf76dd',
  uuid: '',
  year: null,
}

export const FROG_PRINCE_PARAGRAPH_1_TRANSFER: CloudFileType = {
  ...FROG_PRINCE_PARAGRAPH_1_RESERVATION,
  asset: 'paragraph1.mp3',
  content_type: 'audio/mpeg',
  filesize: 781_052,
  state: CloudFileState.TRANSFERRED,
}

export const FROG_PRINCE_PARAGRAPH_1_COMPLETE: CloudFileType = {
  ...FROG_PRINCE_PARAGRAPH_1_TRANSFER,
  artwork_md5: FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE.artwork_md5,
  metadata: FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO,
  name: FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE.name,
  rating: null,
  state: CloudFileState.COMPLETED,
}

export const MOV_BBB_RESERVATION: CloudFileType = {
  ...AI_OVERLORDS_RESERVATION,
  md5: '198918F40ECC7CAB0FC4231ADAF67C96',
  name: '198918f40ecc7cab0fc4231adaf67c96 (reserved)',
  url: 'https://eivu-test.s3.wasabisys.com/video/19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96/',
}

export const MOV_BBB_TRANSFER: CloudFileType = {
  ...MOV_BBB_RESERVATION,
  asset: 'mov_bbb.mp4',
  content_type: 'video/mp4',
  filesize: 19_952_000,
  name: 'mov_bbb.mp4',
  state: CloudFileState.TRANSFERRED,
}

// Metadata for client upload test - filters out eivu: prefixed fields and adds original_local_path_to_file
export const FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO_FOR_UPLOAD: MetadataPair[] = [
  ...FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO.filter(
    (pair) => !Object.keys(pair)[0].startsWith('eivu:'),
  ),
  {original_local_path_to_file: 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'},
]

// Data profile for client upload test - uses metadata without eivu: prefixed fields
export const FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE_FOR_UPLOAD = {
  artists: [{name: 'The Brothers Grimm'}],
  artwork_md5: 'F5B5DD551BD75A524BE57C0A5F1675A8',
  duration: 45.24,
  metadata_list: FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO_FOR_UPLOAD,
  name: 'Paragraph #1',
  path_to_file: 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3',
  rating: null,
  release: {
    artwork_md5: 'F5B5DD551BD75A524BE57C0A5F1675A8',
    bundle_pos: null,
    name: 'The Frog Prince',
    position: 1,
    primary_artist_name: 'brothers grimm',
    year: 1811,
  },
  year: 1811,
}
