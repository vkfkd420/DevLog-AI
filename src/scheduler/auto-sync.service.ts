import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConnectorService } from '../connectors/connector.service';
import { GitCollectorService } from '../collectors/git/git-collector.service';
import { CorrelationService } from '../timeline/correlation.service';

// 새 커밋이 생겨도 사용자가 매번 수동으로 "동기화"와 "세션 재계산"을 누를 필요가 없도록,
// 활성화된 git-collector 전부를 주기적으로 동기화하고 영향받은 프로젝트의 세션을 재계산한다.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface AutoSyncResult {
  ranAt: string;
  syncedConnectors: number;
  failedConnectors: number;
  projectsRecomputed: number;
}

@Injectable()
export class AutoSyncService {
  private readonly logger = new Logger(AutoSyncService.name);

  constructor(
    private readonly connectorService: ConnectorService,
    private readonly gitCollectorService: GitCollectorService,
    private readonly correlationService: CorrelationService,
  ) {}

  @Interval(AUTO_SYNC_INTERVAL_MS)
  private async handleInterval(): Promise<void> {
    const result = await this.runAll();
    this.logger.log(
      `자동 동기화: 커넥터 ${result.syncedConnectors}개 성공 / ${result.failedConnectors}개 실패, 프로젝트 ${result.projectsRecomputed}개 세션 재계산`,
    );
  }

  async runAll(): Promise<AutoSyncResult> {
    const connectors = await this.connectorService.list({ pluginKey: 'git-collector' });
    const active = connectors.filter((connector) => connector.status !== 'disabled' && connector.projectId);

    let syncedConnectors = 0;
    let failedConnectors = 0;
    const projectIds = new Set<string>();

    for (const connector of active) {
      try {
        await this.gitCollectorService.sync(connector.id);
        syncedConnectors += 1;
        projectIds.add(connector.projectId!);
      } catch (error) {
        failedConnectors += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Connector(${connector.id}) 동기화 실패: ${message}`);
      }
    }

    let projectsRecomputed = 0;
    for (const projectId of projectIds) {
      try {
        await this.correlationService.computeForProject(projectId);
        projectsRecomputed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Project(${projectId}) 세션 재계산 실패: ${message}`);
      }
    }

    return {
      ranAt: new Date().toISOString(),
      syncedConnectors,
      failedConnectors,
      projectsRecomputed,
    };
  }
}
