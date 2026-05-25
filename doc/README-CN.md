<p align="right">
  <a href="../README.md">English</a> |
  <a href="README-CN.md">简体中文</a>
</p>

这里是 Chatbox Plus 的代码仓库。Chatbox Plus 是基于 Chatbox 社区版修改的非官方 fork。
Chatbox Plus 与 ChatboxAI 或上游 Chatbox 项目无隶属关系。
本 fork 以 GPLv3 许可证发布。

上游来源：[chatboxai/chatbox](https://github.com/chatboxai/chatbox)

## 下载

Chatbox Plus 的构建产物会发布在本 fork 的 [GitHub Releases](https://github.com/Labyrinth0419/chatbox-plus/releases)。如果当前还没有发布版本，请按照下方构建指南从源码构建。

上游 Chatbox 的官方下载链接、移动端商店页面、付费服务和账号/license 服务不属于 Chatbox Plus。

---


<h1 align="center">
<img src='./statics/icon.png' width='30'>
<span>
    Chatbox Plus
    <span style="font-size:8px; font-weight: normal;">(GPLv3 Fork)</span>
</span>
</h1>
<p align="center">
    <em>Chatbox Plus 是基于 Chatbox 社区版的 GPLv3 桌面 AI 客户端，支持 ChatGPT、Claude、Google Gemini、Ollama 等模型服务。</em>
</p>

<p align="center">
<a href="https://github.com/Labyrinth0419/chatbox-plus/releases" target="_blank">
<img alt="macOS" src="https://img.shields.io/badge/-macOS-black?style=flat-square&logo=apple&logoColor=white" />
</a>
<a href="https://github.com/Labyrinth0419/chatbox-plus/releases" target="_blank">
<img alt="Windows" src="https://img.shields.io/badge/-Windows-blue?style=flat-square&logo=windows&logoColor=white" />
</a>
<a href="https://github.com/Labyrinth0419/chatbox-plus/releases" target="_blank">
<img alt="Linux" src="https://img.shields.io/badge/-Linux-yellow?style=flat-square&logo=linux&logoColor=white" />
</a>
<a href="https://github.com/Labyrinth0419/chatbox-plus/releases" target="_blank">
<img alt="下载量" src="https://img.shields.io/github/downloads/Labyrinth0419/chatbox-plus/total.svg?style=flat" />
</a>
</p>

<img src="./statics/demo_desktop_1.jpg" alt="应用截图" style="box-shadow: 2px 2px 10px rgba(0,0,0,0.1); border: 1px solid #ddd; border-radius: 8px; width: 700px" />

<img src="./statics/demo_desktop_2.jpg" alt="应用截图" style="box-shadow: 2px 2px 10px rgba(0,0,0,0.1); border: 1px solid #ddd; border-radius: 8px; width: 700px" />

## 特性

-   **本地数据存储**  
    :floppy_disk: 您的数据保留在您的设备上，确保数据永不丢失并保护您的隐私。

-   **无需部署、直接安装的安装包**  
    :package: 通过可下载的安装包快速开始使用。无需复杂设置！

-   **支持多个 LLM 提供商**  
    :gear: 无缝集成多种 AI 模型：

    -   OpenAI (ChatGPT)
    -   Azure OpenAI
    -   Claude
    -   Google Gemini Pro
    -   Ollama (启用对本地模型的访问，如 llama2、Mistral、Mixtral、codellama、vicuna、yi 和 solar)
    -   ChatGLM-6B

-   **使用 Dall-E-3 生成图像**  
    :art: 使用 Dall-E-3 创建您想象中的图像。

-   **增强提示**  
    :speech_balloon: 高级提示功能，精炼并聚焦您的查询以获得更好的响应。

-   **键盘快捷键**  
    :keyboard: 使用加速您工作流程的快捷键保持高效。

-   **Markdown、Latex 和代码高亮**  
    :scroll: 使用 Markdown 和 Latex 的全部功能生成消息，并结合各种编程语言的语法高亮，提高可读性和呈现效果。

-   **提示库和消息引用**  
    :books: 保存和组织提示以供重复使用，并引用消息以在讨论中提供上下文。

-   **流式回复**  
    :arrow_forward: 通过即时、渐进式回复快速响应您的互动。

-   **人体工程学 UI 和深色主题**  
    :new_moon: 用户友好的界面，带有夜间模式选项，减少长时间使用时的眼睛疲劳。

-   **团队协作**  
    :busts_in_silhouette: 轻松协作并在团队中共享 OpenAI API 资源。[了解更多](../team-sharing/README.md)

-   **跨平台可用性**  
    :computer: Chatbox Plus 可面向 Windows、Mac、Linux 构建。

-   **通过 Web 版本随处访问**  
    :globe_with_meridians: 在任何设备上使用带有浏览器的 Web 应用程序，随时随地。

-   **iOS 和 Android**  
    :phone: 使用移动应用程序，随时随地在您的指尖上带来这种能力。

-   **多语言支持**  
    :earth_americas: 通过提供多种语言的支持，迎合全球受众：

    -   English
    -   简体中文 (Simplified Chinese)
    -   繁體中文 (Traditional Chinese)
    -   日本語 (Japanese)
    -   한국어 (Korean)
    -   Français (French)
    -   Deutsch (German)
    -   Русский (Russian)

-   **更多...**  
    :sparkles: 不断增强体验，加入新功能！

## 常见问题解答

-   [常见问题](./FAQ-CN.md)

## 如何贡献

欢迎任何形式的贡献，包括但不限于：

-   提交问题
-   提交拉取请求
-   提交功能请求
-   提交错误报告
-   提交文档修订
-   提交翻译
-   提交任何其他形式的贡献

## 构建指南

1. 从 Github 克隆仓库

```bash
git clone https://github.com/Labyrinth0419/chatbox-plus.git
```

2. 安装所需的依赖

```bash
pnpm install
```

3. 启动应用程序（开发模式）

```bash
pnpm run dev
```

4. 构建应用程序，为当前平台打包安装程序

```bash
pnpm run package
```

5. 构建应用程序，为所有平台打包安装程序

```bash
pnpm run package:all
```

## Star History

[![星星历史图表](https://api.star-history.com/svg?repos=Labyrinth0419/chatbox-plus&type=Date)](https://star-history.com/#Labyrinth0419/chatbox-plus&Date)

## 联系方式

请通过 [GitHub Issues](https://github.com/Labyrinth0419/chatbox-plus/issues) 反馈问题和讨论项目。
