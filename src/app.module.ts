import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TimelineModule } from './timeline/timeline.module';
import { PluginModule } from './plugins/plugin.module';
import { ConnectorModule } from './connectors/connector.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProjectModule } from './projects/project.module';
import { GitCollectorModule } from './collectors/git/git-collector.module';
import { IdeCollectorModule } from './collectors/ide/ide-collector.module';
import { AiChatCollectorModule } from './collectors/ai-chat/ai-chat-collector.module';
import { DocumentModule } from './documents/document.module';
import { WorklogModule } from './documents/worklog/worklog.module';
import { ReportModule } from './documents/report/report.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SearchModule } from './search/search.module';
import { AutoSyncModule } from './scheduler/auto-sync.module';
import { QuickRegisterModule } from './onboarding/quick-register.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    PluginModule,
    ConnectorModule,
    WorkspaceModule,
    ProjectModule,
    GitCollectorModule,
    IdeCollectorModule,
    AiChatCollectorModule,
    DocumentModule,
    WorklogModule,
    ReportModule,
    KnowledgeModule,
    SearchModule,
    AutoSyncModule,
    QuickRegisterModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
