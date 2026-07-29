import { Module } from '@nestjs/common';
import { ConnectorModule } from '../../connectors/connector.module';
import { ProjectModule } from '../../projects/project.module';
import { TimelineModule } from '../../timeline/timeline.module';
import { GitCollectorController } from './git-collector.controller';
import { GitCollectorService } from './git-collector.service';

@Module({
  imports: [ConnectorModule, ProjectModule, TimelineModule],
  controllers: [GitCollectorController],
  providers: [GitCollectorService],
  exports: [GitCollectorService],
})
export class GitCollectorModule {}
