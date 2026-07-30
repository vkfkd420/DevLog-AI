import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { AutoDraftSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateAutoDraftSettingDto {
  enabled?: boolean;
  time?: string;
  daysOfWeek?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_PATTERN = /^[0-6](,[0-6])*$/;

// AutoDraftSetting은 Workspace와 같은 "항상 정확히 1개만 존재" 패턴 — 앱 시작 시 없으면 하나 만든다.
@Injectable()
export class SettingsService implements OnModuleInit {
  private id: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.autoDraftSetting.findFirst();
    if (existing) {
      this.id = existing.id;
      return;
    }
    const created = await this.prisma.autoDraftSetting.create({ data: {} });
    this.id = created.id;
  }

  async get(): Promise<AutoDraftSetting> {
    return this.prisma.autoDraftSetting.findUniqueOrThrow({ where: { id: this.resolveId() } });
  }

  async update(dto: UpdateAutoDraftSettingDto): Promise<AutoDraftSetting> {
    if (dto.time !== undefined && !TIME_PATTERN.test(dto.time)) {
      throw new BadRequestException('time은 "HH:mm" 24시간제 형식이어야 합니다 (예: 18:00).');
    }
    if (dto.daysOfWeek !== undefined && (!dto.daysOfWeek || !DAY_PATTERN.test(dto.daysOfWeek))) {
      throw new BadRequestException('daysOfWeek는 0~6 숫자를 콤마로 구분한 값이어야 합니다 (예: 1,2,3,4,5).');
    }
    return this.prisma.autoDraftSetting.update({ where: { id: this.resolveId() }, data: dto });
  }

  async markRun(dateKey: string): Promise<void> {
    await this.prisma.autoDraftSetting.update({ where: { id: this.resolveId() }, data: { lastRunDate: dateKey } });
  }

  private resolveId(): string {
    if (!this.id) {
      throw new Error('AutoDraftSetting이 아직 초기화되지 않았습니다.');
    }
    return this.id;
  }
}
