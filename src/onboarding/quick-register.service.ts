import { Injectable, Logger } from '@nestjs/common';
import { Project } from '@prisma/client';
import { ProjectService } from '../projects/project.service';
import { ConnectorService } from '../connectors/connector.service';
import { GitCollectorService } from '../collectors/git/git-collector.service';
import { CorrelationService } from '../timeline/correlation.service';

export interface QuickRegisterResult {
  project: Project;
  connectorId: string;
  scannedCommits: number;
  truncated: boolean;
  sessionsCreated: number;
  syncError: string | null;
}

// "프로젝트 등록 → 커넥터 등록 → 동기화 → 세션 재계산" 4단계를 사용자가 매번 순서대로
// 밟지 않아도 되도록, 가장 흔한 경우(로컬 git 저장소)를 한 번의 호출로 묶어서 처리한다.
@Injectable()
export class QuickRegisterService {
  private readonly logger = new Logger(QuickRegisterService.name);

  constructor(
    private readonly projectService: ProjectService,
    private readonly connectorService: ConnectorService,
    private readonly gitCollectorService: GitCollectorService,
    private readonly correlationService: CorrelationService,
  ) {}

  async registerAndSync(name: string, rootPath: string): Promise<QuickRegisterResult> {
    const project = await this.projectService.register({ name, rootPath });
    const connector = await this.connectorService.register({
      pluginKey: 'git-collector',
      projectId: project.id,
      config: {},
    });

    let scannedCommits = 0;
    let truncated = false;
    let syncError: string | null = null;

    try {
      const syncResult = await this.gitCollectorService.sync(connector.id);
      scannedCommits = syncResult.scannedCommits;
      truncated = syncResult.truncated;
    } catch (error) {
      // git 저장소가 아니거나 경로가 잘못됐어도 프로젝트/커넥터 등록 자체는 유효하게 남겨둔다 —
      // 사용자가 경로를 고치거나 나중에 "지금 전체 동기화"로 재시도할 수 있다.
      syncError = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Project(${project.id}) 초기 동기화 실패: ${syncError}`);
    }

    let sessionsCreated = 0;
    if (scannedCommits > 0) {
      const correlationResult = await this.correlationService.computeForProject(project.id);
      sessionsCreated = correlationResult.sessionsCreated;
    }

    return {
      project,
      connectorId: connector.id,
      scannedCommits,
      truncated,
      sessionsCreated,
      syncError,
    };
  }
}
