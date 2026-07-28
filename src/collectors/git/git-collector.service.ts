import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { ConnectorService } from '../../connectors/connector.service';
import { ProjectService } from '../../projects/project.service';
import { TimelineService } from '../../timeline/timeline.service';

// git log 출력에서 커밋 레코드/필드 구분자로 쓸 제어문자 (커밋 메시지에 나타날 일이 없다)
const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

// 커서(lastHealthCheckAt)가 없는 첫 sync에서 스캔할 최대 커밋 수.
// 이 한도에 걸리면 결과의 truncated=true로 명시한다 (조용히 누락시키지 않음).
const MAX_COMMITS_WITHOUT_CURSOR = 500;

interface ParsedCommit {
  hash: string;
  authorDate: string;
  authorName: string;
  subject: string;
  files: string[];
}

export interface GitSyncResult {
  connectorId: string;
  scannedCommits: number;
  truncated: boolean;
}

@Injectable()
export class GitCollectorService {
  constructor(
    private readonly connectorService: ConnectorService,
    private readonly projectService: ProjectService,
    private readonly timelineService: TimelineService,
  ) {}

  async sync(connectorId: string): Promise<GitSyncResult> {
    const connector = await this.connectorService.getById(connectorId);

    if (connector.pluginKey !== 'git-collector') {
      throw new BadRequestException('git-collector 타입의 Connector가 아닙니다.');
    }
    if (connector.status === 'disabled') {
      throw new BadRequestException('비활성화된 Connector입니다. 먼저 활성화하세요.');
    }
    if (!connector.projectId) {
      throw new BadRequestException('git-collector Connector는 projectId가 필요합니다.');
    }

    const project = await this.projectService.getById(connector.projectId);
    const hasCursor = connector.lastHealthCheckAt !== null;

    try {
      const currentBranch = (await this.runGit(project.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();

      const logArgs = [
        'log',
        '--name-only',
        '--date=iso-strict',
        `--pretty=format:${RECORD_SEP}%H${FIELD_SEP}%aI${FIELD_SEP}%an${FIELD_SEP}%s`,
      ];
      if (hasCursor) {
        logArgs.push(`--since=${connector.lastHealthCheckAt!.toISOString()}`);
      } else {
        logArgs.push(`--max-count=${MAX_COMMITS_WITHOUT_CURSOR}`);
      }

      const rawLog = await this.runGit(project.rootPath, logArgs);
      const commits = this.parseGitLog(rawLog);

      // git log는 최신 커밋이 먼저 나오므로, 실제 발생 순서로 Timeline에 쌓기 위해 뒤집는다.
      for (const commit of [...commits].reverse()) {
        await this.timelineService.appendEvent({
          connectorId: connector.id,
          projectId: connector.projectId,
          source: 'git',
          type: 'commit',
          occurredAt: commit.authorDate,
          dedupKey: `git:${connector.id}:${commit.hash}`,
          correlationHints: {
            branch: currentBranch,
            ...(commit.files[0] ? { filePath: commit.files[0] } : {}),
          },
          payload: {
            hash: commit.hash,
            authorName: commit.authorName,
            message: commit.subject,
            files: commit.files,
          },
        });
      }

      await this.connectorService.recordSyncResult(connector.id, { success: true });

      return {
        connectorId: connector.id,
        scannedCommits: commits.length,
        truncated: !hasCursor && commits.length === MAX_COMMITS_WITHOUT_CURSOR,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.connectorService.recordSyncResult(connector.id, { success: false, error: message });
      throw new BadRequestException(`Git 동기화에 실패했습니다: ${message}`);
    }
  }

  private runGit(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.toString().trim() || error.message));
          return;
        }
        resolve(stdout.toString());
      });
    });
  }

  private parseGitLog(raw: string): ParsedCommit[] {
    return raw
      .split(RECORD_SEP)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .map((block) => {
        const lines = block.split('\n');
        const [hash, authorDate, authorName, subject] = lines[0].split(FIELD_SEP);
        const files = lines
          .slice(1)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        return { hash, authorDate, authorName, subject, files };
      });
  }
}
