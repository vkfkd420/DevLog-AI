import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { fetchAutoDraftSetting, updateAutoDraftSetting } from '../api';
import type { AutoDraftSetting } from '../types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('DevLog AI 설정을 보거나 바꿉니다')
  .addSubcommand((sub) =>
    sub
      .setName('autodraft')
      .setDescription('자동 업무일지 초안 생성 설정을 보거나 바꿉니다')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('자동 생성 켜기/끄기'))
      .addStringOption((opt) => opt.setName('time').setDescription('실행 시각 (24시간제, 예: 18:00)'))
      .addStringOption((opt) =>
        opt.setName('days').setDescription('실행 요일, 콤마로 구분 (0=일 ~ 6=토, 예: 1,2,3,4,5)'),
      ),
  );

function describeSetting(setting: AutoDraftSetting): string {
  const days = setting.daysOfWeek
    .split(',')
    .filter((d) => d !== '')
    .map((d) => DAY_LABELS[Number(d)] ?? d)
    .join(', ');
  return [
    `상태: ${setting.enabled ? '🟢 켜짐' : '⚫ 꺼짐'}`,
    `실행 시각: ${setting.time}`,
    `실행 요일: ${days || '없음'}`,
    `마지막 실행일: ${setting.lastRunDate ?? '없음'}`,
  ].join('\n');
}

async function executeAutodraft(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const enabled = interaction.options.getBoolean('enabled');
  const time = interaction.options.getString('time');
  const days = interaction.options.getString('days');

  if (time && !TIME_RE.test(time)) {
    await interaction.editReply('time은 24시간제 HH:mm 형식이어야 합니다 (예: 18:00).');
    return;
  }
  if (days && !/^[0-6](,[0-6])*$/.test(days)) {
    await interaction.editReply('days는 0~6 숫자를 콤마로 구분해서 입력하세요 (예: 1,2,3,4,5).');
    return;
  }

  let setting: AutoDraftSetting;
  if (enabled === null && !time && !days) {
    setting = await fetchAutoDraftSetting();
  } else {
    const patch: Partial<Pick<AutoDraftSetting, 'enabled' | 'time' | 'daysOfWeek'>> = {};
    if (enabled !== null) patch.enabled = enabled;
    if (time) patch.time = time;
    if (days) patch.daysOfWeek = days;
    setting = await updateAutoDraftSetting(patch);
  }

  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle('⏰ 자동 업무일지 초안 생성 설정')
    .setDescription(describeSetting(setting));

  await interaction.editReply({ embeds: [embed] });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (sub === 'autodraft') {
    await executeAutodraft(interaction);
  }
}
