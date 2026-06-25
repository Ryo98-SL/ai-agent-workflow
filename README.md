# AI Agent Workflow

AI Agent Workflow 是一个 Web-first 的 AI 工作流调试工作台，用来搭建、运行和观察由 Start、Knowledge、LLM、Tool、Agent、Human Input 等节点组成的工作流图。

项目采用 pnpm workspace + Turborepo 组织，核心目标是把「可视化编排」「模型与工具调用」「知识库检索」「运行过程调试」放在同一个产品体验里：用户可以在浏览器中创建工作流、配置模型、接入知识库或工具，运行后通过流式事件和节点级历史查看每一步输出。

## 快速开始

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会启动 API 服务和 Web 应用：

- API Server: `http://127.0.0.1:8788`
- Web App: `http://127.0.0.1:5173`

如果只想分别启动某一端：

```bash
pnpm dev:server
pnpm dev:web
pnpm dev:desktop
```

Web 和 Desktop 渲染器默认连接 `http://127.0.0.1:8788`。需要切换 API 地址时，设置：

```bash
VITE_WORKFLOW_API_BASE_URL=http://127.0.0.1:8788
```

## 常用命令

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm smoke
pnpm build
```

- `pnpm typecheck`: 运行 legacy runtime 和 workspace 的 TypeScript 检查。
- `pnpm test`: 运行 domain legacy tests 和各 workspace 测试。
- `pnpm lint`: 运行 legacy runtime 和 workspace lint。
- `pnpm smoke`: 运行 workbench-ui 的快速验证测试。
- `pnpm build`: 通过 Turborepo 构建所有 workspace。

## 项目结构

```text
.
├── apps/
│   ├── web/             # 主浏览器客户端，包含首页、Workbench 路由和设计调试页面
│   ├── server/          # Hono REST API、Prisma 数据层、LangGraph 运行时
│   └── desktop/         # 旧版 Electron shell，复用共享 Workbench
├── packages/
│   ├── workbench-ui/    # 可复用 React 工作流编辑器与调试 UI
│   ├── workflow-client/ # 类型安全的 REST client
│   ├── api-contracts/   # REST 路径、DTO、Zod schema、SSE 事件契约
│   ├── workflow-domain/ # 工作流 schema、模板、变量解析、Tool Registry 元数据
│   ├── i18n/            # Product Locale 与翻译工具
│   └── tsconfig/        # 共享 TypeScript 配置
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 核心能力

### Web 工作台

- 在 `/` 提供产品首页，展示用户工作流与 Knowledge Base。
- 在 `/workbench` 提供可视化工作流编辑器。
- 支持匿名本地工作流，登录后可导入到账号。
- 工作流卡片、主题、语言切换、账号菜单和弹窗复用 shared workbench UI。

### 工作流编辑与调试

- 基于 React Flow 编辑节点和边。
- 支持 Start、LLM、Knowledge、Tool、Agent、If/Else、Human Input、Template、End 等节点体验。
- 支持 Chat Mode、节点历史、运行历史抽屉、暂停后 resume、节点输出变量和 prompt 变量引用。
- 运行时通过 Server-Sent Events 流式返回进度，前端按节点展示输出、错误和中间状态。

### 模型与 AI Credits

- 模型配置支持 DeepSeek、OpenAI、Anthropic、Ollama 等 provider-aware settings。
- 用户可以使用自己的 provider key，也可以在平台配置后使用 AI Credits。
- MVP 的平台 AI Credits 面向 DeepSeek，按用户 grant 和平台每日输出 token 上限计量。

### Knowledge Bases (RAG)

- Knowledge Base 可被 Knowledge 节点复用，为下游 LLM/Agent 提供语义检索上下文。
- 匿名用户可使用只读中文客服示例知识库 `云舵客服知识库`。
- 已登录用户可创建 KB，并添加粘贴文本或 `.txt` / `.md` 文档。
- 后端使用 Postgres + pgvector 存储 chunk embeddings。

### Tools 和 MCP

- Tool 节点与 Agent Tool List 使用共享 Tool Registry 描述。
- 内置工具包括 Current Time 和 Send Email。
- 支持账号级远程 HTTP MCP Server 注册，工具会出现在 Tool Browser MCP tab 中。
- 内置只读 MCP Server 面向所有用户开放，用于演示真实 MCP transport 调用。

## 环境与部署

### Server

本地 API 默认监听 `0.0.0.0:8788`。可通过环境变量调整：

```bash
PORT=8788
HOST=127.0.0.1
```

生产部署时先执行 Prisma migration，再启动服务：

```bash
pnpm --filter @ai-agent-workflow/server db:deploy
pnpm --filter @ai-agent-workflow/server start
```

### Embedding

Knowledge Base 检索需要配置 embedding provider。服务端读取：

```bash
EMBEDDING_PROVIDER=
EMBEDDING_MODEL=
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
KNOWLEDGE_INDEXER_CONCURRENCY=
```

`EMBEDDING_API_KEY` 未设置时会回退到 `CREDITS_OPENAI_API_KEY`。如果没有可用 key，Knowledge 节点运行会返回 embedding adapter 未配置的错误，本地开发仍可启动服务。

### AI Credits

平台出资的模型调用密钥从服务端环境读取：

```bash
CREDITS_DEEPSEEK_API_KEY=
CREDITS_DEEPSEEK_BASE_URL=
DAILY_OUTPUT_TOKEN_LIMIT=
```

`CREDITS_DEEPSEEK_BASE_URL` 可选；默认使用官方 endpoint。用户自己的 API key 不计入平台每日输出 token 上限。

### Email Tool

Send Email 默认 dry-run。真实发送需要：

```bash
RESEND_API_KEY=
EMAIL_FROM=
```

真实发送仅限登录用户。系统会在调用 Resend 前通过数据库原子预占额度：
每用户 10 封/分钟、100 封/UTC 日；平台硬上限 80 封/UTC 日、
2,400 封/UTC 月。失败或超时也计入额度且不会自动重发。必须使用本应用
专用的 Resend API key，避免其他系统的发送绕过本地免费额度保护。

## 开发约定

- 不要把 `docs/` 目录下的文件加入 git 记录。
- 调整复杂 UI 前先检查已有 shared components 和 package exports，优先复用 `packages/workbench-ui` 中的能力。
- 调整 React Flow 相关行为时，优先排查节点、边、handle、React Flow 配置项，避免在未确认前自定义渲染器或重造能力。
- 接入模型 provider 时，优先使用官方或维护良好的 SDK / LangChain 集成包。
- UI 交付需要覆盖加载、空状态、错误、流式中间状态和 destructive confirmation，避免用户看到空白、卡死或无反馈状态。

## 子包文档

更多细节可以查看各 workspace 的 README：

- `apps/web/README.md`
- `apps/server/README.md`
- `apps/desktop/README.md`
- `packages/workbench-ui/README.md`
- `packages/workflow-client/README.md`
- `packages/api-contracts/README.md`
- `packages/workflow-domain/README.md`
- `packages/i18n/README.md`
