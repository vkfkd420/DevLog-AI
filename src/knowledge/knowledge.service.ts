import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmGatewayService } from '../llm/llm-gateway.service';

const KNOWLEDGE_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `당신은 개발자의 트러블슈팅 지식을 정리하는 도우미입니다.
아래 제공되는 내용은 실제 Timeline 기록(커밋, IDE 활동, AI 대화)입니다.
반드시 제공된 데이터에 근거해서만 작성하고, 데이터에 없는 내용을 추측하거나 지어내지 마세요.
다음 형식의 JSON으로만 답하세요. 다른 텍스트나 코드블록 표시를 포함하지 마세요.
{"title": "문제를 한 줄로 요약", "cause": "원인 설명", "solution": "해결 방법 설명"}`;

export interface KnowledgeEntrySummary {
  id: string;
  title: string;
  createdAt: Date;
}

export interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  cause: string | null;
  solution: string | null;
  commits: { id: string; message: string; occurredAt: Date }[];
  aiChats: { id: string; question: string; occurredAt: Date }[];
  files: string[];
  worklogs: { id: string; periodStart: Date }[];
}

interface ParsedKnowledge {
  title?: string;
  cause?: string;
  solution?: string;
}

// Knowledge Entry는 "AI 대화" 이벤트를 시작점으로, 같은 Session에 속한 이벤트와
// EventLink로 연결된 이벤트(같은 파일/트레이스로 묶인 커밋 등)를 모아 LLM에게
// 원인/해결방법을 구조화된 JSON으로 요청해서 만든다 (6단계 설계: Retrieval은 코드, Generation만 LLM).
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmGateway: LlmGatewayService,
  ) {}

  async generateFromEvent(eventId: string): Promise<KnowledgeEntryDetail> {
    const seed = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!seed) {
      throw new NotFoundException(`Event(${eventId})를 찾을 수 없습니다.`);
    }
    if (!seed.projectId) {
      throw new BadRequestException('projectId가 없는 이벤트는 Knowledge로 만들 수 없습니다.');
    }

    const relatedIds = await this.collectRelatedEventIds(seed);
    const events = await this.prisma.event.findMany({
      where: { id: { in: [...relatedIds] } },
      orderBy: { occurredAt: 'asc' },
    });
    const documents = await this.prisma.document.findMany({
      where: { evidence: { some: { eventId: { in: [...relatedIds] } } } },
    });

    const promptContent = events.map((event) => `- ${this.renderEvent(event)}`).join('\n');
    const raw = await this.llmGateway.complete({
      model: KNOWLEDGE_MODEL,
      system: SYSTEM_PROMPT,
      userContent: `## 관련 활동 기록\n\n${promptContent}`,
    });

    const parsed = this.tryParseJson(raw);
    const title = parsed?.title ?? this.fallbackTitle(seed);
    const cause = parsed?.cause ?? (parsed ? null : raw);
    const solution = parsed?.solution ?? null;

    const entry = await this.prisma.knowledgeEntry.create({
      data: {
        projectId: seed.projectId,
        title,
        cause,
        solution,
        sourceModel: KNOWLEDGE_MODEL,
      },
    });

    for (const event of events) {
      await this.prisma.knowledgeEventEvidence.create({
        data: { knowledgeId: entry.id, eventId: event.id },
      });
    }
    for (const document of documents) {
      await this.prisma.knowledgeDocumentEvidence.create({
        data: { knowledgeId: entry.id, documentId: document.id },
      });
    }

    return this.getById(entry.id);
  }

  async list(projectId: string): Promise<KnowledgeEntrySummary[]> {
    const entries = await this.prisma.knowledgeEntry.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map((entry) => ({ id: entry.id, title: entry.title, createdAt: entry.createdAt }));
  }

  async getById(id: string): Promise<KnowledgeEntryDetail> {
    const entry = await this.prisma.knowledgeEntry.findUnique({
      where: { id },
      include: {
        eventEvidence: { include: { event: true } },
        documentEvidence: { include: { document: true } },
      },
    });
    if (!entry) {
      throw new NotFoundException(`KnowledgeEntry(${id})를 찾을 수 없습니다.`);
    }

    const events = entry.eventEvidence.map((evidence) => evidence.event);
    const commits = events
      .filter((event) => event.source === 'git' && event.type === 'commit')
      .map((event) => ({ id: event.id, message: this.extractField(event, 'message'), occurredAt: event.occurredAt }));
    const aiChats = events
      .filter((event) => event.source === 'ai-chat' && event.type === 'chat_exchange')
      .map((event) => ({
        id: event.id,
        question: this.extractField(event, 'question') || '(원문 비공개)',
        occurredAt: event.occurredAt,
      }));

    const files = new Set<string>();
    for (const event of events) {
      const hints = event.correlationHints ? (JSON.parse(event.correlationHints) as { filePath?: string }) : {};
      const payload = event.payload ? (JSON.parse(event.payload) as { filePath?: string }) : {};
      const filePath = hints.filePath ?? payload.filePath;
      if (filePath) {
        files.add(filePath);
      }
    }

    const worklogs = entry.documentEvidence.map((evidence) => ({
      id: evidence.document.id,
      periodStart: evidence.document.periodStart,
    }));

    return {
      id: entry.id,
      title: entry.title,
      cause: entry.cause,
      solution: entry.solution,
      createdAt: entry.createdAt,
      commits,
      aiChats,
      files: [...files],
      worklogs,
    };
  }

  private async collectRelatedEventIds(seed: Event): Promise<Set<string>> {
    const ids = new Set<string>([seed.id]);

    if (seed.sessionId) {
      const sessionMates = await this.prisma.event.findMany({
        where: { sessionId: seed.sessionId },
        select: { id: true },
      });
      sessionMates.forEach((event) => ids.add(event.id));
    }

    const links = await this.prisma.eventLink.findMany({
      where: { OR: [{ eventIdA: seed.id }, { eventIdB: seed.id }] },
    });
    links.forEach((link) => {
      ids.add(link.eventIdA);
      ids.add(link.eventIdB);
    });

    return ids;
  }

  private renderEvent(event: Event): string {
    const payload = event.payload ? JSON.parse(event.payload) : {};
    switch (`${event.source}:${event.type}`) {
      case 'git:commit':
        return `[Git] 커밋 "${payload.message}" (${(payload.files ?? []).join(', ')})`;
      case 'ide:file_edit_burst':
        return `[IDE] ${payload.filePath} 편집 (${payload.editCount}회)`;
      case 'ide:run':
        return `[IDE] ${payload.filePath} 실행 (종료 코드 ${payload.exitCode ?? '알수없음'})`;
      case 'ai-chat:chat_exchange':
        return payload.question
          ? `[AI 대화] Q: ${payload.question} / A: ${payload.answer ?? ''}`
          : '[AI 대화] (원문 비공개)';
      default:
        return `[${event.source}] ${event.type}`;
    }
  }

  private extractField(event: Event, field: string): string {
    const payload = event.payload ? JSON.parse(event.payload) : {};
    return payload[field] ? String(payload[field]) : '';
  }

  private fallbackTitle(event: Event): string {
    const payload = event.payload ? JSON.parse(event.payload) : {};
    if (event.source === 'ai-chat' && payload.question) {
      return String(payload.question).slice(0, 60);
    }
    if (event.source === 'git' && payload.message) {
      return String(payload.message);
    }
    return '지식 항목';
  }

  private tryParseJson(raw: string): ParsedKnowledge | null {
    try {
      const cleaned = raw.trim().replace(/^```json\s*|```\s*$/g, '');
      return JSON.parse(cleaned) as ParsedKnowledge;
    } catch {
      return null;
    }
  }
}
