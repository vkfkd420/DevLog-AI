import { Module } from '@nestjs/common';
import { ProjectModule } from '../projects/project.module';
import { TodoController } from './todo.controller';
import { TodoService } from './todo.service';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [ProjectModule],
  controllers: [TodoController],
  providers: [TodoService, RecommendationService],
})
export class TodoModule {}
