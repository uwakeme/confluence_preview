<div align="right">

**[English](./CHANGELOG.en.md)**

</div>

# 更新日志

本文档记录 **Confluence Preview** 的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [Unreleased]

## [0.2.0] - 2026-11-16

### 新增

#### 顶部 banner

README 顶部加了一张深色 banner 图，标出项目名、一句话简介和技术栈标签。

#### 预览与导出

- 新命令「Confluence: Export Standalone HTML」：导出单个自带样式和语法高亮的 HTML 文件，浏览器直接打开，自动跟随系统亮色 / 暗色。
- 快捷键 `Ctrl+Shift+V`（macOS `Cmd+Shift+V`）打开预览；编辑器右键菜单也能打开。
- 预览打开时编辑器标题栏出现刷新按钮；「刷新预览」回到命令面板。
- 编辑器滚动时预览自动跟随到对应章节；双击预览中的标题跳回源码位置。
- VS Code 窗口重载后预览自动恢复，不用重新打开。
- 大纲侧边栏可用预览顶栏按钮随时收起 / 展开，选择会被记住。
- 界面文案支持中英文，跟随 VS Code 显示语言。

#### 内容渲染

- 图片：`ac:image` 附件和相对路径 `<img>` 只要文件在源码同目录就直接显示，支持尺寸、边框和说明文字；本地附件链接点击即可打开。
- 任务清单：`ac:task-list` 渲染为带勾选框的列表，完成状态一目了然。
- 新版页面布局：支持 Confluence Cloud 的 `ac:layout`（等宽双栏、三栏、左右侧边栏），窄屏自动换行。
- 页内目录：`toc` 宏真正渲染在正文中，支持层级范围和平铺 / 树形两种样式。
- 同页摘录引用：`excerpt-include` 引用本文档的 `excerpt` 时直接展开内容，定义在引用之后也能解析。
- 代码块行号：`linenumbers` 和 `firstline` 参数生效，行号从指定行开始。
- 表格增强：单元格背景高亮、列宽、对齐、合并单元格都正确显示。
- 彩色文本：颜色、背景、对齐等安全内联样式保留显示。
- 链接自定义文字：`ac:link` 的纯文本 / 富文本链接体正确显示。

#### 设置

- `baseUrl`：配置 Confluence 地址后，内部页面链接变成真实链接。
- `jiraBaseUrl`：配置 Jira 地址后，工单号变成真实链接。
- `localFiles`：本地附件 / 图片解析开关。
- `refreshDebounce`：刷新防抖延迟可调。
- `outlineVisible`：大纲默认显示开关。
- `enableForHtml`：可选接管普通 `.html` 文件（默认关闭）。

### 修复

- 自闭合标签（`<ri:page/>`、表情等）后面的文字不再被吞掉。
- 嵌套宏的参数不再串到外层：外层面板标题不会被内层代码标题覆盖。
- 同名标题各有独立锚点，大纲跳转不再跳错位置。
- 代码块和注释里的假标题不再混进大纲。
- CDATA 包裹的参数和代码内容不再丢失。
- 实体文本（`&amp;` 等）不再显示成二次转义的源码。
- `status` 宏的颜色、标题和 subtle 样式正确生效。
- `jira` 宏没有 baseurl 时显示为徽章而不是死链接。
- `user-mention` 兼容新版 Confluence 的 account-id 参数，不再显示空白。
- `anchor` 宏兼容旧版参数格式。
- 刷新后阅读位置不再跳回顶部，展开的折叠块保持展开。
- 大纲高亮正确跟随滚动。
- 缺失附件的图片占位符正确显示尺寸。
- 结构化 `emoticon` 宏正确读取名字参数。
- README 顶部的版本号标签显示的是旧版本号，现在与实际发布版本保持一致。

### Changed

- Markdown 导出重写：表格（含对齐和转义）、任务列表、嵌套列表、代码围栏、折叠块、各类宏的转换更贴近原文结构。
- 命令名称统一为「Confluence: Open Preview / Refresh Preview / Copy Rendered HTML / Export to Markdown」。
- 未知宏会在预览顶栏显示警告计数。
- `.html` 文件默认不再接管，改由设置开启。

### 安全

- 恶意样式注入（`url()`、`expression()` 等）被白名单拦截。
- `javascript:` / `data:` / `vbscript:` 链接被中和。
- 外部图片彻底不加载，webview 内容安全策略收紧。
- 本地附件解析被限制在源码所在目录内，无法越界读取其他文件。
- 外链打开前经过协议白名单校验。

## [0.1.2] - 2026-08-03

### Changed

#### 大纲侧边栏

- 标题按层级显示不同字号和字重,h1 最粗最大,越往下越小、越淡,h5 全部大写。文档里章节的层级关系一眼可见。
- 每个标题前多了一个小三角,点一下收起或展开它下面的所有子标题,文档再长也能快速定位到关心的部分。
- 展开/收起状态会被记住,刷新文档或重新打开文件时仍然保持。
- 叶子标题(没有子标题的)用隐形占位保持对齐,文字不会比兄弟节点偏左。
- 小三角展开时旋转 90°,开合有视觉反馈。

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

[0.2.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.2.0
[0.1.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.1.0
