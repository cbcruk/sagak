import type { Plugin, EditorContext } from './types'

/**
 * 플러그인 상태
 */
const PluginState = {
  /** 초기화되지 않음 */
  NOT_INITIALIZED: 'not_initialized',
  /** 초기화 중 */
  INITIALIZING: 'initializing',
  /** 초기화 완료 */
  INITIALIZED: 'initialized',
  /** 실패 */
  FAILED: 'failed',
} as const

type PluginStateValue = (typeof PluginState)[keyof typeof PluginState]

/**
 * 내부 플러그인 메타데이터
 */
interface PluginMetadata {
  /** 플러그인 인스턴스 */
  plugin: Plugin
  /** 플러그인 상태 */
  state: PluginStateValue
  /** 에러 정보 (실패 시) */
  error?: Error
}

/**
 * 플러그인 등록, 초기화, 의존성, 생명주기를 관리합니다.
 *
 * 기능:
 * - 자동 의존성 해결
 * - 비동기 플러그인 초기화
 * - 순환 의존성 감지
 * - 에러 처리 및 복구
 * - 플러그인 생명주기 관리
 *
 * @example
 * ```typescript
 * const manager = new PluginManager(context);
 *
 * // Register a plugin
 * await manager.register(BoldPlugin);
 *
 * // Get a plugin
 * const plugin = manager.get('text-style:bold');
 *
 * // Remove a plugin
 * manager.remove('text-style:bold');
 *
 * // Destroy all plugins
 * manager.destroyAll();
 * ```
 */
export class PluginManager {
  private plugins: Map<string, PluginMetadata> = new Map()
  private context: EditorContext

  constructor(context: EditorContext) {
    this.context = context
    this.context.pluginManager = this
  }

  /**
   * 플러그인을 등록하고 초기화합니다
   *
   * @param plugin 등록할 플러그인
   * @throws 플러그인 이름이 중복되거나 의존성이 충족되지 않으면 에러 발생
   *
   * @example
   * ```typescript
   * await manager.register({
   *   name: 'my-plugin',
   *   initialize(context) {
   *     console.log('Plugin initialized');
   *   }
   * });
   * ```
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`)
    }

    const metadata: PluginMetadata = {
      plugin,
      state: PluginState.NOT_INITIALIZED,
    }

    this.plugins.set(plugin.name, metadata)

    try {
      await this.resolveDependencies(plugin)

      metadata.state = PluginState.INITIALIZING
      await plugin.initialize(this.context)
      metadata.state = PluginState.INITIALIZED
    } catch (error) {
      metadata.state = PluginState.FAILED
      metadata.error = error as Error
      this.plugins.delete(plugin.name)

      throw new Error(
        `Failed to initialize plugin "${plugin.name}": ${
          (error as Error).message
        }`
      )
    }
  }

  /**
   * 플러그인 의존성을 해결합니다
   *
   * @param plugin 확인할 플러그인
   * @throws 의존성이 충족되지 않거나 순환 의존성이 감지되면 에러 발생
   */
  private async resolveDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return
    }

    const missing = plugin.dependencies.filter((dep) => !this.plugins.has(dep))

    if (missing.length > 0) {
      throw new Error(
        `Plugin "${plugin.name}" has missing dependencies: ${missing.join(
          ', '
        )}`
      )
    }

    this.checkCircularDependencies(plugin.name, plugin.dependencies)

    for (const depName of plugin.dependencies) {
      const depMetadata = this.plugins.get(depName)!

      if (depMetadata.state === PluginState.FAILED) {
        throw new Error(
          `Plugin "${plugin.name}" depends on failed plugin "${depName}"`
        )
      }

      if (depMetadata.state === PluginState.INITIALIZING) {
        throw new Error(
          `Circular dependency detected: "${plugin.name}" depends on "${depName}" which is still initializing`
        )
      }

      if (depMetadata.state !== PluginState.INITIALIZED) {
        throw new Error(
          `Plugin "${plugin.name}" depends on "${depName}" which is not initialized`
        )
      }
    }
  }

  /**
   * `DFS`를 사용하여 순환 의존성을 확인합니다
   *
   * @param pluginName 확인할 플러그인 이름
   * @param dependencies 직접 의존성
   * @param visited 순환 감지를 위해 이미 방문한 플러그인
   */
  private checkCircularDependencies(
    pluginName: string,
    dependencies: string[],
    visited: Set<string> = new Set()
  ): void {
    if (visited.has(pluginName)) {
      throw new Error(
        `Circular dependency detected: ${Array.from(visited).join(' → ')} → ${pluginName}`
      )
    }

    visited.add(pluginName)

    for (const depName of dependencies) {
      const depMetadata = this.plugins.get(depName)

      if (depMetadata && depMetadata.plugin.dependencies) {
        this.checkCircularDependencies(
          depName,
          depMetadata.plugin.dependencies,
          new Set(visited)
        )
      }
    }
  }

  /**
   * 등록된 플러그인을 가져옵니다
   *
   * @param name 플러그인 이름
   * @returns 플러그인 인스턴스 또는 `undefined`
   *
   * @example
   * ```typescript
   * const plugin = manager.get('text-style:bold');
   * if (plugin) {
   *   console.log('Plugin found:', plugin.name);
   * }
   * ```
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name)?.plugin
  }

  /**
   * 플러그인이 등록되어 있는지 확인합니다
   *
   * @param name 플러그인 이름
   * @returns 플러그인이 존재하면 `true`
   */
  has(name: string): boolean {
    return this.plugins.has(name)
  }

  /**
   * 플러그인 상태를 가져옵니다
   *
   * @param name 플러그인 이름
   * @returns 플러그인 상태 또는 `undefined`
   */
  getState(name: string): PluginStateValue | undefined {
    return this.plugins.get(name)?.state
  }

  /**
   * 플러그인을 제거합니다
   * `destroy()`가 정의되어 있으면 호출합니다
   *
   * @param name 플러그인 이름
   *
   * @example
   * ```typescript
   * manager.remove('text-style:bold');
   * ```
   */
  remove(name: string): void {
    const metadata = this.plugins.get(name)

    if (!metadata) return

    try {
      metadata.plugin.destroy?.()
    } catch (error) {
      console.error(`Error destroying plugin "${name}":`, error)
    }

    this.plugins.delete(name)
  }

  /**
   * 등록된 모든 플러그인 이름을 가져옵니다
   *
   * @returns 플러그인 이름 배열
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys())
  }

  /**
   * 등록된 모든 플러그인을 가져옵니다
   *
   * @returns 플러그인 배열
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map((m) => m.plugin)
  }

  /**
   * 모든 플러그인을 정리합니다
   * 등록 역순으로 각 플러그인의 `destroy()`를 호출합니다
   *
   * @example
   * ```typescript
   * manager.destroyAll();
   * ```
   */
  destroyAll(): void {
    const plugins = Array.from(this.plugins.values()).reverse()

    for (const metadata of plugins) {
      try {
        metadata.plugin.destroy?.()
      } catch (error) {
        console.error(
          `Error destroying plugin "${metadata.plugin.name}":`,
          error
        )
      }
    }

    this.plugins.clear()
  }

  /**
   * 등록된 플러그인 수를 가져옵니다
   */
  get size(): number {
    return this.plugins.size
  }
}
