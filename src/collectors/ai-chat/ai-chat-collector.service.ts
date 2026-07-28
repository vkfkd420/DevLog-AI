import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConnectorService, ConnectorView } from '../../connectors/connector.service';
import { TimelineEvent, TimelineService } from '../../timeline/timeline.service';
import { ReportChatExchangeDto } from './dto/report-chat-exchange.dto';

// 대화 본문에서 파일 경로처럼 보이는 토큰을 찾는 best-effort 패턴 (약한 신호로만 사용).
const FILE_PATH_PATTERN = /[\w./-]+\.[A-Za-z0-9]{1,10}\b/;

@Injectable()
export class AiChatCollectorService {
  constructor(
    private readonly connectorService: ConnectorService,
    private readonly timelineService: TimelineService,
  ) {}

  async reportExchange(connectorId: string, dto: ReportChatExchangeDto): Promise<TimelineEvent> {
    this.assertValidDto(dto);
    const connector = await this.assertUsableConnector(connectorId);

    const referencedFiles = dto.referencedFiles?.length ? dto.referencedFiles : this.extractFileHints(dto);
    const redact = connector.config.redactContent === true;

    const payload = redact
      ? {
          tool: dto.tool,
          questionLength: dto.question.length,
          answerLength: dto.answer.length,
          referencedFiles,
        }
      : {
          tool: dto.tool,
          question: dto.question,
          answer: dto.answer,
          referencedFiles,
        };

    const hash = createHash('sha1').update(dto.question).digest('hex').slice(0, 12);

    const { event } = await this.timelineService.appendEvent({
      connectorId: connector.id,
      projectId: connector.projectId ?? undefined,
      source: 'ai-chat',
      type: 'chat_exchange',
      occurredAt: dto.occurredAt,
      dedupKey: `ai-chat:${connector.id}:${dto.occurredAt}:${hash}`,
      correlationHints: {
        ...(referencedFiles[0] ? { filePath: referencedFiles[0] } : {}),
        ...(dto.externalSessionRef ? { externalSessionRef: dto.externalSessionRef } : {}),
      },
      payload,
    });

    return event;
  }

  private extractFileHints(dto: ReportChatExchangeDto): string[] {
    const combined = `${dto.question}\n${dto.answer}`;
    const match = combined.match(FILE_PATH_PATTERN);
    return match ? [match[0]] : [];
  }

  private assertValidDto(dto: ReportChatExchangeDto): void {
    if (!dto.question) {
      throw new BadRequestException('question은 필수 값입니다.');
    }
    if (!dto.answer) {
      throw new BadRequestException('answer는 필수 값입니다.');
    }
    if (!dto.occurredAt || Number.isNaN(new Date(dto.occurredAt).getTime())) {
      throw new BadRequestException('occurredAt은 유효한 ISO 8601 날짜 문자열이어야 합니다.');
    }
  }

  private async assertUsableConnector(connectorId: string): Promise<ConnectorView> {
    const connector = await this.connectorService.getById(connectorId);
    if (connector.pluginKey !== 'ai-chat-collector') {
      throw new BadRequestException('ai-chat-collector 타입의 Connector가 아닙니다.');
    }
    if (connector.status === 'disabled') {
      throw new BadRequestException('비활성화된 Connector입니다. 먼저 활성화하세요.');
    }
    return connector;
  }
}
