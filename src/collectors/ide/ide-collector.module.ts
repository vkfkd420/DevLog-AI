import { Module } from '@nestjs/common';
import { ConnectorModule } from '../../connectors/connector.module';
import { TimelineModule } from '../../timeline/timeline.module';
import { IdeCollectorController } from './ide-collector.controller';
import { IdeCollectorService } from './ide-collector.service';

@Module({
  imports: [ConnectorModule, TimelineModule],
  controllers: [IdeCollectorController],
  providers: [IdeCollectorService],
})
export class IdeCollectorModule {}
