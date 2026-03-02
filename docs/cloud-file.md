# CloudFile

The **CloudFile** class represents a single file in EIVU cloud storage. It holds both local path information (when applicable) and remote attributes from the API, and provides methods to reserve, transfer, complete, and update metadata.

## Overview

- **Location:** `src/cloud-file.ts`
- **Import:** `import { CloudFile } from '@src/cloud-file'`

A CloudFile goes through states: **reserved** → **transferred** → **completed**. You typically don’t construct `CloudFile` directly; you get instances from `CloudFile.fetch`, `CloudFile.reserve`, `CloudFile.fetchOrReserveBy`, or from `Client` upload methods.

## Creating / fetching CloudFiles

### Fetch an existing file by MD5

```ts
const cloudFile = await CloudFile.fetch('MD5_HASH_OF_FILE')
// cloudFile.remoteAttr has server state (state, uuid, asset, content_type, etc.)
```

### Reserve a new slot (then transfer and complete)

```ts
// By local path (MD5 is computed from the file)
const cloudFile = await CloudFile.reserve({
  pathToFile: '/path/to/file.mp3',
  nsfw: false,
  secured: false,
})

// Or by MD5 only
const cloudFile = await CloudFile.reserve({
  md5: 'ALREADY_COMPUTED_MD5',
  nsfw: false,
  secured: false,
})
```

### Fetch or reserve (reserve if new, fetch if already exists)

```ts
const cloudFile = await CloudFile.fetchOrReserveBy({
  pathToFile: '/path/to/file.mp3',
  nsfw: false,
  secured: false,
})
// Use either pathToFile or md5, not both.
```

The Client uses this for uploads: it calls `fetchOrReserveBy` so that duplicate content (same MD5) reuses the existing cloud file instead of failing.

## Instance properties

| Property | Description |
|----------|-------------|
| `localPathToFile` | Local filesystem path, or `null`. |
| `remoteAttr` | Server payload (md5, uuid, state, asset, content_type, filesize, etc.). See `CloudFileType` in `src/types/cloud-file-type.ts`. |
| `resourceType` | Inferred from `content_type` (e.g. `audio`, `image`, `video`) or set by `identifyContentType()`. |
| `stateHistory` | Array of states the file has been through (e.g. `['reserved','transferred','completed']`). |

## State checks

| Method | Returns |
|--------|---------|
| `cloudFile.reserved()` | `true` if state is `reserved`. |
| `cloudFile.transferred()` | `true` if state is `transferred` (or legacy `transfered`). |
| `cloudFile.completed()` | `true` if state is `completed`. |

## Lifecycle methods (used during upload)

- **identifyContentType()**  
  Sets `resourceType` and `remoteAttr.content_type` from `localPathToFile` (requires `localPathToFile` to be set).

- **transfer({ asset, filesize })**  
  Marks the file as transferred and sends asset name and size to the server. Requires `content_type` to be set.

- **complete(dataProfile)**  
  Finalizes the upload with metadata (e.g. from `generateDataProfile`). Moves state to `completed`.

- **updateMetadata(dataProfile)**  
  Updates metadata on an already-uploaded/completed file (no state change).

- **reset()**  
  Puts the file back to `reserved` (e.g. after a failed transfer).

These are used internally by `Client` and `S3Uploader`; most callers will use `Client.uploadFile` / `uploadRemoteFile` instead of calling these directly.

## Other instance methods

| Method | Description |
|--------|-------------|
| `grouping()` | Returns grouping key: `'secured'`, `'audio'`, `'image'`, `'video'`, or `'archive'`. |
| `url()` | Builds the public S3-style URL for the file (requires `resourceType`, `md5`, `asset`). |
| `updateOrFetch(md5)` | Updates the cloud file’s MD5 on the server; on conflict (409), fetches the existing file and updates `remoteAttr`. |
| `delete()` | Deletes the cloud file on the server (returns `true` on 204). |

## Types

- **CloudFileType** (`src/types/cloud-file-type.ts`): shape of `remoteAttr` (md5, uuid, state, asset, content_type, filesize, metadata, etc.).
- **CloudFileState**: enum `reserved` | `transferred` | `completed`.

## Errors

- `fetchOrReserveBy` / `reserve`: require exactly one of `md5` or `pathToFile`.
- `identifyContentType`: throws if `localPathToFile` is not set.
- `transfer`: throws if `content_type` is not set.
- `url()`: throws if `resourceType`, `md5`, or `asset` is missing.
- API errors (4xx/5xx) propagate from the HTTP client.
