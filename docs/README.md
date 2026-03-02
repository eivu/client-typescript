# EIVU Upload Client — Documentation

This folder contains usage documentation for the main classes of the EIVU upload client.

## Contents

| Document | Description |
|----------|-------------|
| [Client](client.md) | Upload files and folders, bulk-update cloud files from metadata, remote uploads. |
| [CloudFile](cloud-file.md) | Represent and manage a single cloud file (reserve, transfer, complete, update, delete). |
| [MetadataGenerator](metadata-generator.md) | Generate `.eivu.yml` metadata files using AI (Claude, Gemini, OpenAI). |

## Quick links

- **Upload a file:** `Client.uploadFile({ pathToFile })` → [Client](client.md#basic-usage)
- **Upload a folder:** `Client.uploadFolder({ pathToFolder })` → [Client](client.md#basic-usage)
- **Update cloud files from metadata:** `Client.bulkUpdateCloudFiles({ pathToFolder })` → [Client](client.md#bulk-update-cloud-files-from-metadata-static)
- **Fetch or create a cloud file:** `CloudFile.fetchOrReserveBy({ pathToFile })` → [CloudFile](cloud-file.md#fetch-or-reserve-reserve-if-new-fetch-if-already-exists)
- **Generate metadata with AI:** `MetadataGenerator.generate(filePaths, options)` → [MetadataGenerator](metadata-generator.md#basic-usage)
