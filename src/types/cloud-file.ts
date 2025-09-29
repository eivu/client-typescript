// STATE_RESERVED = :reserved
// STATE_TRANSFERED = :transfered
// STATE_COMPLETED = :completed


type State = 'completed' | 'reserved' | 'transfered'
type CloudFileType = {
  uuid: string
  md5: string
  state: State
  state_history: State[]
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
  

// attribute  :md5, Types::String
// attribute  :state, Types::String
// attribute  :state_history, Types::Strict::Array.of(Types::Strict::Symbol).default([])
// attribute? :artists, Types::Nominal::Hash.optional
// attribute? :releases, Types::Nominal::Hash.optional
// attribute? :user_uuid, Types::String
// attribute? :folder_uuid, Types::String.optional
// attribute? :bucket_uuid, Types::String
// attribute? :bucket_name, Types::String
// attribute  :created_at, Types::JSON::DateTime
// attribute  :updated_at, Types::JSON::DateTime
// attribute? :last_viewed_at, Types::JSON::DateTime.optional
// attribute? :name, Types::String.optional
// attribute? :asset, Types::String.optional
// attribute? :content_type, Types::String.optional
// attribute? :filesize, Types::Coercible::Integer.optional
// attribute? :description, Types::String.optional
// attribute? :rating, Types::Coercible::Float.optional
// attribute? :nsfw, Types::Bool.default(false)
// attribute? :secured, Types::Bool.default(false)
// attribute? :peepy, Types::Bool.default(false)
// attribute? :folder_id, Types::Coercible::Integer.optional
// attribute? :ext_id, Types::String.optional
// attribute? :data_source_id, Types::Coercible::Integer.optional
// attribute? :release_id, Types::Coercible::Integer.optional
// attribute? :artwork_md5, Types::Coercible::String.optional
// attribute? :artwork_url, Types::Coercible::String.optional
// attribute? :release_pos, Types::Coercible::Integer.optional
// attribute? :num_plays, Types::Coercible::Integer.optional
// attribute? :year, Types::Coercible::Integer.optional
// attribute? :duration, Types::Coercible::Integer.optional
// attribute? :info_url, Types::String.optional
// attribute? :url, Types::String.optional
// attribute? :metadata, Types::JSON::Array.of(Types::JSON::Hash)
// attribute? :date_aquired_at, Types::JSON::DateTime.optional
// attribute? :deletable, Types::Bool.default(false)
// attribute? :shared, Types::Bool.default(false)
// attribute? :delicate, Types::Bool.default(false)


// import {Artitst} from './artist'
// type State = 'completed' | 'reserved' | 'transfered'

// export class CloudFile {
//   name: string
//   asset: string
//   md5: string
//   contentType: string
//   filesize: number
//   description: string | null
//   rating: number | null
//   nsfw: boolean
//   secured: boolean
//   uploadedAt: string
//   updatedAt: string
//   infoUrl: string | null
//   duration: number
//   extId: string | null
//   dataSourceId: string | null
//   release_id: string | null
//   year: number | null
//   releasePos: number | null
//   numPlays: number
//   state: string
//   lastViewedAt: string | null
//   deletable: boolean
//   dateAquiredAt: string | null
//   shared: boolean
//   bucketUuid: string | null
//   bucketName: string | null
//   userUuid: string
//   folderUuid: string | null
//   artworkUrl: string | null
//   artworkMd5: string | null
//   metadata: Metadatum[]
//   artists: Artist[]
//   releases: Release[]
//   delicate: boolean
//   url: string
// }


