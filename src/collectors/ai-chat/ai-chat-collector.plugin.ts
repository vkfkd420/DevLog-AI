import { PluginManifest } from '../../plugins/plugin-manifest.interface';

export const AI_CHAT_COLLECTOR_PLUGIN_MANIFEST: PluginManifest = {
  key: 'ai-chat-collector',
  name: 'AI 대화',
  type: 'collector',
  version: '0.1.0',
  configSchema: {
    type: 'object',
    properties: {
      redactContent: {
        type: 'boolean',
        default: false,
        description: 'true면 대화 원문 대신 길이 정보만 저장합니다.',
      },
    },
  },
  permissions: [],
  description:
    'Claude/Cursor 등 AI 도구와의 질문-응답 한 쌍을 chat_exchange 이벤트로 Timeline에 기록하는 커넥터. ' +
    'projectId는 선택 사항입니다 (프로젝트와 무관한 대화도 있을 수 있음).',
};
