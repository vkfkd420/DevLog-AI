import { Injectable } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// 연속 이벤트 간 간격이 이 값(ms)을 넘으면 Session을 자른다. (6단계 설계: 기본 20분)
const SESSION_GAP_MS = 20 * 60 * 1000;

// Session/EventLink는 재계산 가능한 파생 데이터라, 알고리즘이 바뀌면 이 값을 올린다.
const ALGORITHM_VERSION = 1;

type CorrelationHintKey = 'traceId' | 'filePath' | 'externalSessionRef';

const LINK_RULES: { hint: CorrelationHintKey; linkType: string; confidence: 'strong' | 'weak' }[] = [
  { hint: 'traceId', linkType: 'same_trace', confidence: 'strong' },
  { hint: 'filePath', linkType: 'same_file', confidence: 'weak' },
  { hint: 'externalSessionRef', linkType: 'same_session_ref', confidence: 'weak' },
];

export interface CorrelationResult {
  eventsProcessed: number;
  sessionsCreated: number;
  sessionsExtended: number;
  linksCreated: number;
}

export interface SessionSummary {
  id: string;
  sessionNumber: number;
  startAt: Date;
  endAt: Date;
  title: string;
  eventCount: number;
  commitCount: number;
  aiQuestionCount: number;
  errorCount: number;
}

@Injectable()
export class CorrelationService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForProject(projectId: string): Promise<CorrelationResult> {
    const unassigned = await this.prisma.event.findMany({
      where: { projectId, sessionId: null },
      orderBy: { occurredAt: 'asc' },
    });

    if (unassigned.length === 0) {
      return { eventsProcessed: 0, sessionsCreated: 0, sessionsExtended: 0, linksCreated: 0 };
    }

    let sessionsCreated = 0;
    let sessionsExtended = 0;
    const touchedSessionIds = new Set<string>();

    // 기존 Session에 이어붙일 수 있는지 확인하기 위해, 이 프로젝트의 가장 최근 Session을 시드로 삼는다.
    let currentSession = await this.prisma.session.findFirst({
      where: { projectId },
      orderBy: { endAt: 'desc' },
    });

    for (const event of unassigned) {
      const gap = currentSession ? event.occurredAt.getTime() - currentSession.endAt.getTime() : Infinity;

      if (currentSession && gap <= SESSION_GAP_MS) {
        currentSession = await this.prisma.session.update({
          where: { id: currentSession.id },
          data: { endAt: event.occurredAt },
        });
        sessionsExtended += 1;
      } else {
        currentSession = await this.prisma.session.create({
          data: {
            projectId,
            startAt: event.occurredAt,
            endAt: event.occurredAt,
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
        sessionsCreated += 1;
      }

      await this.prisma.event.update({
        where: { id: event.id },
        data: { sessionId: currentSession.id },
      });
      touchedSessionIds.add(currentSession.id);
    }

    let linksCreated = 0;
    for (const sessionId of touchedSessionIds) {
      const sessionEvents = await this.prisma.event.findMany({ where: { sessionId } });
      linksCreated += await this.computeLinksForSession(sessionEvents);
    }

    return {
      eventsProcessed: unassigned.length,
      sessionsCreated,
      sessionsExtended,
      linksCreated,
    };
  }

  private async computeLinksForSession(events: Event[]): Promise<number> {
    if (events.length < 2) {
      return 0;
    }

    const existingPairKeys = await this.loadExistingPairKeys(events.map((event) => event.id));
    let created = 0;

    for (const rule of LINK_RULES) {
      const groups = new Map<string, Event[]>();
      for (const event of events) {
        const hints = event.correlationHints ? JSON.parse(event.correlationHints) : {};
        const value = hints[rule.hint];
        if (!value) {
          continue;
        }
        const group = groups.get(value) ?? [];
        group.push(event);
        groups.set(value, group);
      }

      for (const group of groups.values()) {
        if (group.length < 2) {
          continue;
        }
        for (let i = 0; i < group.length; i += 1) {
          for (let j = i + 1; j < group.length; j += 1) {
            const [eventIdA, eventIdB] = [group[i].id, group[j].id].sort();
            const pairKey = `${eventIdA}:${eventIdB}:${rule.linkType}`;
            if (existingPairKeys.has(pairKey)) {
              continue;
            }

            await this.prisma.eventLink.create({
              data: {
                eventIdA,
                eventIdB,
                linkType: rule.linkType,
                confidence: rule.confidence,
                algorithmVersion: ALGORITHM_VERSION,
              },
            });
            existingPairKeys.add(pairKey);
            created += 1;
          }
        }
      }
    }

    return created;
  }

  private async loadExistingPairKeys(eventIds: string[]): Promise<Set<string>> {
    const links = await this.prisma.eventLink.findMany({
      where: { OR: [{ eventIdA: { in: eventIds } }, { eventIdB: { in: eventIds } }] },
    });
    return new Set(links.map((link) => `${link.eventIdA}:${link.eventIdB}:${link.linkType}`));
  }

  async listSessions(projectId: string): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { projectId },
      orderBy: { startAt: 'asc' },
      include: { events: true },
    });

    // 오래된 순서로 번호를 매기고(#1 = 가장 처음 세션), 화면에는 최신순으로 보여준다.
    const summaries = sessions.map((session, index) => {
      const events = session.events;
      const commitCount = events.filter((event) => event.source === 'git' && event.type === 'commit').length;
      const aiQuestionCount = events.filter(
        (event) => event.source === 'ai-chat' && event.type === 'chat_exchange',
      ).length;
      const errorCount = events.filter((event) => event.type === 'error' || event.source === 'log').length;

      return {
        id: session.id,
        sessionNumber: index + 1,
        startAt: session.startAt,
        endAt: session.endAt,
        title: this.deriveSessionTitle(events),
        eventCount: events.length,
        commitCount,
        aiQuestionCount,
        errorCount,
      };
    });

    return summaries.reverse();
  }

  // LLM 없이 규칙만으로 만드는 제목이다 — 커밋 메시지가 있으면 그걸 쓰고,
  // 없으면 가장 많이 건드린 파일 이름을 쓴다. 더 정교한 요약이 필요해지면
  // 이 메서드만 LLM 호출로 교체하면 된다.
  private deriveSessionTitle(events: Event[]): string {
    const commits = events.filter((event) => event.source === 'git' && event.type === 'commit');
    if (commits.length > 0) {
      const payload = JSON.parse(commits[commits.length - 1].payload) as { message?: string };
      if (payload.message) {
        return payload.message;
      }
    }

    const fileCounts = new Map<string, number>();
    for (const event of events) {
      const hints = event.correlationHints ? (JSON.parse(event.correlationHints) as { filePath?: string }) : {};
      const payload = event.payload ? (JSON.parse(event.payload) as { filePath?: string }) : {};
      const filePath = hints.filePath ?? payload.filePath;
      if (filePath) {
        fileCounts.set(filePath, (fileCounts.get(filePath) ?? 0) + 1);
      }
    }
    if (fileCounts.size > 0) {
      const [topFile] = [...fileCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const fileName = topFile.split(/[\\/]/).pop() ?? topFile;
      return `${fileName} 작업`;
    }

    return '작업 세션';
  }
}
