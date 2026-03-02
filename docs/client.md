# Client

The **Client** class is the main entry point for uploading files to EIVU cloud storage and for bulk-updating existing cloud files from metadata (`.eivu.yml`) files.

## Overview

- **Location:** `src/client.ts`
- **Import:** `import { Client } from '@src/client'`

The Client handles:

- File and folder uploads (local files)
- Remote file uploads (download from URL then upload to cloud)
- Bulk updates of cloud file metadata from `.eivu.yml` files in a folder
- Upload verification and logging (success/failure CSV logs)

You can use **static methods** without creating an instance, or create an instance and call **instance methods** (e.g. if you need to reuse the same logger or pass it around).

## Prerequisites

- Required environment variables must be set (see [Environment](#environment)).
- For local uploads: the file or folder must exist and be readable; paths are validated (no path traversal, must be under cwd for relative paths).
- For remote uploads: the download URL must be reachable.

## Basic usage

### Upload a single file (static)

```ts
import { Client } from '@src/client'

const cloudFile = await Client.uploadFile({
  pathToFile: '/path/to/myfile.mp3',
})
// Optional: metadataList, nsfw, secured
```

### Upload a folder (static)

```ts
const messages = await Client.uploadFolder({
  pathToFolder: '/path/to/folder',
  concurrency: 5, // optional, default 3
})
// messages: string[] e.g. ["/path/to/file1.mp3: uploaded successfully", ...]
```

### Bulk update cloud files from metadata (static)

```ts
const messages = await Client.bulkUpdateCloudFiles({
  pathToFolder: '/path/to/folder/with/eivu-yml-files',
  concurrency: 3,
})
// Processes every .eivu.yml in the folder; each filename base (before .eivu.yml) is the cloud file MD5.
```

### Upload a file from a remote URL (static)

```ts
const cloudFile = await Client.uploadRemoteFile({
  downloadUrl: 'https://example.com/file.mp3',
  // optional: assetFilename, metadataProfile, nsfw, secured, sourceUrl
})
```

### Using an instance

```ts
const client = new Client()
// Use client.logger if needed
const cloudFile = await client.uploadFile({ pathToFile: '/path/to/file.mp3' })
const messages = await client.uploadFolder({ pathToFolder: '/path/to/folder' })
```

## API summary

| Method | Description |
|--------|-------------|
| `Client.uploadFile(params)` | Upload one local file. Returns `Promise<CloudFile>`. |
| `Client.uploadFolder(params)` | Upload all (non-skipped) files in a folder. Returns `Promise<string[]>`. |
| `Client.bulkUpdateCloudFiles(params)` | Update cloud files from `.eivu.yml` files in a folder. Returns `Promise<string[]>`. |
| `Client.uploadRemoteFile(params)` | Download from URL and upload to cloud. Returns `Promise<CloudFile>`. |
| `Client.uploadRemoteQueue(pathToJson, concurrency?)` | Process a JSONL queue of remote uploads. Returns `Promise<string[]>`. |
| `client.verifyUpload(pathToFile)` | Check if a local file exists in cloud and is completed. Returns `Promise<boolean>`. |
| `client.updateCloudFile(pathToFile)` | Update one cloud file from a single `.eivu.yml` file. Returns `Promise<CloudFile>`. |

## Parameters

- **pathToFile** / **pathToFolder**: Local path; validated (existence, path traversal, cwd).
- **concurrency**: Optional; number of concurrent operations (default `3`).
- **metadataList**: Optional; array of metadata key/value pairs to attach.
- **nsfw**: Optional; default `false`.
- **secured**: Optional; default `false`.
- **pathToJson**: Path to a JSONL file (one JSON object per line) for `uploadRemoteQueue`.

## Skipped files (folder uploads)

- **SKIPPABLE_EXTENSIONS**: e.g. `.cue`, `.eivu.yml`, `.log`, `.md5`, `.m3u`, `.nfo`, etc. (see `Client.SKIPPABLE_EXTENSIONS`).
- **SKIPPABLE_FOLDERS**: `.git`, `podcasts` (see `Client.SKIPPABLE_FOLDERS`).

## Logging

- Success/failure are logged to `logs/success.csv` and `logs/failure.csv`.
- The client uses the default app logger; you can pass or replace `client.logger` if needed.

## Environment

Ensure all required EIVU env vars are set (e.g. `EIVU_ACCESS_KEY_ID`, `EIVU_SECRET_ACCESS_KEY`, `EIVU_BUCKET_NAME`, `EIVU_UPLOAD_SERVER_HOST`, `EIVU_USER_TOKEN`, etc.). See `src/env.ts` and `getEnv()` for the full list.

## Errors

- Empty files: `uploadFile` throws if the file has zero size.
- Invalid paths: `validateFilePath` / `validateDirectoryPath` throw on path traversal or missing paths.
- Remote URL not reachable: `uploadRemoteFile` throws if the download URL (or source URL) is not reachable.
- API/network errors from the upload server or S3 propagate as thrown errors.
