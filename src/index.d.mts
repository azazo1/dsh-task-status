import type { Context } from '@deepseek-ai/cordis'

/** 只读任务列表路由（与 client bundle 轮询地址一致）。 */
export const TASKS_PATH: string

/** 任务输出读取路由（走 jobs.readAt 非消耗式读保留区，返回增量 chunks）。 */
export const OUTPUT_PATH: string

/** 任务终止路由（只允许任务 owner session 发起）。 */
export const KILL_PATH: string

/** Cordis 插件名。 */
export const name: string

/** 所需服务：web 形状的 HTTP 载体 + 任务注册表。 */
export const inject: string[]

/**
 * 插件主体：注册任务列表 / 输出增量 / 终止三条精确路由，不修改宿主服务。
 */
export function apply(ctx: Context): void
