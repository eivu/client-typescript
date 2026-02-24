import {Command} from '@oclif/core'
import {Client} from '@src/client'
import {logResponse} from '@src/utils'

export default class TestUploadFolder extends Command {
  static override description = 'Test uploading an entire folder'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    logResponse(
      await Client.uploadFolder({
        nsfw: true,
        pathToFolder: 'test/fixtures/samples/secured/',
        secured: true,
      }),
    )
  }
}
