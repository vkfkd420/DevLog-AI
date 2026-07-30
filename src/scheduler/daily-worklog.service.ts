import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SettingsService } from '../settings/settings.service';
import { ProjectService } from '../projects/project.service';
import { WorklogGeneratorService } from '../documents/worklog/worklog-generator.service';

function todayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 사용자가 설정 탭에서 지정한 요일 + 시각에, 활성 프로젝트마다 오늘자 업무일지를
// 초안으로만 생성한다(확정 X). 1분마다 깨어나서 조건을 확인하는 폴링 방식 —
// 정확히 그 분(HH:mm)에 한 번만 돌리고, lastRunDate로 같은 날 중복 실행을 막는다.
@Injectable()
export class DailyWorklogService {
  private readonly logger = new Logger(DailyWorklogService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly projectService: ProjectService,
    private readonly worklogGeneratorService: WorklogGeneratorService,
  ) {}

  @Interval(60_000)
  private async checkAndRun(): Promise<void> {
    const settings = await this.settingsService.get();
    if (!settings.enabled) {
      return;
    }

    const now = new Date();
    const days = settings.daysOfWeek.split(',').map(Number);
    if (!days.includes(now.getDay())) {
      return;
    }

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (currentTime !== settings.time) {
      return;
    }

    const dateKey = todayKey(now);
    if (settings.lastRunDate === dateKey) {
      return;
    }

    const projects = await this.projectService.list({});
    for (const project of projects) {
      try {
        await this.worklogGeneratorService.generate(project.id, dateKey);
      } catch (error) {
        // 이미 확정된 문서면 재생성이 막히는 게 정상 동작 — 로그만 남기고 다음 프로젝트로 진행한다.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Project(${project.id}) 자동 초안 생성 실패: ${message}`);
      }
    }

    await this.settingsService.markRun(dateKey);
    this.logger.log(`자동 업무일지 초안 생성 완료 (${dateKey}, 프로젝트 ${projects.length}개)`);
  }
}
