import { Injectable, InternalServerErrorException } from '@nestjs/common';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface LlmCompletionRequest {
  model: string;
  system: string;
  userContent: string;
  maxTokens?: number;
}

interface AnthropicMessageResponse {
  content: { type: string; text?: string }[];
}

// 문서 타입(업무일지/트러블슈팅/주간보고서 등)이 공통으로 쓰는 LLM 호출 창구.
// Retrieval 단계에서 조립된 텍스트만 받아 그대로 전달한다 — 여기서는 어떤 문서 타입인지 알지 못한다.
@Injectable()
export class LlmGatewayService {
  async complete(request: LlmCompletionRequest): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env 파일에 추가한 뒤 서버를 다시 시작하세요.',
      );
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 2000,
        system: request.system,
        messages: [{ role: 'user', content: request.userContent }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(`LLM 호출에 실패했습니다 (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as AnthropicMessageResponse;
    const text = data.content?.find((block) => block.type === 'text')?.text;
    if (!text) {
      throw new InternalServerErrorException('LLM 응답에서 텍스트를 찾을 수 없습니다.');
    }
    return text;
  }
}
