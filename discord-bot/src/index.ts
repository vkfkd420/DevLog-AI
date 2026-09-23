import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import * as todo from './commands/todo';
import * as worklog from './commands/worklog';
import * as summary from './commands/summary';
import * as heatmap from './commands/heatmap';
import * as report from './commands/report';
import * as project from './commands/project';
import * as sync from './commands/sync';
import * as settings from './commands/settings';
import * as help from './commands/help';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN이 .env에 설정되어 있지 않습니다.');
  process.exit(1);
}

// 슬래시 커맨드 + 컴포넌트 상호작용만 쓰므로 길드 인텐트는 필요 없다.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = new Map<string, { execute: (interaction: any) => Promise<void>; autocomplete?: (interaction: any) => Promise<void> }>([
  [todo.data.name, todo],
  [worklog.data.name, worklog],
  [summary.data.name, summary],
  [heatmap.data.name, heatmap],
  [report.data.name, report],
  [project.data.name, project],
  [sync.data.name, sync],
  [settings.data.name, settings],
  [help.data.name, help],
]);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`DevLog AI 봇 로그인 완료: ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      await command.autocomplete(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('todo:')) {
      await todo.handleSelect(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('summary:')) {
      await summary.handleSelect(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('heatmap:')) {
      await heatmap.handleSelect(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('project-discover:')) {
      await project.handleSelect(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('project-delete:')) {
      await project.handleButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('todo:')) {
      await todo.handleButton(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('todo:')) {
      await todo.handleModalSubmit(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('report:')) {
      await report.handleButton(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('report:')) {
      await report.handleModalSubmit(interaction);
      return;
    }
  } catch (error) {
    console.error('상호작용 처리 실패:', error);
    const message = `오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`;
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message).catch(() => undefined);
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
      }
    }
  }
});

client.login(token);
