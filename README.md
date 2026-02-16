# eivu-upload-client

TS Upload Client for Eivu

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/eivu-upload-client.svg)](https://npmjs.org/package/eivu-upload-client)
[![Downloads/week](https://img.shields.io/npm/dw/eivu-upload-client.svg)](https://npmjs.org/package/eivu-upload-client)

<!-- toc -->

- [eivu-upload-client](#eivu-upload-client)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g eivu-upload-client
$ eivu-upload COMMAND
running command...
$ eivu-upload (--version)
eivu-upload-client/0.0.0 linux-x64 node-v18.20.8
$ eivu-upload --help [COMMAND]
USAGE
  $ eivu-upload COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`eivu-upload help [COMMAND]`](#eivu-upload-help-command)
- [`eivu-upload plugins`](#eivu-upload-plugins)
- [`eivu-upload plugins add PLUGIN`](#eivu-upload-plugins-add-plugin)
- [`eivu-upload plugins:inspect PLUGIN...`](#eivu-upload-pluginsinspect-plugin)
- [`eivu-upload plugins install PLUGIN`](#eivu-upload-plugins-install-plugin)
- [`eivu-upload plugins link PATH`](#eivu-upload-plugins-link-path)
- [`eivu-upload plugins remove [PLUGIN]`](#eivu-upload-plugins-remove-plugin)
- [`eivu-upload plugins reset`](#eivu-upload-plugins-reset)
- [`eivu-upload plugins uninstall [PLUGIN]`](#eivu-upload-plugins-uninstall-plugin)
- [`eivu-upload plugins unlink [PLUGIN]`](#eivu-upload-plugins-unlink-plugin)
- [`eivu-upload plugins update`](#eivu-upload-plugins-update)

## `eivu-upload help [COMMAND]`

Display help for eivu-upload.

```
USAGE
  $ eivu-upload help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for eivu-upload.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.33/src/commands/help.ts)_

## `eivu-upload plugins`

List installed plugins.

```
USAGE
  $ eivu-upload plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ eivu-upload plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/index.ts)_

## `eivu-upload plugins add PLUGIN`

Installs a plugin into eivu-upload.

```
USAGE
  $ eivu-upload plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into eivu-upload.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the EIVU_UPLOAD_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the EIVU_UPLOAD_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ eivu-upload plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ eivu-upload plugins add myplugin

  Install a plugin from a github url.

    $ eivu-upload plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ eivu-upload plugins add someuser/someplugin
```

## `eivu-upload plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ eivu-upload plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ eivu-upload plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/inspect.ts)_

## `eivu-upload plugins install PLUGIN`

Installs a plugin into eivu-upload.

```
USAGE
  $ eivu-upload plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into eivu-upload.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the EIVU_UPLOAD_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the EIVU_UPLOAD_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ eivu-upload plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ eivu-upload plugins install myplugin

  Install a plugin from a github url.

    $ eivu-upload plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ eivu-upload plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/install.ts)_

## `eivu-upload plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ eivu-upload plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ eivu-upload plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/link.ts)_

## `eivu-upload plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ eivu-upload plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ eivu-upload plugins unlink
  $ eivu-upload plugins remove

EXAMPLES
  $ eivu-upload plugins remove myplugin
```

## `eivu-upload plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ eivu-upload plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/reset.ts)_

## `eivu-upload plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ eivu-upload plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ eivu-upload plugins unlink
  $ eivu-upload plugins remove

EXAMPLES
  $ eivu-upload plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/uninstall.ts)_

## `eivu-upload plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ eivu-upload plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ eivu-upload plugins unlink
  $ eivu-upload plugins remove

EXAMPLES
  $ eivu-upload plugins unlink myplugin
```

## `eivu-upload plugins update`

Update installed plugins.

```
USAGE
  $ eivu-upload plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.48/src/commands/plugins/update.ts)_

<!-- commandsstop -->

# Eivu Metadata YAML Files

Eivu uses YAML metadata files (with the `.eivu.yml` extension) to store and manage rich metadata for uploaded files. These files provide a way to attach detailed information to your files that goes beyond what can be extracted from filenames or embedded file metadata.

## File Naming Conventions

There are two types of `.eivu.yml` files:

### 1. Associated Metadata Files

These files are named after the file they describe by appending `.eivu.yml` to the original filename:

```
myfile.txt.eivu.yml          # Metadata for myfile.txt
comic.cbz.eivu.yml           # Metadata for comic.cbz
song.mp3.eivu.yml            # Metadata for song.mp3
```

When you upload a file, the system automatically looks for a corresponding `.eivu.yml` file and merges that metadata with any automatically extracted metadata.

### 2. Standalone Metadata Files (for bulk updates)

For bulk updating cloud files, metadata files are named using the MD5 hash of the cloud file:

```
6068BE59B486F912BB432DDA00D8949B.eivu.yml
```

The MD5 hash identifies which cloud file to update on the server.

## Metadata File Structure

Eivu metadata YAML files support the following top-level fields:

### Core Fields

- `name` (string): The title or name of the file
- `description` (string): A longer description of the content (supports multi-line text)
- `year` (number): The year associated with the content
- `rating` (number): A rating value (e.g., 0.5, 4.25, 4.75, 5.0)
- `duration` (number): Duration in seconds (for audio/video files)
- `info_url` (string): A URL with additional information about the content
- `artwork_md5` (string): MD5 hash of associated artwork file

### Metadata List

The `metadata_list` field contains an array of key-value pairs with additional metadata. Each item in the array is a single-key object:

```yaml
metadata_list:
  - tag: horror
  - tag: thriller
  - performer: John Doe
  - studio: XYZ Productions
  - character: Batman
  - genre: Superhero
```

Common metadata keys include:

- `tag`: General tags
- `performer`: Performers/actors
- `studio`: Production studio
- `character`: Characters featured
- `genre`: Genre classification
- `writer`: Writer/author
- `artist`: Artist name
- `publisher`: Publisher name
- `source_url`: Source URL where the content was obtained
- `synopsis`: Brief synopsis or summary

You can also use namespaced keys for specific metadata types:

- `eivu:*`: Eivu-specific metadata (e.g., `eivu:artist_name`, `eivu:release_name`)
- `id3:*`: ID3 tag metadata for audio files (e.g., `id3:album`, `id3:artist`)
- `acoustid:*`: Acoustid fingerprint data (e.g., `acoustid:fingerprint`)
- `override:*`: Override values (e.g., `override:name`)

## Example Metadata File

Here's a complete example for a comic book:

```yaml
name: The Peacemaker #1
year: 1967
description: |
  The fleets of various foreign countries have been fishing near maritime 
  borders of other countries and have recently become the target of sabotage.
  U.S. Diplomat Christopher Smith investigates as the Peacemaker.
info_url: https://dc.fandom.com/wiki/Peacemaker_Vol_1_1
metadata_list:
  - character: Christopher Smith
  - character: Peacemaker
  - cover_artist: Pat Boyette
  - penciler: Pat Boyette
  - inker: Pat Boyette
  - letterer: Pat Boyette
  - writer: Joe Gill
  - publisher: Charlton Comics
  - publisher: DC Comics
  - tag: Peacemaker
  - source_url: https://comicbookplus.com/?dlid=70555
  - synopsis: The Commodore has been damaging fishing fleets, but the Peacemaker captures him and destroys his submarine
```

## Metadata Extraction Priority

When processing files, metadata is merged in the following priority order (highest to lowest):

1. Explicit metadata from `.eivu.yml` files
2. Embedded file metadata (ID3 tags for audio, EXIF for images, etc.)
3. Metadata extracted from filenames using tag patterns
4. Default values

Metadata from higher priority sources will override values from lower priority sources when they conflict.

## Using Metadata Files

### During Upload

Simply place a `.eivu.yml` file next to your file before uploading:

```
my-video.mp4
my-video.mp4.eivu.yml
```

The metadata will automatically be included when you upload `my-video.mp4`.

### For Bulk Updates

Use the bulk update command to update multiple cloud files from a folder of `.eivu.yml` files:

```bash
eivu-upload bulk-update --path /path/to/metadata/folder
```

This is useful for updating metadata on files that have already been uploaded to the cloud.

## AI Assistant Guide

For detailed specifications on generating `.eivu.yml` files programmatically, see [EIVU_METADATA_AI_GUIDE.md](./EIVU_METADATA_AI_GUIDE.md).
