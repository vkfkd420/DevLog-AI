import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { fetchAllWorklogDocuments, fetchDocument, fetchProjects } from '../api';
import { parseWorklog, truncate } from '../format';

export const data = new SlashCommandBuilder()
  .setName('worklog')
  .setDescription('가장 최근 업무일지 요약을 봅니다 (전체 프로젝트 중 가장 최근 것)');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const [documents, projects] = await Promise.all([fetchAllWorklogDocuments(), fetchProjects()]);
  if (documents.length === 0) {
    await interaction.editReply('아직 생성된 업무일지가 없습니다.');
    return;
  }

  const latest = [...documents].sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];
  const detail = await fetchDocument(latest.id);
  const worklog = parseWorklog(detail.content);
  const projectName = projects.find((p) => p.id === latest.projectId)?.name ?? '알 수 없는 프로젝트';
  const dateLabel = latest.periodStart.slice(0, 10);
  const statusLabel = latest.status === 'final' ? '확정' : '초안';

  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle(`📝 ${projectName} · ${dateLabel} (${statusLabel})`);

  if (!worklog) {
    embed.setDescription(truncate(detail.content ?? '내용 없음', 4000));
  } else {
    embed.addFields(
      {
        name: '오늘 작업',
        value: `Git ${worklog.commits} Commit · IDE ${worklog.files} Files · AI ${worklog.aiQuestions} Questions · Error ${worklog.errors}건`,
      },
      { name: '오늘 한 일 요약', value: truncate(worklog.summary || '요약할 활동 기록이 없습니다.', 1000) },
      { name: '트러블슈팅', value: truncate(worklog.troubleshooting || '특별한 이슈가 없었습니다.', 1000) },
      { name: '내일 해야할 일', value: truncate(worklog.tomorrow || '제안된 작업이 없습니다.', 1000) },
    );
    if (worklog.note) {
      embed.addFields({ name: '메모', value: truncate(worklog.note, 1000) });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
