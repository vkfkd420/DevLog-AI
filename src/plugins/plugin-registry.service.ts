import { Injectable, OnModuleInit } from '@nestjs/common';
import { Plugin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MANUAL_ENTRY_PLUGIN_MANIFEST } from './manual-entry.plugin';
import { PluginManifest } from './plugin-manifest.interface';
import { GIT_COLLECTOR_PLUGIN_MANIFEST } from '../collectors/git/git-collector.plugin';
import { IDE_COLLECTOR_PLUGIN_MANIFEST } from '../collectors/ide/ide-collector.plugin';
import { AI_CHAT_COLLECTOR_PLUGIN_MANIFEST } from '../collectors/ai-chat/ai-chat-collector.plugin';

// 새 Collector/Exporter/Generator를 만들면 이 목록에 자신의 manifest를 추가한다.
// (10단계 설계: "Plugin은 자신을 등록한다" — 코어는 이 목록만 보고 동작한다.)
const BUILTIN_MANIFESTS: PluginManifest[] = [
  MANUAL_ENTRY_PLUGIN_MANIFEST,
  GIT_COLLECTOR_PLUGIN_MANIFEST,
  IDE_COLLECTOR_PLUGIN_MANIFEST,
  AI_CHAT_COLLECTOR_PLUGIN_MANIFEST,
];

export type PluginView = Omit<Plugin, 'configSchema' | 'permissions'> & {
  configSchema: Record<string, unknown>;
  permissions: string[];
};

@Injectable()
export class PluginRegistryService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const manifest of BUILTIN_MANIFESTS) {
      await this.prisma.plugin.upsert({
        where: { key: manifest.key },
        update: {
          name: manifest.name,
          type: manifest.type,
          version: manifest.version,
          configSchema: JSON.stringify(manifest.configSchema),
          permissions: JSON.stringify(manifest.permissions),
          description: manifest.description,
        },
        create: {
          key: manifest.key,
          name: manifest.name,
          type: manifest.type,
          version: manifest.version,
          configSchema: JSON.stringify(manifest.configSchema),
          permissions: JSON.stringify(manifest.permissions),
          description: manifest.description,
        },
      });
    }
  }

  async listPlugins(): Promise<PluginView[]> {
    const plugins = await this.prisma.plugin.findMany();
    return plugins.map((plugin) => ({
      ...plugin,
      configSchema: JSON.parse(plugin.configSchema),
      permissions: JSON.parse(plugin.permissions),
    }));
  }
}
