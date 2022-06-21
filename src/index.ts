import algoliasearch from 'algoliasearch'
import discordJS from 'discord.js'
import config from './config.json'
import { SlashCommandBuilder } from '@discordjs/builders'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'

const algoliaClient = algoliasearch('TTNNKYDNG0', '5c54af8e3fabab7eb0344dd521d33887')
const index = algoliaClient.initIndex('algorand_en')

async function getSearchResults (queryString: string) {
  const { hits } = await index.search(queryString)
  const results = [] as Array<any>

  hits.forEach((h: any) => {
    let label = 'LABEL_NOT_FOUND'

    if (h.object_source === 'others' && h.object_type === 'docs') {
      const titles = Object.values(h.hierarchy)
      const nonNullTitles = titles.filter(t => {
        return t !== null
      }) as Array<string>

      label = ['Docs'].concat(nonNullTitles).join(' > ')
    } else if (h.object_type === 'ecosystem_project') {
      return
    } else if (h.object_source === 'blog') {
      label = 'Blog > ' + h.title
      console.log(label)
    }

    const fullLabel = label
    if (label.length >= 100) {
      label = label.slice(0, 97) + '...'
    }

    results.push({
      label,
      desc: fullLabel,
      value: h.objectID
    })
  })

  return results
}

const client = new discordJS.Client({ intents: [discordJS.Intents.FLAGS.GUILDS] })

client.once('ready', () => {
  console.log('Ready!')
})

client.login(config.token)

const commands = [
  new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Search the developer portal')
    // @ts-ignore
    .addStringOption(option => option.setName('query')
      .setDescription('The string to search for on the portal')
      .setRequired(true))
]
  .map(command => command.toJSON())

const rest = new REST({ version: '9' }).setToken(config.token)

// @ts-ignore
rest.put(Routes.applicationGuildCommands(config.clientID, config.guildID), { body: commands })
  .then(() => console.log('Successfully registered application commands.'))
  .catch(console.error)

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return

  if (interaction.commandName === 'docs') {
    const results = await getSearchResults(interaction.options.getString('query') as string)
    console.log(results)
    const row = new discordJS.MessageActionRow()
      .addComponents(
        new discordJS.MessageSelectMenu()
          .setCustomId('select')
          .setPlaceholder('Nothing selected')
          .addOptions(results)
      )

    await interaction.reply({ content: 'Which page do you want to link to?', components: [row], ephemeral: true })
  }
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isSelectMenu()) return

  if (interaction.customId === 'select') {
    const obj = await index.getObject(interaction.values[0]) as any
    let url = obj.url

    if (url.startsWith('/')) {
      url = 'https://developer.algorand.org' + url
    }

    const message = `${interaction.user.toString()} shared ${url}`
    interaction.channel?.send(message)
  }
})
