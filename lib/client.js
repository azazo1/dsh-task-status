window.__ModuleLoader__.load({
	id: "dsh-task-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/task-status.tsx
		/** Node half 只读任务路由（与 src/index.mjs 的 TASKS_PATH 一致）。 */
		const TASKS_PATH = "/plugins/dsh-task-status/tasks";
		/** Node half 任务输出读取路由（与 src/index.mjs 的 OUTPUT_PATH 一致）。 */
		const OUTPUT_PATH = "/plugins/dsh-task-status/output";
		/** Node half 任务终止路由。 */
		const KILL_PATH = "/plugins/dsh-task-status/kill";
		/** 轮询间隔：活跃任务状态条不需要亚秒刷新。 */
		const POLL_MS = 1e3;
		const NS = "task-status";
		const zh = {
			"status.running": "{count} 个后台任务运行中",
			"status.finished": "{count} 已完成",
			"status.open": "展开",
			"status.close": "收起",
			"task.running": "运行中",
			"task.stopping": "停止中",
			"task.completed": "已完成",
			"task.killed": "已终止",
			"task.failed": "失败",
			"task.cancel": "终止任务",
			"output.lossy": "... 更早的输出已被保留区丢弃",
			"confirm.title": "确认终止任务？",
			"confirm.description": "终止后任务会收到用户主动终止信号, 未完成的工作可能丢失.",
			"confirm.cancel": "取消",
			"confirm.confirm": "终止任务"
		};
		const en = {
			"status.running": "{count} background task(s) running",
			"status.finished": "{count} finished",
			"status.open": "Expand",
			"status.close": "Collapse",
			"task.running": "Running",
			"task.stopping": "Stopping",
			"task.completed": "Completed",
			"task.killed": "Killed",
			"task.failed": "Failed",
			"task.cancel": "Stop task",
			"output.lossy": "... earlier output dropped by retention",
			"confirm.title": "Stop task?",
			"confirm.description": "The task will receive a user cancellation signal and unfinished work may be lost.",
			"confirm.cancel": "Cancel",
			"confirm.confirm": "Stop task"
		};
		/** 布局变量对齐官方 dock 家族（ConversationRoot.module.css）。 */
		const SIDE_CLEARANCE = "var(--dsh-composer-side-clearance, 16px)";
		const DOCK_INSET = "var(--dsh-composer-dock-inset, 8px)";
		const CARD_MAX = "var(--dsh-composer-card-max-width, 780px)";
		/** 每状态视觉：token + glyph 字符（14px outline 家族近似）。 */
		const STATUS_META = {
			running: {
				state: "ongoing",
				label: "task.running"
			},
			stopping: {
				state: "warning",
				label: "task.stopping"
			},
			completed: {
				state: "done",
				label: "task.completed"
			},
			killed: {
				state: "warning",
				label: "task.killed"
			},
			failed: {
				state: "error",
				label: "task.failed"
			}
		};
		/** 会话级轮询 hook：每 POLL_MS 拉取 Node half 路由，返回该会话的任务。 */
		function useSessionTasks(sessionId) {
			const [tasks, setTasks] = (0, react.useState)([]);
			(0, react.useEffect)(() => {
				let alive = true;
				const poll = async () => {
					try {
						const res = await fetch(`${TASKS_PATH}?sessionId=${encodeURIComponent(sessionId)}`, { headers: { accept: "application/json" } });
						if (!res.ok) return;
						const data = await res.json();
						if (alive && Array.isArray(data.tasks)) setTasks(data.tasks);
					} catch {}
				};
				poll();
				const timer = setInterval(() => {
					poll();
				}, POLL_MS);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [sessionId]);
			return tasks;
		}
		/** Request a user-intended cancellation for one task. */
		async function requestTaskKill(taskId, sessionId) {
			try {
				return (await fetch(KILL_PATH, {
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					body: JSON.stringify({
						id: taskId,
						sessionId
					})
				})).ok;
			} catch {
				return false;
			}
		}
		/**
		* 任务输出 tail：展开任务时**自动轮询** Node half 输出路由。路由走官方
		* `jobs.readAt`——非消耗式读保留区，按 `from` 游标返回增量 `chunks`、
		* 续读位移 `next` 和丢弃标记 `lossy`；本 hook 累积增量并只保留尾部
		* OUTPUT_MAX，与官方 `task_output` 工具的消耗式游标互不干扰（插件读不到
		* 也不推进模型游标，官方视图与无插件时逐字节一致）。
		* @param taskId - 当前展开的任务 id；null 时不轮询。
		* @param sessionId - 当前会话 id（官方 owner fence 的 caller）。
		* @param lossyLabel - 保留区截断时的提示文案。
		* @returns 累积的输出文本（tail）。
		*/
		function useTaskOutput(taskId, sessionId, lossyLabel) {
			const [output, setOutput] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				setOutput("");
				if (taskId === null) return;
				let alive = true;
				let cursor = 0;
				let lossySeen = false;
				const poll = async () => {
					try {
						const query = `id=${encodeURIComponent(taskId)}&sessionId=${encodeURIComponent(sessionId)}&from=${cursor}`;
						const res = await fetch(`${OUTPUT_PATH}?${query}`, { headers: { accept: "application/json" } });
						if (!res.ok) return;
						const data = await res.json();
						if (!alive || !Array.isArray(data.chunks)) return;
						const text = data.chunks.map((chunk) => chunk.text ?? "").join("");
						let marker = "";
						if (data.lossy === true && !lossySeen) {
							lossySeen = true;
							marker = `${lossyLabel}\n`;
						}
						if (typeof data.next === "number" && data.next >= cursor) cursor = data.next;
						if (marker !== "" || text !== "") setOutput((prev) => (prev + marker + text).slice(-65536));
					} catch {}
				};
				poll();
				const timer = setInterval(() => {
					poll();
				}, POLL_MS);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [
				taskId,
				sessionId,
				lossyLabel
			]);
			return output;
		}
		/**
		* 任务行标签 + 悬停全文气泡。label 就是派发后台任务时的命令行, 行内单行
		* ellipsis 展示会吃掉换行和连续空白, 所以悬停时按原文弹出:
		* `white-space: pre-wrap` 保留连续空格, 制表符与换行, 不做空白合并.
		* 气泡用 fixed 定位, 跟随锚点左边缘与宽度 (不越过右边界), 向上展开.
		* @param props.text - 行内标签原文 (完整命令行).
		* @param props.style - 行内标签自身的排版样式 (省略号截断等).
		* @returns 标签元素与悬停气泡.
		*/
		function CommandLabel(props) {
			const { text, style } = props;
			const anchor = (0, react.useRef)(null);
			const [box, setBox] = (0, react.useState)(null);
			const show = () => {
				const el = anchor.current;
				if (el === null) return;
				const rect = el.getBoundingClientRect();
				setBox({
					left: rect.left,
					top: rect.top,
					width: rect.width
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				ref: anchor,
				style,
				onMouseEnter: show,
				onMouseLeave: () => setBox(null),
				children: text
			}), box !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				role: "tooltip",
				style: {
					position: "fixed",
					left: box.left,
					top: box.top - 6,
					transform: "translateY(-100%)",
					maxWidth: Math.min(box.width, 720),
					padding: "6px 10px",
					borderRadius: 8,
					background: "var(--dsw-alias-tooltip-bg)",
					color: "var(--dsw-static-neutral-bluish-00)",
					fontFamily: "var(--dsh-code-font-family, ui-monospace, monospace)",
					fontSize: 12,
					lineHeight: "18px",
					whiteSpace: "pre-wrap",
					overflowWrap: "break-word",
					pointerEvents: "none",
					zIndex: 100
				},
				children: text
			})] });
		}
		/**
		* 对话页对话框上方的后台任务状态条：仅 Chat 视图显示（`[data-chat-flow=""]`
		* 探针），轮询该会话任务（running 高亮 + 展开逐条）。
		*/
		function TaskStatusBar(props) {
			const { t, session } = props;
			const tasks = useSessionTasks(session.sessionId);
			const [inChat, setInChat] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const [expandedTask, setExpandedTask] = (0, react.useState)(null);
			const [confirmingTask, setConfirmingTask] = (0, react.useState)(null);
			const [cancellingTask, setCancellingTask] = (0, react.useState)(null);
			const taskOutput = useTaskOutput(expandedTask, session.sessionId, t("output.lossy"));
			const cancelTask = async (taskId) => {
				if (cancellingTask !== null) return;
				setCancellingTask(taskId);
				await requestTaskKill(taskId, session.sessionId);
				setCancellingTask(null);
			};
			const confirmTask = () => {
				const taskId = confirmingTask;
				setConfirmingTask(null);
				if (taskId !== null) cancelTask(taskId);
			};
			(0, react.useEffect)(() => {
				const check = () => {
					setInChat(document.querySelector("[data-chat-flow=\"\"]") !== null);
				};
				check();
				const observer = new MutationObserver(check);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => {
					observer.disconnect();
				};
			}, []);
			if (!inChat) return null;
			const active = tasks.filter((task) => task.status === "running" || task.status === "stopping");
			const running = active.filter((task) => task.status === "running").length;
			if (active.length === 0) return null;
			const confirmation = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: confirmingTask !== null,
				onClose: () => setConfirmingTask(null),
				title: t("confirm.title"),
				description: t("confirm.description"),
				closeLabel: t("confirm.cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					onClick: () => setConfirmingTask(null),
					children: t("confirm.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: cancellingTask !== null,
					onClick: confirmTask,
					children: t("confirm.confirm")
				})] })
			});
			const statusOf = (status) => STATUS_META[status] ?? {
				state: "warning",
				label: status
			};
			const header = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "6px 12px",
					cursor: active.length > 1 ? "pointer" : "default"
				},
				onClick: active.length > 1 ? () => setOpen((v) => !v) : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							width: 16,
							fontSize: 14,
							lineHeight: "16px",
							textAlign: "center",
							color: "var(--dsw-alias-label-tertiary)"
						},
						children: "⚙"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							flex: 1,
							fontSize: 13,
							lineHeight: "24px",
							fontWeight: 500,
							color: "var(--dsw-alias-label-primary)"
						},
						children: t("status.running", { count: running })
					}),
					active.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							padding: "0 8px",
							fontSize: 12,
							color: "var(--dsw-alias-label-caption)"
						},
						children: open ? t("status.close") : t("status.open")
					})
				]
			});
			const timeText = (task) => {
				const start = new Date(task.startedAt);
				const pad = (n) => String(n).padStart(2, "0");
				const time = `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`;
				return task.finishedAt === void 0 ? `${time} 起` : `${time} → ${pad(new Date(task.finishedAt).getHours())}:${pad(new Date(task.finishedAt).getMinutes())}`;
			};
			const row = (task) => {
				const meta = statusOf(task.status);
				const expanded = expandedTask === task.id;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 6,
						height: 36,
						padding: "0 12px",
						borderRadius: 8,
						cursor: "pointer",
						background: expanded ? "var(--dsw-alias-interactive-bg-hover)" : void 0
					},
					onClick: () => setExpandedTask(expanded ? null : task.id),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
							state: meta.state,
							size: 10
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommandLabel, {
							text: task.label,
							style: {
								flex: 1,
								fontSize: 13,
								lineHeight: "20px",
								color: "var(--dsw-alias-label-secondary)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap"
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 12,
								color: "var(--dsw-alias-label-caption)",
								whiteSpace: "nowrap"
							},
							children: timeText(task)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 12,
								whiteSpace: "nowrap"
							},
							children: t(meta.label)
						}),
						task.status === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							title: t("task.cancel"),
							"aria-label": t("task.cancel"),
							disabled: cancellingTask === task.id,
							onClick: (event) => {
								event.stopPropagation();
								setConfirmingTask(task.id);
							},
							style: {
								width: 24,
								height: 24,
								padding: 0,
								border: 0,
								borderRadius: 4,
								cursor: cancellingTask === task.id ? "wait" : "pointer",
								color: "var(--dsw-alias-label-tertiary)",
								background: "transparent",
								fontSize: 13,
								lineHeight: "24px"
							},
							children: "■"
						})
					]
				}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						padding: "0 12px 8px 34px",
						fontSize: 12,
						lineHeight: "18px",
						color: "var(--dsw-alias-label-tertiary)",
						display: "flex",
						flexDirection: "column",
						gap: 2
					},
					children: [task.detail !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["详情：", task.detail] }), taskOutput !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							margin: "2px 0 0",
							fontSize: 11,
							lineHeight: "16px",
							fontFamily: "var(--dsh-code-font-family, ui-monospace, monospace)",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							maxHeight: 160,
							overflowY: "auto"
						},
						children: taskOutput
					})]
				})] }, task.id);
			};
			const card = (body) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-task-status-bar": "",
				style: {
					width: `calc(100% - 2 * ${SIDE_CLEARANCE} - 4 * ${DOCK_INSET})`,
					maxWidth: `calc(${CARD_MAX} - 4 * ${DOCK_INSET})`,
					margin: "0 auto",
					border: "1px solid var(--dsw-alias-border-l1)",
					borderRadius: 12,
					background: "var(--dsw-specific-tip)",
					overflow: "hidden",
					fontSize: 13,
					fontFamily: "system-ui"
				},
				children: body
			});
			if (active.length === 1) {
				const single = active[0];
				if (single !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [card(row(single)), confirmation] });
				return null;
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [card(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [header, open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					maxHeight: 180,
					overflowY: "auto",
					borderTop: "1px solid var(--dsw-alias-border-l1)"
				},
				children: active.map(row)
			})] })), confirmation] });
		}
		/** 需要此插件声明的服务：slots + locale。 */
		const inject = ["slots", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "task-status: dictionaries");
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "task-status",
				order: 10,
				locale: NS
			}, TaskStatusBar));
		}
		//#endregion
		exports.TaskStatusBar = TaskStatusBar;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
