import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { fetchAllWorklogDocuments, fetchDocuments, fetchEvents, fetchProjects } from '../api';
import { buildSummary } from '../summary';

const PROJECT_SELECT_ID = 'summary:project';
const ALL_PROJECTS_VALUE = '__all__';

export const data = new SlashCommandBuilder()
  .setName('summary')
  .setDescription('오늘의 요약 카드를 봅니다 (기본: 전체 프로젝트 통합)');

async function buildView(
  projectId: string | undefined,
): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder>[] }> {
  const [projects, events, documents] = await Promise.all([
    fetchProjects(),
    fetchEvents(projectId),
    projectId ? fetchDocuments(projectId) : fetchAllWorklogDocuments(),
  ]);

  const { streak, cards } = buildSummary(events, documents);
  const isAllProjects = projectId === undefined;
  const scopeLabel = isAllProjects ? '전체' : projects.find((p) => p.id === projectId)?.name ?? '알 수 없는 프로젝트';

  const embed = new EmbedBuilder().setTitle(`📊 오늘의 요약 · ${scopeLabel}`).setColor(0xd97757);

  embed.addFields({ name: '연속 활동일', value: `🔥 ${streak}일`, inline: true });
  for (const card of cards) {
    embed.addFields({ name: card.label, value: `**${card.value}**\n${card.deltaLabel}\n${card.weekAvgLabel}`, inline: true });
  }

  const projectSelect = new StringSelectMenuBuilder()
    .setCustomId(PROJECT_SELECT_ID)
    .setPlaceholder('프로젝트 선택')
    .addOptions(
      { label: '전체', value: ALL_PROJECTS_VALUE, default: isAllProjects },
      ...projects.slice(0, 24).map((p) => ({ label: p.name, value: p.id, default: p.id === projectId })),
    );
  const components = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(projectSelect)];

  return { embeds: [embed], components };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const view = await buildView(undefined);
  await interaction.editReply({ embeds: view.embeds, components: view.components });
}

export async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();
  const value = interaction.values[0];
  const projectId = value === ALL_PROJECTS_VALUE ? undefined : value;
  const view = await buildView(projectId);
  await interaction.editReply({ embeds: view.embeds, components: view.components });
}
