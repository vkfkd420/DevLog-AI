import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('help').setDescription('DevLog AI 봇 명령어 목록을 봅니다');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle('📖 DevLog AI 봇 명령어')
    .setDescription('명령어를 입력하면 디스코드가 하위 옵션과 설명을 자동으로 보여줘요.')
    .addFields(
      {
        name: '오늘의 업무',
        value: [
          '`/todo` — 오늘 할 일 + AI 추천 보기 (버튼으로 완료 처리/추가까지)',
          '`/worklog` — 최근 업무일지 요약',
          '`/summary` — 오늘의 요약 카드',
          '`/heatmap` — 최근 18주 활동 히트맵',
          '`/report` — 최근 기간 보고서 보기 (버튼으로 이번 주/지난 주/이번 달/지난 달 생성)',
        ].join('\n'),
      },
      {
        name: '프로젝트 / 설정 (초기 세팅)',
        value: [
          '`/project add` — 프로젝트 등록 (경로 직접 입력)',
          '`/project discover` — 폴더 스캔해서 등록 (경로 생략 시 자동 추측)',
          '`/project list` — 등록된 프로젝트 목록',
          '`/project archive` — 비활성화/재활성화',
          '`/project delete` — 완전 삭제',
          '`/sync` — 커넥터 지금 동기화 + 상태 확인',
          '`/settings autodraft` — 자동 업무일지 생성 스케줄',
        ].join('\n'),
      },
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
