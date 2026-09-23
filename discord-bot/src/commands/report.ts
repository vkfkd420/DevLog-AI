import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { fetchAllReports, fetchDocument, fetchProjects, generateReport } from '../api';
import { parseWorklog, truncate } from '../format';
import { presetRange, ReportPreset, shiftDayBack } from '../dates';
import type { DocumentSummary } from '../types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CUSTOM_BUTTON_ID = 'report:custom';
const CUSTOM_MODAL_ID = 'report:customModal';
const PRESET_BUTTONS: { id: ReportPreset; label: string }[] = [
  { id: 'week', label: '이번 주 생성' },
  { id: 'lastWeek', label: '지난 주 생성' },
  { id: 'month', label: '이번 달 생성' },
  { id: 'lastMonth', label: '지난 달 생성' },
];

export const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('기간 보고서를 보고, 버튼으로 새로 생성합니다 (전체 프로젝트 대상)');

function groupKey(doc: DocumentSummary): string {
  return `${doc.periodStart}__${doc.periodEnd}`;
}

function presetButtonsRow(): ActionRowBuilder<ButtonBuilder> {
  const buttons = PRESET_BUTTONS.map((p) =>
    new ButtonBuilder().setCustomId(`report:${p.id}`).setLabel(p.label).setStyle(ButtonStyle.Secondary),
  );
  buttons.push(new ButtonBuilder().setCustomId(CUSTOM_BUTTON_ID).setLabel('직접 입력').setStyle(ButtonStyle.Secondary));
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

async function buildView(): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const [reports, projects] = await Promise.all([fetchAllReports(), fetchProjects()]);
  const components = [presetButtonsRow()];

  if (reports.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xd97757)
      .setTitle('🧾 기간 보고서')
      .setDescription('아직 생성된 기간 보고서가 없습니다. 아래 버튼으로 생성해보세요.');
    return { embeds: [embed], components };
  }

  const groups = new Map<string, DocumentSummary[]>();
  for (const doc of reports) {
    const key = groupKey(doc);
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }

  const latestKey = [...groups.entries()].sort((a, b) => b[1][0].periodStart.localeCompare(a[1][0].periodStart))[0][0];
  const docs = groups.get(latestKey)!;
  const [periodStart, periodEnd] = latestKey.split('__');

  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle(`🧾 기간 보고서 · ${periodStart.slice(0, 10)} ~ ${shiftDayBack(periodEnd.slice(0, 10))}`);

  for (const doc of docs) {
    const detail = await fetchDocument(doc.id);
    const worklog = parseWorklog(detail.content);
    const projectName = projects.find((p) => p.id === doc.projectId)?.name ?? '알 수 없는 프로젝트';
    const status = doc.status === 'final' ? '확정' : '초안';

    const value = worklog
      ? `${truncate(worklog.summary || '요약 없음', 400)}\n**다음 계획:** ${truncate(worklog.tomorrow || '없음', 200)}`
      : truncate(detail.content ?? '내용 없음', 400);

    embed.addFields({ name: `${projectName} (${status})`, value });
  }

  return { embeds: [embed], components };
}

async function generateForAllProjects(periodStart: string, periodEnd: string): Promise<string> {
  const projects = await fetchProjects();
  if (projects.length === 0) return '등록된 프로젝트가 없습니다.';

  const lines: string[] = [];
  for (const project of projects) {
    try {
      const result = await generateReport(project.id, periodStart, periodEnd);
      lines.push(`✅ **${project.name}** — 이벤트 ${result.eventCount}개, 세션 ${result.sessionCount}개`);
    } catch (error) {
      lines.push(`⚠️ **${project.name}** — 생성 실패 (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return lines.join('\n');
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const view = await buildView();
  await interaction.editReply({ embeds: view.embeds, components: view.components });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === CUSTOM_BUTTON_ID) {
    const startInput = new TextInputBuilder()
      .setCustomId('start')
      .setLabel('시작일 (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const endInput = new TextInputBuilder()
      .setCustomId('end')
      .setLabel('종료일 (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const modal = new ModalBuilder()
      .setCustomId(CUSTOM_MODAL_ID)
      .setTitle('기간 보고서 생성 (직접 입력)')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(startInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(endInput),
      );
    await interaction.showModal(modal);
    return;
  }

  const preset = PRESET_BUTTONS.find((p) => `report:${p.id}` === interaction.customId)?.id;
  if (!preset) return;

  await interaction.deferUpdate();
  const [periodStart, periodEnd] = presetRange(preset);
  await generateForAllProjects(periodStart, periodEnd);
  const view = await buildView();
  await interaction.editReply({ embeds: view.embeds, components: view.components });
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== CUSTOM_MODAL_ID || !interaction.isFromMessage()) return;

  const start = interaction.fields.getTextInputValue('start').trim();
  const end = interaction.fields.getTextInputValue('end').trim();

  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    await interaction.reply({ content: '시작일/종료일은 YYYY-MM-DD 형식이어야 합니다.', ephemeral: true });
    return;
  }
  if (start > end) {
    await interaction.reply({ content: '시작일은 종료일보다 이후일 수 없습니다.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  await generateForAllProjects(start, end);
  const view = await buildView();
  await interaction.editReply({ embeds: view.embeds, components: view.components });
}
