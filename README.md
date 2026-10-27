# 去小住

**找个喜欢的地方，小住一下。**

去小住是一个中文旅居探索网站，将租房、天气、周边设施、实地体验视频、网页阅读和 RSS 资讯集中到同一处，帮助你在出发前整理目的地资料。支持收藏城市与检索结果、查看最近探索、导出 Markdown 调研资料，并适配手机和桌面浏览器。

项目使用 Vinext、React、TypeScript 和 Cloudflare Workers，采用奶油米白与陶土橘的民宿风格界面，搭配屋檐下安睡的小猪标识。六项检索功能读取公开来源，无需模型 API Key。

## 目录

- [首页设计](#首页设计)
- [本地开发](#本地开发)
- [构建与生产预览](#构建与生产预览)
- [功能与 API](#功能与-api)
- [收藏与资料导出](#收藏与资料导出)
- [数据范围与时效](#数据范围与时效)
- [检查命令](#检查命令)
- [源码结构与打包](#源码结构与打包)
- [素材与许可](#素材与许可)

## 首页设计

首页设计稿以奶油米白、陶土橘与可可棕为主色，搭配小猪屋檐标识和日光露台，呈现放松、温暖的民宿风格。实现中的字标与 Logo 同为 `#BC785C`；设计稿展示布局与氛围，最终字标颜色以实现为准。

![去小住首页设计稿](docs/design/homepage-design.png)

[查看首页设计稿原图](docs/design/homepage-design.png)

## 本地开发

需要 Node.js **22.13.0 或更新版本**及 npm。在项目目录执行：

```sh
npm ci
npm run dev
```

默认开发地址为 `http://localhost:5173`，以终端实际输出为准。安装依赖与公开信息检索均需要联网。六项检索功能无需模型 API Key、第三方账号或 Cookie，也不依赖数据库。

## 构建与生产预览

```sh
npm run build
npm run start
```

构建输出在 `dist/`。`start` 使用项目内 Wrangler 读取 `dist/server/wrangler.json`，在 `127.0.0.1` 启动本地 Worker 生产预览；端口以终端输出为准。这条命令不会发布线上网站。修改源码后需重新构建，生产预览才会使用新版本。

所有运行脚本均使用项目相对路径和本地依赖。干净源码没有 `.sites-runtime/execution-profile.json` 时默认使用 `portable` 模式，无需安装 Codex 插件或设置插件绝对路径。仓库同时保留 Sites 托管环境脚本；只有显式选择 `managed-linux` 模式时才会使用 GNU `timeout`、`flock` 等 Linux 工具。正常本地开发按上述 npm 命令运行即可。

## 功能与 API

六项功能共用 `GET /api/research`，用 `type` 参数选择功能。

| 功能 | `type` | 来源与输入 |
| --- | --- | --- |
| 房租检索 | `rent` | 豆瓣租房小组、安居客、贝壳 / 链家；输入城市，可选关键词、区域和来源 |
| 近期天气 | `weather` | 中国天气网 7 天预报页面；输入已收录城市或 9 位城市代码 |
| 周边设施 | `facilities` | 大众点评城市页与关键词搜索；输入已收录城市或城市拼音，可选关键词与来源 |
| 实地体验 | `bili` | B 站公开搜索接口；输入城市与关键词，返回标题、作者、播放量和原站链接 |
| 网页阅读 | `read` | 输入公开网页 `url`；优先通过 Jina Reader 读取，失败后尝试直连并清理 HTML |
| 本地资讯 | `feeds` | 输入公开 RSS / Atom `url`；读取条目标题、摘要与原文链接 |

公共参数包括 `city`、`keyword`、`district`、`source`、`url` 和 `limit`。默认 `type=rent`、`city=大理`、`source=all`。`limit` 适用于视频与订阅条目，默认 6，有限数值会向下取整并限制在 1–12，非数值回退为 6。

租房来源别名为 `douban`（豆瓣租房小组）、`anjuke`（安居客）、`ke`（贝壳/链家）；设施来源别名为 `city`（大众点评城市页）、`dianping`（大众点评关键词）。`source=all` 读取该功能的全部来源，也支持传入上述对应的完整中文来源名。

接口返回 `query`、`results`、`fetchedAt`，视频检索还会返回 `videos`。每条结果包含 `title`、`source`、`url`、`content` 和 `status`。来源读取失败时保留来源链接并返回该条错误；部分或全部来源失败时仍可能返回 HTTP 200，调用方应检查每条 `status`。条件无效时返回 HTTP 400。

## 收藏与资料导出

支持收藏城市、收藏检索结果、最近探索及 Markdown 调研资料导出。数据保存在当前浏览器、当前站点的 `localStorage`，存储键为 `slowstay-library`。

收藏结果是保存时的内容快照，不会自动刷新。不同浏览器或域名之间不会同步；清理浏览器数据会丢失本地收藏。可通过导出按钮另存资料。

## 数据范围与时效

页面读取真实公开来源，不填充模拟房源、租金或天气。`fetchedAt` 是本次检索时间，不能当作来源的发布时间或信息有效期；接口使用 `Cache-Control: no-store`，但第三方页面或 Jina Reader 仍可能提供缓存内容。天气读取近期预报，不提供长期气候统计。

租房与设施结果主要是来源页面正文，不是经过核验的结构化房源库或地图数据。B 站功能检索视频元信息，不理解视频正文。当前版本没有在线订房、支付、合同服务或自动生活成本预算。

外部站点可能限流、要求登录或安全验证，也可能调整页面结构与城市路径。读取失败会显示错误并保留原站入口。通用网页与订阅网址仅支持公开域名及标准 HTTP / HTTPS 端口，并校验地址与重定向；其 DNS 校验依赖 Cloudflare DNS over HTTPS。网页正文以文本展示，不执行来源 HTML。

## 检查命令

```sh
npx tsc --noEmit
node --experimental-strip-types app/api/research/selftest.mjs
npm run build
```

自检覆盖地址校验、正文清理、RSS / Atom 解析、重定向与错误响应；其中网络响应由自检桩模拟，不表示第三方来源当前一定可用。需要检查当前来源时，在本地页面实际执行相应检索。

## 源码结构与打包

主要目录与文件如下：

```text
.
├── app/
│   ├── api/research/
│   │   ├── route.ts              # 六类检索的 GET 接口
│   │   ├── core.ts               # 来源读取、地址检查与正文解析
│   │   └── selftest.mjs          # API 核心逻辑自检
│   ├── page.tsx                 # 页面、导航、检索、收藏与导出
│   ├── layout.tsx               # 页面元信息与全局布局
│   ├── globals.css              # 暖色主题与响应式样式
│   └── chatgpt-auth.ts           # Sites 模板身份辅助函数
├── components/ui/               # 模板 UI 组件
├── hooks/                       # 通用 React hooks
├── lib/                         # 通用工具与连接器适配
├── db/                          # 模板数据库定义，检索功能不依赖数据库
├── docs/design/
│   └── homepage-design.png       # 首页设计稿
├── examples/d1/                 # 可选 D1 示例
├── public/
│   ├── brand/
│   │   ├── quxiaozhu-mark.svg    # 小猪屋檐图标
│   │   └── quxiaozhu-logo.svg    # 横向品牌字标
│   ├── images/
│   │   ├── warm-stay-hero.png    # 当前首页主图
│   │   ├── dali-hero.png         # 大理氛围图
│   │   ├── chengdu.png           # 成都氛围图
│   │   ├── weihai.png            # 威海氛围图
│   │   └── sky-coast-hero.png    # 保留的海岸背景
│   └── favicon.svg
├── scripts/
│   ├── run-framework.mjs        # 开发与构建入口
│   ├── execution-profile.mjs    # 本地运行模式
│   ├── sites-env.mjs            # 本地工具环境
│   ├── vite/                    # 随源码保留的 Vite 插件
│   └── connector-preview/       # 本地连接器预览适配
├── worker/index.ts              # Cloudflare Worker 入口
├── vendor/                      # 模板样式与对应许可证
├── .openai/hosting.json          # Sites 托管配置
├── package.json                 # 依赖与 npm 命令
├── package-lock.json            # 锁定依赖版本
├── vite.config.ts               # Vinext / Vite / Worker 配置
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── README.md
├── ASSETS.md                    # 素材来源与生成说明
└── LICENSE.original             # 原旅居检索项目的 MIT 许可证
```

源码包应包含源文件、`package.json`、`package-lock.json`、`public/`、`scripts/`、`worker/`、`.openai/hosting.json` 和许可证。排除 `node_modules/`、`.git/`、`dist/`、`.next/`、`.vinext/`、`.wrangler/`、`.sites-runtime/`、缓存、日志、`*.tsbuildinfo`，以及 `.env*`、`.dev.vars*`、私钥等本地凭据。解压后运行 `npm ci` 重装依赖，不要复用其他电脑的 `node_modules`。

## 素材与许可

氛围图片由 ImageGen 生成，并非实地拍摄、真实房源或设施证明。当前首页使用阳光民宿湖山露台图，品牌配色、目的地图片及保留背景的来源与提示词见 [ASSETS.md](ASSETS.md)。

旅居检索能力改编自 Agent Reach 中文旅居检索，原项目的 MIT 许可证与版权声明保留在 [LICENSE.original](LICENSE.original)。模板另附 [Sites Vite 插件许可证](scripts/vite/sites-vite-plugin.LICENSE) 和 [shadcn 样式许可证](vendor/shadcn-tailwind-4.13.0.LICENSE.md)，分发源码时应一并保留。
