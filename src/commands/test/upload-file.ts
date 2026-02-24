import {Command} from '@oclif/core'
import {Client} from '@src/client'
import {logResponse} from '@src/utils'

export default class TestUploadFile extends Command {
  static override description = 'Test uploading a single file'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    logResponse(
      await Client.uploadFile({
        pathToFile: 'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz',
      }),
    )
  }
}
