import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';

// 코어 밖으로 노출되는 Event 형태 — payload/correlationHints는 저장 시 직렬화한 JSON 문자열을
// 다시 객체로 풀어서 돌려준다. Event Store를 쓰는 쪽(Collector, Generator, API 소비자)은
// SQLite가 Json 타입을 지원하지 않아 문자열로 저장한다는 사실을 몰라도 된다.
export type TimelineEvent = Omit<Event, 'payload' | 'correlationHints'> & {
  payload: Record<string, unknown>;
  correlationHints: Record<string, unknown> | null;
};

const REQUIRED_FIELDS: (keyof CreateEventDto)[] = [
  'connectorId',
  'source',
  'type',
  'occurredAt',
  'dedupKey',
  'payload',
];

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async appendEvent(dto: CreateEventDto): Promise<{ event: TimelineEvent; created: boolean }> {
    this.assertValidCreateEventDto(dto);

    const existing = await this.prisma.event.findUnique({
      where: { dedupKey: dto.dedupKey },
    });

    if (existing) {
      // 같은 이벤트가 재수집된 경우 — 새로 만들지 않고 발생 횟수만 누적한다 (idempotency).
      const updated = await this.prisma.event.update({
        where: { id: existing.id },
        data: { occurrenceCount: existing.occurrenceCount + 1 },
      });
      return { event: this.toTimelineEvent(updated), created: false };
    }

    try {
      const created = await this.prisma.event.create({
        data: {
          connectorId: dto.connectorId,
          projectId: dto.projectId,
          source: dto.source,
          type: dto.type,
          occurredAt: new Date(dto.occurredAt),
          dedupKey: dto.dedupKey,
          correlationHints: dto.correlationHints ? JSON.stringify(dto.correlationHints) : null,
          payload: JSON.stringify(dto.payload),
        },
      });
      return { event: this.toTimelineEvent(created), created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          'connectorId 또는 projectId가 존재하지 않습니다. 먼저 해당 Connector/Project를 등록하세요.',
        );
      }
      throw error;
    }
  }

  async queryEvents(filter: QueryEventsDto): Promise<TimelineEvent[]> {
    const events = await this.prisma.event.findMany({
      where: {
        projectId: filter.projectId,
        source: filter.source,
        type: filter.type,
        occurredAt: {
          gte: filter.from ? new Date(filter.from) : undefined,
          lte: filter.to ? new Date(filter.to) : undefined,
        },
      },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map((event) => this.toTimelineEvent(event));
  }

  async getEventById(id: string): Promise<TimelineEvent> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event(${id})를 찾을 수 없습니다.`);
    }
    return this.toTimelineEvent(event);
  }

  private assertValidCreateEventDto(dto: CreateEventDto): void {
    for (const field of REQUIRED_FIELDS) {
      const value = dto[field];
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(`${field}는 필수 값입니다.`);
      }
    }
    if (Number.isNaN(new Date(dto.occurredAt).getTime())) {
      throw new BadRequestException('occurredAt은 유효한 ISO 8601 날짜 문자열이어야 합니다.');
    }
  }

  private toTimelineEvent(event: Event): TimelineEvent {
    return {
      ...event,
      correlationHints: event.correlationHints ? JSON.parse(event.correlationHints) : null,
      payload: JSON.parse(event.payload),
    };
  }
}
