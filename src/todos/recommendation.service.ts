import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../projects/project.service';

export interface TodoRecommendation {
  key: string;
  type: 'resume_session' | 'pending_todo' | 'draft_worklog';
  message: string;
  projectId: string;
  sessionId?: string;
  documentId?: string;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// AI는 여기서 "추천"만 만든다 — 아무것도 저장하지 않고, 호출될 때마다 Session/Document/Todo를
// 다시 조회해서 계산만 한다. 실제로 TODO가 되는 건 사용자가 "오늘 할 일 추가"를 눌러
// POST /todos 를 호출했을 때뿐이다.
@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  async forProject(projectId: string): Promise<TodoRecommendation[]> {
    const recommendations: TodoRecommendation[] = [];
    const todayStart = startOfDay(new Date());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const lastSession = await this.prisma.session.findFirst({
      where: { projectId, startAt: { gte: yesterdayStart, lt: todayStart } },
      orderBy: { startAt: 'desc' },
    });
    if (lastSession) {
      const label = await this.describeSession(lastSession.id);
      recommendations.push({
        key: `resume:${lastSession.id}`,
        type: 'resume_session',
        message: `어제 작업하던 "${label}" 이어서 작업`,
        projectId,
        sessionId: lastSession.id,
      });
    }

    const pendingCount = await this.prisma.todo.count({
      where: { projectId, completed: false, createdAt: { lt: todayStart } },
    });
    if (pendingCount > 0) {
      recommendations.push({
        key: `pending:${projectId}`,
        type: 'pending_todo',
        message: `아직 끝내지 못한 할 일이 ${pendingCount}개 있습니다`,
        projectId,
      });
    }

    const draftDoc = await this.prisma.document.findFirst({
      where: { projectId, type: 'worklog', status: 'draft' },
      orderBy: { periodStart: 'desc' },
    });
    if (draftDoc) {
      const dateLabel = draftDoc.periodStart.toISOString().slice(0, 10);
      recommendations.push({
        key: `draft:${draftDoc.id}`,
        type: 'draft_worklog',
        message: `${dateLabel} 업무일지가 아직 초안입니다`,
        projectId,
        documentId: draftDoc.id,
      });
    }

    return recommendations;
  }

  // Session.title은 저장돼 있지 않고 매번 이벤트에서 계산된다(CorrelationService.deriveSessionTitle과
  // 동일한 방식) — 여기서도 그 세션에 연결된 이벤트 중 마지막 커밋 메시지를 우선으로 가져온다.
  private async describeSession(sessionId: string): Promise<string> {
    const events = await this.prisma.event.findMany({ where: { sessionId }, orderBy: { occurredAt: 'asc' } });
    const commits = events.filter((event) => event.source === 'git' && event.type === 'commit');
    if (commits.length > 0) {
      const payload = JSON.parse(commits[commits.length - 1].payload) as { message?: string };
      if (payload.message) {
        return payload.message;
      }
    }
    return '세션';
  }

  async forAllProjects(): Promise<TodoRecommendation[]> {
    const projects = await this.projectService.list({});
    const perProject = await Promise.all(projects.map((project) => this.forProject(project.id)));
    return perProject.flat();
  }
}
