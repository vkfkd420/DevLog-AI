import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConnectorModule } from '../connectors/connector.module';
import { GitCollectorModule } from '../collectors/git/git-collector.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AutoSyncService } from './auto-sync.service';
import { AutoSyncController } from './auto-sync.controller';

@Module({
  imports: [ScheduleModule.forRoot(), ConnectorModule, GitCollectorModule, TimelineModule],
  controllers: [AutoSyncController],
  providers: [AutoSyncService],
})
export class AutoSyncModule {}
