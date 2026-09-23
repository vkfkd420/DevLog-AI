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
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createTodo, fetchProjects, fetchTodoRecommendations, fetchTodos, updateTodo } from '../api';
import { PRIORITY_LABEL, formatDueDate, sortActiveTodos, truncate } from '../format';
import type { Project, Todo, TodoRecommendation } from '../types';

// /todo 실행 시 만든 추천 목록과 현재 보고 있는 프로젝트 필터를 메시지 ID별로 기억해둔다 —
// 선택 메뉴/모달은 짧은 값만 담을 수 있고, 다음 상호작용(완료 처리, 할 일 추가 등)에서도
// 같은 필터를 유지해야 한다.
const recommendationCache = new Map<string, TodoRecommendation[]>();
const projectFilterCache = new Map<string, string | undefined>();

const PROJECT_SELECT_ID = 'todo:project';
const COMPLETE_SELECT_ID = 'todo:complete';
const ADD_REC_SELECT_ID = 'todo:addrec';
const OPEN_ADD_BUTTON_ID = 'todo:openAdd';
const ADD_MODAL_ID = 'todo:addModal';
const ALL_PROJECTS_VALUE = '__all__';

export const data = new SlashCommandBuilder()
  .setName('todo')
  .setDescription('오늘 할 일 + AI 추천 목록을 봅니다 (기본: 전체 프로젝트 통합)');

function projectName(projects: Project[], projectId: string | null): string {
  if (!projectId) return '일반';
  return projects.find((p) => p.id === projectId)?.name ?? '알 수 없는 프로젝트';
}

function todoLine(todo: Todo, projects: Project[], showProject: boolean): string {
  const due = formatDueDate(todo.dueDate);
  const parts = [PRIORITY_LABEL[todo.priority], todo.title];
  if (showProject) parts.push(`_(${projectName(projects, todo.projectId)})_`);
  if (due) parts.push(`· 마감 ${due}`);
  return parts.join(' ');
}

function recommendationLine(rec: TodoRecommendation, projects: Project[], showProject: boolean): string {
  return showProject ? `**${projectName(projects, rec.projectId)}** · ${truncate(rec.message)}` : truncate(rec.message);
}

async function buildView(projectId: string | undefined): Promise<{
  embeds: EmbedBuilder[];
  components: (ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>)[];
  recommendations: TodoRecommendation[];
}> {
  const [projects, todos, recommendations] = await Promise.all([
    fetchProjects(),
    fetchTodos(projectId),
    fetchTodoRecommendations(projectId),
  ]);

  const isAllProjects = projectId === undefined;
  const active = sortActiveTodos(todos.filter((t) => !t.completed));
  const completedCount = todos.length - active.length;
  const scopeLabel = isAllProjects ? '전체' : projectName(projects, projectId);

  const embed = new EmbedBuilder()
    .setTitle(`📋 오늘 할 일 · ${scopeLabel}`)
    .setColor(0xd97757)
    .setFooter({ text: `완료됨 ${completedCount}개는 목록에서 생략됨 · DevLog AI` });

  embed.addFields({
    name: `진행 중 (${active.length})`,
    value:
      active.length > 0
        ? truncate(active.map((t) => `☐ ${todoLine(t, projects, isAllProjects)}`).join('\n'), 1000)
        : '없음',
  });

  if (recommendations.length > 0) {
    embed.addFields({
      name: `🤖 AI 추천 (${recommendations.length})`,
      value: truncate(recommendations.map((r) => recommendationLine(r, projects, isAllProjects)).join('\n'), 1000),
    });
  }

  const components: (ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>)[] = [];

  const projectSelect = new StringSelectMenuBuilder()
    .setCustomId(PROJECT_SELECT_ID)
    .setPlaceholder('프로젝트 선택')
    .addOptions(
      { label: '전체', value: ALL_PROJECTS_VALUE, default: isAllProjects },
      ...projects.slice(0, 24).map((p) => ({ label: p.name, value: p.id, default: p.id === projectId })),
    );
  components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(projectSelect));

  if (active.length > 0) {
    const completeSelect = new StringSelectMenuBuilder()
      .setCustomId(COMPLETE_SELECT_ID)
      .setPlaceholder('완료 처리할 항목 선택')
      .addOptions(
        active.slice(0, 25).map((t) => ({
          label: truncate(t.title, 90),
          description: projectName(projects, t.projectId),
          value: t.id,
        })),
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(completeSelect));
  }

  if (recommendations.length > 0) {
    const addRecSelect = new StringSelectMenuBuilder()
      .setCustomId(ADD_REC_SELECT_ID)
      .setPlaceholder('추천 항목을 오늘 할 일로 추가')
      .addOptions(
        recommendations.slice(0, 25).map((r) => ({
          label: truncate(r.message, 90),
          description: projectName(projects, r.projectId),
          value: r.key,
        })),
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(addRecSelect));
  }

  const addButton = new ButtonBuilder().setCustomId(OPEN_ADD_BUTTON_ID).setLabel('➕ 할 일 추가').setStyle(ButtonStyle.Secondary);
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(addButton));

  return { embeds: [embed], components, recommendations };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const view = await buildView(undefined);
  const message = await interaction.editReply({ embeds: view.embeds, components: view.components });
  recommendationCache.set(message.id, view.recommendations);
  projectFilterCache.set(message.id, undefined);
}

export async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();

  let projectId = projectFilterCache.get(interaction.message.id);

  if (interaction.customId === PROJECT_SELECT_ID) {
    const value = interaction.values[0];
    projectId = value === ALL_PROJECTS_VALUE ? undefined : value;
  } else if (interaction.customId === COMPLETE_SELECT_ID) {
    const todoId = interaction.values[0];
    await updateTodo(todoId, { completed: true });
  } else if (interaction.customId === ADD_REC_SELECT_ID) {
    const key = interaction.values[0];
    const cached = recommendationCache.get(interaction.message.id) ?? [];
    const rec = cached.find((r) => r.key === key);
    if (rec) {
      await createTodo({
        projectId: rec.projectId,
        title: rec.message,
        source: 'ai_suggested',
        sessionId: rec.sessionId,
        documentId: rec.documentId,
      });
    }
  }

  const view = await buildView(projectId);
  await interaction.editReply({ embeds: view.embeds, components: view.components });
  recommendationCache.set(interaction.message.id, view.recommendations);
  projectFilterCache.set(interaction.message.id, projectId);
}

// "➕ 할 일 추가" 버튼 — 필드 하나(제목)만 있는 팝업으로 최소한의 클릭/입력만 받는다.
// 프로젝트는 지금 보고 있는 필터를 그대로 따르고(전체 보기면 일반 할 일), 우선순위는 보통, 마감일은 없음으로 고정.
export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== OPEN_ADD_BUTTON_ID) return;

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('할 일 내용')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId(ADD_MODAL_ID)
    .setTitle('오늘 할 일 추가')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput));

  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== ADD_MODAL_ID || !interaction.isFromMessage()) return;

  const title = interaction.fields.getTextInputValue('title').trim();
  const projectId = projectFilterCache.get(interaction.message.id);

  await createTodo({ projectId, title });

  const view = await buildView(projectId);
  await interaction.update({ embeds: view.embeds, components: view.components });
  recommendationCache.set(interaction.message.id, view.recommendations);
}
