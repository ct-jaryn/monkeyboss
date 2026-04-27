# monkeyboss

MonkeyBoss 是一个浏览器控制产品，包含服务端和浏览器插件两部分：

- 服务端：配置大模型、管理插件实例、下发运营任务
- 插件端：接收服务端指令并执行网页操作
- 场景示例：知乎账号运营、小红书账号运营

## 项目目标

这个仓库当前提供一个最小可运行原型，用来验证以下主链路：

- 服务端配置模型参数
- 服务端创建并下发任务
- 浏览器插件向服务端注册并轮询同步
- 插件执行浏览器动作并回传结果
- 服务端页面展示插件同步状态与任务状态

## 当前脚手架

当前版本是一个最小可运行原型：

- `server/`: Node.js 服务端与控制台页面
- `extension/`: Chrome Manifest V3 插件
- `shared/`: 服务端与插件约定文档

## 目录结构

```text
.
├── extension/        # 浏览器插件
├── server/           # 服务端与控制台页面
├── shared/           # 服务端和插件共享协议文档
├── package.json      # 根目录启动脚本
└── README.md
```

## 架构说明

```text
Browser Extension <-> MonkeyBoss Server <-> Model Config / Task Orchestration
```

- 服务端负责插件接入、任务管理、模型配置和状态展示
- 插件负责在浏览器中执行实际动作，例如打开页面、点赞、评论
- 当前原型默认使用内存状态，重启服务后插件和任务状态会重置

## 快速启动

```bash
npm run dev
```

启动后访问：

- 控制台：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`
- 插件下载：`http://localhost:3000/downloads/extension`

## 控制台能力

控制台首页当前支持：

- 下载插件 ZIP
- 配置模型参数
- 模型 API key 安全保存，页面不会回显已保存密钥
- 输入自然语言指令，由 AI 生成结构化浏览器任务
- 创建任务
- 使用任务模板快速创建知乎、小红书和评论动作
- 按任务状态筛选任务列表
- 查看任务列表
- 查看插件同步状态
- 查看最近同步时间和基础插件信息
- 手动刷新控制台状态并自动定时刷新

## 插件加载方式

1. 打开 Chrome 扩展管理页面 `chrome://extensions`
2. 打开开发者模式
3. 选择“加载已解压的扩展程序”
4. 选择项目中的 `extension/` 目录

也可以直接从服务端下载插件压缩包：

1. 打开控制台首页
2. 点击“下载插件 ZIP”
3. 解压压缩包
4. 在 Chrome 中加载解压后的插件目录

如果插件运行在你的本地浏览器，而服务端是通过线上预览地址访问的，请在插件弹窗里把 `Server URL` 改成控制台页面地址，而不是默认的 `http://localhost:3000`。

## 插件同步说明

插件同步成功后，服务端控制台会显示：

- `已同步到服务端`
- 最近同步时间
- 插件 ID
- 浏览器与版本信息

如果点击“立即同步”失败，请优先检查：

1. `Server URL` 是否填写为真实服务端地址
2. 服务端是否已经启动
3. 插件是否为最新下载版本

## 已实现能力

- 大模型配置接口：`GET/PUT /api/config/model`
- 插件注册接口：`POST /api/extensions/register`
- 任务创建接口：`POST /api/tasks`
- 插件拉取任务：`GET /api/extensions/next-task`
- 任务结果回传：`POST /api/tasks/:id/result`
- 一个可直接操作的服务端管理页面
- 服务端直接下载插件 ZIP：`GET /downloads/extension`
- 插件轮询服务端并执行 `open_url` 动作
- 插件支持执行 `like` 和 `comment` 页面动作，会在目标页面内尝试点击按钮或填入文本

## AI 任务生成

控制台支持在“AI 指令生成任务”区域输入自然语言，例如：

```text
打开 https://www.zhihu.com/ 并点赞第一条内容
```

服务端会调用已配置的模型，把自然语言转换为结构化任务：

```json
{
  "target": "zhihu",
  "action": "like",
  "payload": {
    "url": "https://www.zhihu.com/"
  }
}
```

如果还没有配置模型密钥，服务端会使用本地规则兜底生成基础任务，便于先验证完整链路。

插件当前支持的动作：

- `open_url`：打开目标页面
- `like`：打开页面后尝试点击文本或无障碍标签中包含“赞”“喜欢”“like”“upvote”的按钮
- `comment`：打开页面后尝试找到可输入文本的评论框并填入 `payload.comment`

## API 概览

- `GET /api/health`：服务健康检查
- `GET /api/config/model`：获取模型配置
- `PUT /api/config/model`：更新模型配置
- `POST /api/extensions/register`：插件注册
- `GET /api/extensions`：获取插件同步状态列表
- `GET /api/extensions/next-task`：插件拉取下一条任务
- `GET /api/tasks`：获取任务列表
- `POST /api/tasks`：创建任务
- `POST /api/ai/tasks`：使用自然语言生成并创建任务
- `POST /api/tasks/:id/result`：插件回传任务结果
- `GET /downloads/extension`：下载插件压缩包

## 下一步建议

1. 接入真实数据库与鉴权
2. 为知乎、小红书分别抽象站点适配器
3. 接入真实大模型调用链路
4. 增加任务编排、重试、日志与审计能力
