// azazo1/dsh-task-status Node half: 两条只读数据路由 + 一条用户终止路由.
//
// 数据源是官方 jobs 服务 (dsh 0.1.7 的 ring 版 API):
// - `jobs.list(sessionId)` 返回该会话自己的任务 + 无主任务;
// - `jobs.get(id, sessionId)` 取一条快照 (非消耗, 未知或越权抛错);
// - `jobs.readAt(id, from, sessionId)` 读保留区增量: **不推进模型游标**,
//   返回 `{ chunks, next, lossy }` —— 这是插件 tail 的唯一数据源;
// - `jobs.kill(id, sessionId, reason)` 请求终止, reason 会在任务 settle 为
//   killed 时并入 detail, agent 下次读任务结果时能看到用户主动终止原因.
//
// 因此早期版本给 `jobs.read` 打的镜像补丁 (rawRead + shadow 缓冲 + 官方
// 消费游标记账) 已无必要: 插件与官方 `task_output` 工具走两条互不干扰的
// 读通道, 插件只读保留区, 官方消耗式游标完全不受影响.
//
// caller 一律是 SessionId (浏览器侧的会话 id), 由客户端在请求里带上.

/** 只读任务列表路由 (与 client bundle 轮询地址一致). */
export const TASKS_PATH = '/plugins/dsh-task-status/tasks'

/** 任务输出读取路由 (非消耗式读保留区, 按 from 游标返回增量 chunks). */
export const OUTPUT_PATH = '/plugins/dsh-task-status/output'

/** 任务终止路由 (只允许任务 owner session 发起). */
export const KILL_PATH = '/plugins/dsh-task-status/kill'

/** 用户从状态条发起终止时写入任务 detail 的原因. */
const USER_CANCEL_REASON = 'cancelled by user from task-status UI'

/** Cordis 插件名. */
export const name = 'task-status'

/** 所需服务: web 形状的 HTTP 载体 + 任务注册表. */
export const inject = ['webServer', 'jobs']

/** 统一取错误信息. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/** 写一个 JSON 响应. */
function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

/** 以 JSON 形式返回一条错误. */
function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

/** 解析请求 URL (查询参数: sessionId / id / from). */
function requestUrl(req) {
  return new URL(req.url ?? '/', 'http://dsh.internal')
}

/** 裁剪任务投影到 wire 视图 (内部记账不跨线; `owner` 就是 session id). */
function toWire(job) {
  return {
    id: job.id,
    kind: job.kind,
    label: job.label,
    status: job.status,
    ...(job.detail !== undefined ? { detail: job.detail } : {}),
    ...(job.owner !== undefined ? { owner: job.owner } : {}),
    startedAt: job.startedAt,
    ...(job.finishedAt !== undefined ? { finishedAt: job.finishedAt } : {}),
  }
}

/**
 * 列出该会话自己的任务: 无主任务不属于任何会话的状态条, 直接滤掉.
 * @param ctx - host cordis context.
 * @param sessionId - 浏览器侧会话 id (官方 owner fence 的 caller).
 * @returns wire 视图数组.
 */
function listSessionTasks(ctx, sessionId) {
  return ctx.jobs.list(sessionId)
    .filter(job => job.owner === sessionId)
    .map(toWire)
}

/**
 * Read a small JSON request body without accepting an unbounded payload.
 * @param req - host HTTP request.
 * @returns parsed request body.
 */
async function readJsonBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 8192) throw new Error('request body too large')
  }
  return JSON.parse(body)
}

/**
 * 插件主体: 注册任务列表 / 输出增量 / 终止三条精确路由, 不修改宿主任何
 * 服务方法. handler 异常按缺失参数 (400) / 任务不可见 (404) / 其它 (500)
 * 返回, 客户端轮询吞掉瞬态错误.
 * @param ctx - host cordis context.
 */
export function apply(ctx) {
  ctx.effect(() => {
    const disposeTasks = ctx.webServer.register({
      kind: 'exact',
      path: TASKS_PATH,
      handler: async (req, res) => {
        try {
          const sessionId = requestUrl(req).searchParams.get('sessionId') ?? ''
          if (sessionId === '') {
            sendError(res, 400, 'missing session id')
            return
          }
          sendJson(res, 200, { tasks: listSessionTasks(ctx, sessionId) })
        } catch (error) {
          sendError(res, 500, messageOf(error))
        }
      },
    })
    const disposeOutput = ctx.webServer.register({
      kind: 'exact',
      path: OUTPUT_PATH,
      handler: async (req, res) => {
        try {
          const url = requestUrl(req)
          const id = url.searchParams.get('id') ?? ''
          const sessionId = url.searchParams.get('sessionId') ?? ''
          if (id === '' || sessionId === '') {
            sendError(res, 400, 'missing task id or session id')
            return
          }
          // get 先落 404 (未知任务 / 越权任务), 顺带拿到保留区起点.
          let job
          try {
            job = ctx.jobs.get(id, sessionId)
          } catch (error) {
            sendError(res, 404, messageOf(error))
            return
          }
          const fromText = url.searchParams.get('from')
          const from = fromText === null ? job.output.earliest : Number(fromText)
          if (!Number.isSafeInteger(from) || from < 0) {
            sendError(res, 400, 'invalid output offset')
            return
          }
          let read
          try {
            read = ctx.jobs.readAt(id, from, sessionId)
          } catch (error) {
            sendError(res, 404, messageOf(error))
            return
          }
          sendJson(res, 200, { chunks: read.chunks, next: read.next, lossy: read.lossy })
        } catch (error) {
          sendError(res, 500, messageOf(error))
        }
      },
    })
    const disposeKill = ctx.webServer.register({
      kind: 'exact',
      path: KILL_PATH,
      handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' })
            res.end()
            return
          }
          const body = await readJsonBody(req)
          const id = typeof body?.id === 'string' ? body.id : ''
          const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
          if (id === '' || sessionId === '') {
            sendError(res, 400, 'missing task id or session id')
            return
          }
          // 先按官方 owner fence 确认这条任务对该会话可见, 越权与未知同答 404.
          try {
            ctx.jobs.get(id, sessionId)
          } catch (error) {
            sendError(res, 404, messageOf(error))
            return
          }
          sendJson(res, 200, { outcome: ctx.jobs.kill(id, sessionId, USER_CANCEL_REASON) })
        } catch (error) {
          sendError(res, 500, messageOf(error))
        }
      },
    })
    return () => {
      disposeTasks()
      disposeOutput()
      disposeKill()
    }
  }, 'task-status: jobs routes (tasks/output/kill)')
}
