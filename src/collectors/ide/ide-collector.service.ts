import { BadRequestException, Injectable } from '@nestjs/common';
import { ConnectorService, ConnectorView } from '../../connectors/connector.service';
import { TimelineService } from '../../timeline/timeline.service';
import { ReportIdeActivityDto } from './dto/report-ide-activity.dto';

// 같은 파일에 대한 연속 편집이 이 시간(ms)보다 오래 끊기면 별도의 burst로 취급한다.
const EDIT_BURST_GAP_MS = 2 * 60 * 1000;

interface OpenBurst {
  connectorId: string;
  projectId: string;
  filePath: string;
  branch?: string;
  burstStartAt: string;
  lastActivityAt: string;
  editCount: number;
}

@Injectable()
export class IdeCollectorService {
  // key = `${connectorId}:${filePath}` — 서버 메모리에서만 관리되는 진행 중 burst.
  // 서버가 재시작되면 flush되지 않은 burst는 사라진다 (Local-first에서 감수한 트레이드오프).
  private readonly openBursts = new Map<string, OpenBurst>();

  constructor(
    private readonly connectorService: ConnectorService,
    private readonly timelineService: TimelineService,
  ) {}

  async reportActivity(connectorId: string, dto: ReportIdeActivityDto): Promise<{ status: string }> {
    this.assertValidDto(dto);
    const connector = await this.assertUsableConnector(connectorId);

    if (dto.activityType === 'edit') {
      await this.recordEdit(connector, dto);
      return { status: 'buffered' };
    }

    await this.timelineService.appendEvent({
      connectorId: connector.id,
      projectId: connector.projectId!,
      source: 'ide',
      type: dto.activityType,
      occurredAt: dto.occurredAt,
      dedupKey: `ide:${connector.id}:${dto.activityType}:${dto.filePath}:${dto.occurredAt}`,
      correlationHints: {
        filePath: dto.filePath,
        ...(dto.branch ? { branch: dto.branch } : {}),
      },
      payload: {
        filePath: dto.filePath,
        durationMs: dto.durationMs,
        exitCode: dto.exitCode,
      },
    });
    return { status: 'recorded' };
  }

  async flush(connectorId: string): Promise<{ flushed: number }> {
    const keys = [...this.openBursts.keys()].filter((key) => key.startsWith(`${connectorId}:`));
    for (const key of keys) {
      await this.flushBurst(key);
    }
    return { flushed: keys.length };
  }

  private async recordEdit(connector: ConnectorView, dto: ReportIdeActivityDto): Promise<void> {
    const key = `${connector.id}:${dto.filePath}`;
    const existing = this.openBursts.get(key);

    if (existing) {
      const gap = new Date(dto.occurredAt).getTime() - new Date(existing.lastActivityAt).getTime();
      if (gap >= 0 && gap <= EDIT_BURST_GAP_MS) {
        existing.lastActivityAt = dto.occurredAt;
        existing.editCount += 1;
        return;
      }
      // 무활동 간격을 넘겼으면 이전 burst를 먼저 확정하고 새로 시작한다.
      await this.flushBurst(key);
    }

    this.openBursts.set(key, {
      connectorId: connector.id,
      projectId: connector.projectId!,
      filePath: dto.filePath,
      branch: dto.branch,
      burstStartAt: dto.occurredAt,
      lastActivityAt: dto.occurredAt,
      editCount: 1,
    });
  }

  private async flushBurst(key: string): Promise<void> {
    const burst = this.openBursts.get(key);
    if (!burst) {
      return;
    }
    this.openBursts.delete(key);

    const durationMs = new Date(burst.lastActivityAt).getTime() - new Date(burst.burstStartAt).getTime();

    await this.timelineService.appendEvent({
      connectorId: burst.connectorId,
      projectId: burst.projectId,
      source: 'ide',
      type: 'file_edit_burst',
      occurredAt: burst.burstStartAt,
      dedupKey: `ide:${burst.connectorId}:file_edit_burst:${burst.filePath}:${burst.burstStartAt}`,
      correlationHints: {
        filePath: burst.filePath,
        ...(burst.branch ? { branch: burst.branch } : {}),
      },
      payload: {
        filePath: burst.filePath,
        durationMs,
        editCount: burst.editCount,
      },
    });
  }

  private assertValidDto(dto: ReportIdeActivityDto): void {
    if (!dto.filePath) {
      throw new BadRequestException('filePath는 필수 값입니다.');
    }
    if (!dto.activityType || !['edit', 'run', 'debug_session'].includes(dto.activityType)) {
      throw new BadRequestException('activityType은 edit/run/debug_session 중 하나여야 합니다.');
    }
    if (!dto.occurredAt || Number.isNaN(new Date(dto.occurredAt).getTime())) {
      throw new BadRequestException('occurredAt은 유효한 ISO 8601 날짜 문자열이어야 합니다.');
    }
  }

  private async assertUsableConnector(connectorId: string): Promise<ConnectorView> {
    const connector = await this.connectorService.getById(connectorId);
    if (connector.pluginKey !== 'ide-collector') {
      throw new BadRequestException('ide-collector 타입의 Connector가 아닙니다.');
    }
    if (connector.status === 'disabled') {
      throw new BadRequestException('비활성화된 Connector입니다. 먼저 활성화하세요.');
    }
    if (!connector.projectId) {
      throw new BadRequestException('ide-collector Connector는 projectId가 필요합니다.');
    }
    return connector;
  }
}
