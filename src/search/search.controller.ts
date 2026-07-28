import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('projectId') projectId: string, @Query('q') q?: string) {
    if (!projectId) {
      throw new BadRequestException('projectId는 필수 값입니다.');
    }
    if (!q || !q.trim()) {
      return { commits: [], aiChats: [], files: [], worklogs: [], knowledge: [] };
    }
    return this.searchService.search(projectId, q.trim());
  }
}
