import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { fetchConnectors, fetchProjects, runAllSync } from '../api';

export const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('모든 git 커넥터를 지금 바로 동기화하고 상태를 보여줍니다');

const STATUS_ICON: Record<string, string> = { enabled: '🟢', disabled: '⚫', error: '🔴' };

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const result = await runAllSync();
  const [connectors, projects] = await Promise.all([fetchConnectors(), fetchProjects(true)]);

  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle('🔄 동기화 완료')
    .setDescription(
      `동기화됨 ${result.syncedConnectors}개 · 실패 ${result.failedConnectors}개 · 세션 재계산 ${result.projectsRecomputed}개 프로젝트`,
    );

  if (connectors.length > 0) {
    const lines = connectors.map((c) => {
      const projectName = projects.find((p) => p.id === c.projectId)?.name ?? '알 수 없는 프로젝트';
      const icon = STATUS_ICON[c.status] ?? '⚪';
      const errorNote = c.status === 'error' && c.lastError ? ` — ${c.lastError}` : '';
      return `${icon} **${projectName}** (${c.pluginKey})${errorNote}`;
    });
    embed.addFields({ name: '커넥터 상태', value: lines.join('\n').slice(0, 1000) });
  }

  await interaction.editReply({ embeds: [embed] });
}
