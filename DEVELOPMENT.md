# 开发说明

面向插件开发者。普通用户请读 [README_zh_CN.md](./README_zh_CN.md)。

## 环境

- Node.js 18+
- npm（或 pnpm）
- 本地已安装思源笔记

```bash
npm install
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 监听源码，实时构建并写入思源插件目录，改完在思源里禁用再启用插件即可 |
| `npm run build` | 生产构建，输出 `dist/` 与 `package.zip` |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run check-package` | 校验产物是否符合集市上架要求 |
| `npm run assets` | 重新生成 `icon.png` 与 `preview.png` |
| `npm run release` | 类型检查 + 构建 + 校验，发布前跑这个 |

## 本地联调

在项目根目录创建 `.env.local`：

```
VITE_SIYUAN_WORKSPACE_PATH=D:/siyuan_data
```

然后执行 `npm run dev`，构建产物会直接写入：

```
{工作空间}/data/plugins/siyuan-plugin-blocktodo/
```

`dist/` 不要放在 `data/plugins/` 下——那里会被同步，卸载插件时目录会被整体删除。

## 目录结构

```
src/
├── index.ts              插件入口：注册页签、顶栏按钮、命令、事务监听
├── App.vue               根组件：三视图切换 + 全局键盘
├── api/kernel.ts         思源内核 HTTP 接口封装
├── core/
│   ├── types.ts          任务模型、状态、筛选类型、设置类型
│   ├── task.ts           任务块 ↔ 内存模型的双向映射
│   ├── filter.ts         筛选、计数、排序、分组、树形展开
│   └── date.ts           日期与重复规则
├── store/                内存仓库、缓存、撤销栈、设置
├── ui/                   组件与派生数据
├── i18n/                 中英文语言包
└── styles/index.scss     样式（全部使用思源主题变量）
```

## 设计约束

1. **任务块是唯一事实源。** 插件不存任务副本；所有读写都落到笔记里的任务列表块与块属性上。
2. **不轮询。** 数据变化通过内核的 `transactions` 事件做增量更新，禁止引入定时全量刷新。
3. **长列表必须窗口化。** 新增列表类视图时沿用现有的窗口化渲染。
4. **派生计算只做一次。** 全表扫描类统计放进 `store/childStats.ts` 这类共享缓存。
5. **不引入运行时依赖。** 目前运行时只有 Vue；新增依赖需要明确理由。

## 发布

1. 更新 `package.json` 与 `plugin.json` 的 `version`，在 `CHANGELOG.md` 写明用户可见的变更。
2. `npm run release` 必须通过。
3. 在 GitHub 创建 Release，Tag 与版本号一致（如 `0.2.2`），附上 `package.zip`。
4. 首次上架：Fork [siyuan-note/bazaar](https://github.com/siyuan-note/bazaar)，在 `plugins.txt` 末尾加一行 `yichangsheng/siyuan-plugin-blocktodo`，提 PR 到 `main`。一个 PR 只加一个包。
5. 之后每次发版只需在自己仓库发 Release，集市索引会在 1–3 小时内自动更新。
