# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[项目仓库初始结构]
- Date: 2026-04-24
- Context: Agent 在执行“启动项目”时发现
- Category: 代码结构
- Instructions:
  - 仓库根目录当前仅包含 `README.md`，未发现 `package.json`、后端入口或其他常见项目文件。
  - 当前看起来不像一个可直接启动的 Web 或应用项目，需先确认项目内容是否完整。

[monkeyboss 产品背景]
- Date: 2026-04-24
- Context: 用户在说明项目背景时提供
- Category: 代码结构
- Instructions:
  - `monkeyboss` 是一个浏览器控制产品，包含插件端和服务端。
  - 服务端负责控制浏览器插件，插件根据服务端指令执行网页操作。
  - 典型业务场景包括知乎账号运营和小红书账号运营，由插件侧完成页面操作。
  - 服务端支持配置大模型。

[monkeyboss 原型启动方式]
- Date: 2026-04-24
- Context: Agent 在执行“生成项目并启动”时发现
- Category: 构建方法
- Instructions:
  - 当前原型项目使用根目录 `package.json` 管理启动脚本。
  - 服务端通过 `npm run dev` 启动，入口文件为 `server/index.js`。
  - 服务端默认监听 `3000` 端口，并同时提供管理页面与 API。
  - 浏览器插件通过 Chrome 开发者模式加载 `extension/` 目录。

[monkeyboss 插件下载入口]
- Date: 2026-04-24
- Context: Agent 在执行“插件可以在服务端进行下载”时发现
- Category: 代码模式
- Instructions:
  - 服务端提供 `GET /downloads/extension` 用于直接下载浏览器插件 ZIP 包。
  - 管理页面首页提供“下载插件 ZIP”入口，便于从服务端分发插件。

[monkeyboss 插件同步展示]
- Date: 2026-04-24
- Context: Agent 在执行“同步到服务端时要有已同步说明”时发现
- Category: 代码模式
- Instructions:
  - 服务端使用插件状态字段 `lastSyncAt`、`syncStatus` 表示最近同步状态。
  - 控制台页面展示“已同步到服务端”和最近同步时间，便于确认插件已连通。
