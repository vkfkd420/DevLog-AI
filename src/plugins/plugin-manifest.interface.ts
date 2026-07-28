export interface PluginManifest {
  key: string;
  name: string;
  type: 'collector' | 'exporter' | 'generator';
  version: string;
  configSchema: Record<string, unknown>;
  permissions: string[];
  description: string;
}
