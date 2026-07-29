import { Module } from '@nestjs/common';
import { ProjectModule } from '../projects/project.module';
import { ConnectorModule } from '../connectors/connector.module';
import { GitCollectorModule } from '../collectors/git/git-collector.module';
import { TimelineModule } from '../timeline/timeline.module';
import { QuickRegisterService } from './quick-register.service';
import { QuickRegisterController } from './quick-register.controller';

@Module({
  imports: [ProjectModule, ConnectorModule, GitCollectorModule, TimelineModule],
  controllers: [QuickRegisterController],
  providers: [QuickRegisterService],
})
export class QuickRegisterModule {}
