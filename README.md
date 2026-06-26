# AI Character Studio

AI Character Studio 是一个 TypeScript 全栈项目，用于构建多角色、多模型、多记忆的 AI 虚拟角色创作控制台。你可以创建带有人格、背景、目标、秘密、说话风格、Provider/Model 绑定和私有记忆的 Character Agent，并让多个角色在同一个 Episode 中按回合互动。

本 MVP 暂不做视频生成，重点是“AI 群像剧场”的内部创作控制台、多角色剧情引擎、共享情报板、结构化输出、成本统计和脚本导出。

## 功能概览

- Character Agent：独立人格、背景、目标、秘密、说话风格、模型绑定和私有记忆。
- Episode 格式：`jury_deliberation`、`murder_mystery`、`tabletop_rpg`、`werewolf`、`debate`、`council_vote`、`improv_drama`。
- 使用 LangGraphJS 编排每一次角色发言。
- 使用 Prisma 持久化角色、Episode、台词、记忆、共享情报、LLM 调用和图检查点。
- 统一 Provider Adapter：支持 OpenAI、Anthropic、Gemini、DeepSeek、xAI 和 `mock-local` fallback。
- 角色输出必须是结构化 JSON，并通过 Zod 校验。
- 内置成本估算、Episode 预算控制和 Cost Center 聚合视图。
- 支持将 Episode 导出为 Markdown 剧本。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn 风格的本地 UI 组件
- Prisma ORM
- SQLite 本地开发数据库
- Zod
- React Hook Form
- `@langchain/langgraph`

## 安装与启动

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed
npm run dev
```

启动后打开：

```text
http://localhost:3000/dashboard
```

如果当前环境使用 `pnpm`，可以执行：

```bash
pnpm install
cp .env.example .env
pnpm prisma migrate dev --name init
pnpm seed
pnpm dev
```

## 环境变量

`.env.example`：

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GEMINI_API_KEY=""
GOOGLE_GENERATIVE_AI_API_KEY=""
DEEPSEEK_API_KEY=""
XAI_API_KEY=""
DEFAULT_PROVIDER="mock"
DEFAULT_MODEL="mock-roleplay"
```

所有 API Key 都可以为空。缺少真实 Provider Key 或真实 Provider 调用失败时，系统会自动 fallback 到 `mock-local`，保证本地完整流程可运行。

## Prisma 数据库

数据库 schema 位于：

```text
prisma/schema.prisma
```

本地使用 SQLite。模型中保留了清晰的 JSON 字段边界，后续迁移到 PostgreSQL 或接入 pgvector 时，业务代码不需要大规模改动。

执行迁移：

```bash
npx prisma migrate dev --name init
```

写入种子数据：

```bash
npm run seed
```

种子数据会创建 6 个示例角色，并创建一个 active 状态的示例 Episode：`雨夜别墅谋杀案`。

## Provider Adapter

业务代码只允许调用：

```text
src/lib/llm/router.ts
```

不要在业务模块中直接调用某个厂商 SDK 或 API。

当前 Provider：

- `mock-local`
- `openai`
- `anthropic`
- `gemini`
- `deepseek`
- `xai`

所有 Adapter 都返回统一的 `GenerateCharacterTurnResult`，包含：

- raw text
- token 输入/输出
- 估算成本
- latency
- provider response
- fallback/error 信息

缺少 API Key、未知 Provider 或真实调用失败时，router 会 fallback 到 mock provider，且不会在日志中输出 API Key。

## LangGraph EpisodeGraph

核心图定义在：

```text
src/lib/graph/episode-graph.ts
```

运行流程：

```text
START
  -> loadEpisodeState
  -> checkBudget
  -> selectSpeaker
  -> buildCharacterContext
  -> callCharacterModel
  -> validateCharacterOutput
  -> persistTurn
  -> updatePrivateMemory
  -> updateSharedBoard
  -> checkEndCondition
  -> END
```

`Run Next Turn` 每次只 invoke 一次图，生成一个角色发言。

`Run Full Round` 会按当前 Episode 参与角色数量循环调用 `runNextTurn`，遇到预算耗尽或结束条件时停止。

## 记忆系统

MVP 中的记忆系统遵循以下原则：

