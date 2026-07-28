import { PluginManifest } from './plugin-manifest.interface';

// 자동 Collector(Git/IDE/AI-Chat 등)가 아직 없는 활동을 사용자가 직접
// Timeline에 기록할 수 있게 해주는 기본 제공 Plugin.
export const MANUAL_ENTRY_PLUGIN_MANIFEST: PluginManifest = {
  key: 'manual-entry',
  name: '수동 입력',
  type: 'collector',
  version: '0.1.0',
  configSchema: {},
  permissions: [],
  description: '자동 Collector가 없는 활동을 사용자가 직접 Timeline에 기록할 때 사용하는 기본 제공 커넥터',
};
