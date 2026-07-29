import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocumentService } from './document.service';

interface EditDocumentDto {
  content: string;
  changeNote?: string;
}

@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  list(@Query('projectId') projectId?: string, @Query('type') type?: string) {
    return this.documentService.list({ projectId, type });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.documentService.getById(id);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.documentService.listVersions(id);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() dto: EditDocumentDto) {
    if (!dto.content) {
      throw new BadRequestException('content는 필수 값입니다.');
    }
    return this.documentService.editContent(id, dto.content, dto.changeNote);
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string) {
    return this.documentService.finalize(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.documentService.remove(id);
    return { id, deleted: true };
  }
}
