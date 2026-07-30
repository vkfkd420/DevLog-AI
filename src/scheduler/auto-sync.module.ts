import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConnectorModule } from '../connectors/connector.module';
import { GitCollectorModule } from '../collectors/git/git-collector.module';
import { TimelineModule } from '../timeline/timeline.module';
import { SettingsModule } from '../settings/settings.module';
import { ProjectModule } from '../projects/project.module';
import { WorklogModule } from '../documents/worklog/worklog.module';
import { AutoSyncService } from './auto-sync.service';
import { AutoSyncController } from './auto-sync.controller';
import { DailyWorklogService } from './daily-worklog.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConnectorModule,
    GitCollectorModule,
    TimelineModule,
    SettingsModule,
    ProjectModule,
    WorklogModule,
  ],
  controllers: [AutoSyncController],
  providers: [AutoSyncService, DailyWorklogService],
})
export class AutoSyncModule {}
