import {MetadataPair} from '@src/metadata-extraction'

/**
 * Represents the state of a cloud file in the upload lifecycle
 */
export enum CloudFileState {
  COMPLETED = 'completed',
  RESERVED = 'reserved',
  TRANSFERRED = 'transferred',
}

/**
 * Type definition for cloud file attributes returned from the API
 */
export type CloudFileType = {
  artists?: Record<string, unknown>[]
  artwork_md5?: null | string
  artwork_url?: null | string
  asset?: null | string
  bucket_name?: string
  bucket_uuid?: string
  content_type?: null | string
  created_at: string
  data_source_id?: null | number
  date_aquired_at?: null | string
  deletable?: boolean
  delicate?: boolean
  description?: null | string
  duration?: null | number
  ext_id?: null | string
  filesize?: null | number
  folder_id?: null | number
  folder_uuid?: null | string
  info_url?: null | string
  last_viewed_at?: null | string
  md5: string
  metadata?: MetadataPair[]
  name?: null | string
  nsfw?: boolean
  num_plays?: null | number
  peepy?: boolean
  rating?: null | number
  release_id?: null | number
  release_pos?: null | number
  releases?: Record<string, unknown>[]
  secured?: boolean
  shared?: boolean
  state: CloudFileState
  updated_at: string
  url?: null | string
  user_uuid?: string
  uuid: string
  year?: null | number
}
