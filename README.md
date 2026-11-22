# Yuhanbo Task

Yuhanbo Task is a task manager and Pomodoro timer for Obsidian. It stores tasks as Markdown files in your vault and can optionally use DeepSeek to split a task into actionable subtasks.

[中文说明](#中文说明)

## Features

- Manage one-time and recurring tasks in configurable vault folders.
- Track task progress, due dates, execution dates, and subtasks.
- Archive completed tasks as Markdown files.
- Run a configurable Pomodoro timer with optional sound notifications.
- Optionally split tasks into subtasks with DeepSeek models.

## Installation

### Community plugins

After the plugin is accepted into the Obsidian community directory:

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse** and search for **Yuhanbo Task**.
3. Install and enable the plugin.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `<vault>/.obsidian/plugins/yuhanbo-task/`.
3. Copy the downloaded files into that folder.
4. Reload Obsidian, then enable **Yuhanbo Task** under **Community plugins**.

## Usage

### Task management

1. Open the plugin settings and configure the folders for recurring, one-time, and completed tasks.
2. Use **Add new task** from the command palette to create a task.
3. Use **View all tasks** to edit tasks, update progress, or mark tasks as complete.
4. Use the folder commands to open the Markdown files created by the plugin.

For recurring tasks, **Complete this occurrence** archives the due occurrence and resets progress for the next scheduled date. Setting progress to 100% does the same. Completing a task late preserves its schedule, such as the 24th of every month. The task's end date still applies.

### Pomodoro timer

1. Select the clock icon in the ribbon or run **Start Pomodoro timer**.
2. Choose a task and start a work session.
3. The plugin notifies you when work and break periods end.
4. Work duration, break duration, cycle interval, and notification sound are configurable.

### AI task splitting

1. Create a DeepSeek API key and enter it in the plugin settings.
2. Optionally choose a prompt file from your vault and select a DeepSeek model.
3. Enable AI task splitting when creating a task.
4. Generate and review the proposed subtasks before saving the task.

## Privacy and external services

- AI task splitting is disabled by default and only runs when you explicitly request it.
- When AI task splitting runs, the task title, task description, and the contents of your optional prompt file are sent directly to `https://api.deepseek.com` for processing. DeepSeek's terms and privacy policy apply to that request.
- Your DeepSeek API key is stored in this plugin's local Obsidian settings data and is sent only to the DeepSeek API for authentication.
- The plugin does not include telemetry, analytics, advertisements, or background network requests.
- If you choose a custom notification sound, the plugin accesses only the vault file or desktop file path that you provide.

## Compatibility

- Minimum Obsidian version: `0.15.0`.
- Desktop and mobile are supported. Direct desktop file paths for custom sounds are only checked on desktop; vault-relative sound files are recommended for portability.

## 中文说明

Yuhanbo Task 是一款 Obsidian 任务管理与番茄时钟插件。任务以 Markdown 文件保存在笔记库中，并可按需调用 DeepSeek，将复杂任务拆分为可执行的子任务。

### 主要功能

- 管理一次性任务和按年、月、周、日重复的任务。
- 跟踪任务进度、截止日期、执行日期和子任务。
- 将完成的任务归档为 Markdown 文件。
- 提供可配置的番茄时钟和声音提醒。
- 可选的 DeepSeek AI 任务拆分。

重复任务的「完成本期」及 100% 进度只归档当前待办期次，下次仍按原周期排期，整个计划的截止日期继续生效。

### 隐私说明

AI 功能默认关闭。只有在你主动生成子任务时，任务标题、任务描述及可选提示词文件内容才会发送到 `https://api.deepseek.com`。API Key 保存在 Obsidian 的本地插件设置中，仅用于向 DeepSeek 认证。本插件不包含遥测、分析、广告或后台网络请求。

## License

[MIT](LICENSE)

## Author

**余汉波**

- GitHub: [@yuhanbo758](https://github.com/yuhanbo758)
- Email: yuhanbo@sanrenjz.com
- Website: [三人聚智](https://www.sanrenjz.com)
