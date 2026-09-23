import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { deleteProject, discoverProjects, fetchProjects, quickRegisterProject, updateProject } from '../api';
import { truncate } from '../format';
import type { DiscoveredProject, Project } from '../types';

// "C:/a/b/c" -> "C:/a/b" — web/src/components/ProjectsPanel.tsx의 parentDir과 동일한 로직으로,
// 기존 프로젝트가 모여있는 폴더를 추정해 path 옵션 생략 시 기본값으로 쓴다.
function parentDir(p: string): string {
  const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

function guessDiscoverRoot(projects: Project[]): string | undefined {
  return projects[0] ? parentDir(projects[0].rootPath) : undefined;
}

// project discover 실행 시 찾은 후보를 메시지 ID별로 기억해둔다 — 선택 메뉴 값(최대 100자) 제약 때문에
// 경로 대신 인덱스를 값으로 쓰고, 실제 후보 목록은 여기서 다시 꺼내 쓴다.
const discoveredCache = new Map<string, DiscoveredProject[]>();

const DISCOVER_SELECT_ID = 'project-discover:select';
const DELETE_CONFIRM_PREFIX = 'project-delete:confirm:';
const DELETE_CANCEL_ID = 'project-delete:cancel';

export const data = new SlashCommandBuilder()
  .setName('project')
  .setDescription('프로젝트를 등록/조회/관리합니다')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('로컬 git 저장소 경로로 새 프로젝트를 등록합니다 (커넥터 등록+초기 동기화까지 한 번에)')
      .addStringOption((opt) => opt.setName('name').setDescription('프로젝트 이름').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('path').setDescription('로컬 경로 (예: C:/workspace/my-project)').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('discover')
      .setDescription('상위 폴더 아래에서 등록 안 된 git 저장소를 찾아 후보로 보여줍니다 (최대 2단계)')
      .addStringOption((opt) =>
        opt
          .setName('path')
          .setDescription('찾아볼 상위 폴더 (비우면 기존 프로젝트가 모여있는 폴더를 자동으로 씀)'),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('등록된 프로젝트 목록을 봅니다'))
  .addSubcommand((sub) =>
    sub
      .setName('archive')
      .setDescription('프로젝트를 비활성화하거나 다시 활성화합니다 (토글)')
      .addStringOption((opt) =>
        opt.setName('project').setDescription('대상 프로젝트').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('프로젝트를 완전히 삭제합니다 (관련 이벤트/세션/업무일지/Knowledge/커넥터 전부 삭제, 되돌릴 수 없음)')
      .addStringOption((opt) =>
        opt.setName('project').setDescription('삭제할 프로젝트').setRequired(true).setAutocomplete(true),
      ),
  );

async function executeAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const name = interaction.options.getString('name', true);
  const rootPath = interaction.options.getString('path', true);

  try {
    const result = await quickRegisterProject(name, rootPath);
    const embed = new EmbedBuilder()
      .setColor(0xd97757)
      .setTitle(`✅ "${result.project.name}" 등록 완료`)
      .setDescription(
        result.syncError
          ? `초기 동기화 실패 (${result.syncError}). 경로/git 상태를 확인한 뒤 \`/sync\`로 다시 시도하세요.`
          : `커밋 ${result.scannedCommits}개 동기화, 세션 ${result.sessionsCreated}개 생성됨.`,
      );
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply(`등록 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function executeDiscover(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  let root = interaction.options.getString('path') ?? undefined;
  if (!root) {
    const projects = await fetchProjects(true);
    root = guessDiscoverRoot(projects);
    if (!root) {
      await interaction.editReply('찾아볼 상위 폴더를 지정하세요 (아직 등록된 프로젝트가 없어서 자동으로 추측할 수 없어요).');
      return;
    }
  }

  let found: DiscoveredProject[];
  try {
    found = await discoverProjects(root);
  } catch (error) {
    await interaction.editReply(`검색 실패: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (found.length === 0) {
    await interaction.editReply('새로 찾은 git 저장소가 없습니다 (이미 등록된 것은 제외됩니다).');
    return;
  }

  const limited = found.slice(0, 25);
  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle(`🔍 "${root}"에서 ${found.length}개 발견`)
    .setDescription('등록할 항목을 드롭다운에서 선택하세요 (여러 개 선택 가능). 선택 즉시 등록됩니다.');

  const select = new StringSelectMenuBuilder()
    .setCustomId(DISCOVER_SELECT_ID)
    .setPlaceholder('등록할 프로젝트 선택 (복수 선택 가능)')
    .setMinValues(1)
    .setMaxValues(limited.length)
    .addOptions(
      limited.map((d, i) => ({ label: truncate(d.name, 90), description: truncate(d.path, 90), value: String(i) })),
    );

  const message = await interaction.editReply({
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  });
  discoveredCache.set(message.id, limited);
}

async function executeList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const projects = await fetchProjects(true);
  if (projects.length === 0) {
    await interaction.editReply('등록된 프로젝트가 없습니다. `/project add` 또는 `/project discover`로 등록해보세요.');
    return;
  }

  const lines = projects.map((p) => {
    const status = p.archivedAt ? '⚫ 비활성화됨' : '🟢 활성';
    return `${status} · **${p.name}**\n${truncate(p.rootPath, 90)}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xd97757)
    .setTitle(`📁 등록된 프로젝트 (${projects.length})`)
    .setDescription(truncate(lines.join('\n\n'), 4000));

  await interaction.editReply({ embeds: [embed] });
}

async function executeArchive(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const projectOpt = interaction.options.getString('project', true);
  const projects = await fetchProjects(true);
  const matched = projects.find((p) => p.id === projectOpt || p.name.toLowerCase() === projectOpt.toLowerCase());
  if (!matched) {
    await interaction.editReply(`"${projectOpt}" 프로젝트를 찾을 수 없습니다.`);
    return;
  }

  const nextArchived = !matched.archivedAt;
  await updateProject(matched.id, { archived: nextArchived });
  await interaction.editReply(`"${matched.name}"을(를) ${nextArchived ? '비활성화' : '다시 활성화'}했습니다.`);
}

async function executeDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const projectOpt = interaction.options.getString('project', true);
  const projects = await fetchProjects(true);
  const matched = projects.find((p) => p.id === projectOpt || p.name.toLowerCase() === projectOpt.toLowerCase());
  if (!matched) {
    await interaction.reply({ content: `"${projectOpt}" 프로젝트를 찾을 수 없습니다.`, ephemeral: true });
    return;
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId(`${DELETE_CONFIRM_PREFIX}${matched.id}`)
    .setLabel(`"${matched.name}" 완전히 삭제`)
    .setStyle(ButtonStyle.Danger);
  const cancelButton = new ButtonBuilder().setCustomId(DELETE_CANCEL_ID).setLabel('취소').setStyle(ButtonStyle.Secondary);

  await interaction.reply({
    content: `⚠️ "${matched.name}"을(를) 삭제하면 관련된 모든 이벤트/세션/업무일지/Knowledge/커넥터가 함께 삭제되며 되돌릴 수 없습니다. 정말 삭제할까요?`,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)],
    ephemeral: true,
  });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return executeAdd(interaction);
  if (sub === 'discover') return executeDiscover(interaction);
  if (sub === 'list') return executeList(interaction);
  if (sub === 'archive') return executeArchive(interaction);
  if (sub === 'delete') return executeDelete(interaction);
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const projects = await fetchProjects(true);
  const matches = projects
    .filter((p) => p.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((p) => ({ name: `${p.name}${p.archivedAt ? ' (비활성화됨)' : ''}`, value: p.id }));
  await interaction.respond(matches);
}

export async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();

  const cached = discoveredCache.get(interaction.message.id) ?? [];
  const targets = interaction.values.map((v) => cached[Number(v)]).filter((d): d is DiscoveredProject => !!d);

  const lines: string[] = [];
  for (const target of targets) {
    try {
      const result = await quickRegisterProject(target.name, target.path);
      lines.push(`✅ **${result.project.name}** — 커밋 ${result.scannedCommits}개 동기화됨`);
    } catch (error) {
      lines.push(`⚠️ **${target.name}** — 등록 실패 (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  const embed = new EmbedBuilder().setColor(0xd97757).setTitle('등록 결과').setDescription(lines.join('\n'));

  // 한 번 등록하면 끝인 일회성 동작이라, 재사용 혼란을 막기 위해 선택 메뉴는 제거한다.
  await interaction.editReply({ embeds: [embed], components: [] });
  discoveredCache.delete(interaction.message.id);
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === DELETE_CANCEL_ID) {
    await interaction.update({ content: '삭제를 취소했습니다.', components: [] });
    return;
  }

  if (interaction.customId.startsWith(DELETE_CONFIRM_PREFIX)) {
    const projectId = interaction.customId.slice(DELETE_CONFIRM_PREFIX.length);
    await interaction.deferUpdate();
    try {
      await deleteProject(projectId);
      await interaction.editReply({ content: '✅ 삭제했습니다.', components: [] });
    } catch (error) {
      await interaction.editReply({
        content: `삭제 실패: ${error instanceof Error ? error.message : String(error)}`,
        components: [],
      });
    }
  }
}
