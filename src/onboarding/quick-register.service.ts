import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Project } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
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

export interface DiscoveredProject {
  path: string;
  name: string;
}

const DISCOVER_MAX_DEPTH = 2;
const DISCOVER_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo']);

function normalizePath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
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

  // 지정한 상위 폴더 아래(최대 2단계)에서 .git 저장소를 찾아 후보로 보여준다 — 자동으로
  // 등록하지 않고 후보만 반환하며, 이미 등록된 프로젝트는 목록에서 제외한다.
  async discover(rootPath: string): Promise<DiscoveredProject[]> {
    const root = path.resolve(rootPath);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new BadRequestException(`"${rootPath}" 폴더를 찾을 수 없습니다.`);
    }

    const existingProjects = await this.projectService.list({ includeArchived: 'true' });
    const existingRootPaths = new Set(existingProjects.map((p) => normalizePath(p.rootPath)));

    const results: DiscoveredProject[] = [];

    const scan = (dir: string, depth: number) => {
      if (depth > DISCOVER_MAX_DEPTH) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || DISCOVER_IGNORE.has(entry.name)) {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (fs.existsSync(path.join(full, '.git'))) {
          if (!existingRootPaths.has(normalizePath(full))) {
            results.push({ path: full.replace(/\\/g, '/'), name: entry.name });
          }
          continue;
        }
        scan(full, depth + 1);
      }
    };

    scan(root, 1);
    return results;
  }
}
