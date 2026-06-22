<div align="right">

**[English](./CHANGELOG.en.md)**

</div>

# 更新日志

本文档记录 **Confluence Preview** 的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [0.1.0] - 2026-06-19

第一个公开版本。在 VS Code 里预览 Confluence 存储格式，整个流程跑在本地，不发网络请求。

### 新增

#### 预览与编辑器集成

打开 `.confluence` 文件，渲染面板坐在旁边，每打一个字刷新一次（250 ms 防抖），保存时立即刷新。注册的文件类型：`*.confluence`、`*.cfl`、`*.confluence-storage`，以及任何包含 Confluence 标记的 `*.html`。

四个命令：`Confluence: Open Preview`、`Confluence: Refresh Preview`、`Confluence: Copy Rendered HTML`、`Confluence: Export to Markdown`。

右边一栏有 `h1`–`h6` 的大纲，跟着滚动位置高亮当前章节。

#### 宏渲染

`code` 支持标题、语言、折叠、行号，语法高亮走 `highlight.js`。`toc` / `table-of-contents` 在文末画个占位标记，真实大纲由侧边栏提供。`note` / `info` / `warning` / `tip` 是四种带图标的彩色标注块。`panel` 标题和边框颜色由宏参数控制。`expand` 是可折叠块（`<details>` / `<summary>`）。`excerpt` / `excerpt-include` 是可复用片段。`quote` 是带样式的 blockquote。`noformat` 预格式化块，原样保留 CDATA。`status` 是彩色徽标：grey / green / yellow / red / blue / purple。

`jira` 生成 issue 链接，读 `baseurl` 参数。`user-mention` 是 `@user` 标签。`link` / `pagelink` 是带可选正文的链接宏。`section` / `column` 是 flex-row 布局。`anchor` 是页内锚点。`children` 只画占位（不连 Confluence，离线安全）。`emoticon` / `cheese` 渲染 emoji 字符。

遇到不认识的内置宏，落成一个灰色占位框，里面写宏名和正文——不崩，但也不假装渲染过。

#### 结构化链接

`<ac:link><ri:page>`、`<ri:attachment>`、`<ri:url>`、`<ri:user>` 解析为内联链接。行内裸 `<ri:page>` / `<ri:url>` 同样能识别。

#### 标准 HTML

全覆盖：`h1`–`h6`、`p`、行内格式（`strong` / `em` / `u` / `s`）、`sub` / `sup`、行内 `code`、`pre`、`blockquote`、`ul` / `ol` / `li`、`a`、`img`、`table` / `thead` / `tbody` / `tr` / `th` / `td`（含 `colspan` / `rowspan`）、`span`、`div`、`figure`、`figcaption`、`time`、`small`、`mark`、`cite`、`q`、`kbd`、`br`、`hr`。

#### 质量与安全

CDATA 在解析前 base64 暂存，渲染时再逐字还原。`code` 宏里的代码体不会在解析阶段被破坏。

所有用户文本在注入前过 `sanitize.ts` 转义。UI 跟 VS Code 的浅色 / 深色 / 高对比度主题走。零网络请求、零埋点，隔离网络环境也能用。Webview CSP 卡得死，不加载远程脚本、样式、图片。

### 已知限制

内部 page / attachment 链接是带标签的占位符，不是真实 URL（扩展没有 Confluence 主机上下文）。外部 `<img>` 被 CSP 拦了，也是占位符。预览只读，要改还是回 Confluence 自己的源码编辑器。Markdown 导出尽力而为，不保证可往返还原。

[0.1.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.1.0
