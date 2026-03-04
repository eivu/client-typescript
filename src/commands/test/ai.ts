import Anthropic from '@anthropic-ai/sdk'
import {Command} from '@oclif/core'

export default class TestAi extends Command {
  public async run(): Promise<void> {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await client.messages.create({
      // eslint-disable-next-line camelcase -- API uses snake_case
      max_tokens: 1024,
      messages: [{content: 'Hello, Claude', role: 'user'}],
      model: 'claude-sonnet-4-6',
    })

    const text = response.content
      .map((block) =>
        block.type === 'text' ? (block as {text: string}).text : '',
      )
      .join('')
    this.log(text)
  }
}