- 角色记忆默认是 private。
- `buildCharacterContext` 只读取当前发言角色自己的 private memory。
- 不会把其他角色的 private memory 注入当前角色 prompt。
- `memory_writes` 会在角色输出通过 Zod 校验后写入 `Memory`。
- public memory 不等于 shared board，不会自动公开给所有角色。
- secret 类型记忆不会自动进入 shared board。

后续可扩展为 pgvector similarity search。

## 共享情报板

`SharedBoardItem` 表示所有角色都能看到的公共状态。

只有角色输出中的 claim 满足：

```json
{
  "should_publish_to_shared_board": true
}
```

才会写入共享情报板。

支持类型：

- `public_fact`
- `claim`
- `hypothesis`
- `contradiction`
- `clue`
- `vote_result`
- `rule_state`

角色秘密和 private memory 不会被自动公开。

## 成本控制

成本逻辑位于：

```text
src/lib/cost/
```

核心能力：

- `estimate-cost.ts` 维护 provider/model 价格表。
- 未知模型使用 fallback pricing。
- mock provider 成本为 0。
- `checkBudget` 和 `enforceEpisodeBudget` 会在模型调用前检查预算。
- Episode 预算耗尽且未 override 时，不会继续调用真实模型。
- Live Room 会显示已花费、预算和剩余额度。
- Cost Center 会按 provider、model、episode、date 聚合 LLM 调用。

## 剧本导出

接口：

```text
GET /api/episodes/[id]/export-script
```

导出 Markdown 内容包含：

- 标题
- Episode format
- 场景设定
- 参与角色
- 公开事实
- 共享情报板
- 按 round 分组的台词
- action，使用括号表示
- speech，作为正式台词

默认不导出 `innerThought`。如需包含内心想法：

```text
GET /api/episodes/[id]/export-script?includeInnerThought=true
```

## 页面说明

主要页面：

- `/dashboard`：统计角色数、Episode 数、turns、tokens、估算成本和最近生成内容。
- `/characters`：角色列表、创建、编辑、删除、记忆管理和单角色测试发言。
- `/episodes`：Episode 列表、创建、编辑、删除。
- `/episodes/[id]/live`：核心 Live Room，可运行回合、查看 Transcript、Shared Board、Memories 和 Cost。
- `/cost-center`：LLM 调用成本聚合。

## API 路由

核心 API：

- `POST /api/episodes/[id]/run-next-turn`
- `POST /api/episodes/[id]/run-round`
- `GET /api/episodes/[id]/export-script`
- `POST /api/episodes/[id]/summarize`
- `POST /api/episodes/[id]/characters`
- `POST /api/characters`
- `PATCH /api/characters/[id]`
- `DELETE /api/characters/[id]`

## Director Review 预留能力

以下模块已作为 human-in-the-loop 扩展点预留：

```text
src/lib/graph/nodes/interrupt-for-director.ts
src/lib/orchestrator/resume-after-director-review.ts
```

MVP 默认不启用导演审核。后续可以扩展：

- 暂停某一轮输出
- 人类导演批准
- 人类导演修改
- 人类导演拒绝并重跑

## 种子数据

`npm run seed` 会创建 6 个示例角色：

- 林澈
- 白鸥
- 赫尔曼
- 砂夜
- 诺亚
- 雾岛莲

并创建示例 Episode：

```text
雨夜别墅谋杀案
```

该 Episode 默认状态为 `active`，可以直接进入 Live Room 点击 `Run Next Turn`。

## 本地验收步骤

```bash
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

验收点：

- Dashboard 能看到基础统计。
- Characters 页面能看到 6 个 seed 角色。
- Episodes 页面能看到 `雨夜别墅谋杀案`。
- Live Room 中点击 `Run Next Turn` 能生成一条角色发言。
- 多次点击 `Run Next Turn` 时角色按 round-robin 轮流发言。
- Shared Board 会根据角色 claims 更新。
- Memories 会根据 `memory_writes` 更新。
- Cost Center 能看到 `LlmCall` 统计。
- Export Script 能导出 Markdown 剧本。
- 不配置任何真实 API Key 时，系统仍能通过 `mock-local` 正常运行。

## 下一步路线图

- 接入 pgvector，实现相似度记忆检索。
- 接入 Redis/BullMQ，实现异步 Episode 执行队列。
- 完善 Director Review human-in-the-loop 流程。
- 增加内容安全和导演审核节点。
- 增强真实 Provider 的 structured output 能力。
- 增加 PostgreSQL 部署配置。
- 在角色引擎稳定后，再扩展视频生成能力。
