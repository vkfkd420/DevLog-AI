import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Workspace는 지금은 항상 정확히 1개만 존재한다 (4단계 DB 설계).
// 사용자가 직접 만들지 않고, 앱 시작 시 없으면 하나 자동 생성해 내부적으로만 참조한다.
@Injectable()
export class WorkspaceService implements OnModuleInit {
  private workspaceId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.workspace.findFirst();
    if (existing) {
      this.workspaceId = existing.id;
      return;
    }
    const created = await this.prisma.workspace.create({
      data: { name: '기본 워크스페이스' },
    });
    this.workspaceId = created.id;
  }

  getWorkspaceId(): string {
    if (!this.workspaceId) {
      throw new Error('Workspace가 아직 초기화되지 않았습니다.');
    }
    return this.workspaceId;
  }
}
