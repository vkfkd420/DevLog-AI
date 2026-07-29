import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuickRegisterService } from './quick-register.service';

interface QuickRegisterDto {
  name: string;
  rootPath: string;
}

@ApiTags('Projects')
@Controller('projects')
export class QuickRegisterController {
  constructor(private readonly quickRegisterService: QuickRegisterService) {}

  // 프로젝트 등록 + git-collector 커넥터 등록 + 초기 동기화 + 세션 재계산을 한 번에 처리한다.
  @Post('quick-register')
  quickRegister(@Body() dto: QuickRegisterDto) {
    if (!dto.name || !dto.rootPath) {
      throw new BadRequestException('name과 rootPath는 필수입니다.');
    }
    return this.quickRegisterService.registerAndSync(dto.name, dto.rootPath);
  }
}
