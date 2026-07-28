import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Document, DocumentVersion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DocumentWithContent extends Document {
  content: string | null;
}

// 문서 타입(업무일지/트러블슈팅/주간보고서 등)이 공통으로 쓰는 저장/조회 로직.
// 어떤 프롬프트를 쓰고 어떤 데이터를 모으는지는 각 타입별 Generator가 결정하고,
// 여기서는 Document/DocumentVersion/DocumentEvidence 3개 테이블만 다룬다.
@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateDraft(params: {
    projectId: string;
    type: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<Document> {
    const existing = await this.prisma.document.findFirst({
      where: { projectId: params.projectId, type: params.type, periodStart: params.periodStart },
    });

    if (existing) {
      if (existing.status === 'final') {
        throw new BadRequestException('이미 확정된 문서입니다. 재생성할 수 없습니다.');
      }
      return existing;
    }

    return this.prisma.document.create({
      data: {
        projectId: params.projectId,
        type: params.type,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      },
    });
  }

  async addVersion(
    documentId: string,
    content: string,
    generatedBy: 'ai_generated' | 'user_edited',
    sourceModel?: string,
    changeNote?: string,
  ): Promise<{ id: string; versionNumber: number }> {
    const lastVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await this.prisma.documentVersion.create({
      data: { documentId, versionNumber, content, generatedBy, sourceModel, changeNote },
    });
    await this.prisma.document.update({
      where: { id: documentId },
      data: { currentVersionId: version.id },
    });
    return version;
  }

  /** draft 상태일 때만 허용되는 사람에 의한 편집. 항상 새 버전을 추가한다(기존 버전은 보존). */
  async editContent(
    documentId: string,
    content: string,
    changeNote?: string,
  ): Promise<{ id: string; versionNumber: number }> {
    const document = await this.findOrThrow(documentId);
    if (document.status === 'final') {
      throw new BadRequestException('확정된 문서는 편집할 수 없습니다.');
    }
    return this.addVersion(documentId, content, 'user_edited', undefined, changeNote);
  }

  /** idempotent — 이미 final이면 아무 것도 바꾸지 않고 현재 상태를 그대로 반환한다. */
  async finalize(documentId: string): Promise<Document> {
    const document = await this.findOrThrow(documentId);
    if (document.status === 'final') {
      return document;
    }
    return this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'final', finalizedAt: new Date() },
    });
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    await this.findOrThrow(documentId);
    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'asc' },
    });
  }

  async addEvidence(documentId: string, eventIds: string[]): Promise<void> {
    for (const eventId of new Set(eventIds)) {
      await this.prisma.documentEvidence.upsert({
        where: { documentId_eventId: { documentId, eventId } },
        update: {},
        create: { documentId, eventId },
      });
    }
  }

  async getById(id: string): Promise<DocumentWithContent> {
    const document = await this.findOrThrow(id);
    const version = document.currentVersionId
      ? await this.prisma.documentVersion.findUnique({ where: { id: document.currentVersionId } })
      : null;
    return { ...document, content: version?.content ?? null };
  }

  async list(filter: { projectId?: string; type?: string }): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { projectId: filter.projectId, type: filter.type },
      orderBy: { periodStart: 'desc' },
    });
  }

  private async findOrThrow(id: string): Promise<Document> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document(${id})를 찾을 수 없습니다.`);
    }
    return document;
  }
}
