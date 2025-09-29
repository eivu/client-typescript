export enum CloudFileState {
  COMPLETED = 'completed',
  RESERVED = 'reserved',
  TRANSFERED = 'transfered',
}

export type CloudFileType = {
  uuid: string
  md5: string
  state: CloudFileState
  state_history: CloudFileState[]
  artists?: Record<string, unknown>
  releases?: Record<string, unknown>
  user_uuid?: string
  folder_uuid?: string | null
  bucket_uuid?: string
  bucket_name?: string
  created_at: string
  updated_at: string
  last_viewed_at?: string | null
  name?: string | null
  asset?: string | null
  content_type?: string | null
  filesize?: number | null
  description?: string | null
  rating?: number | null
  nsfw?: boolean
  secured?: boolean
  peepy?: boolean
  folder_id?: number | null
  ext_id?: string | null
  data_source_id?: number | null
  release_id?: number | null
  artwork_md5?: string | null
  artwork_url?: string | null
  release_pos?: number | null
  num_plays?: number | null
  year?: number | null
  duration?: number | null
  info_url?: string | null
  url?: string | null
  metadata?: Record<string, unknown>[]
  date_aquired_at?: string | null
  deletable?: boolean
  shared?: boolean
  delicate?: boolean
}
