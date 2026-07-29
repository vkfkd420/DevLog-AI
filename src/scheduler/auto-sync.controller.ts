import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AutoSyncService } from './auto-sync.service';

@ApiTags('Sync')
@Controller('sync')
export class AutoSyncController {
  constructor(private readonly autoSyncService: AutoSyncService) {}

  // 5분 주기 자동 실행을 기다리지 않고, 지금 바로 전체 git-collector를 동기화하고 싶을 때 사용.
  @Post('run-all')
  runAll() {
    return this.autoSyncService.runAll();
  }
}
