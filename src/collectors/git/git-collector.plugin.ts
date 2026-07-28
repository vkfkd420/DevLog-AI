import { PluginManifest } from '../../plugins/plugin-manifest.interface';

export const GIT_COLLECTOR_PLUGIN_MANIFEST: PluginManifest = {
  key: 'git-collector',
  name: 'Git',
  type: 'collector',
  version: '0.1.0',
  configSchema: {},
  permissions: ['filesystem:read'],
  description:
    '로컬 Git 레포의 커밋 이력을 Timeline에 기록하는 커넥터. Connector 등록 시 projectId가 필요합니다.',
};
