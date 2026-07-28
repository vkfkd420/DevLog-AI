import { Injectable } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface WorklogStats {
  commits: number;
  files: number;
  aiQuestions: number;
  errors: number;
}

export interface WorklogContext {
  promptContent: string;
  eventIds: string[];
  sessionCount: number;
  eventCount: number;
  stats: WorklogStats;
}

const TRUNCATE_LENGTH = 200;

// Retrieval 단계: LLM에게 무엇을 보여줄지 결정하는 건 전부 이 코드가 한다 (5단계 설계).
// LLM은 여기서 만들어진 텍스트를 문장으로 다듬는 역할만 한다.
// commits/files/aiQuestions/errors는 카드 UI의 상단 요약에 쓰이는 결정론적 집계로,
// LLM에게 맡기지 않고 여기서 직접 센다 (Knowledge와 동일하게 Retrieval=코드, Generation=LLM 원칙).
@Injectable()
export class WorklogContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(projectId: string, periodStart: Date, periodEnd: Date): Promise<WorklogContext> {
    const sessions = await this.prisma.session.findMany({
      where: {
        projectId,
        startAt: { lt: periodEnd },
        endAt: { gte: periodStart },
      },
      orderBy: { startAt: 'asc' },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });

    const lines: string[] = [];
    const eventIds: string[] = [];
    const files = new Set<string>();
    let eventCount = 0;
    let commits = 0;
    let aiQuestions = 0;
    let errors = 0;

    for (const session of sessions) {
      lines.push(`### ${this.formatTime(session.startAt)} ~ ${this.formatTime(session.endAt)}`);
      for (const event of session.events) {
        const payload = event.payload ? JSON.parse(event.payload) : {};
        lines.push(`- ${this.renderEvent(event, payload)}`);
        eventIds.push(event.id);
        eventCount += 1;

        if (event.source === 'git' && event.type === 'commit') {
          commits += 1;
        }
        if (event.source === 'ai-chat' && event.type === 'chat_exchange') {
          aiQuestions += 1;
        }
        if (event.type === 'error' || event.source === 'log') {
          errors += 1;
        }
        const hints = event.correlationHints ? JSON.parse(event.correlationHints) : {};
        if (Array.isArray(payload.files)) {
          payload.files.forEach((f: string) => files.add(f));
        }
        if (typeof payload.filePath === 'string') {
          files.add(payload.filePath);
        }
        if (typeof hints.filePath === 'string') {
          files.add(hints.filePath);
        }
      }
      lines.push('');
    }

    return {
      promptContent: lines.join('\n'),
      eventIds,
      sessionCount: sessions.length,
      eventCount,
      stats: { commits, files: files.size, aiQuestions, errors },
    };
  }

  private renderEvent(event: Event, payload: Record<string, any>): string {
    switch (`${event.source}:${event.type}`) {
      case 'git:commit':
        return `[Git] 커밋 "${payload.message}" (${(payload.files ?? []).join(', ')})`;
      case 'ide:file_edit_burst':
        return `[IDE] ${payload.filePath} 편집 (${payload.editCount}회, 약 ${Math.round(
          (payload.durationMs ?? 0) / 1000,
        )}초)`;
      case 'ide:run':
        return `[IDE] ${payload.filePath} 실행 (종료 코드 ${payload.exitCode ?? '알수없음'})`;
      case 'ide:debug_session':
        return `[IDE] 디버그 세션 (${payload.filePath ?? ''}, 약 ${Math.round(
          (payload.durationMs ?? 0) / 1000,
        )}초)`;
      case 'ai-chat:chat_exchange':
        return payload.question
          ? `[AI 대화] Q: ${this.truncate(payload.question)} / A: ${this.truncate(payload.answer)}`
          : `[AI 대화] (질문 ${payload.questionLength}자 / 답변 ${payload.answerLength}자, 원문 비공개 설정)`;
      default:
        return `[${event.source}] ${event.type}`;
    }
  }

  private truncate(text: string): string {
    return text.length > TRUNCATE_LENGTH ? `${text.slice(0, TRUNCATE_LENGTH)}...` : text;
  }

  private formatTime(date: Date): string {
    return date.toISOString().slice(11, 16);
  }
}
