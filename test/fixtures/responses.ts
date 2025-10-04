/* eslint-disable camelcase */
import {type PutObjectCommandOutput} from '@aws-sdk/client-s3'

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
  releases: {},
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

export const MOV_BBB_RESERVATION: CloudFileType = {
  ...AI_OVERLORDS_RESERVATION,
  md5: '198918F40ECC7CAB0FC4231ADAF67C96',
  name: '198918f40ecc7cab0fc4231adaf67c96 (reserved)',
  url: 'https://eivu-test.s3.wasabisys.com/video/19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96/',
}

export const DREDD_DATA_PROFILE = {
  artists: [{name: null}],
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
    year: '2012',
  },
  year: 2012,
}
