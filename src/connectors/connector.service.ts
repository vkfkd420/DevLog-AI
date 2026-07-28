import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Connector, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterConnectorDto } from './dto/register-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { QueryConnectorsDto } from './dto/query-connectors.dto';

export type ConnectorView = Omit<Connector, 'config'> & { config: Record<string, unknown> };

const ALLOWED_STATUSES = ['enabled', 'disabled'];

@Injectable()
export class ConnectorService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterConnectorDto): Promise<ConnectorView> {
    if (!dto.pluginKey) {
      throw new BadRequestException('pluginKey는 필수 값입니다.');
    }
    if (dto.config === undefined || dto.config === null) {
      throw new BadRequestException('config는 필수 값입니다 (설정이 없다면 빈 객체 {}를 보내세요).');
    }

    try {
      const connector = await this.prisma.connector.create({
        data: {
          pluginKey: dto.pluginKey,
          projectId: dto.projectId,
          config: JSON.stringify(dto.config),
        },
      });
      return this.toView(connector);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          'pluginKey 또는 projectId가 존재하지 않습니다. 등록된 Plugin/Project인지 확인하세요.',
        );
      }
      throw error;
    }
  }

  async list(filter: QueryConnectorsDto): Promise<ConnectorView[]> {
    const connectors = await this.prisma.connector.findMany({
      where: {
        pluginKey: filter.pluginKey,
        projectId: filter.projectId,
        status: filter.status,
      },
      orderBy: { createdAt: 'asc' },
    });
    return connectors.map((connector) => this.toView(connector));
  }

  async getById(id: string): Promise<ConnectorView> {
    const connector = await this.prisma.connector.findUnique({ where: { id } });
    if (!connector) {
      throw new NotFoundException(`Connector(${id})를 찾을 수 없습니다.`);
    }
    return this.toView(connector);
  }

  async update(id: string, dto: UpdateConnectorDto): Promise<ConnectorView> {
    if (dto.status !== undefined && !ALLOWED_STATUSES.includes(dto.status)) {
      throw new BadRequestException(`status는 ${ALLOWED_STATUSES.join('/')} 중 하나여야 합니다.`);
    }

    try {
      const updated = await this.prisma.connector.update({
        where: { id },
        data: {
          config: dto.config !== undefined ? JSON.stringify(dto.config) : undefined,
          status: dto.status,
        },
      });
      return this.toView(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Connector(${id})를 찾을 수 없습니다.`);
      }
      throw error;
    }
  }

  /**
   * Collector의 실제 동작 결과(sync 성공/실패)를 기존 헬스체크 필드에 기록한다.
   * 성공하면 error 상태였던 Connector는 enabled로 자동 복구된다.
   */
  async recordSyncResult(id: string, result: { success: boolean; error?: string }): Promise<ConnectorView> {
    const current = await this.getById(id);
    const nextStatus = result.success ? (current.status === 'error' ? 'enabled' : current.status) : 'error';

    const updated = await this.prisma.connector.update({
      where: { id },
      data: {
        lastHealthCheckAt: new Date(),
        lastError: result.success ? null : result.error ?? '알 수 없는 오류',
        status: nextStatus,
      },
    });
    return this.toView(updated);
  }

  private toView(connector: Connector): ConnectorView {
    return { ...connector, config: JSON.parse(connector.config) };
  }
}
