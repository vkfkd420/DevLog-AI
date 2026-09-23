import 'dotenv/config';
import { REST, Routes } from 'discord.js';
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
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('DISCORD_TOKEN과 DISCORD_CLIENT_ID를 .env에 설정하세요.');
  process.exit(1);
}

const commands = [
  todo.data.toJSON(),
  worklog.data.toJSON(),
  summary.data.toJSON(),
  heatmap.data.toJSON(),
  report.data.toJSON(),
  project.data.toJSON(),
  sync.data.toJSON(),
  settings.data.toJSON(),
  help.data.toJSON(),
];

const rest = new REST().setToken(token);

async function main() {
  const target = guildId
    ? Routes.applicationGuildCommands(clientId!, guildId)
    : Routes.applicationCommands(clientId!);

  await rest.put(target, { body: commands });
  console.log(
    guildId
      ? `길드(${guildId})에 슬래시 커맨드 ${commands.length}개를 등록했습니다 (즉시 반영).`
      : `전역 슬래시 커맨드 ${commands.length}개를 등록했습니다 (반영까지 최대 1시간 걸릴 수 있음).`,
  );
}

main().catch((error) => {
  console.error('커맨드 등록 실패:', error);
  process.exit(1);
});
