# eivu-upload-client

TS Upload Client for Eivu

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/eivu-upload-client.svg)](https://npmjs.org/package/eivu-upload-client)
[![Downloads/week](https://img.shields.io/npm/dw/eivu-upload-client.svg)](https://npmjs.org/package/eivu-upload-client)

<!-- toc -->
* [eivu-upload-client](#eivu-upload-client)
* [Usage](#usage)
* [Commands](#commands)
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
* [`eivu-upload help [COMMAND]`](#eivu-upload-help-command)
* [`eivu-upload plugins`](#eivu-upload-plugins)
* [`eivu-upload plugins add PLUGIN`](#eivu-upload-plugins-add-plugin)
* [`eivu-upload plugins:inspect PLUGIN...`](#eivu-upload-pluginsinspect-plugin)
* [`eivu-upload plugins install PLUGIN`](#eivu-upload-plugins-install-plugin)
* [`eivu-upload plugins link PATH`](#eivu-upload-plugins-link-path)
* [`eivu-upload plugins remove [PLUGIN]`](#eivu-upload-plugins-remove-plugin)
* [`eivu-upload plugins reset`](#eivu-upload-plugins-reset)
* [`eivu-upload plugins uninstall [PLUGIN]`](#eivu-upload-plugins-uninstall-plugin)
* [`eivu-upload plugins unlink [PLUGIN]`](#eivu-upload-plugins-unlink-plugin)
* [`eivu-upload plugins update`](#eivu-upload-plugins-update)

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
