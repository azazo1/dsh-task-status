<p align="center">中文 | <a href="README.md">English</a></p>

<h1 align="center">task-status</h1>

<p align="center">后台任务状态条：对话页输入区上方的任务进度 UI——运行中计数 + 展开详情 + 实时输出 tail</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
</p>

对话页输入框上方的后台任务状态条：运行中任务计数 + 点击展开逐条详情 + **实时输出 tail**（自动轮询，10 行滚动区）。经官方 `conversation.input.dock` 槽注册（与 queue/todo/goal 同族）。形态：官方 **bundle 插件**（`dsh.bundle` + dshClient 通道），0 patch。

## 效果

![task-status（真实运行截图：任务行 + 展开输出 tail）](docs/preview/task-status.png)

## 能力

**UI**（对话页 dock 槽）：

| 功能 | 说明 |
|---|---|
| 状态条 | 对话页输入框上方 dock 卡片：`⚙ N 个后台任务运行中` |
| 展开详情 | 点击任务行展开：状态/耗时/详情 + 输出 tail |
| 命令悬停 | 悬停任务行标签弹出气泡显示完整命令行, 原样保留连续空格/制表符/换行 (不做空白合并) |
| 实时 tail | 展开时每 1s 轮询输出路由, 按游标增量拉取并渲染 (走官方 `jobs.readAt` 非消耗式读, 与 `task_output` 工具互不干扰) |
| 手动终止 | 点击运行中任务右侧的终止按钮, 在 DSH 原生确认框中确认后终止, agent 会在下次任务结果中看到用户主动终止原因 |
| 滚动区 | 输出区 max 10 行 (160px), 超出变滚动条 (tail 保尾可回看) |
| 仅对话页 | 非 Chat 视图（trajectory/taskboard 等）自动隐藏 |

**路由**（Node half）：

| 路由 | 说明 |
|---|---|
| `/plugins/dsh-task-status/tasks` | 任务列表（只读，需 `sessionId`；只回该会话自己的任务） |
| `/plugins/dsh-task-status/output` | 任务输出 tail（需 `id`/`sessionId` 与可选 `from`；返回增量 `chunks` + 续读位移 `next` + 保留区丢弃标记 `lossy`） |
| `/plugins/dsh-task-status/kill` | 终止该会话拥有的任务（`POST { id, sessionId }`），用户终止原因交给官方 `jobs.kill` 写进任务 detail |

**输出 tail 的数据通道**（dsh 0.1.7 jobs API）：插件走官方 `jobs.readAt(id, from, sessionId)` 读任务保留区（运行中 256 KiB / 已结束 16 KiB）——非消耗式读取, 不推进 `task_output` 工具的模型游标, 所以插件不需要任何打补丁手段, 双方各自看到完整增量。客户端按 `next` 续读, 本地只保留尾部 64 KiB；`lossy` 为真时在输出里插一行截断提示。

> dsh 0.1.7 之前的 jobs API 只有消耗式 `read`（`{ text, snapshot }`），本插件当时靠给 `ctx.jobs.read` 打镜像补丁来规避游标竞争；0.1.7 把 jobs 服务换成 ring + 双游标后该补丁会抛 `Cannot read properties of undefined (reading 'id')`。本版本适配 0.1.7 并删除补丁, 因此**要求 dsh >= 0.1.7**（0.1.6 及更早请使用 v0.3.1）。

## 安装

**推荐：git 源一行安装**（构建产物已入库，git 源不触发构建）：

```sh
dsh plugin add --profile web azazo1/dsh-task-status
```

装完后重启 web 生效; 可在设置页 Plugins 面板停用或启用.

## 使用

跑一个后台任务即可看到状态条（如模型侧 `bash` 工具 `run_in_background: true`）：

```
⚙ 1 个后台任务运行中
  ● bash-1  for i in $(seq 1 20)…   21:30:15 起   运行中
```

点击任务行展开 → 输出 tail 实时滚动（超过 10 行滚动条）。任务结束后状态条自动消失。

## 开发

```sh
pnpm install
pnpm run build      # tsdown：Node half (lib/index.mjs) + client bundle (lib/client.js)
```

- Node half：`src/index.mjs`（三条 jobs 路由：`/tasks` `/output` `/kill`）
- client：`src/client/task-status.tsx`（dock 槽状态条）

## 许可

MIT License（DSH 生态示例插件）。
