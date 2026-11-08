# 开发说明

面向插件开发者。普通用户请读 [README_zh_CN.md](./README_zh_CN.md)。

## 环境

- Node.js 18+
- npm
- 本地联调需要思源笔记；浏览器端到端测试需要 Playwright Chromium

```bash
npm install
npx playwright install chromium
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 监听源码并写入开发插件目录 |
| `npm run typecheck` | TypeScript 与 Vue 类型检查 |
| `npm test` | 核心、持久化、块协议和命令服务测试 |
| `npm run test:e2e` | 启动真实 Vue 应用，运行 Chromium 用户流程测试 |
| `npm run build` | 输出 `dist/` 与 `package.zip` |
| `npm run check-package` | 校验集市发布包 |
| `npm run verify` | 类型检查 + 全部测试 + 构建 + 发布包校验 |
| `npm run release` | 同 `verify`，发布前必须通过 |

## 本地联调

在项目根目录创建 `.env.local`：

```text
VITE_SIYUAN_WORKSPACE_PATH=D:/siyuan_data
```

执行 `npm run dev` 后，产物写入 `{工作空间}/data/plugins/SYTodos/`。在思源里禁用再启用插件即可加载新构建。

## 架构

```text
src/
├── index.ts                    插件生命周期、页签与事务事件
├── api/kernel.ts               严格内核 API、分页、索引冲刷
├── core/                       无宿主依赖的任务模型、树、日期、筛选
├── data/
│   ├── repository.ts           两个空间共同的仓库契约
│   ├── siyuanRepository.ts     真实块与块属性仓库
│   └── storage.ts              插件存储响应检查
├── store/
│   ├── taskService.ts          唯一串行命令层与撤销/重做
│   ├── tasks.ts                UI 使用的命令门面
│   ├── local.ts                独立空间 v2 存档、校验、迁移、备份
│   ├── drafts.ts               按任务隔离的详情草稿与单航班冲刷
│   ├── settings.ts             可等待的设置持久化
│   └── ui.ts                   瞬态界面状态
├── ui/                         三视图、表单、拖拽与派生数据
└── styles/index.scss           思源主题适配
```

## 不可破坏的约束

1. **单一事实源**：SiYuan 任务来自真实 `i/t` 块，独立任务来自 v2 存档；不得在组件中另建权威副本。
2. **命令串行**：所有读取协调、写入、结构移动和历史操作进入 `TaskService` 队列。界面不得直接调用块 CRUD 或 `saveData`。
3. **提交后回读**：仓库方法只有持久化成功并验证权威快照后才返回。失败不得先把乐观状态伪装成成功。
4. **父级来自块结构**：父任务由 `i/t → l → i/t` 的真实类型关系推导。兄弟作用域必须包含 `space + rootId + containerId + parentId`。
5. **创建不猜 ID**：新块使用唯一临时标题，调用 `/api/sqlite/flushTransaction` 后在 `i/t` 索引中精确定位；禁止采用“第一个块 ID”兜底。
6. **内容更新保留子树**：既有任务使用 `getBlockKramdown` 后只改首行标记或标题，保留附加内容、子列表和块 ID；失败执行补偿回滚。
7. **存档失败不覆盖**：重复 ID、悬空父级、循环、非法枚举和非法日期必须拒绝加载；主存档损坏时只能读取有效备份，不得自动写空数组。
8. **草稿绑定 ID**：详情文本只能经 `store/drafts.ts` 保存。失败保留草稿，保存期间的新值优先于旧值。
9. **空间与回收站隔离**：不得跨空间建立父子关系，不得把未删除任务移入已删除父级，回收、恢复和永久删除采用一致的子树语义。
10. **三种视图行模型分离**：列表只生成平铺任务行与可选分组标题，不读取父子关系、缩进和折叠状态；层级、祖先上下文和折叠只属于树形视图；看板只按状态分列。
11. **破坏性操作统一确认**：移入回收站、永久删除、清空回收站及批量/键盘删除只能经 `ui/useDeleteActions.ts` 的确认流程执行；禁止在组件中直接调用原生 `window.confirm` 或删除命令。
12. **运行时依赖保持精简**：当前运行时只有 Vue，测试工具不得进入插件产物。

## 测试

- `tests/`：日期、筛选、树约束、IAL、全字段存档、备份恢复、块创建/回滚、串行命令、历史和草稿竞态。
- `e2e/`：真实 Vue 应用 + 真实命令服务 + 浏览器 `localStorage`，覆盖创建、父子关系、刷新、详情自动保存、看板、键盘缩进、撤销与回收站。
- 修改块协议后，除自动化测试外还应在目标思源版本手工验证：根/子任务创建、带附加内容的父任务改名、跨文档移动、重启后字段一致，以及笔记内直接勾选后的同步。

## 发布

1. 更新 `package.json` 与 `plugin.json` 的 `version`，在 `CHANGELOG.md` 写明用户可见变更。
2. 执行 `npm run release`，必须全部通过。
3. 在 GitHub 创建同版本 Release，附上 `package.zip`。
4. 集市索引按原项目发布流程更新。
