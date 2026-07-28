import { Injectable } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  commits: { id: string; message: string; occurredAt: Date }[];
  aiChats: { id: string; question: string; occurredAt: Date }[];
  files: string[];
  worklogs: { id: string; periodStart: Date; snippet: string }[];
  knowledge: { id: string; title: string; snippet: string }[];
}

// Git/IDE/AI 대화는 전부 Event 테이블이라 하나의 경로로 검색하고,
// 업무일지(Document)와 Knowledge는 각자의 텍스트 필드를 검색한다.
// 형태소 분석 없이 대소문자 무시 부분일치만 쓴다 — 개인용 로컬 데이터 규모에 맞춘 선택.
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(projectId: string, query: string): Promise<SearchResult> {
    const q = query.toLowerCase();

    const events = await this.prisma.event.findMany({
      where: { projectId },
      orderBy: { occurredAt: 'desc' },
    });
    const matchedEvents = events.filter((event) => this.eventMatches(event, q));

    const commits = matchedEvents
      .filter((event) => event.source === 'git' && event.type === 'commit')
      .map((event) => ({ id: event.id, message: this.field(event, 'message'), occurredAt: event.occurredAt }));

    const aiChats = matchedEvents
      .filter((event) => event.source === 'ai-chat' && event.type === 'chat_exchange')
      .map((event) => ({
        id: event.id,
        question: this.field(event, 'question') || '(원문 비공개)',
        occurredAt: event.occurredAt,
      }));

    const files = new Set<string>();
    for (const event of matchedEvents) {
      const filePath = this.filePath(event);
      if (filePath) {
        files.add(filePath);
      }
    }

    const documents = await this.prisma.document.findMany({ where: { projectId } });
    const worklogs: SearchResult['worklogs'] = [];
    for (const document of documents) {
      if (!document.currentVersionId) {
        continue;
      }
      const version = await this.prisma.documentVersion.findUnique({ where: { id: document.currentVersionId } });
      if (version && version.content.toLowerCase().includes(q)) {
        worklogs.push({
          id: document.id,
          periodStart: document.periodStart,
          snippet: this.snippet(version.content, q),
        });
      }
    }

    const knowledgeEntries = await this.prisma.knowledgeEntry.findMany({ where: { projectId } });
    const knowledge = knowledgeEntries
      .filter((entry) =>
        [entry.title, entry.cause, entry.solution].some((field) => field?.toLowerCase().includes(q)),
      )
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        snippet: this.snippet(entry.cause ?? entry.solution ?? entry.title, q),
      }));

    return { commits, aiChats, files: [...files], worklogs, knowledge };
  }

  private eventMatches(event: Event, q: string): boolean {
    const payload = event.payload ? event.payload.toLowerCase() : '';
    const hints = event.correlationHints ? event.correlationHints.toLowerCase() : '';
    return payload.includes(q) || hints.includes(q);
  }

  private field(event: Event, key: string): string {
    const payload = event.payload ? (JSON.parse(event.payload) as Record<string, unknown>) : {};
    return payload[key] ? String(payload[key]) : '';
  }

  private filePath(event: Event): string | null {
    const hints = event.correlationHints ? (JSON.parse(event.correlationHints) as { filePath?: string }) : {};
    const payload = event.payload ? (JSON.parse(event.payload) as { filePath?: string }) : {};
    return hints.filePath ?? payload.filePath ?? null;
  }

  private snippet(text: string, q: string): string {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) {
      return text.length > 80 ? `${text.slice(0, 80)}...` : text;
    }
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + q.length + 50);
    return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
  }
}
