import { PluginManifest } from '../../plugins/plugin-manifest.interface';

export const IDE_COLLECTOR_PLUGIN_MANIFEST: PluginManifest = {
  key: 'ide-collector',
  name: 'IDE',
  type: 'collector',
  version: '0.1.0',
  configSchema: {},
  permissions: [],
  description:
    'IDE(예: VSCode 확장)가 보내주는 파일 편집/실행/디버그 활동을 Timeline에 기록하는 커넥터. ' +
    '편집 활동은 무활동 2분을 기준으로 하나의 작업 단위(burst)로 자동 집계됩니다. Connector 등록 시 projectId가 필요합니다.',
};
