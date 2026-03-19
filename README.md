# MonkeyBoss

AI 驱动的 MonkeyCode 自动化管理工具，通过浏览器自动化 + AI 决策实现 7x24 小时持续开发。

## 工作原理

1. 启动浏览器隐私模式，登录 MonkeyCode 平台
2. 采集页面状态（DOM、交互元素、对话内容）
3. 将页面上下文发送给 AI，AI 返回操作指令
4. 执行浏览器操作（点击、输入、发送消息等）
5. 循环 2-4，直到 AI 判断项目开发完成

## 快速开始

```bash
# 安装依赖
npm install

# 安装浏览器
npx playwright install chromium

# 复制配置文件并填写
cp .env.example .env

# 构建
npm run build

# 运行
npm start
```

## 配置

复制 `.env.example` 为 `.env`，填写以下必要配置：

| 变量 | 说明 |
|------|------|
| `MONKEYCODE_USERNAME` | MonkeyCode 账号 |
| `MONKEYCODE_PASSWORD` | MonkeyCode 密码 |
| `AI_API_KEY` | AI 服务 API Key |
| `AI_MODEL` | AI 模型名称（默认 gpt-4o） |
| `TASK_PROJECT_NAME` | 要开发的项目名称 |
| `TASK_DESCRIPTION` | 项目需求描述 |

## CLI 用法

```bash
# 启动自动化任务
monkeyboss run -p "my-project" -d "开发一个用户管理系统"

# 可视化模式运行（显示浏览器窗口）
monkeyboss run --no-headless

# 限制最大迭代次数
monkeyboss run --max-iterations 500

# 验证配置
monkeyboss validate
```

## 项目结构

```
src/
  browser/    - 浏览器引擎（Playwright 隐私模式）
  auth/       - MonkeyCode 账号认证
  scraper/    - 页面数据采集
  ai/         - AI 决策层（OpenAI 兼容）
  executor/   - 浏览器操作执行器
  engine/     - 7x24 任务循环引擎
  config/     - 配置管理
  utils/      - 日志等工具
  index.ts    - CLI 入口
```

## License

MIT
