window.__ModuleLoader__.load({
	id: "dsh-task-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/ansi.tsx
		const ANSI_PATTERN = /\x1b\[([0-9;?]*)([ -/]*)([@-~])/g;
		const ANSI_COLORS = [
			"#1f1f1f",
			"#c93c37",
			"#2e9b55",
			"#b58900",
			"#357edd",
			"#9256a8",
			"#218c8d",
			"#d8d8d8"
		];
		const ANSI_BRIGHT_COLORS = [
			"#666666",
			"#f05d5e",
			"#5fcf80",
			"#e5c07b",
			"#6fa8ff",
			"#c678dd",
			"#56d4d4",
			"#ffffff"
		];
		function ansi256Color(value) {
			if (value < 0 || value > 255) return void 0;
			if (value < 16) return (value < 8 ? ANSI_COLORS : ANSI_BRIGHT_COLORS)[value % 8];
			if (value >= 232) {
				const level = 8 + (value - 232) * 10;
				return `rgb(${level}, ${level}, ${level})`;
			}
			const index = value - 16;
			const red = Math.floor(index / 36);
			const green = Math.floor(index % 36 / 6);
			const blue = index % 6;
			const channel = (component) => component === 0 ? 0 : 55 + component * 40;
			return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`;
		}
		function readColor(values, index) {
			const mode = values[index + 1];
			if (mode === 5) return {
				color: ansi256Color(values[index + 2] ?? -1),
				next: index + 2
			};
			if (mode === 2) {
				const red = values[index + 2];
				const green = values[index + 3];
				const blue = values[index + 4];
				if ([
					red,
					green,
					blue
				].every((channel) => channel !== void 0 && channel >= 0 && channel <= 255)) return {
					color: `rgb(${red}, ${green}, ${blue})`,
					next: index + 4
				};
			}
			return { next: index };
		}
		function applySgr(style, values) {
			for (let index = 0; index < values.length; index += 1) {
				const value = values[index] ?? 0;
				if (value === 0) {
					delete style.color;
					delete style.backgroundColor;
					delete style.fontWeight;
					delete style.fontStyle;
					delete style.textDecoration;
					delete style.opacity;
				} else if (value === 1) style.fontWeight = 700;
				else if (value === 2) style.opacity = .72;
				else if (value === 3) style.fontStyle = "italic";
				else if (value === 4) style.textDecoration = "underline";
				else if (value === 22) {
					style.fontWeight = void 0;
					style.opacity = void 0;
				} else if (value === 23) style.fontStyle = void 0;
				else if (value === 24) style.textDecoration = void 0;
				else if (value === 39) style.color = void 0;
				else if (value === 49) style.backgroundColor = void 0;
				else if (value >= 30 && value <= 37) style.color = ANSI_COLORS[value - 30];
				else if (value >= 40 && value <= 47) style.backgroundColor = ANSI_COLORS[value - 40];
				else if (value >= 90 && value <= 97) style.color = ANSI_BRIGHT_COLORS[value - 90];
				else if (value >= 100 && value <= 107) style.backgroundColor = ANSI_BRIGHT_COLORS[value - 100];
				else if (value === 38 || value === 48) {
					const color = readColor(values, index);
					if (color.color !== void 0) if (value === 38) style.color = color.color;
					else style.backgroundColor = color.color;
					index = color.next;
				}
			}
			return values.length;
		}
		function styleKey(style) {
			return JSON.stringify(style);
		}
		/** 将带 ANSI 控制序列的文本拆成可安全渲染的终端片段. */
		function renderAnsi(text) {
			const nodes = [];
			const style = {};
			let segmentStart = 0;
			let key = 0;
			const pushText = (value) => {
				if (value === "") return;
				nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: { ...style },
					children: value
				}, `${styleKey(style)}-${key}`));
				key += 1;
			};
			text.replace(ANSI_PATTERN, (sequence, params, _intermediates, command, offset) => {
				pushText(text.slice(segmentStart, offset));
				segmentStart = offset + sequence.length;
				if (command === "m") {
					const values = params === "" ? [0] : params.split(";").map(Number);
					applySgr(style, values);
				}
				return sequence;
			});
			pushText(text.slice(segmentStart));
			return nodes;
		}
		//#endregion
		//#region src/client/task-status.tsx
		/** Node half 只读任务路由（与 examples/task-status/index.mjs 的 TASKS_PATH 一致）。 */
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
		/** 会话级轮询 hook：每 POLL_MS 拉取 Node half 路由，返回该会话的活跃任务。 */
		function useSessionTasks(sessionId) {
			const [tasks, setTasks] = (0, react.useState)([]);
			(0, react.useEffect)(() => {
				let alive = true;
				const poll = async () => {
					try {
						const res = await fetch(TASKS_PATH, { headers: { accept: "application/json" } });
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
			return tasks.filter((task) => task.ownerSession === sessionId);
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
		* 任务输出 tail：展开任务时**自动轮询** Node half 输出路由。Node half 给
		* `ctx.tasks.read` 打了**镜像补丁**（见 src/index.mjs）——官方 read = 缓冲
		* 镜像（他人已读增量，不重复消耗）+ 直读补最新（正常消耗），官方视图与
		* 无插件时逐字节一致；本插件自读直接走底层 rawRead 并累积。路由带
		* `full: true` 返回累积全文——客户端**整段替换**渲染（tail -f 效果，无需
		* 按钮）。双方视图 = 全量（无重复无丢失无滞后）。兼容旧路由（无 `full`
		* 标志 = 增量契约）：此时**追加**。
		* @param taskId - 当前展开的任务 id；null 时不轮询。
		* @returns 当前输出文本（整段替换或增量追加后）。
		*/
		function useTaskOutput(taskId) {
			const [output, setOutput] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				if (taskId === null) {
					setOutput("");
					return;
				}
				let alive = true;
				const poll = async () => {
					try {
						const res = await fetch(`${OUTPUT_PATH}?id=${encodeURIComponent(taskId)}`, { headers: { accept: "application/json" } });
						if (!res.ok) return;
						const data = await res.json();
						if (!alive || typeof data.text !== "string") return;
						setOutput((prev) => data.full === true ? data.text : prev + data.text);
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
			}, [taskId]);
			return output;
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
			const taskOutput = useTaskOutput(expandedTask);
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
					variant: "secondary",
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								flex: 1,
								fontSize: 13,
								lineHeight: "20px",
								color: "var(--dsw-alias-label-secondary)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap"
							},
							children: task.label
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
								color: meta.color,
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
					children: [task.detail !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["详情：", task.detail] }), taskOutput !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						style: {
							margin: "2px 0 0",
							padding: "8px 10px",
							fontSize: 11,
							lineHeight: "16px",
							fontFamily: "var(--dsh-code-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
							color: "#d8dee9",
							background: "#17191d",
							border: "1px solid rgba(255, 255, 255, 0.08)",
							borderRadius: 6,
							whiteSpace: "pre",
							wordBreak: "normal",
							tabSize: 4,
							maxHeight: 160,
							overflow: "auto"
						},
						children: renderAnsi(taskOutput)
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
