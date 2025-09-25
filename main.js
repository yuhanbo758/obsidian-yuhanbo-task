const { Plugin, Notice, PluginSettingTab, Setting, Modal, moment, normalizePath } = require('obsidian');

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: "",
    promptFilePath: "",
    repeatingTasksPath: "任务/重复性任务",
    oneTimeTasksPath: "任务/一次性任务",
    completedTasksPath: "任务/已完成任务",
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    soundEnabled: true,
    soundFilePath: "",
    aiEnabled: false,
    aiModel: "deepseek-chat",
    showRemainingDays: true // 是否显示剩余天数
};

// 番茄时钟状态
const PomodoroState = {
    IDLE: "idle",
    WORKING: "working",
    SHORT_BREAK: "shortBreak",
    LONG_BREAK: "longBreak",
    PAUSED: "paused"
};

// 任务类型
const TaskType = {
    REPEATING: "repeating",
    ONE_TIME: "oneTime"
};

// 任务周期
const TaskCycle = {
    YEARLY: "yearly",
    MONTHLY: "monthly",
    WEEKLY: "weekly",
    DAILY: "daily"
};

// 内置默认提示音（base64编码的短音效，文件大小约3KB）
const DEFAULT_SOUND = 'data:audio/mp3;base64,SUQzAwAAAAAfdlRJVDIAAAAZAAAAaHR0cDovL3d3dy5mcmVlc2Z4LmNvLnVrVFBFMQAAABcAAABVc2VyOiBwYXVsZW5nZWxicmVjaHRUQUxCAAAAGwAAAGh0dHA6Ly93d3cuZnJlZXNmeC5jby51a1RZRVIAAAAFAAAAMjAwNlRDT04AAAAVAAAAw4EgT3RoZXIsIE90aGVyOiBGeENPTU0AAAA9AAAAZnJlZSBzZnggLSBodHRwOi8vd3d3LmZyZWVzZnguY28udWsvVGhlIEJlbGwgKHNoYWxsb3cgdGluaykubXAzQVBJQwAAAGMCAABNTUlG/z8AAP/+AAB0AAAAOAAAACAAAAAgAAAAAP/7UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhpbmcAAAAPAAAAGwAACloAIiIiIiIiIiIiNTU1NTU1NTU1NUhISEhISEhISFpaWlpaWlpaWmxsbGxsbGxsbH9/f39/f39/f5GRkZGRkZGRkaSkpKSkpKSkpLa2tra2tra2trCwsLCwsLCwsJ+fn5+fn5+fn46Ojo6Ojo6OjpSUlJSUlJSUlJubm5ubm5ubm6KioqKioqKiorCwsLCwsLCwsMDAwMDAwMDAwL+/v7+/v7+/v6+vr6+vr6+vr56enp6enp6enpqampqampqamqKioqKioqKiorKysrKysrKyssHBwcHBwcHBwc/Pz8/Pz8/Pz9ra2tra2tra2tra2tra2tra2traAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tSZAAAA+w4TcHsMAAGUAFnAAAACRCxHQfh4AAaQAWgAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/+xJkKo/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAAQQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';

class YuhanboTaskPlugin extends Plugin {
    async onload() {
        console.log('加载任务管理与番茄时钟插件 - 任务将保存在您的笔记库中，而非插件目录');
        
        // 加载设置
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        
        // 添加设置标签页
        this.addSettingTab(new YuhanboTaskSettingTab(this.app, this));
        
        // 创建任务管理器
        this.taskManager = new TaskManager(this);
        
        // 确保 updateTask 方法可用并绑定上下文
        if (this.taskManager.updateTask) {
            this.taskManager.updateTask = this.taskManager.updateTask.bind(this.taskManager);
        }
        
        // 添加番茄时钟状态栏
        this.pomodoroTimer = new PomodoroTimer(this);
        
        // 添加侧边栏按钮
        this.addRibbonIcon('clock', '开始番茄时钟', () => {
            this.pomodoroTimer.startWorkWithTaskSelection();
        });
        
        // 添加查看任务的侧边栏按钮
        this.addRibbonIcon('checkmark', '查看任务列表', () => {
            new TaskListModal(this.app, this).open();
        });
        
        // 添加命令
        this.addCommand({
            id: 'start-pomodoro',
            name: '开始番茄时钟',
            callback: () => {
                this.pomodoroTimer.startWorkWithTaskSelection();
            }
        });
        
        this.addCommand({
            id: 'pause-pomodoro',
            name: '暂停番茄时钟',
            callback: () => {
                this.pomodoroTimer.pause();
            }
        });
        
        this.addCommand({
            id: 'add-task',
            name: '添加新任务',
            callback: () => {
                new TaskModal(this.app, this, null).open();
            }
        });
        
        this.addCommand({
            id: 'view-tasks',
            name: '查看所有任务',
            callback: () => {
                new TaskListModal(this.app, this).open();
            }
        });
        
        this.addCommand({
            id: 'open-repeating-tasks-folder',
            name: '打开重复性任务文件夹',
            callback: async () => {
                await this.openTaskFolder(this.settings.repeatingTasksPath);
            }
        });
        
        this.addCommand({
            id: 'open-onetime-tasks-folder',
            name: '打开一次性任务文件夹',
            callback: async () => {
                await this.openTaskFolder(this.settings.oneTimeTasksPath);
            }
        });
        
        this.addCommand({
            id: 'open-completed-tasks-folder',
            name: '打开已完成任务文件夹',
            callback: async () => {
                await this.openTaskFolder(this.settings.completedTasksPath);
            }
        });
        
        // 添加任务系统恢复命令
        this.addCommand({
            id: 'reset-task-system',
            name: '重置任务系统',
            callback: async () => {
                const confirmed = await this.confirmReset();
                if (confirmed) {
                    await this.resetTaskSystem();
                }
            }
        });
        
        // 初始化目录
        await this.taskManager.initializeDirectories();
        
        // 加载所有任务
        await this.taskManager.loadTasks();
        
        // 清理过期的重复性任务
        await this.taskManager.cleanupExpiredRepeatingTasks();
        
        // 启动定时清理机制
        this.startDailyCleanupTimer();
    }
    
    async openTaskFolder(folderPath) {
        if (!folderPath) {
            new Notice("未设置文件夹路径，请在设置中配置");
            return;
        }
        
        // 确保文件夹存在
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            try {
                await this.app.vault.createFolder(folderPath);
                new Notice(`已在笔记库中创建文件夹: ${folderPath}`);
            } catch (error) {
                console.error("创建文件夹失败:", error);
                new Notice("创建文件夹失败，请检查路径是否有效");
                return;
            }
        }
        
        // 尝试打开文件夹
        try {
            // 尝试获取一个文件浏览视图
            const leaf = this.app.workspace.getLeaf();
            await leaf.setViewState({
                type: "file-explorer"
            });
            
            // 尝试找到并选择文件夹
            const fileExplorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
            if (fileExplorer && fileExplorer.view) {
                // 等待一下确保视图已加载
                setTimeout(() => {
                    try {
                        // 通过路径查找文件夹
                        const folder = this.app.vault.getAbstractFileByPath(folderPath);
                        
                        if (folder) {
                            // 选择文件夹
                            const fileExplorerView = fileExplorer.view;
                            fileExplorerView.revealInFolder(folder);
                        }
                    } catch (err) {
                        console.error("打开文件夹视图失败:", err);
                    }
                }, 300);
            }
            
            new Notice(`打开笔记库中的任务文件夹: ${folderPath}`);
        } catch (error) {
            console.error("打开文件夹失败:", error);
            new Notice(`无法在界面显示文件夹，但文件夹已在笔记库中创建: ${folderPath}`);
        }
    }
    
    onunload() {
        console.log('卸载任务管理与番茄时钟插件 - 您的任务数据仍保留在笔记库中');
        if (this.pomodoroTimer) {
            this.pomodoroTimer.cleanup();
        }
        
        // 清理定时器
        this.stopDailyCleanupTimer();
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    /**
     * 启动每日定时清理机制
     * 每天0点自动清理过期的重复性任务
     */
    startDailyCleanupTimer() {
        // 清理之前的定时器（如果存在）
        this.stopDailyCleanupTimer();
        
        // 计算到下一个0点的毫秒数
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        console.log(`定时清理将在 ${Math.round(msUntilMidnight / 1000 / 60)} 分钟后首次执行`);
        
        // 设置首次执行的定时器
        this.cleanupTimer = setTimeout(() => {
            this.performDailyCleanup();
            
            // 设置每24小时执行一次的定时器
            this.cleanupInterval = setInterval(() => {
                this.performDailyCleanup();
            }, 24 * 60 * 60 * 1000); // 24小时
            
        }, msUntilMidnight);
    }
    
    /**
     * 停止定时清理机制
     */
    stopDailyCleanupTimer() {
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    /**
     * 执行每日清理任务
     */
    async performDailyCleanup() {
        try {
            console.log('执行每日定时清理过期重复性任务');
            await this.taskManager.cleanupExpiredRepeatingTasks();
            console.log('每日定时清理完成');
        } catch (error) {
            console.error('每日定时清理失败:', error);
        }
    }
    
    // 确认重置对话框
    async confirmReset() {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            
            modal.contentEl.createEl("h3", { text: "确认重置任务系统" });
            modal.contentEl.createEl("p", { text: "这将重置任务系统，删除现有任务文件并创建新的文件结构。确定要继续吗？" });
            
            const buttonContainer = modal.contentEl.createDiv({ cls: "yuhanbo-button-container" });
            
            const confirmButton = buttonContainer.createEl("button", {
                text: "确认重置",
                cls: "yuhanbo-delete-button"
            });
            
            const cancelButton = buttonContainer.createEl("button", {
                text: "取消",
                cls: "yuhanbo-secondary-button"
            });
            
            confirmButton.addEventListener("click", () => {
                modal.close();
                resolve(true);
            });
            
            cancelButton.addEventListener("click", () => {
                modal.close();
                resolve(false);
            });
            
            modal.open();
        });
    }
    
    // 重置任务系统
    async resetTaskSystem() {
        try {
            new Notice("正在重置任务系统...");
            
            // 获取所有任务路径
            const repeatingTasksPath = normalizePath(this.settings.repeatingTasksPath);
            const oneTimeTasksPath = normalizePath(this.settings.oneTimeTasksPath);
            const completedTasksPath = normalizePath(this.settings.completedTasksPath);
            
            console.log("重置任务系统 - 路径:", repeatingTasksPath, oneTimeTasksPath, completedTasksPath);
            
            // 删除可能有问题的文件
            try {
                // 检查并删除一次性任务文件
                const oneTimeFile = `${oneTimeTasksPath}/onetime_tasks.md`;
                if (await this.app.vault.adapter.exists(oneTimeFile)) {
                    console.log(`删除一次性任务文件: ${oneTimeFile}`);
                    await this.app.vault.adapter.remove(oneTimeFile);
                }
                
                // 删除重复性任务文件
                const cycles = ["yearly", "monthly", "weekly", "daily"];
                for (const cycle of cycles) {
                    const repeatingFile = `${repeatingTasksPath}/repeating_${cycle}.md`;
                    if (await this.app.vault.adapter.exists(repeatingFile)) {
                        console.log(`删除重复性任务文件: ${repeatingFile}`);
                        await this.app.vault.adapter.remove(repeatingFile);
                    }
                }
                
                // 清空任务列表
                this.taskManager.tasks.repeating = [];
                this.taskManager.tasks.oneTime = [];
                this.taskManager.tasks.completed = [];
                
                // 重新初始化目录
                await this.taskManager.initializeDirectories();
                
                // 创建默认的空文件结构
                // 创建一次性任务文件
                const oneTimeContent = "# 一次性任务\n\n";
                const oneTimeFilePath = `${oneTimeTasksPath}/onetime_tasks.md`;
                await this.app.vault.create(oneTimeFilePath, oneTimeContent);
                
                // 创建各个周期的重复性任务文件
                for (const cycle of cycles) {
                    const repeatingContent = `# 重复性任务 - ${this.taskManager.getCycleNameFromCycle(cycle)}\n\n`;
                    const repeatingFilePath = `${repeatingTasksPath}/repeating_${cycle}.md`;
                    await this.app.vault.create(repeatingFilePath, repeatingContent);
                }
                
                // 重新加载任务
                await this.taskManager.loadTasks();
                
                new Notice("任务系统已重置，文件结构已重建");
            } catch (error) {
                console.error("重置任务系统失败:", error);
                new Notice(`重置任务系统失败: ${error.message}`);
            }
        } catch (error) {
            console.error("重置任务系统过程中出错:", error);
            new Notice(`任务系统重置出错: ${error.message}`);
        }
    }
}

// 番茄时钟计时器
class PomodoroTimer {
    constructor(plugin) {
        this.plugin = plugin;
        this.state = PomodoroState.IDLE;
        this.timeRemaining = 0;
        this.interval = null;
        this.completedPomodoros = 0;
        this.statusBarItem = this.plugin.addStatusBarItem();
        this.currentTask = null;
        this.audio = null;
        this.defaultAudio = new Audio(DEFAULT_SOUND); // 创建默认提示音
        this.endTime = null; // 添加结束时间属性，用于基于系统时间的倒计时
        this.setupStatusBar();
        this.loadAudio();
    }
    
    setupStatusBar() {
        this.statusBarItem.addClass("yuhanbo-pomodoro-status");
        this.statusBarItem.addEventListener("click", () => {
            if (this.state === PomodoroState.IDLE) {
                this.startWorkWithTaskSelection();
            } else if (this.state === PomodoroState.PAUSED) {
                this.resume();
            } else {
                this.pause();
            }
        });
        this.updateStatusBar();
    }
    
    // 完全重写的 loadAudio 方法：使用 Obsidian API 验证文件存在性
    async loadAudio() {
        this.audio = null;
        const { soundEnabled, soundFilePath } = this.plugin.settings;
        
        // 没有开启声音或路径无效就直接返回
        if (!soundEnabled || !soundFilePath || soundFilePath.trim().length === 0) {
            console.log("提示音未启用或路径为空");
            return;
        }
        
        try {
            // 获取规范化路径
            let normalizedPath = soundFilePath.trim();
            
            // 检查是绝对路径还是相对路径
            let isAbsolutePath = /^([A-Za-z]:[\\/]|\/|https?:\/\/)/.test(normalizedPath);
            
            // 如果是相对路径，尝试在 Vault 中查找
            if (!isAbsolutePath) {
                try {
                    // 优先尝试作为 Vault 内的路径查找
                    const exists = await this.plugin.app.vault.adapter.exists(normalizedPath);
                    if (exists) {
                        console.log(`文件存在于 Vault 中: ${normalizedPath}`);
                        // 读取二进制数据
                        const data = await this.plugin.app.vault.adapter.readBinary(normalizedPath);
                        if (data) {
                            // 创建 Blob 对象
                            const blob = new Blob([data], {type: 'audio/mpeg'});
                            const url = URL.createObjectURL(blob);
                            console.log(`为 Vault 内文件创建 Blob URL: ${url}`);
                            this.audio = new Audio(url);
                            this.audio.load();
                            return;
                        }
                    } else {
                        console.log(`文件在 Vault 中不存在: ${normalizedPath}`);
                    }
                } catch (vaultError) {
                    console.error("Vault 内文件读取失败:", vaultError);
                }
                
                // Vault 中找不到，尝试拼接到 Vault 根目录的绝对路径
                    const basePath = this.plugin.app.vault.adapter.basePath;
                    if (basePath) {
                    normalizedPath = `${basePath}/${normalizedPath}`.replace(/\\/g, '/');
                    console.log(`拼接到 Vault 根目录: ${normalizedPath}`);
                }
            }
            
            // 确保路径使用正斜杠
            normalizedPath = normalizedPath.replace(/\\/g, '/');
            console.log(`最终音频路径: ${normalizedPath}`);
            
            // 验证外部文件是否存在（仅对于本地文件系统路径）
            if (/^[A-Za-z]:/.test(normalizedPath)) {
                try {
                    const fs = require('fs');
                    const fileExists = fs.existsSync(normalizedPath);
                    console.log(`外部文件检查: ${fileExists ? '存在' : '不存在'}`);
                    if (!fileExists) {
                        new Notice(`提示音文件不存在: ${normalizedPath}`);
                        return;
                    }
                } catch (fsError) {
                    console.log("无法检查文件系统:", fsError);
                }
            }
            
            // 创建音频对象
            this.audio = new Audio(normalizedPath);
            
            // 添加事件监听
                this.audio.onerror = (e) => {
                    console.error("音频加载失败:", e);
                new Notice("无法加载提示音文件，请检查路径或文件格式");
                    this.audio = null;
                };
            
            this.audio.oncanplaythrough = () => {
                console.log("音频加载成功，可以播放");
            };
            
            // 预加载
            this.audio.load();
            console.log("尝试加载音频:", normalizedPath);
            
            } catch (error) {
            console.error("音频初始化失败:", error);
            new Notice(`无法初始化音频: ${error.message}`);
                this.audio = null;
            }
    }
    
    // 尝试播放声音
    async playSound() {
        if (!this.plugin.settings.soundEnabled) {
            console.log("提示音已禁用，跳过播放");
            return;
        }
            
        if (!this.audio) {
            console.log("没有加载音频，重新尝试加载");
            await this.loadAudio();
        }
            
        // 先尝试播放用户配置的音频，失败时使用默认音频
        const audioToPlay = this.audio || this.defaultAudio;
        if (audioToPlay) {
            try {
                console.log("尝试播放音频:", audioToPlay === this.defaultAudio ? "默认音效" : "用户配置音效");
                audioToPlay.currentTime = 0;
                const playPromise = audioToPlay.play();
                
                if (playPromise) {
                    playPromise.catch(error => {
                        console.error("播放音频失败:", error);
                        if (audioToPlay === this.defaultAudio) {
                            new Notice("无法播放提示音，请检查浏览器设置是否允许自动播放");
                        } else {
                            console.log("尝试使用默认提示音");
                            this.defaultAudio.currentTime = 0;
                            this.defaultAudio.play().catch(innerError => {
                                console.error("默认提示音播放失败:", innerError);
                                new Notice("所有提示音播放失败，请检查浏览器音频设置");
                            });
                        }
                    });
                }
            } catch (error) {
                console.error("播放音频时出错:", error);
                new Notice("播放提示音出错: " + error.message);
            }
        } else {
            console.log("播放默认提示音");
            try {
                this.defaultAudio.currentTime = 0;
                this.defaultAudio.play().catch(error => {
                    console.error("默认提示音播放失败:", error);
                    new Notice("提示音播放失败，请检查浏览器音频设置");
                });
            } catch (error) {
                console.error("默认提示音播放失败:", error);
            }
        }
    }
    
    updateStatusBar() {
        this.statusBarItem.empty();
        const icon = document.createElement("span");
        icon.addClass("yuhanbo-pomodoro-icon");
        
        let taskText = this.currentTask ? ` - ${this.currentTask.title}` : "";
        
        switch (this.state) {
            case PomodoroState.IDLE:
                this.statusBarItem.setText(" 开始番茄钟");
                break;
            case PomodoroState.WORKING:
                this.statusBarItem.setText(` 工作中: ${this.formatTime(this.timeRemaining)}${taskText}`);
                break;
            case PomodoroState.SHORT_BREAK:
                this.statusBarItem.setText(` 短休息: ${this.formatTime(this.timeRemaining)}`);
                break;
            case PomodoroState.LONG_BREAK:
                this.statusBarItem.setText(` 长休息: ${this.formatTime(this.timeRemaining)}`);
                break;
            case PomodoroState.PAUSED:
                this.statusBarItem.setText(` 已暂停: ${this.formatTime(this.timeRemaining)}${taskText}`);
                break;
        }
        this.statusBarItem.prepend(icon);
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    
    startWorkWithTaskSelection() {
        new TaskSelectionModal(this.plugin.app, this.plugin, (task) => {
            this.currentTask = task;
            this.startWork();
        }).open();
    }
    
    startWork() {
        this.state = PomodoroState.WORKING;
        this.timeRemaining = this.plugin.settings.workDuration * 60;
        // 设置基于系统时间的结束时间
        this.endTime = new Date(Date.now() + this.timeRemaining * 1000);
        this.startTimer();
        new Notice(`番茄工作周期开始!${this.currentTask ? ` 任务: ${this.currentTask.title}` : ""} 将在 ${this.endTime.toLocaleTimeString()} 结束`);
    }
    
    startShortBreak() {
        this.state = PomodoroState.SHORT_BREAK;
        this.timeRemaining = this.plugin.settings.shortBreakDuration * 60;
        // 设置基于系统时间的结束时间
        this.endTime = new Date(Date.now() + this.timeRemaining * 1000);
        this.startTimer();
        new Notice(`短休息开始! 将在 ${this.endTime.toLocaleTimeString()} 结束`);
        this.playSound();
    }
    
    startLongBreak() {
        this.state = PomodoroState.LONG_BREAK;
        this.timeRemaining = this.plugin.settings.longBreakDuration * 60;
        // 设置基于系统时间的结束时间
        this.endTime = new Date(Date.now() + this.timeRemaining * 1000);
        this.startTimer();
        new Notice(`长休息开始! 将在 ${this.endTime.toLocaleTimeString()} 结束`);
        this.playSound();
    }
    
    startTimer() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        this.updateStatusBar();
        
        this.interval = setInterval(() => {
            // 基于系统时间计算剩余时间
            const now = new Date();
            this.timeRemaining = Math.max(0, Math.ceil((this.endTime - now) / 1000));
            this.updateStatusBar();
            
            if (this.timeRemaining <= 0) {
                this.handleTimerEnd();
            }
        }, 1000);
    }
    
    handleTimerEnd() {
        clearInterval(this.interval);
        this.interval = null;
        
        switch (this.state) {
            case PomodoroState.WORKING:
                this.playSound();
                this.completedPomodoros++;
                
                // 如果有任务正在进行，弹出任务进度更新窗口
                if (this.currentTask) {
                    new TaskProgressModal(this.plugin.app, this.plugin, this.currentTask, () => {
                        if (this.completedPomodoros % this.plugin.settings.longBreakInterval === 0) {
                            this.startLongBreak();
                        } else {
                            this.startShortBreak();
                        }
                    }).open();
                } else {
                    if (this.completedPomodoros % this.plugin.settings.longBreakInterval === 0) {
                        this.startLongBreak();
                    } else {
                        this.startShortBreak();
                    }
                }
                break;
                
            case PomodoroState.SHORT_BREAK:
            case PomodoroState.LONG_BREAK:
                this.playSound();
                // 休息结束后，提示用户选择下一个任务
                new TaskSelectionModal(this.plugin.app, this.plugin, (task) => {
                    this.currentTask = task;
                    this.startWork();
                }).open();
                break;
        }
    }
    
    pause() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        // 暂停时记录当前剩余时间
        const now = new Date();
        this.timeRemaining = Math.max(0, Math.ceil((this.endTime - now) / 1000));
        this.state = PomodoroState.PAUSED;
        this.updateStatusBar();
        new Notice("番茄钟已暂停");
    }
    
    resume() {
        if (this.state === PomodoroState.PAUSED && this.timeRemaining > 0) {
            // 恢复时重新设置结束时间
            this.endTime = new Date(Date.now() + this.timeRemaining * 1000);
            this.startTimer();
            new Notice("番茄钟已恢复");
        }
    }
    
    reset() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.state = PomodoroState.IDLE;
        this.timeRemaining = 0;
        this.completedPomodoros = 0;
        this.currentTask = null;
        this.endTime = null; // 清除结束时间
        this.updateStatusBar();
        new Notice("番茄钟已重置");
    }
    
    cleanup() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        if (this.statusBarItem) {
            this.statusBarItem.remove();
        }
    }
}

// 设置页面
class YuhanboTaskSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass("yuhanbo-settings-container");
        
        // API设置部分
        containerEl.createEl("h2", { text: "API 设置" });
        
        new Setting(containerEl)
            .setName("DeepSeek API Key")
            .setDesc("输入您的 DeepSeek API Key 以启用 AI 智能拆分功能")
            .addText(text => text
                .setPlaceholder("输入 API Key")
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName("提示词文件路径")
            .setDesc("选择包含 AI 提示词的 Markdown 文件路径")
            .addText(text => text
                .setPlaceholder("例如：Templates/AIPrompts.md")
                .setValue(this.plugin.settings.promptFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.promptFilePath = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName("启用 AI 功能")
            .setDesc("开启或关闭 AI 智能拆分功能")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.aiEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.aiEnabled = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName("AI 模型")
            .setDesc("选择要使用的 AI 模型")
            .addDropdown(dropdown => dropdown
                .addOption("deepseek-chat", "DeepSeek Chat")
                .addOption("deepseek-reasoner", "DeepSeek Reasoner")
                .setValue(this.plugin.settings.aiModel)
                .onChange(async (value) => {
                    this.plugin.settings.aiModel = value;
                    await this.plugin.saveSettings();
                }));
        
        // 任务路径设置部分
        const taskPathsSection = containerEl.createDiv({ cls: "yuhanbo-settings-section" });
        taskPathsSection.createEl("h2", { text: "任务保存路径设置" });
        taskPathsSection.createEl("p", { 
            text: "设置在笔记库中保存任务的路径，这些目录将在您的Obsidian笔记库中创建，而不是在插件目录中", 
            cls: "setting-item-description" 
        });
        
        // 重复性任务路径
        new Setting(taskPathsSection)
            .setName("重复性任务路径")
            .setDesc("设置保存重复性任务的文件夹路径（例如年度、月度、周和日常任务）")
            .addText(text => text
                .setPlaceholder("例如：任务/重复性任务")
                .setValue(this.plugin.settings.repeatingTasksPath)
                .onChange(async (value) => {
                    this.plugin.settings.repeatingTasksPath = value;
                    await this.plugin.saveSettings();
                }))
            .addButton(button => button
                .setButtonText("创建文件夹")
                .onClick(async () => {
                    try {
                        const path = this.plugin.settings.repeatingTasksPath;
                        if (!path) {
                            new Notice("请先输入文件夹路径");
                            return;
                        }
                        
                        if (!(await this.plugin.app.vault.adapter.exists(path))) {
                            await this.plugin.app.vault.createFolder(path);
                            new Notice(`已在笔记库中创建文件夹: ${path}`);
                        } else {
                            new Notice(`文件夹已存在: ${path}`);
                        }
                    } catch (error) {
                        console.error("创建文件夹失败:", error);
                        new Notice("创建文件夹失败，请检查路径是否有效");
                    }
                }));
        
        // 一次性任务路径
        new Setting(taskPathsSection)
            .setName("一次性任务路径")
            .setDesc("设置保存一次性任务的文件夹路径")
            .addText(text => text
                .setPlaceholder("例如：任务/一次性任务")
                .setValue(this.plugin.settings.oneTimeTasksPath)
                .onChange(async (value) => {
                    this.plugin.settings.oneTimeTasksPath = value;
                    await this.plugin.saveSettings();
                }))
            .addButton(button => button
                .setButtonText("创建文件夹")
                .onClick(async () => {
                    try {
                        const path = this.plugin.settings.oneTimeTasksPath;
                        if (!path) {
                            new Notice("请先输入文件夹路径");
                            return;
                        }
                        
                        if (!(await this.plugin.app.vault.adapter.exists(path))) {
                            await this.plugin.app.vault.createFolder(path);
                            new Notice(`已在笔记库中创建文件夹: ${path}`);
                        } else {
                            new Notice(`文件夹已存在: ${path}`);
                        }
                    } catch (error) {
                        console.error("创建文件夹失败:", error);
                        new Notice("创建文件夹失败，请检查路径是否有效");
                    }
                }));
        
        // 已完成任务路径
        new Setting(taskPathsSection)
            .setName("已完成任务路径")
            .setDesc("设置保存已完成任务的文件夹路径")
            .addText(text => text
                .setPlaceholder("例如：任务/已完成任务")
                .setValue(this.plugin.settings.completedTasksPath)
                .onChange(async (value) => {
                    this.plugin.settings.completedTasksPath = value;
                    await this.plugin.saveSettings();
                }))
            .addButton(button => button
                .setButtonText("创建文件夹")
                .onClick(async () => {
                    try {
                        const path = this.plugin.settings.completedTasksPath;
                        if (!path) {
                            new Notice("请先输入文件夹路径");
                            return;
                        }
                        
                        if (!(await this.plugin.app.vault.adapter.exists(path))) {
                            await this.plugin.app.vault.createFolder(path);
                            new Notice(`已在笔记库中创建文件夹: ${path}`);
                        } else {
                            new Notice(`文件夹已存在: ${path}`);
                        }
                    } catch (error) {
                        console.error("创建文件夹失败:", error);
                        new Notice("创建文件夹失败，请检查路径是否有效");
                    }
                }));
        
        // 打开任务管理器按钮
        const viewTasksButton = taskPathsSection.createEl("button", {
            text: "打开任务管理器",
            cls: "yuhanbo-primary-button",
            style: "margin-top: 15px; width: 100%;"
        });
        
        viewTasksButton.addEventListener("click", () => {
            new TaskListModal(this.app, this.plugin).open();
        });
                
        // 番茄时钟设置
        containerEl.createEl("h2", { text: "番茄时钟设置" });
        
        new Setting(containerEl)
            .setName("工作时间（分钟）")
            .setDesc("设置每个工作周期的时长")
            .addSlider(slider => slider
                .setLimits(1, 60, 1)
                .setValue(this.plugin.settings.workDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.workDuration = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName("短休息时间（分钟）")
            .setDesc("设置短休息周期的时长")
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.settings.shortBreakDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.shortBreakDuration = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName("长休息时间（分钟）")
            .setDesc("设置长休息周期的时长")
            .addSlider(slider => slider
                .setLimits(5, 60, 5)
                .setValue(this.plugin.settings.longBreakDuration)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.longBreakDuration = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName("长休息间隔")
            .setDesc("设置几个工作周期后进行长休息")
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.longBreakInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.longBreakInterval = value;
                    await this.plugin.saveSettings();
                }));
                
        // 显示剩余天数设置
        new Setting(containerEl)
            .setName("显示剩余天数")
            .setDesc("在任务列表中显示距离执行日期的剩余天数")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRemainingDays)
                .onChange(async (value) => {
                    this.plugin.settings.showRemainingDays = value;
                    await this.plugin.saveSettings();
                }));
        
        // 声音设置部分
        const soundSection = containerEl.createDiv({ cls: "yuhanbo-settings-section" });
        soundSection.createEl("h3", { text: "提示音设置" });
        
        // 启用提示音设置
        new Setting(soundSection)
            .setName("启用提示音")
            .setDesc("开启或关闭番茄时钟提示音")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.soundEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.soundEnabled = value;
                    await this.plugin.saveSettings();
                    
                    // 更新提示音文件输入框的可用性
                    const soundFileEl = soundSection.querySelector(".yuhanbo-sound-file-setting");
                    if (soundFileEl) {
                        soundFileEl.style.display = value ? "block" : "none";
                    }
                    
                    // 重新加载音频
                    this.plugin.pomodoroTimer.loadAudio();
                }));
        
        // 提示音文件路径设置
        const soundFileSetting = new Setting(soundSection)
            .setName("提示音文件路径")
            .setDesc("选择MP3或WAV格式音频文件作为番茄钟提示音")
            
        // 添加提示音使用说明
        const soundHelpDiv = soundSection.createDiv({ cls: "yuhanbo-sound-help" });
        soundHelpDiv.createEl("p", { 
            text: "路径格式说明:", 
            cls: "yuhanbo-sound-help-title"
        });
        
        const helpList = soundHelpDiv.createEl("ul", { cls: "yuhanbo-sound-help-list" });
        helpList.createEl("li", { 
            text: "相对路径: 文件相对于笔记库的位置，如 '附件/声音.mp3'" 
        });
        
        // 下载示例音频的链接
        const downloadLink = soundHelpDiv.createEl("a", {
            text: "下载测试用MP3文件",
            href: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
            cls: "yuhanbo-download-link"
        });
        downloadLink.setAttribute("target", "_blank");
        downloadLink.style.display = "block";
        downloadLink.style.marginTop = "5px";
        
        // 创建声音文件设置容器
        const soundFileContainer = soundSection.createDiv({ 
            cls: "yuhanbo-sound-file-setting",
            style: this.plugin.settings.soundEnabled ? "display: block" : "display: none"
        });
        
        // 文件路径输入框
        const fileInput = soundFileContainer.createEl("input", {
            type: "text",
            value: this.plugin.settings.soundFilePath || "",
            placeholder: "例如: 附件/声音.mp3",
            cls: "yuhanbo-input"
        });
        
        // 绑定测试声音事件
        const testSoundButton = soundFileContainer.createEl("button", {
            text: "测试声音",
            cls: "yuhanbo-secondary-button yuhanbo-file-browser-button",
            style: "margin-left: 8px;"
        });
        
        // 绑定测试声音事件
        testSoundButton.addEventListener("click", async () => {
            const testPath = fileInput.value.trim();
            if (!testPath) {
                new Notice("请输入提示音文件路径");
                return;
            }
            
            try {
                // 显示测试状态
                testSoundButton.textContent = "测试中...";
                testSoundButton.disabled = true;
                
                // 获取规范化路径
                let normalizedPath = testPath.trim();
                
                // 禁止使用 obsidian:// 协议链接
                if (normalizedPath.startsWith('obsidian://')) {
                    new Notice("请不要使用 obsidian:// 链接，直接输入文件路径，例如：\n附件/音频.mp3 或 C:/音乐/音频.mp3");
                    testSoundButton.textContent = "测试声音";
                    testSoundButton.disabled = false;
                    return;
                }
                
                // 检查是绝对路径还是相对路径
                let isAbsolutePath = /^([A-Za-z]:[\\/]|\/|https?:\/\/)/.test(normalizedPath);
                console.log(`测试音频路径: ${normalizedPath}, 是绝对路径: ${isAbsolutePath}`);
                
                // 如果是相对路径，尝试在 Vault 中查找
                if (!isAbsolutePath) {
                    try {
                        // 优先尝试作为 Vault 内的路径查找
                        const exists = await this.app.vault.adapter.exists(normalizedPath);
                        if (exists) {
                            new Notice(`文件存在于 Vault 中: ${normalizedPath}`);
                            console.log(`文件存在于 Vault 中: ${normalizedPath}`);
                            
                            // 读取二进制数据
                            const data = await this.app.vault.adapter.readBinary(normalizedPath);
                            if (data) {
                                // 创建 Blob 对象
                                const blob = new Blob([data], {type: 'audio/mpeg'});
                                const url = URL.createObjectURL(blob);
                                console.log(`为 Vault 内文件创建 Blob URL: ${url}`);
                                
                                // 保存设置并播放
                                this.plugin.settings.soundFilePath = normalizedPath;
                                await this.plugin.saveSettings();
                                
                                const audio = new Audio(url);
                                audio.oncanplaythrough = () => {
                                    audio.play().catch(err => {
                                        console.error("播放 Blob 音频失败:", err);
                                        new Notice("播放测试提示音失败，请检查音频格式");
                                    });
                                };
                                audio.onerror = (e) => {
                                    console.error("Blob 音频加载失败:", e);
                                    new Notice("无法加载 Blob 音频，请检查文件格式");
                                };
                                audio.load();
                                return;
                            }
                        } else {
                            console.log(`文件在 Vault 中不存在: ${normalizedPath}`);
                        }
                    } catch (vaultError) {
                        console.warn("Vault 内文件读取失败:", vaultError);
                    }
                    
                    // Vault 中找不到，尝试拼接到 Vault 根目录的绝对路径
                    const basePath = this.app.vault.adapter.basePath;
                    if (basePath) {
                        normalizedPath = `${basePath}/${normalizedPath}`.replace(/\\/g, '/');
                        console.log(`拼接到 Vault 根目录: ${normalizedPath}`);
                    }
                }
                
                // 确保路径使用正斜杠
                normalizedPath = normalizedPath.replace(/\\/g, '/');
                console.log(`最终测试音频路径: ${normalizedPath}`);
                
                // 验证外部文件是否存在（仅对于本地文件系统路径）
                if (/^[A-Za-z]:/.test(normalizedPath)) {
                    try {
                        const fs = require('fs');
                        const fileExists = fs.existsSync(normalizedPath);
                        console.log(`外部文件检查: ${fileExists ? '存在' : '不存在'}`);
                        if (!fileExists) {
                            new Notice(`提示音文件不存在: ${normalizedPath}`);
                            return;
                        }
                    } catch (fsError) {
                        console.log("无法检查文件系统:", fsError);
                    }
                }
                
                // 保存设置
                this.plugin.settings.soundFilePath = testPath; // 保存原始输入
                await this.plugin.saveSettings();
                new Notice(`提示音路径已保存: ${testPath}`);
                
                // 尝试播放音频
                const audio = new Audio(normalizedPath);
                audio.onerror = (e) => {
                    console.error("测试音频加载失败:", e);
                    new Notice("无法加载测试提示音，请检查文件格式");
                };
                audio.oncanplaythrough = () => {
                    console.log("测试音频已加载，准备播放");
                    audio.play().catch(err => {
                        console.error("播放测试音频失败:", err);
                        new Notice("播放测试提示音失败，请检查音频格式或系统音量");
                    });
                };
                audio.load();
            } catch (error) {
                console.error("测试音频出错:", error);
                new Notice(`测试提示音出错: ${error.message}`);
            } finally {
                // 恢复按钮状态
                testSoundButton.textContent = "测试声音";
                testSoundButton.disabled = false;
            }
        });
        
        // 仅保留输入框和测试声音按钮，无文件浏览功能
        soundFileSetting.settingEl.appendChild(soundFileContainer);
    }
}

// 任务管理器
class TaskManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.tasks = {
            oneTime: [],
            repeating: [],
            completed: []
        };
    }

    // 获取北京时间
    getBJDate() {
        const now = new Date();
        const utcDate = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utcDate + (3600000 * 8)); // 东八区
    }

    // 验证任务数据
    validateTasks() {
        // 验证一次性任务
        for (const task of this.tasks.oneTime) {
            if (!task.title) throw new Error("一次性任务缺少标题");
            if (!task.dueDate) throw new Error("一次性任务缺少截止日期");
        }

        // 验证重复性任务
        for (const task of this.tasks.repeating) {
            if (!task.title) throw new Error("重复性任务缺少标题");
            if (!task.cycle) throw new Error("重复性任务缺少周期类型");
            if (task.cycle !== "daily" && !task.cyclePeriod) {
                throw new Error(`${task.cycle}类型的重复性任务缺少周期单位`);
            }
        }
    }

    // 验证保存路径
    async validatePaths() {
        const paths = [
            this.plugin.settings.oneTimeTasksPath,
            this.plugin.settings.repeatingTasksPath,
            this.plugin.settings.completedTasksPath
        ];

        for (const path of paths) {
            if (!path) throw new Error("任务保存路径未设置");
            const normalizedPath = normalizePath(path);
            if (!(await this.plugin.app.vault.adapter.exists(normalizedPath))) {
                await this.plugin.app.vault.createFolder(normalizedPath);
            }
        }
    }

    // 处理一次性任务
    async handleOneTimeTask(task) {
        try {
            console.log("开始处理一次性任务:", task);
            
            // 确保有截止日期
            if (!task.dueDate) {
                const bjNow = this.getBJDate();
                task.dueDate = bjNow.toISOString().split('T')[0];
                console.log("设置默认截止日期:", task.dueDate);
            }
            
            // 确保任务类型正确
            task.type = "oneTime";
            
            // 清除周期相关属性
            task.cycle = null;
            task.cyclePeriod = null;
            task.executeDate = null;
            
            // 确保有任务ID
            if (!task.id) {
                task.id = this.generateTaskId();
                console.log("生成新的任务ID:", task.id);
            }
            
            // 确保有创建日期
            if (!task.createdDate) {
                const bjNow = this.getBJDate();
                task.createdDate = bjNow.toISOString().split('T')[0];
                console.log("设置创建日期:", task.createdDate);
            }
            
            // 添加到任务列表
            this.tasks.oneTime.push(task);
            console.log("一次性任务处理完成，当前一次性任务数量:", this.tasks.oneTime.length);
            
            return task;
        } catch (error) {
            console.error("处理一次性任务时出错:", error);
            throw new Error(`处理一次性任务失败: ${error.message}`);
        }
    }

    // 处理重复性任务
    async handleRepeatingTask(task) {
        try {
            console.log("【调试】进入重复性任务处理方法，任务:", JSON.stringify(task));
            
            // 确保任务类型正确
            task.type = "repeating";
            
            // 确保有周期类型
            if (!task.cycle) {
                console.log("【警告】重复性任务未指定周期类型，设置为每天");
                task.cycle = "daily";
            }
            
            // 规范化周期类型
            task.cycle = task.cycle.toLowerCase();
            
            // 确保任务ID存在
            if (!task.id) {
                task.id = this.generateTaskId();
                console.log("【调试】生成新的任务ID:", task.id);
            }
            
            // 设置进度为0（如果未设置）
            if (task.progress === undefined || task.progress === null) {
                task.progress = 0;
            }
            
            // 确保有创建日期
            if (!task.createdDate) {
                const bjNow = this.getBJDate();
                task.createdDate = bjNow.toISOString().split('T')[0];
                console.log("【调试】设置创建日期:", task.createdDate);
            }
            
            console.log(`【调试】任务周期类型: "${task.cycle}"`);
            
            // 根据不同周期类型处理
            try {
                switch (task.cycle) {
                    case "weekly":
                        console.log("【调试】处理每周任务");
                        await this.handleWeeklyTask(task);
                        break;
                    case "monthly":
                        console.log("【调试】处理每月任务");
                        await this.handleMonthlyTask(task);
                        break;
                    case "yearly":
                        console.log("【调试】处理每年任务");
                        await this.handleYearlyTask(task);
                        break;
                    case "daily":
                        console.log("【调试】处理每日任务");
                        await this.handleDailyTask(task);
                        break;
                    default:
                        console.warn(`【警告】未知的任务周期类型: "${task.cycle}"，改为每天`);
                        task.cycle = "daily";
                        await this.handleDailyTask(task);
                }
            } catch (cycleError) {
                console.error(`【错误】处理${task.cycle}周期任务失败:`, cycleError);
                throw new Error(`处理${task.cycle}周期任务失败: ${cycleError.message}`);
            }
            
            console.log("【调试】处理完成后的任务:", JSON.stringify(task));
            
            // 添加到任务列表
            if (!this.tasks.repeating) {
                this.tasks.repeating = [];
            }
            this.tasks.repeating.push(task);
            console.log("【调试】重复性任务处理完成，当前任务数:", this.tasks.repeating.length);
            
            return task;
        } catch (error) {
            console.error("【错误】处理重复性任务时出错:", error);
            throw new Error(`处理重复性任务失败: ${error.message}`);
        }
    }

    // 处理每周任务
    async handleWeeklyTask(task) {
        try {
            console.log("【调试】处理每周任务:", task.title);
            
            const bjNow = this.getBJDate();
            console.log("【调试】当前北京时间:", bjNow.toLocaleString(), "星期:", bjNow.getDay());
            
            // 设置周期单位（0-6，0表示周日）
            if (!task.cyclePeriod) {
                task.cyclePeriod = bjNow.getDay().toString();
                console.log("【调试】未指定周几，默认设置为今天:", this.getWeekdayName(bjNow.getDay()));
            }
            
            console.log("【调试】周期单位(原始值):", task.cyclePeriod, "类型:", typeof task.cyclePeriod);
            
            // 确保周期单位是有效的数字
            let targetDay = parseInt(task.cyclePeriod);
            console.log("【调试】周期单位(解析后):", targetDay);
            
            if (isNaN(targetDay) || targetDay < 0 || targetDay > 6) {
                console.warn(`【警告】无效的周期单位: ${task.cyclePeriod}，重置为周一(1)`);
                targetDay = 1;
                task.cyclePeriod = "1"; // 默认设置为周一
            }
            
            // 计算首次执行日期
            const currentDay = bjNow.getDay();
            let daysToAdd = (targetDay - currentDay + 7) % 7;
            
            // 如果目标是今天且已过执行时间，则设置为下周
            if (daysToAdd === 0) {
                daysToAdd = 7;
                console.log("【调试】目标日期是今天，设置为下周");
            }
            
            const execDate = new Date(bjNow);
            execDate.setDate(bjNow.getDate() + daysToAdd);
            task.executeDate = execDate.toISOString().split('T')[0];
            
            console.log("【调试】每周任务执行日期计算: " +
                      "当前是 " + this.getWeekdayName(currentDay) + " (" + currentDay + "), " +
                      "目标是 " + this.getWeekdayName(targetDay) + " (" + targetDay + "), " +
                      "相差 " + daysToAdd + " 天, " +
                      "执行日期: " + task.executeDate);
            
            return task;
        } catch (error) {
            console.error("【错误】处理每周任务时出错:", error);
            throw new Error(`处理每周任务失败: ${error.message}`);
        }
    }

    // 处理每月任务
    async handleMonthlyTask(task) {
        try {
            console.log("【调试】处理每月任务:", task.title);
            
            const bjNow = this.getBJDate();
            console.log("【调试】当前北京时间:", bjNow.toLocaleString(), "日期:", bjNow.getDate());
            
            // 设置周期单位（1-31）
            if (!task.cyclePeriod) {
                task.cyclePeriod = bjNow.getDate().toString();
                console.log("【调试】未指定每月几号，默认设置为今天:", bjNow.getDate() + "号");
            }
            
            console.log("【调试】周期单位(原始值):", task.cyclePeriod, "类型:", typeof task.cyclePeriod);
            
            // 确保周期单位是有效的数字
            let targetDay = parseInt(task.cyclePeriod);
            console.log("【调试】周期单位(解析后):", targetDay);
            
            if (isNaN(targetDay) || targetDay < 1 || targetDay > 31) {
                console.warn(`【警告】无效的周期单位: ${task.cyclePeriod}，重置为1号`);
                targetDay = 1;
                task.cyclePeriod = "1";
            }
            
            // 计算首次执行日期
            const currentDate = bjNow.getDate();
            const currentMonth = bjNow.getMonth();
            const currentYear = bjNow.getFullYear();
            
            let execYear = currentYear;
            let execMonth = currentMonth;
            let execDay = targetDay;
            
            // 如果本月的执行日期已过，则设置为下月
            if (targetDay < currentDate) {
                execMonth = currentMonth + 1;
                // 如果是12月，进入下一年
                if (execMonth > 11) {
                    execMonth = 0;
                    execYear++;
                }
            }
            
            // 创建执行日期对象并处理月份日期问题
            // 例如：2月没有31号，会自动调整为最后一天
            const execDate = new Date(execYear, execMonth, execDay);
            
            // 检查是否发生了月份溢出（例如，试图设置2月31日实际变成了3月初）
            if (execDate.getMonth() !== execMonth) {
                console.log(`【调试】${execMonth + 1}月没有${execDay}号，调整到月末`);
                // 将日期设为上个月的最后一天
                execDate.setDate(0);
            }
            
            task.executeDate = execDate.toISOString().split('T')[0];
            
            console.log("【调试】每月任务执行日期计算: " +
                      "当前是 " + currentYear + "年" + (currentMonth + 1) + "月" + currentDate + "日, " +
                      "目标是每月 " + targetDay + " 号, " +
                      "执行日期: " + task.executeDate);
            
            return task;
        } catch (error) {
            console.error("【错误】处理每月任务时出错:", error);
            throw new Error(`处理每月任务失败: ${error.message}`);
        }
    }

    // 处理每年任务
    async handleYearlyTask(task) {
        try {
            console.log("处理每年任务:", task.title);
            
            const bjNow = this.getBJDate();
            
            // 设置周期单位（月-日）
            if (!task.cyclePeriod) {
                const month = bjNow.getMonth() + 1;
                const day = bjNow.getDate();
                task.cyclePeriod = `${month}-${day}`;
                console.log("未指定每年几月几日，默认设置为今天:", month + "月" + day + "日");
            }
            
            // 解析月和日
            let [month, day] = task.cyclePeriod.split('-').map(Number);
            
            // 验证月份有效性
            if (isNaN(month) || month < 1 || month > 12) {
                console.warn(`无效的月份: ${month}，重置为1月`);
                month = 1;
            }
            
            // 验证日期有效性
            if (isNaN(day) || day < 1 || day > 31) {
                console.warn(`无效的日期: ${day}，重置为1日`);
                day = 1;
            }
            
            // 更新周期单位
            task.cyclePeriod = `${month}-${day}`;
            
            // 计算首次执行日期
            const currentMonth = bjNow.getMonth() + 1; // 1-12
            const currentDay = bjNow.getDate();
            const currentYear = bjNow.getFullYear();
            
            let execYear = currentYear;
            
            // 如果今年的执行日期已过，则设置为明年
            if (month < currentMonth || (month === currentMonth && day < currentDay)) {
                execYear = currentYear + 1;
            }
            
            // 创建执行日期对象
            const execDate = new Date(execYear, month - 1, day);
            
            // 检查日期是否有效（例如2月30日不存在会变成3月初）
            if (execDate.getMonth() !== month - 1) {
                console.log(`${month}月没有${day}号，调整到月末`);
                // 将日期设为上个月的最后一天
                execDate.setMonth(month); // 设置为下个月
                execDate.setDate(0); // 然后回到上个月的最后一天
            }
            
            task.executeDate = execDate.toISOString().split('T')[0];
            
            console.log("每年任务执行日期计算: " +
                      "目标是每年 " + month + " 月 " + day + " 日, " +
                      "执行日期: " + task.executeDate);
            
            return task;
        } catch (error) {
            console.error("处理每年任务时出错:", error);
            throw new Error(`处理每年任务失败: ${error.message}`);
        }
    }

    // 处理每日任务
    async handleDailyTask(task) {
        try {
            console.log("【调试】处理每日任务:", task.title);
            
            // 每日任务不需要特定的周期单位
            task.cyclePeriod = null;
            
            // 设置执行日期为明天
            const bjNow = this.getBJDate();
            const tomorrow = new Date(bjNow);
            tomorrow.setDate(bjNow.getDate() + 1);
            task.executeDate = tomorrow.toISOString().split('T')[0];
            
            console.log("【调试】每日任务设置 - 下次执行日期:", task.executeDate);
            
            return task;
        } catch (error) {
            console.error("【错误】处理每日任务时出错:", error);
            throw new Error(`处理每日任务失败: ${error.message}`);
        }
    }
    
    async initializeDirectories() {
        const { vault } = this.plugin.app;
        
        // 获取设置的路径并进行规范化
        const repeatingTasksPath = normalizePath(this.plugin.settings.repeatingTasksPath);
        const oneTimeTasksPath = normalizePath(this.plugin.settings.oneTimeTasksPath);
        const completedTasksPath = normalizePath(this.plugin.settings.completedTasksPath);
        
        console.log("初始化任务目录...");
        console.log("- 重复性任务路径:", repeatingTasksPath);
        console.log("- 一次性任务路径:", oneTimeTasksPath);
        console.log("- 已完成任务路径:", completedTasksPath);
        
        // 创建重复性任务目录
            try {
            if (!(await vault.adapter.exists(repeatingTasksPath))) {
                await vault.createFolder(repeatingTasksPath);
                console.log(`已创建重复性任务目录: ${repeatingTasksPath}`);
        } else {
            console.log(`重复性任务目录已存在: ${repeatingTasksPath}`);
            }
        } catch (error) {
            console.error(`创建重复性任务目录失败:`, error);
            new Notice(`创建重复性任务目录失败，请检查权限并重试`);
        }
        
        // 创建一次性任务目录
            try {
            if (!(await vault.adapter.exists(oneTimeTasksPath))) {
                await vault.createFolder(oneTimeTasksPath);
                console.log(`已创建一次性任务目录: ${oneTimeTasksPath}`);
        } else {
            console.log(`一次性任务目录已存在: ${oneTimeTasksPath}`);
            }
            
            // 确保一次性任务文件存在
            const oneTimeFile = `${oneTimeTasksPath}/onetime_tasks.md`;
            if (!(await vault.adapter.exists(oneTimeFile))) {
                const content = "# 一次性任务\n\n";
                await vault.create(oneTimeFile, content);
                console.log(`已创建一次性任务文件: ${oneTimeFile}`);
            } else {
                console.log(`一次性任务文件已存在: ${oneTimeFile}`);
            }
        } catch (error) {
            console.error(`创建一次性任务目录或文件失败:`, error);
            new Notice(`创建一次性任务目录或文件失败，请检查权限并重试`);
        }
        
        // 创建已完成任务目录
            try {
            if (!(await vault.adapter.exists(completedTasksPath))) {
                await vault.createFolder(completedTasksPath);
                console.log(`已创建已完成任务目录: ${completedTasksPath}`);
        } else {
            console.log(`已完成任务目录已存在: ${completedTasksPath}`);
            }
        } catch (error) {
            console.error(`创建已完成任务目录失败:`, error);
            new Notice(`创建已完成任务目录失败，请检查权限并重试`);
        }
    }
    
    async loadTasks() {
        const { vault } = this.plugin.app;
        
        try {
            // 清空任务列表，避免重复加载
            this.tasks.repeating = [];
            this.tasks.oneTime = [];
            this.tasks.completed = [];
            
            // 获取规范化的路径
            const repeatingTasksPath = normalizePath(this.plugin.settings.repeatingTasksPath);
            const oneTimeTasksPath = normalizePath(this.plugin.settings.oneTimeTasksPath);
            const completedTasksPath = normalizePath(this.plugin.settings.completedTasksPath);
            
            console.log("加载任务 - 路径配置:", 
                        "重复性:", repeatingTasksPath, 
                        "一次性:", oneTimeTasksPath, 
                        "已完成:", completedTasksPath);
            
            // 1. 加载一次性任务
                try {
                const oneTimeFile = `${oneTimeTasksPath}/onetime_tasks.md`;
                console.log("尝试加载一次性任务文件:", oneTimeFile);
                    
                if (await vault.adapter.exists(oneTimeFile)) {
                    const content = await vault.adapter.read(oneTimeFile);
                    console.log("一次性任务文件内容长度:", content.length);
                    
                    const tasks = this.parseTasksFromFile(content, "oneTime");
                    console.log(`从一次性任务文件解析到${tasks.length}个任务`);
                    this.tasks.oneTime.push(...tasks);
                        } else {
                    console.log("一次性任务文件不存在，将创建新文件");
                    // 创建空的一次性任务文件
                    await vault.create(oneTimeFile, "# 一次性任务\n\n");
                    }
                } catch (error) {
                console.error("加载一次性任务失败:", error);
                new Notice("加载一次性任务失败，请检查文件权限");
            }
            
            // 2. 加载重复性任务
                try {
                // 检查每个周期文件是否存在，并加载其中的任务
                for (const cycle of ["yearly", "monthly", "weekly", "daily"]) {
                    const repeatingFile = `${repeatingTasksPath}/repeating_${cycle}.md`;
                    console.log(`尝试加载${cycle}任务文件:`, repeatingFile);
                    
                    if (await vault.adapter.exists(repeatingFile)) {
                        const content = await vault.adapter.read(repeatingFile);
                        const tasks = this.parseTasksFromFile(content, "repeating");
                        console.log(`从${cycle}任务文件解析到${tasks.length}个任务`);
                        this.tasks.repeating.push(...tasks);
                    } else {
                        console.log(`${cycle}任务文件不存在，将创建新文件`);
                        // 创建空的重复性任务文件
                        await vault.create(repeatingFile, `# 重复性任务 - ${this.getCycleNameFromCycle(cycle)}\n\n`);
                    }
                    }
                } catch (error) {
                console.error("加载重复性任务失败:", error);
                new Notice("加载重复性任务失败，请检查文件权限");
            }
            
            // 3. 加载已完成任务
            try {
            if (await vault.adapter.exists(completedTasksPath)) {
                    const completedFiles = await vault.adapter.list(completedTasksPath);
                    console.log("已完成任务目录文件数量:", completedFiles.files.length);
                    
                    // 加载以completed_开头的md文件
                    for (const filePath of completedFiles.files) {
                        if (filePath.endsWith('.md') && filePath.includes('completed_')) {
                                const content = await vault.adapter.read(filePath);
                                
                                // 判断任务类型
                                const fileName = filePath.split('/').pop();
                                const isOneTime = fileName.includes('onetime');
                                const isRepeating = fileName.includes('repeating');
                                
                                const type = isOneTime ? "oneTime" : 
                                             isRepeating ? "repeating" : null;
                                
                                const tasks = this.parseTasksFromFile(content, type, true);
                            console.log(`从已完成任务文件解析到${tasks.length}个任务:`, filePath);
                                this.tasks.completed.push(...tasks);
                            }
                        }
                    }
                } catch (error) {
                console.error("加载已完成任务失败:", error);
                new Notice("加载已完成任务失败，请检查文件权限");
            }
            
            console.log("任务加载完成:", 
                       "重复性任务:", this.tasks.repeating.length,
                       "一次性任务:", this.tasks.oneTime.length,
                       "已完成任务:", this.tasks.completed.length);
                      
            // 验证任务数据是否完整
            this.validateLoadedTasks();
        } catch (error) {
            console.error("加载任务失败:", error);
            new Notice("加载任务失败，请检查控制台获取详细信息");
        }
    }
    
    // 验证加载的任务数据
    validateLoadedTasks() {
        console.log("验证加载的任务数据...");
        let hasErrors = false;
        
        // 检查一次性任务
        for (let i = 0; i < this.tasks.oneTime.length; i++) {
            const task = this.tasks.oneTime[i];
            if (!task.title) {
                console.error(`一次性任务 #${i} 缺少标题`);
                hasErrors = true;
                continue;
            }
            
            if (!task.id) {
                console.log(`一次性任务 "${task.title}" 缺少ID，自动生成`);
                task.id = this.generateTaskId();
            }
            
            if (!task.dueDate) {
                console.log(`一次性任务 "${task.title}" 缺少截止日期，设置为当前日期`);
                task.dueDate = this.getBJDate().toISOString().split('T')[0];
            }
        }
        
        // 检查重复性任务
        for (let i = 0; i < this.tasks.repeating.length; i++) {
            const task = this.tasks.repeating[i];
            if (!task.title) {
                console.error(`重复性任务 #${i} 缺少标题`);
                hasErrors = true;
                continue;
            }
            
            if (!task.id) {
                console.log(`重复性任务 "${task.title}" 缺少ID，自动生成`);
                task.id = this.generateTaskId();
            }
            
            if (!task.cycle) {
                console.log(`重复性任务 "${task.title}" 缺少周期类型，设置为每天`);
                task.cycle = "daily";
                }
        }
        
        console.log("任务数据验证完成。" + (hasErrors ? "发现问题，已尝试修复。" : "无问题。"));
    }
    
    generateTaskId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    getTaskById(id) {
        // 在所有任务列表中查找指定ID的任务
        for (const taskType of ['repeating', 'oneTime', 'completed']) {
            const task = this.tasks[taskType].find(t => t.id === id);
            if (task) return task;
        }
        return null;
    }
    
    getAllActiveTasks() {
        // 获取所有一次性任务（未完成的）
        const oneTimeTasks = this.tasks.oneTime.filter(task => !task.isCompleted);
        
        // 获取重复性任务并应用过滤逻辑
        const filteredRepeatingTasks = this.filterRepeatingTasksForSelection(this.tasks.repeating);
        
        return [...filteredRepeatingTasks, ...oneTimeTasks];
    }
    
    /**
     * 为任务选择过滤重复性任务
     * 与TaskListModal中的filterRepeatingTasks逻辑保持一致
     */
    filterRepeatingTasksForSelection(tasks) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        return tasks.filter(task => {
            // 检查任务是否已过截止日期
            if (task.dueDate && task.dueDate < todayStr) {
                return false; // 过期任务不显示
            }
            
            // 检查是否应该在今天显示
            if (!this.isTaskDueToday(task, today)) {
                return false; // 不是今天执行的任务不显示
            }
            
            return true;
        });
    }
    
    /**
     * 检查重复性任务是否应该在指定日期显示
     * 与TaskListModal中的逻辑保持一致
     */
    isTaskDueToday(task, targetDate) {
        if (!task.executeDate) return false;
        
        const executeDate = new Date(task.executeDate);
        const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const executeDateOnly = new Date(executeDate.getFullYear(), executeDate.getMonth(), executeDate.getDate());
        
        switch (task.cycle) {
            case 'daily':
                // 每日任务：如果执行日期<=今天，则显示
                return executeDateOnly <= targetDateOnly;
                
            case 'weekly':
                // 每周任务：检查是否是同一周几
                return executeDate.getDay() === targetDate.getDay() && executeDateOnly <= targetDateOnly;
                
            case 'monthly':
                // 每月任务：检查是否是同一天
                return executeDate.getDate() === targetDate.getDate() && executeDateOnly <= targetDateOnly;
                
            case 'yearly':
                // 每年任务：检查是否是同一月同一天
                return executeDate.getMonth() === targetDate.getMonth() && 
                       executeDate.getDate() === targetDate.getDate() && 
                       executeDateOnly <= targetDateOnly;
                
            default:
                return false;
        }
    }
    
    async addTask(task) {
        try {
            console.log("【开始】添加任务:", JSON.stringify(task));
            // 基本校验
            if (!task.title) throw new Error("任务标题不能为空");
            // 规范任务类型
            const type = task.type === 'repeating' ? 'repeating' : 'oneTime';
            task.type = type;
            // 生成ID
            if (!task.id) task.id = this.generateTaskId();
            // 设置创建日期
            const bjNow = this.getBJDate();
            task.createdDate = bjNow.toISOString().split('T')[0];
            console.log(`任务类型:${task.type}, ID:${task.id}, 创建日期:${task.createdDate}`);
            
            let savedTask;
            const vault = this.plugin.app.vault;
            if (type === 'oneTime') {
                console.log("【处理】一次性任务");
                savedTask = await this.handleOneTimeTask(task);
                console.log("【保存】一次性任务文件");
                await this.saveOneTimeTasks(vault);
            } else {
                console.log("【处理】重复性任务");
                savedTask = await this.handleRepeatingTask(task);
                console.log("【保存】追加重复性任务到文件");
                await this.appendRepeatingTaskToFile(savedTask);
            }
            console.log("【完成】任务添加完成:", savedTask.title);
            new Notice(`任务 "${savedTask.title}" 添加成功`);
            return savedTask;
        } catch (error) {
            console.error("【错误】添加任务失败:", error);
            new Notice(`添加任务失败: ${error.message}`);
            throw error;
        }
    }
    
    // 追加单个重复性任务到对应文件
    async appendRepeatingTaskToFile(task) {
        const vault = this.plugin.app.vault;
        const repeatingTasksPath = normalizePath(this.plugin.settings.repeatingTasksPath);
        const fileName = `${repeatingTasksPath}/repeating_${task.cycle}.md`;
        console.log("【调试】追加重复性任务到文件:", fileName);
        let existing = "";
        if (await vault.adapter.exists(fileName)) {
            existing = await vault.adapter.read(fileName);
        } else {
            existing = `# 重复性任务 - ${this.getCycleNameFromCycle(task.cycle)}\n\n`;
        }
        const formatted = this.formatTaskToMarkdown(task) + "\n\n";
        try {
            await vault.adapter.write(fileName, existing + formatted);
            console.log("【成功】已追加重复性任务至文件");
        } catch (error) {
            console.error("【错误】追加重复性任务到文件失败:", error);
            // 尝试create
            await vault.create(fileName, existing + formatted);
            console.log("【成功】使用create方法追加重复性任务文件");
        }
    }
    
    async saveTasks() {
        try {
            console.log("【开始】保存所有任务");
            
            // 验证任务数据
            this.validateTasks();
            
            // 验证保存路径
            await this.validatePaths();
            
            const { vault } = this.plugin.app;
            
            // 保存一次性任务
            await this.saveOneTimeTasks(vault);
            
            // 保存重复性任务
            await this.saveRepeatingTasks(vault);
            
            // 保存已完成任务
            await this.saveCompletedTasks(vault);
            
            console.log("【完成】所有任务保存成功");
        } catch (error) {
            console.error("【错误】保存任务时出错:", error);
            throw new Error(`保存任务失败: ${error.message}`);
        }
    }
    
    // 保存一次性任务
    async saveOneTimeTasks(vault) {
        try {
            // 获取一次性任务路径
            const oneTimeTasksPath = normalizePath(this.plugin.settings.oneTimeTasksPath);
            console.log(`【调试】保存一次性任务，数量: ${this.tasks.oneTime.length}，路径: ${oneTimeTasksPath}`);
            
            // 如果没有一次性任务，创建空文件
            const fileName = `${oneTimeTasksPath}/onetime_tasks.md`;
                let content = `# 一次性任务\n\n`;
                
                // 添加每个任务到内容中
            for (const task of this.tasks.oneTime) {
                try {
                    console.log(`【调试】格式化一次性任务: ${task.title}`);
                    content += this.formatTaskToMarkdown(task) + '\n\n';
                } catch (formatError) {
                    console.error(`【错误】格式化一次性任务失败: ${task.title}`, formatError);
                }
                }
                
            // 保存文件
                try {
                    await vault.adapter.write(fileName, content);
                console.log(`【成功】保存一次性任务文件: ${fileName}`);
                } catch (writeError) {
                console.error(`【错误】写入一次性任务文件失败:`, writeError);
                    // 尝试使用create方法
                    try {
                    await vault.create(fileName, content);
                    console.log(`【成功】使用create方法创建一次性任务文件: ${fileName}`);
                    } catch (createError) {
                    throw new Error(`无法保存一次性任务文件: ${createError.message}`);
                }
            }
        } catch (error) {
            console.error("【错误】保存一次性任务失败:", error);
            throw error;
        }
            }
            
    // 保存重复性任务
    async saveRepeatingTasks(vault) {
        try {
            // 获取重复性任务路径
            const repeatingTasksPath = normalizePath(this.plugin.settings.repeatingTasksPath);
            console.log(`【调试】保存重复性任务，数量: ${this.tasks.repeating.length}，路径: ${repeatingTasksPath}`);
            
            // 按周期类型分类任务
            const tasksByType = {
                "daily": [],
                "weekly": [],
                "monthly": [],
                "yearly": []
            };
            
            // 对任务进行分类
            for (const task of this.tasks.repeating) {
                const cycle = task.cycle || "daily";
                if (!tasksByType[cycle]) {
                    console.log(`【警告】未知的周期类型: ${cycle}，归为每日任务`);
                    tasksByType["daily"].push(task);
                } else {
                    tasksByType[cycle].push(task);
                }
            }
            
            // 保存每种周期类型的任务
            for (const [cycle, cycleTasks] of Object.entries(tasksByType)) {
                // 即使没有任务，也创建文件以保持文件结构
                const fileName = `${repeatingTasksPath}/repeating_${cycle}.md`;
                let content = `# 重复性任务 - ${this.getCycleNameFromCycle(cycle)}\n\n`;
                
                // 添加任务到内容中
                for (const task of cycleTasks) {
                    try {
                        console.log(`【调试】格式化${cycle}任务: ${task.title}`);
                    content += this.formatTaskToMarkdown(task) + '\n\n';
                    } catch (formatError) {
                        console.error(`【错误】格式化${cycle}任务失败: ${task.title}`, formatError);
                    }
                }
                
                // 保存文件
                try {
                    await vault.adapter.write(fileName, content);
                    console.log(`【成功】保存${cycle}任务文件 (${cycleTasks.length}个任务): ${fileName}`);
                } catch (writeError) {
                    console.error(`【错误】写入${cycle}任务文件失败:`, writeError);
                    // 尝试使用create方法
                    try {
                        await vault.create(fileName, content);
                        console.log(`【成功】使用create方法创建${cycle}任务文件: ${fileName}`);
                    } catch (createError) {
                        console.error(`【错误】创建${cycle}任务文件失败:`, createError);
                        throw new Error(`无法保存${cycle}任务文件: ${createError.message}`);
                    }
                }
            }
        } catch (error) {
            console.error("【错误】保存重复性任务失败:", error);
            throw error;
        }
    }
    
    // 保存已完成任务
    async saveCompletedTasks(vault) {
        try {
            // 获取已完成任务路径
            const completedTasksPath = normalizePath(this.plugin.settings.completedTasksPath);
            console.log(`【调试】保存已完成任务，数量: ${this.tasks.completed.length}，路径: ${completedTasksPath}`);
            
            // 如果没有已完成任务，直接返回
            if (this.tasks.completed.length === 0) {
                console.log("【调试】没有已完成任务需要保存");
                return;
            }
        
            // 确保目录存在
            if (!(await vault.adapter.exists(completedTasksPath))) {
                console.log(`【调试】创建已完成任务目录: ${completedTasksPath}`);
                await vault.createFolder(completedTasksPath);
            }
            
            // 获取今天的日期
            const today = new Date().toISOString().split('T')[0];
            
            // 只处理今天完成的任务
            const todayTasks = this.tasks.completed.filter(task => {
                const taskDate = task.completedDate || today;
                return taskDate === today;
            });
            
            if (todayTasks.length === 0) {
                console.log("【调试】今天没有完成的任务需要保存");
                return;
            }
            
            // 按类型分组
            const onetimeTasks = todayTasks.filter(task => task.type !== "repeating");
            const repeatingTasks = todayTasks.filter(task => task.type === "repeating");
            
            // 生成文件名和内容
            const fileName = `${completedTasksPath}/completed_${today}.md`;
            let content = `# 已完成任务 - ${today}\n\n`;
            
            // 添加一次性任务
            if (onetimeTasks.length > 0) {
                content += `# 一次性任务\n\n`;
                for (const task of onetimeTasks) {
                    try {
                        console.log(`【调试】格式化已完成一次性任务: ${task.title}`);
                        content += this.formatTaskToMarkdown(task) + '\n\n';
                    } catch (formatError) {
                        console.error(`【错误】格式化已完成任务失败: ${task.title}`, formatError);
                    }
                }
            }
            
            // 添加重复性任务
            if (repeatingTasks.length > 0) {
                content += `# 重复性任务\n\n`;
                for (const task of repeatingTasks) {
                    try {
                        console.log(`【调试】格式化已完成重复性任务: ${task.title}`);
                        content += this.formatTaskToMarkdown(task) + '\n\n';
                    } catch (formatError) {
                        console.error(`【错误】格式化已完成任务失败: ${task.title}`, formatError);
                    }
                }
            }
            
            // 保存文件
            try {
                await vault.adapter.write(fileName, content);
                console.log(`【成功】保存今日已完成任务文件 (${todayTasks.length}个任务): ${fileName}`);
            } catch (writeError) {
                console.error(`【错误】写入已完成任务文件失败:`, writeError);
            }
            
        } catch (error) {
            console.error("【错误】保存已完成任务失败:", error);
        }
    }
    
    formatTaskToMarkdown(task) {
        try {
            console.log(`开始格式化任务为Markdown: ${task.title}`);
            
            if (!task || !task.title) {
                throw new Error("无效的任务对象或标题缺失");
            }
            
            // 使用Obsidian自带的任务选框格式
            const isCompleted = task.progress === 100 || task.status === 'completed';
            let markdown = `- [${isCompleted ? 'x' : ' '}] ${task.title}\n`;
            
            // 添加基本信息
            markdown += `  - ID: ${task.id || this.generateTaskId()}\n`;
            markdown += `  - 类型: ${task.type === "repeating" ? "重复任务" : "一次性任务"}\n`;
            
            // 添加描述
            if (task.description) {
                markdown += `  - 描述: ${task.description}\n`;
            }
            
            // 添加进度
            markdown += `  - 进度: ${task.progress || 0}%\n`;
            
            // 添加创建日期
            const createdDate = task.createdDate || new Date().toISOString().split('T')[0];
            markdown += `  - 创建日期: ${createdDate}\n`;
            
            // 添加截止日期（一次性任务必需）
            if (task.type === "oneTime" || task.dueDate) {
                markdown += `  - 截止日期: ${task.dueDate}\n`;
            }
            
            // 重复性任务特有的字段
            if (task.type === "repeating") {
                if (task.cycle) {
                    markdown += `  - 周期: ${task.cycle}\n`;
                }
                
                if (task.cyclePeriod) {
                    markdown += `  - 周期单位: ${task.cyclePeriod}\n`;
                }
                
                if (task.executeDate) {
                    markdown += `  - 执行日期: ${task.executeDate}\n`;
                }
            }
            
            // 添加标签
            if (task.tags && task.tags.length > 0) {
                markdown += `  - 标签: ${task.tags.join(', ')}\n`;
            }
            
            // 添加子任务
            if (task.subTasks && task.subTasks.length > 0) {
                markdown += `  - 子任务:\n`;
                for (const subTask of task.subTasks) {
                    markdown += `    - [${subTask.completed ? 'x' : ' '}] ${subTask.text}\n`;
                }
            }
            
            console.log(`任务格式化完成，内容长度: ${markdown.length}`);
            return markdown;
        } catch (error) {
            console.error(`格式化任务失败: ${task?.title || 'unknown'}`, error);
            throw new Error(`格式化任务失败: ${error.message}`);
        }
    }
    
    getCycleNameFromCycle(cycle) {
        switch (cycle) {
            case "yearly":
                return '每年';
            case "monthly":
                return '每月';
            case "weekly":
                return '每周';
            case "daily":
                return '每天';
            default:
                return '';
        }
    }
    
    async deleteTask(taskId) {
        let found = false;
        
        // 在所有任务列表中查找并删除指定ID的任务
        for (const taskType of ['repeating', 'oneTime', 'completed']) {
            const index = this.tasks[taskType].findIndex(t => t.id === taskId);
            if (index !== -1) {
                this.tasks[taskType].splice(index, 1);
                found = true;
                break;
            }
        }
        
        if (found) {
            await this.saveTasks();
            return true;
        }
        
        return false;
    }
    
    // 更新任务的进度或状态
    async updateTask(taskId, updates) {
        console.log(`【调试】调用 updateTask: ${taskId}`, updates);
        // 查找任务对象
        const task = this.getTaskById(taskId);
        if (!task) {
            console.error(`【错误】updateTask 找不到任务 ID: ${taskId}`);
            throw new Error(`未找到任务 ID: ${taskId}`);
        }
        
        // 合并更新字段
        Object.assign(task, updates);
        
        // 如果任务标记完成
        if (updates.isCompleted) {
            // 自动完成所有子任务
            if (task.subTasks && task.subTasks.length > 0) {
                console.log(`【调试】主任务完成，自动完成 ${task.subTasks.length} 个子任务`);
                task.subTasks.forEach(subTask => {
                    subTask.completed = true;
                });
            }
            
            const today = this.getBJDate().toISOString().split('T')[0];
            
            if (task.type === 'repeating') {
                // 重复性任务：记录当期完成，更新下次执行日期
                console.log(`【调试】重复性任务完成，记录当期完成状态`);
                
                // 创建当期完成记录
                const completedInstance = {
                    ...task,
                    completedDate: today,
                    currentPeriod: today, // 记录完成的是哪一期
                    isCompleted: true,
                    status: 'completed'
                };
                
                // 添加到已完成列表
                this.tasks.completed.push(completedInstance);
                
                // 重置原任务状态并更新下次执行日期
                task.progress = 0;
                task.isCompleted = false;
                task.status = 'active';
                
                // 重置子任务状态
                if (task.subTasks && task.subTasks.length > 0) {
                    task.subTasks.forEach(subTask => {
                        subTask.completed = false;
                    });
                }
                
                // 更新下次执行日期
                await this.updateNextExecuteDate(task);
                
                console.log(`【调试】重复性任务 ${taskId} 当期完成，下次执行日期: ${task.executeDate}`);
            } else {
                // 一次性任务：从源列表移除，移动到已完成列表
                const list = this.tasks.oneTime;
                const idx = list.findIndex(t => t.id === taskId);
                if (idx !== -1) list.splice(idx, 1);
                
                // 设置完成日期
                task.completedDate = today;
                this.tasks.completed.push(task);
                console.log(`【调试】一次性任务 ${taskId} 已移动到已完成列表`);
            }
        }
        
        // 保存所有任务
        await this.saveTasks();
        console.log(`【调试】updateTask 保存完成: ${taskId}`);
        return task;
    }
    
    // 更新重复性任务的下次执行日期
    async updateNextExecuteDate(task) {
        const bjNow = this.getBJDate();
        
        switch (task.cycle) {
            case "daily":
                // 每日任务：下次执行日期为明天
                const tomorrow = new Date(bjNow);
                tomorrow.setDate(bjNow.getDate() + 1);
                task.executeDate = tomorrow.toISOString().split('T')[0];
                break;
                
            case "weekly":
                // 每周任务：下次执行日期为下周同一天
                const nextWeek = new Date(bjNow);
                nextWeek.setDate(bjNow.getDate() + 7);
                task.executeDate = nextWeek.toISOString().split('T')[0];
                break;
                
            case "monthly":
                // 每月任务：下次执行日期为下月同一天
                const nextMonth = new Date(bjNow);
                nextMonth.setMonth(bjNow.getMonth() + 1);
                task.executeDate = nextMonth.toISOString().split('T')[0];
                break;
                
            case "yearly":
                // 每年任务：下次执行日期为明年同一天
                const nextYear = new Date(bjNow);
                nextYear.setFullYear(bjNow.getFullYear() + 1);
                task.executeDate = nextYear.toISOString().split('T')[0];
                break;
        }
        
        console.log(`【调试】${task.cycle}任务下次执行日期更新为: ${task.executeDate}`);
    }
    
    // 清理过期的重复性任务
    async cleanupExpiredRepeatingTasks() {
        const today = this.getBJDate().toISOString().split('T')[0];
        const initialCount = this.tasks.repeating.length;
        
        // 过滤掉已过截止日期的重复性任务
        this.tasks.repeating = this.tasks.repeating.filter(task => {
            if (task.dueDate && task.dueDate < today) {
                console.log(`【调试】清理过期重复性任务: "${task.title}", 截止日期: ${task.dueDate}`);
                return false;
            }
            return true;
        });
        
        const removedCount = initialCount - this.tasks.repeating.length;
        if (removedCount > 0) {
            console.log(`【调试】清理了 ${removedCount} 个过期重复性任务`);
            await this.saveTasks();
        }
        
        return removedCount;
    }

    // 在TaskManager类中添加日期处理辅助方法
    getBJDate() {
        const now = new Date();
        const utcDate = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utcDate + (3600000 * 8)); // 东八区
    }

    getWeekdayName(dayNumber) {
        const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        return weekdays[parseInt(dayNumber)] || `未知(${dayNumber})`;
    }

    parseTasksFromFile(content, taskType, isCompleted = false) {
        console.log(`解析${taskType === "oneTime" ? '一次性' : '重复性'}任务文件，内容长度:`, content.length);
        const tasks = [];
        
        try {
            // 检查内容是否为空
            if (!content || content.trim().length === 0) {
                console.log("文件内容为空，无任务可解析");
                return [];
            }
            
            // 检查文件内容是否有乱码
            const hasGarbledText = /[\ufffd\uFFFD]/.test(content);
            if (hasGarbledText) {
                console.warn("文件内容可能存在编码问题，尝试清理内容后解析");
                // 尝试清理内容中的乱码字符
                content = content.replace(/[\ufffd\uFFFD]/g, '');
            }
            
            // 获取所有任务块 - 以选框"- [ ]"或"- [x]"开始，到下一个任务或文件结束
            const taskRegex = /- \[([x ])\] (.+?)\n([\s\S]*?)(?=\n- \[|$)/g;
            let match;
            
            while ((match = taskRegex.exec(content)) !== null) {
                try {
                    const isCompleted = match[1] === 'x';
                    const taskTitle = match[2].trim();
                    const taskContent = match[3].trim();
                    
                    console.log(`找到任务: "${taskTitle}", 完成状态: ${isCompleted}`);
                    
                    // 解析任务属性 - 使用正则表达式匹配各个属性（注意缩进）
                    const idMatch = taskContent.match(/- ID: ([^\n]+)/);
                    const typeMatch = taskContent.match(/- 类型: ([^\n]+)/);
                    const descMatch = taskContent.match(/- 描述: ([\s\S]*?)(?=\n  - |$)/);
                    const progressMatch = taskContent.match(/- 进度: (\d+)%/);
                    const dueDateMatch = taskContent.match(/- 截止日期: ([^\n]+)/);
                    const createDateMatch = taskContent.match(/- 创建日期: ([^\n]+)/);
                    const cycleMatch = taskContent.match(/- 周期: ([^\n]+)/);
                    const cyclePeriodMatch = taskContent.match(/- 周期单位: ([^\n]+)/);
                    const executeDateMatch = taskContent.match(/- 执行日期: ([^\n]+)/);
                    const tagsMatch = taskContent.match(/- 标签: ([^\n]+)/);
                    
                    // 创建任务对象
                    const task = {
                        id: idMatch ? idMatch[1].trim() : this.generateTaskId(),
                        title: taskTitle,
                        description: descMatch ? descMatch[1].trim() : "",
                        progress: isCompleted ? 100 : (progressMatch ? parseInt(progressMatch[1]) : 0),
                        type: typeMatch && typeMatch[1].includes("重复") ? "repeating" : "oneTime",
                        createdDate: createDateMatch ? createDateMatch[1].trim() : new Date().toISOString().split('T')[0],
                        isCompleted: isCompleted,
                        status: isCompleted ? 'completed' : 'active'
                    };
                    
                    console.log(`  解析ID: ${task.id}, 类型: ${task.type}`);
                    
                    // 设置截止日期
                    if (dueDateMatch) {
                        task.dueDate = dueDateMatch[1].trim();
                        console.log(`  截止日期: ${task.dueDate}`);
                    }
                    
                    // 设置标签
                    if (tagsMatch) {
                        task.tags = tagsMatch[1].split(',').map(tag => tag.trim());
                    }
                    
                    // 解析子任务（如果有）
                    const subTasksMatch = taskContent.match(/- 子任务:\n([\s\S]*?)(?=\n  - [^-]|$)/);
                    if (subTasksMatch) {
                        const subTasksContent = subTasksMatch[1];
                        const subTasksRegex = /    - \[([x ])\] (.+)$/gm;
                        const subTasks = [];
                        let subTaskMatch;
                        
                        while ((subTaskMatch = subTasksRegex.exec(subTasksContent)) !== null) {
                            subTasks.push({
                                completed: subTaskMatch[1] === 'x',
                                text: subTaskMatch[2].trim()
                            });
                        }
                        
                        if (subTasks.length > 0) {
                            task.subTasks = subTasks;
                            console.log(`  子任务数量: ${subTasks.length}`);
                        }
                    }
                    
                    // 对于重复性任务，设置周期相关属性
                    if (task.type === "repeating" || cycleMatch) {
                        // 强制设置类型为repeating
                        task.type = "repeating";
                        
                        if (cycleMatch) {
                            task.cycle = cycleMatch[1].trim();
                            console.log(`  周期类型: ${task.cycle}`);
                            
                            if (cyclePeriodMatch) {
                                task.cyclePeriod = cyclePeriodMatch[1].trim();
                                console.log(`  周期单位: ${task.cyclePeriod}`);
                            }
                            
                            if (executeDateMatch) {
                                task.executeDate = executeDateMatch[1].trim();
                                console.log(`  执行日期: ${task.executeDate}`);
                            }
                        } else {
                            // 默认为每天
                            task.cycle = "daily";
                            console.log(`  未找到周期类型，默认设置为每天`);
                        }
                    }
                    
                    console.log(`成功解析任务: "${task.title}"`);
                    tasks.push(task);
                } catch (taskError) {
                    console.error(`解析任务"${match[1].trim()}"时出错:`, taskError);
                    // 继续解析下一个任务
                }
            }
            
            console.log(`共解析到${tasks.length}个任务`);
        } catch (error) {
            console.error("解析任务文件时出错:", error);
        }
        
        return tasks;
    }
}

// 任务选择弹窗
class TaskSelectionModal extends Modal {
    constructor(app, plugin, onTaskSelected) {
        super(app);
        this.plugin = plugin;
        this.onTaskSelected = onTaskSelected;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("yuhanbo-task-selection-modal");
        
        contentEl.createEl("h2", { text: "选择要进行的任务" });
        
        // 添加搜索框
        const searchContainer = contentEl.createDiv({ cls: "yuhanbo-search-container" });
        const searchInput = searchContainer.createEl("input", {
            type: "text",
            placeholder: "搜索任务...",
            cls: "yuhanbo-search-input"
        });
        
        // 任务列表容器
        const taskListContainer = contentEl.createDiv({ cls: "yuhanbo-task-list-container" });
        
        // 按钮容器
        const buttonContainer = contentEl.createDiv({ cls: "yuhanbo-button-container" });
        
        // 创建新任务按钮
        const newTaskButton = buttonContainer.createEl("button", { 
            text: "创建新任务",
            cls: "yuhanbo-primary-button"
        });
        
        // 无任务按钮
        const noTaskButton = buttonContainer.createEl("button", { 
            text: "不选择任务",
            cls: "yuhanbo-secondary-button"
        });
        
        // 绑定按钮事件
        newTaskButton.addEventListener("click", () => {
            this.close();
            new TaskModal(this.app, this.plugin, (task) => {
                this.onTaskSelected(task);
            }).open();
        });
        
        noTaskButton.addEventListener("click", () => {
            this.close();
            this.onTaskSelected(null);
        });
        
        // 渲染任务列表
        this.renderTaskList(taskListContainer);
        
        // 绑定搜索事件
        searchInput.addEventListener("input", () => {
            const searchTerm = searchInput.value.toLowerCase();
            this.renderTaskList(taskListContainer, searchTerm);
        });
    }
    
    renderTaskList(container, searchTerm = "") {
        container.empty();
        
        // 获取所有活动任务
        const tasks = this.plugin.taskManager.getAllActiveTasks();
        
        if (tasks.length === 0) {
            container.createEl("p", { text: "没有可选择的任务", cls: "yuhanbo-no-tasks" });
            return;
        }
        
        // 过滤任务
        const filteredTasks = searchTerm 
            ? tasks.filter(task => 
                task.title.toLowerCase().includes(searchTerm) || 
                task.description.toLowerCase().includes(searchTerm))
            : tasks;
        
        if (filteredTasks.length === 0) {
            container.createEl("p", { text: "没有匹配的任务", cls: "yuhanbo-no-tasks" });
            return;
        }
        
        // 创建任务列表
        const taskList = container.createEl("div", { cls: "yuhanbo-task-list" });
        
        for (const task of filteredTasks) {
            const taskItem = taskList.createEl("div", { cls: "yuhanbo-task-item" });
            
            // 任务信息
            const taskInfo = taskItem.createEl("div", { cls: "yuhanbo-task-info" });
            taskInfo.createEl("div", { text: task.title, cls: "yuhanbo-task-title" });
            
            // 显示任务到期日期和进度
            const taskMeta = taskInfo.createEl("div", { cls: "yuhanbo-task-meta" });
            if (task.dueDate) {
                taskMeta.createEl("span", { 
                    text: `截止: ${task.dueDate}`, 
                    cls: "yuhanbo-task-due-date" 
                });
            }
            
            taskMeta.createEl("span", { 
                text: `进度: ${task.progress}%`, 
                cls: "yuhanbo-task-progress" 
            });
            
            // 任务类型和周期
            const taskType = taskInfo.createEl("div", { cls: "yuhanbo-task-type" });
            taskType.createEl("span", { 
                text: task.type === "repeating" ? "重复任务" : "一次性任务", 
                cls: "yuhanbo-task-type-badge" 
            });
            
            if (task.cycle) {
                taskType.createEl("span", { 
                    text: this.plugin.taskManager.getCycleNameFromCycle(task.cycle), 
                    cls: "yuhanbo-task-cycle-badge" 
                });
            }
            
            // 选择按钮
            const selectButton = taskItem.createEl("button", { 
                text: "选择", 
                cls: "yuhanbo-select-button" 
            });
            
            selectButton.addEventListener("click", () => {
                this.close();
                this.onTaskSelected(task);
            });
        }
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 任务进度更新弹窗
class TaskProgressModal extends Modal {
    constructor(app, plugin, task, onComplete) {
        super(app);
        this.app = app;
        this.plugin = plugin;
        this.task = task;
        this.onComplete = onComplete;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("yuhanbo-task-progress-modal");
        
        // 刷新任务对象，获取最新的 subTasks 状态
        const latest = this.plugin.taskManager.getTaskById(this.task.id);
        if (latest) {
            this.task = latest;
        }
        
        contentEl.createEl("h2", { text: "更新任务进度" });
        
        // 任务信息
        const taskInfo = contentEl.createDiv({ cls: "yuhanbo-task-info" });
        taskInfo.createEl("h3", { text: this.task.title, cls: "yuhanbo-task-title" });
        
        if (this.task.description) {
            taskInfo.createEl("p", { text: this.task.description, cls: "yuhanbo-task-description" });
        }
        
        // 任务进度
        const progressContainer = contentEl.createDiv({ cls: "yuhanbo-progress-container" });
        progressContainer.createEl("label", { text: "任务完成进度:", for: "task-progress" });
        
        const progressInput = progressContainer.createEl("input", {
            type: "range",
            id: "task-progress",
            min: "0",
            max: "100",
            value: this.task.progress.toString(),
            cls: "yuhanbo-progress-slider"
        });
        
        const progressValue = progressContainer.createEl("span", {
            text: `${this.task.progress}%`,
            cls: "yuhanbo-progress-value"
        });
        
        // 更新进度值显示
        progressInput.addEventListener("input", () => {
            progressValue.textContent = `${progressInput.value}%`;
        });
        
        // 显示子任务列表
        if (this.task.subTasks && this.task.subTasks.length > 0) {
            const subTasksContainer = contentEl.createDiv({ cls: "yuhanbo-subtasks-container" });
            subTasksContainer.createEl("h4", { text: "子任务列表" });
            
            const subTasksList = subTasksContainer.createEl("div", { cls: "yuhanbo-subtasks-list" });
            
            for (let i = 0; i < this.task.subTasks.length; i++) {
                const subTask = this.task.subTasks[i];
                const subTaskItem = subTasksList.createDiv({ cls: "yuhanbo-subtask-item" });
                
                const checkbox = subTaskItem.createEl("input", {
                    type: "checkbox",
                    cls: "yuhanbo-subtask-checkbox"
                });
                // 手动设置复选框状态
                checkbox.checked = subTask.completed;
                
                subTaskItem.createEl("span", { text: subTask.text, cls: "yuhanbo-subtask-text" });
                
                // 更新子任务完成状态
                checkbox.addEventListener("change", () => {
                    this.task.subTasks[i].completed = checkbox.checked;
                    
                    // 自动更新总进度
                    const completedSubTasks = this.task.subTasks.filter(st => st.completed).length;
                    const newProgress = Math.round((completedSubTasks / this.task.subTasks.length) * 100);
                    progressInput.value = newProgress.toString();
                    progressValue.textContent = `${newProgress}%`;
                });
            }
        }
        
        // 按钮容器
        const buttonContainer = contentEl.createDiv({ cls: "yuhanbo-button-container" });
        
        // 完成任务按钮
        const completeButton = buttonContainer.createEl("button", { 
            text: "完成任务",
            cls: "yuhanbo-primary-button"
        });
        
        // 更新进度按钮
        const updateButton = buttonContainer.createEl("button", { 
            text: "更新进度",
            cls: "yuhanbo-secondary-button"
        });
        
        // 取消按钮
        const cancelButton = buttonContainer.createEl("button", { 
            text: "取消",
            cls: "yuhanbo-cancel-button"
        });
        
        // 绑定按钮事件
        completeButton.addEventListener("click", async () => {
            // 将任务标记为已完成
            await this.plugin.taskManager.updateTask(this.task.id, {
                progress: 100,
                isCompleted: true
            });
            
            this.close();
            new Notice(`任务 "${this.task.title}" 已完成！`);
            this.onComplete();
        });
        
        updateButton.addEventListener("click", async () => {
            // 更新任务进度
            const progress = parseInt(progressInput.value, 10);
            // 获取当前子任务状态
            const subTasks = this.task.subTasks || [];
            await this.plugin.taskManager.updateTask(this.task.id, {
                progress: progress,
                isCompleted: progress >= 100,
                subTasks: subTasks
            });
            
            this.close();
            new Notice(`任务 "${this.task.title}" 进度已更新为 ${progress}%`);
            this.onComplete();
        });
        
        cancelButton.addEventListener("click", () => {
            this.close();
            this.onComplete();
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 任务创建和编辑弹窗
class TaskModal extends Modal {
    constructor(app, plugin, onTaskCreated) {
        super(app);
        this.app = app;
        this.plugin = plugin;
        this.onTaskCreated = onTaskCreated;
        this.task = {
            id: this.plugin.taskManager.generateTaskId(),
            title: "",
            description: "",
            type: "oneTime", // 默认为一次性任务
            isCompleted: false,
            progress: 0,
            cycle: null, // 一次性任务没有周期
            cyclePeriod: null, // 存储具体执行日期信息（周几、每月几号、每年几月几日）
            dueDate: new Date().toISOString().split('T')[0],
            executeDate: null, // 执行日期，仅适用于重复性任务
            tags: [],
            subTasks: []
        };
        this.useAI = false;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("yuhanbo-task-modal");
        
        contentEl.createEl("h2", { text: "创建新任务" });
        
        // 使用 div 替代 form，避免表单提交刷新问题
        const form = contentEl.createDiv({ cls: "yuhanbo-task-form" });
        
        // 任务标题
        const titleGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        titleGroup.createEl("label", { text: "任务标题:", for: "task-title" });
        const titleInput = titleGroup.createEl("input", {
            type: "text",
            id: "task-title",
            placeholder: "输入任务标题",
            required: true,
            cls: "yuhanbo-input"
        });
        
        // 任务描述
        const descGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        descGroup.createEl("label", { text: "任务描述:", for: "task-description" });
        const descInput = descGroup.createEl("textarea", {
            id: "task-description",
            placeholder: "输入任务描述",
            cls: "yuhanbo-textarea"
        });
        
        // 任务类型
        const typeGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        typeGroup.createEl("label", { text: "任务类型:", for: "task-type" });
        const typeSelect = typeGroup.createEl("select", {
            id: "task-type",
            cls: "yuhanbo-select"
        });
        
        const typeOptions = [
            { value: "oneTime", text: "一次性任务" },
            { value: "repeating", text: "重复性任务" }
        ];
        
        for (const option of typeOptions) {
            typeSelect.createEl("option", {
                value: option.value,
                text: option.text,
                selected: option.value === "oneTime"
            });
        }
        
        // 添加截止日期输入框
        const dueDateGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        dueDateGroup.createEl("label", { text: "截止日期:", for: "task-due-date" });
        const dueDateInput = dueDateGroup.createEl("input", {
            type: "date",
            id: "task-due-date",
            cls: "yuhanbo-input",
            value: this.task.dueDate,
            required: true
        });
        
        // 添加进度条输入
        const progressGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        progressGroup.createEl("label", { text: "完成进度:", for: "task-progress" });
        const progressContainer = progressGroup.createDiv({ cls: "progress-container" });
        const progressInput = progressContainer.createEl("input", {
            type: "range",
            id: "task-progress",
            min: "0",
            max: "100",
            value: this.task.progress.toString(),
            cls: "yuhanbo-progress-slider"
        });
        const progressValue = progressContainer.createEl("span", {
            text: `${this.task.progress}%`,
            cls: "progress-value"
        });
        progressInput.addEventListener("input", () => {
            progressValue.textContent = `${progressInput.value}%`;
        });
        
        // 创建但不立即添加周期选择组
        const cycleGroup = document.createElement("div");
        cycleGroup.className = "yuhanbo-form-group";
        
        const cycleLabel = document.createElement("label");
        cycleLabel.textContent = "重复周期:";
        cycleLabel.htmlFor = "task-cycle";
        cycleGroup.appendChild(cycleLabel);
        
        const cycleSelect = document.createElement("select");
        cycleSelect.id = "task-cycle";
        cycleSelect.className = "yuhanbo-select";
        
        const cycleOptions = [
            { value: "daily", text: "每天" },
            { value: "weekly", text: "每周" },
            { value: "monthly", text: "每月" },
            { value: "yearly", text: "每年" }
        ];
        
        for (const option of cycleOptions) {
            const optionEl = document.createElement("option");
            optionEl.value = option.value;
            optionEl.text = option.text;
            cycleSelect.appendChild(optionEl);
        }
        
        cycleGroup.appendChild(cycleSelect);
        
        // 创建执行日期组（但不立即添加）
        const executeDateGroup = document.createElement("div");
        executeDateGroup.className = "yuhanbo-form-group";

        // 周期变化时更新执行日期选择
        cycleSelect.addEventListener("change", () => {
            // 清除旧的执行日期组
            if (executeDateGroup.parentNode) {
                executeDateGroup.remove();
            }
            executeDateGroup.innerHTML = '';
            
            // 根据周期类型创建不同的执行日期选择
            const cycleType = cycleSelect.value;
            
            if (cycleType === "daily") {
                // 每天周期不需要执行日期
                return;
            }
            
            const executeDateLabel = document.createElement("label");
            executeDateLabel.textContent = "执行日期:";
            executeDateLabel.htmlFor = "task-execute-date";
            executeDateGroup.appendChild(executeDateLabel);
            
            if (cycleType === "weekly") {
                // 周周期选择周几
                const weekdaySelect = document.createElement("select");
                weekdaySelect.id = "task-execute-date";
                weekdaySelect.className = "yuhanbo-select";
                
                const weekdays = [
                    { value: "1", text: "周一" },
                    { value: "2", text: "周二" },
                    { value: "3", text: "周三" },
                    { value: "4", text: "周四" },
                    { value: "5", text: "周五" },
                    { value: "6", text: "周六" },
                    { value: "0", text: "周日" }
                ];
                
                // 默认选择今天是周几
                const today = new Date().getDay(); // 0是周日，1-6是周一至周六
                const defaultDay = today === 0 ? "0" : today.toString();
                
                for (const day of weekdays) {
                    const option = document.createElement("option");
                    option.value = day.value;
                    option.text = day.text;
                    option.selected = day.value === defaultDay;
                    weekdaySelect.appendChild(option);
                }
                
                executeDateGroup.appendChild(weekdaySelect);
                const description = document.createElement("div");
                description.className = "setting-item-description";
                description.textContent = "选择每周的哪一天执行此任务";
                executeDateGroup.appendChild(description);
                
            } else if (cycleType === "monthly") {
                // 月周期选择几号
                const daySelect = document.createElement("select");
                daySelect.id = "task-execute-date";
                daySelect.className = "yuhanbo-select";
                
                // 默认选择今天是几号
                const today = new Date().getDate(); // 1-31
                
                for (let i = 1; i <= 31; i++) {
                    const option = document.createElement("option");
                    option.value = i.toString();
                    option.text = `${i}号`;
                    option.selected = i === today;
                    daySelect.appendChild(option);
                }
                
                executeDateGroup.appendChild(daySelect);
                const description = document.createElement("div");
                description.className = "setting-item-description";
                description.textContent = "选择每月的哪一天执行此任务";
                executeDateGroup.appendChild(description);
                
            } else if (cycleType === "yearly") {
                // 年周期选择月和日
                const container = document.createElement("div");
                container.style.display = "flex";
                container.style.gap = "10px";
                
                const monthSelect = document.createElement("select");
                monthSelect.id = "task-execute-date-month";
                monthSelect.className = "yuhanbo-select";
                monthSelect.style.flex = "1";
                
                const daySelect = document.createElement("select");
                daySelect.id = "task-execute-date-day";
                daySelect.className = "yuhanbo-select";
                daySelect.style.flex = "1";
                
                // 默认选择今天的月和日
                const today = new Date();
                const currentMonth = today.getMonth() + 1; // 1-12
                const currentDay = today.getDate(); // 1-31
                
                // 月份选择
                const months = ["一月", "二月", "三月", "四月", "五月", "六月", 
                               "七月", "八月", "九月", "十月", "十一月", "十二月"];
                
                for (let i = 1; i <= 12; i++) {
                    const option = document.createElement("option");
                    option.value = i.toString();
                    option.text = months[i-1];
                    option.selected = i === currentMonth;
                    monthSelect.appendChild(option);
                }
                
                // 日期选择
                updateDaysInMonth(monthSelect, daySelect, currentDay);
                
                // 月份变化时更新天数
                monthSelect.addEventListener("change", () => {
                    updateDaysInMonth(monthSelect, daySelect);
                });
                
                container.appendChild(monthSelect);
                container.appendChild(daySelect);
                executeDateGroup.appendChild(container);
                
                const description = document.createElement("div");
                description.className = "setting-item-description";
                description.textContent = "选择每年的哪一天执行此任务";
                executeDateGroup.appendChild(description);
            }
            
            // 在截止日期之前添加执行日期
            if (executeDateGroup.children.length > 0) {
                dueDateGroup.before(executeDateGroup);
            }
        });
        
        // 辅助函数：根据月份更新天数
        function updateDaysInMonth(monthSelect, daySelect, defaultDay) {
            const month = parseInt(monthSelect.value);
            const selectedDay = daySelect.value ? parseInt(daySelect.value) : defaultDay;
            
            // 清除现有选项
            daySelect.innerHTML = "";
            
            // 获取月份的天数
            let daysInMonth;
            if (month === 2) {
                // 二月份，简单处理闰年为29天
                daysInMonth = 29;
            } else if ([4, 6, 9, 11].includes(month)) {
                // 小月30天
                daysInMonth = 30;
            } else {
                // 大月31天
                daysInMonth = 31;
            }
            
            // 添加日期选项
            for (let i = 1; i <= daysInMonth; i++) {
                const option = document.createElement("option");
                option.value = i.toString();
                option.text = `${i}日`;
                option.selected = i === selectedDay;
                daySelect.appendChild(option);
            }
        }
        
        // 标签
        const tagsGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        tagsGroup.createEl("label", { text: "标签 (用逗号分隔):", for: "task-tags" });
        const tagsInput = tagsGroup.createEl("input", {
            type: "text",
            id: "task-tags",
            placeholder: "工作, 家庭, 学习",
            cls: "yuhanbo-input"
        });
        
        // AI智能拆分选项
        const aiGroup = form.createDiv({ cls: "yuhanbo-form-group" });
        const aiCheckboxContainer = aiGroup.createDiv({ cls: "yuhanbo-checkbox-container" });
        
        const aiCheckbox = aiCheckboxContainer.createEl("input", {
            type: "checkbox",
            id: "task-ai",
            cls: "yuhanbo-checkbox"
        });
        aiCheckbox.checked = true; // 手动设置默认勾选
        
        aiCheckboxContainer.createEl("label", { 
            text: "使用AI智能拆分任务", 
            for: "task-ai",
            cls: "yuhanbo-checkbox-label"
        });
        
        // AI生成的子任务容器
        const aiSubtasksContainer = form.createDiv({ 
            cls: "yuhanbo-ai-subtasks",
            style: "display: none;"
        });
        
        // AI生成按钮和子任务列表
        const aiButtonContainer = form.createDiv({
            cls: "yuhanbo-ai-button-container",
            style: aiCheckbox.checked ? "display: block;" : "display: none;"
        });
        
        const generateButton = aiButtonContainer.createEl("button", {
            text: "生成子任务",
            type: "button",
            cls: "yuhanbo-secondary-button"
        });
        
        // 切换AI选项显示
        aiCheckbox.addEventListener("change", () => {
            this.useAI = aiCheckbox.checked;
            aiButtonContainer.style.display = this.useAI ? "block" : "none";
            
            // 如果取消选中，隐藏子任务容器
            if (!this.useAI) {
                aiSubtasksContainer.style.display = "none";
            }
        });
        
        // 生成子任务
        generateButton.addEventListener("click", async () => {
            const title = titleInput.value;
            const description = descInput.value;
            
            if (!title) {
                new Notice("请先输入任务标题和描述");
                return;
            }
            
            generateButton.disabled = true;
            generateButton.textContent = "正在生成...";
            
            try {
                const subTasks = await this.generateSubtasksWithAI(title, description);
                this.renderSubtasks(aiSubtasksContainer, subTasks);
            } catch (error) {
                console.error("生成子任务失败:", error);
                new Notice("生成子任务失败，请检查API设置或网络连接");
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = "生成子任务";
            }
        });
        
        // 新增：如果插件全局未启用 AI 功能，则禁用相关 UI 并提示
        if (!this.plugin.settings.aiEnabled) {
            aiCheckbox.disabled = true;
            generateButton.disabled = true;
            aiCheckboxContainer.createEl("div", {
                text: "AI 功能未启用，请在 设置→插件→yuhanbo-task 中开启",
                cls: "yuhanbo-ai-disabled-note"
            });
        }
        
        // 按钮容器
        const buttonContainer = form.createDiv({ cls: "yuhanbo-button-container" });
        
        // 保存按钮
        const saveButton = buttonContainer.createEl("button", { 
            text: "保存任务",
            type: "button",
            cls: "yuhanbo-primary-button"
        });
        
        // 取消按钮
        const cancelButton = buttonContainer.createEl("button", { 
            text: "取消",
            type: "button",
            cls: "yuhanbo-cancel-button"
        });
        
        // 绑定按钮事件
        saveButton.addEventListener("click", async () => {
            try {
                this.task.title = titleInput.value.trim();
                this.task.description = descInput.value.trim();
                this.task.type = typeSelect.value;
                
                if (!this.task.title) {
                new Notice("请输入任务标题");
                return;
            }
            
                // 记录任务初始状态
                console.log("准备保存任务: ", JSON.stringify(this.task));
                
                // 使用北京时间
                const bjNow = this.plugin.taskManager.getBJDate();
                
                if (!this.task.id) {
                    this.task.id = this.plugin.taskManager.generateTaskId();
                }
                
                this.task.progress = parseInt(progressInput.value || "0");
                this.task.dueDate = dueDateInput.value || bjNow.toISOString().split('T')[0];
                this.task.createdDate = bjNow.toISOString().split('T')[0];
                
                // 处理标签和子任务
                this.task.tags = tagsInput.value ? tagsInput.value.split(',').map(tag => tag.trim()) : [];
                this.task.subTasks = [];
                
                if (aiSubtasksContainer) {
                    const subtaskItems = aiSubtasksContainer.querySelectorAll('.yuhanbo-subtask-item');
                    if (subtaskItems && subtaskItems.length > 0) {
                        this.task.subTasks = Array.from(subtaskItems).map(item => {
                            const checkbox = item.querySelector('input[type="checkbox"]');
                            const text = item.querySelector('.yuhanbo-subtask-text').textContent;
                            return { text, completed: checkbox ? checkbox.checked : false };
                        });
                        console.log(`添加${this.task.subTasks.length}个子任务`);
                    }
                }
                
                // 处理周期相关属性
            if (this.task.type === "repeating") {
                    const cycleSelect = document.getElementById("task-cycle");
                    if (!cycleSelect) {
                        console.error("[TaskModal] 无法找到周期选择元素");
                        new Notice("创建任务失败：无法获取周期类型");
                        return;
                    }
                    
                    this.task.cycle = cycleSelect.value;
                    console.log(`[TaskModal] 设置任务周期: ${this.task.cycle}`);
                    
                    // 获取北京时间
                    const bjNow = this.plugin.taskManager.getBJDate();
                    
                    if (this.task.cycle === "weekly") {
                        // 获取周几选择控件
                        const weekdaySelect = document.getElementById("task-execute-date");
                        if (!weekdaySelect) {
                            console.error("[TaskModal] 无法找到周几选择元素");
                            new Notice("创建任务失败：无法获取周几设置");
                            return;
                        }
                        
                        // 获取选择的周几（0-6）
                        this.task.cyclePeriod = weekdaySelect.value;
                        const targetDay = parseInt(this.task.cyclePeriod);
                        
                        // 计算下一个执行日期
                        const currentDay = bjNow.getDay(); // 0-6
                        let daysToAdd = (targetDay - currentDay + 7) % 7;
                        if (daysToAdd === 0) daysToAdd = 7; // 如果是今天，则设为下周
                            
                        const execDate = new Date(bjNow);
                        execDate.setDate(bjNow.getDate() + daysToAdd);
                            this.task.executeDate = execDate.toISOString().split('T')[0];
                            
                        console.log(`[TaskModal] 每周任务设置 - 当前: ${this.plugin.taskManager.getWeekdayName(currentDay)}, ` +
                                  `目标: ${this.plugin.taskManager.getWeekdayName(targetDay)}, ` +
                                  `相差天数: ${daysToAdd}, ` +
                                  `下次执行: ${this.task.executeDate}`);
                        
                    } else if (this.task.cycle === "monthly") {
                        // 获取每月几号选择控件
                        const daySelect = document.getElementById("task-execute-date");
                        if (!daySelect) {
                            console.error("[TaskModal] 无法找到每月几号选择元素");
                            new Notice("创建任务失败：无法获取每月几号设置");
                            return;
                        }
                        
                        this.task.cyclePeriod = daySelect.value;
                        const targetDay = parseInt(this.task.cyclePeriod);
                            
                        // 计算下一个执行日期
                        const currentMonth = bjNow.getMonth();
                        const currentYear = bjNow.getFullYear();
                        
                        // 如果本月的这一天已过，计算下个月的日期
                        const currentDate = bjNow.getDate();
                        let execMonth = currentMonth;
                        let execYear = currentYear;
                        
                        if (targetDay < currentDate) {
                            execMonth++;
                            if (execMonth > 11) {
                                execMonth = 0;
                                execYear++;
                            }
                        }
                        
                        // 创建执行日期
                        const execDate = new Date(execYear, execMonth, targetDay);
                        
                        // 处理无效日期（如2月30日）
                        if (execDate.getMonth() !== execMonth) {
                            console.log(`${execMonth + 1}月没有${targetDay}号，调整到月末`);
                            execDate.setDate(0); // 设置为上个月的最后一天
                        }
                        
                            this.task.executeDate = execDate.toISOString().split('T')[0];
                        
                        console.log(`[TaskModal] 每月任务设置 - 执行日期: ${targetDay}号, 下次执行: ${this.task.executeDate}`);
                        
                    } else if (this.task.cycle === "yearly") {
                        // 获取月份和日期选择控件
                        const monthSelect = document.getElementById("task-execute-date-month");
                        const daySelect = document.getElementById("task-execute-date-day");
                        
                        if (!monthSelect || !daySelect) {
                            console.error("[TaskModal] 无法找到年度任务日期选择元素");
                            new Notice("创建任务失败：无法获取年度任务日期设置");
                            return;
                        }
                        
                        const month = parseInt(monthSelect.value);
                        const day = parseInt(daySelect.value);
                        
                            this.task.cyclePeriod = `${month}-${day}`;
                            
                        // 计算下一个执行日期
                        const currentDate = bjNow.getDate();
                        const currentMonth = bjNow.getMonth() + 1; // 1-12
                        const currentYear = bjNow.getFullYear();
                        
                        let execYear = currentYear;
                        
                        // 如果今年的执行日期已过，设为明年
                        if (month < currentMonth || (month === currentMonth && day < currentDate)) {
                            execYear++;
                        }
                        
                        // 创建执行日期
                        const execDate = new Date(execYear, month - 1, day);
                        
                        // 处理无效日期
                        if (execDate.getMonth() !== month - 1) {
                            console.log(`${month}月没有${day}号，调整到月末`);
                            execDate.setMonth(month); // 设置为下个月
                            execDate.setDate(0); // 回到上个月的最后一天
                        }
                        
                            this.task.executeDate = execDate.toISOString().split('T')[0];
                        
                        console.log(`[TaskModal] 每年任务设置 - 执行日期: ${month}月${day}日, 下次执行: ${this.task.executeDate}`);
                        
                    } else if (this.task.cycle === "daily") {
                        // 每日任务不需要周期单位
                            this.task.cyclePeriod = null;
                        
                        // 执行日期设为明天
                        const tomorrow = new Date(bjNow);
                        tomorrow.setDate(bjNow.getDate() + 1);
                        this.task.executeDate = tomorrow.toISOString().split('T')[0];
                        
                        console.log(`[TaskModal] 每日任务设置 - 下次执行: ${this.task.executeDate}`);
                    }
                } else {
                    // 一次性任务
                    console.log("[TaskModal] 设置一次性任务");
                    this.task.type = "oneTime"; // 强制设置类型
                this.task.cycle = null;
                this.task.cyclePeriod = null;
                this.task.executeDate = null;
                    console.log(`[TaskModal] 一次性任务设置 - 截止日期: ${this.task.dueDate}`);
            }
            
                // 保存任务
                console.log('[TaskModal] 准备保存任务:', JSON.stringify(this.task));
                new Notice("正在保存任务...");
                
                try {
                const createdTask = await this.plugin.taskManager.addTask(this.task);
                    if (!createdTask) {
                        throw new Error("任务创建失败，未返回有效的任务对象");
                    }
                
                new Notice(`任务 "${this.task.title}" 已创建！`);
                    this.close();
                if (this.onTaskCreated) {
                    this.onTaskCreated(createdTask);
                    }
                } catch (saveError) {
                    console.error("[TaskModal] 保存任务失败:", saveError);
                    new Notice(`保存任务失败: ${saveError.message}`);
                }
            } catch (error) {
                console.error("[TaskModal] 创建任务时出错:", error);
                new Notice(`创建任务失败: ${error.message}`);
            }
        });
        
        // 显示/隐藏周期选择
        typeSelect.addEventListener("change", () => {
            if (typeSelect.value === "repeating") {
                // 插入周期选择组到表单中，放在任务类型之后
                typeGroup.after(cycleGroup);
                // 触发周期变化事件，显示对应的执行日期选择
                if (cycleSelect) {
                    cycleSelect.dispatchEvent(new Event('change'));
                }
            } else {
                // 移除周期选择组和执行日期组
                if (cycleGroup.parentNode) {
                    cycleGroup.remove();
                }
                if (executeDateGroup && executeDateGroup.parentNode) {
                    executeDateGroup.remove();
                }
            }
        });
        
        cancelButton.addEventListener("click", () => {
            this.close();
        });
    }
    
    async generateSubtasksWithAI(title, description) {
        if (!this.plugin.settings.apiKey) {
            throw new Error("未设置API密钥");
        }
        
        let prompt = `请将以下任务拆分为具体的子任务步骤（最多10个）：\n\n任务标题：${title}\n任务描述：${description}`;
        
        // 如果有自定义提示词文件，读取并使用
        if (this.plugin.settings.promptFilePath) {
            try {
                const promptContent = await this.app.vault.adapter.read(this.plugin.settings.promptFilePath);
                if (promptContent) {
                    prompt = promptContent.replace("{title}", title).replace("{description}", description);
                }
            } catch (error) {
                console.error("读取提示词文件失败:", error);
            }
        }
        
        // 调用DeepSeek API
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.plugin.settings.apiKey}`
            },
            body: JSON.stringify({
                model: this.plugin.settings.aiModel,
                messages: [
                    {
                        role: "system",
                        content: "你是一个任务分解专家，善于将复杂任务拆分为具体可执行的步骤。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // 解析返回的内容，提取子任务
        const subtasks = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            // 匹配列表项，例如 "1. 完成任务" 或 "- 完成任务"
            const match = line.match(/^(?:[\d-]+\.|\-)\s+(.+)$/);
            if (match) {
                subtasks.push({
                    text: match[1],
                    completed: false
                });
            }
        }
        
        return subtasks;
    }
    
    renderSubtasks(container, subtasks) {
        container.empty();
        container.style.display = "block";
        
        if (!subtasks || subtasks.length === 0) {
            container.createEl("p", { text: "未生成任何子任务" });
            return;
        }
        
        container.createEl("h4", { text: "AI生成的子任务:" });
        
        const subtasksList = container.createEl("div", { cls: "yuhanbo-subtasks-list" });
        
        for (const subtask of subtasks) {
            const subtaskItem = subtasksList.createEl("div", { cls: "yuhanbo-subtask-item" });
            
            const checkbox = subtaskItem.createEl("input", {
                type: "checkbox",
                checked: subtask.completed,
                cls: "yuhanbo-subtask-checkbox"
            });
            
            subtaskItem.createEl("span", { 
                text: subtask.text, 
                cls: "yuhanbo-subtask-text" 
            });
        }
    }
    
    // 辅助函数：获取星期几的中文名称
    getWeekdayName(dayNumber) {
        const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        return weekdays[dayNumber] || `未知(${dayNumber})`;
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 任务列表弹窗
class TaskListModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.app = app;
        this.plugin = plugin;
        this.activeTab = "repeating"; // 默认显示重复性任务
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("yuhanbo-task-list-modal");
        
        contentEl.createEl("h2", { text: "任务列表" });
        
        // 创建标签页
        const tabContainer = contentEl.createDiv({ cls: "yuhanbo-tab-container" });
        
        const repeatingTab = tabContainer.createEl("button", {
            text: "重复性任务",
            cls: "yuhanbo-tab-button yuhanbo-active-tab"
        });
        
        const oneTimeTab = tabContainer.createEl("button", {
            text: "一次性任务",
            cls: "yuhanbo-tab-button"
        });
        
        const completedTab = tabContainer.createEl("button", {
            text: "已完成任务",
            cls: "yuhanbo-tab-button"
        });
        
        // 任务列表容器
        const taskListContainer = contentEl.createDiv({ cls: "yuhanbo-task-list-container" });
        
        // 加载默认标签页内容
        this.renderTaskList(taskListContainer, this.activeTab);
        
        // 标签页切换
        repeatingTab.addEventListener("click", () => {
            this.activeTab = "repeating";
            this.setActiveTab(tabContainer, repeatingTab);
            this.renderTaskList(taskListContainer, this.activeTab);
        });
        
        oneTimeTab.addEventListener("click", () => {
            this.activeTab = "oneTime";
            this.setActiveTab(tabContainer, oneTimeTab);
            this.renderTaskList(taskListContainer, this.activeTab);
        });
        
        completedTab.addEventListener("click", () => {
            this.activeTab = "completed";
            this.setActiveTab(tabContainer, completedTab);
            this.renderTaskList(taskListContainer, this.activeTab);
        });
        
        // 添加任务按钮
        const addButton = contentEl.createEl("button", {
            text: "添加新任务",
            cls: "yuhanbo-primary-button yuhanbo-add-button"
        });
        
        addButton.addEventListener("click", () => {
            new TaskModal(this.app, this.plugin, () => {
                // 刷新任务列表
                this.renderTaskList(taskListContainer, this.activeTab);
            }).open();
        });
    }
    
    setActiveTab(container, activeButton) {
        // 移除所有标签页的活动状态
        const tabs = container.querySelectorAll(".yuhanbo-tab-button");
        tabs.forEach(tab => tab.removeClass("yuhanbo-active-tab"));
        
        // 设置当前标签页为活动状态
        activeButton.addClass("yuhanbo-active-tab");
    }
    
    renderTaskList(container, taskType) {
        container.empty();
        
        let tasks = [];
        
        switch (taskType) {
            case "repeating":
                tasks = this.plugin.taskManager.tasks.repeating;
                // 过滤重复性任务：只显示当期应该执行的任务
                tasks = this.filterRepeatingTasks(tasks);
                break;
            case "oneTime":
                tasks = this.plugin.taskManager.tasks.oneTime;
                break;
            case "completed":
                tasks = this.plugin.taskManager.tasks.completed;
                break;
        }
        
        if (tasks.length === 0) {
            container.createEl("p", { 
                text: "没有任务", 
                cls: "yuhanbo-no-tasks" 
            });
            return;
        }
        
        // 创建任务列表
        const taskList = container.createEl("div", { cls: "yuhanbo-task-list" });
        
        for (const task of tasks) {
            const taskItem = taskList.createEl("div", { cls: "yuhanbo-task-item" });
            
            // 任务信息
            const taskInfo = taskItem.createEl("div", { cls: "yuhanbo-task-info" });
            taskInfo.createEl("div", { text: task.title, cls: "yuhanbo-task-title" });
            
            // 任务元数据
            const taskMeta = taskInfo.createEl("div", { cls: "yuhanbo-task-meta" });
            
            if (task.dueDate) {
                taskMeta.createEl("span", { 
                    text: `截止: ${task.dueDate}`, 
                    cls: "yuhanbo-task-due-date" 
                });
            }
            
            // 只有重复性任务且非每日任务才显示执行日期
            if (task.type === "repeating" && 
                task.cycle !== "daily" && 
                task.executeDate && this.plugin.settings.showRemainingDays) {
                // 计算剩余天数
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const executeDate = new Date(task.executeDate);
                executeDate.setHours(0, 0, 0, 0);
                
                const diffTime = executeDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let remainingText = "";
                if (diffDays > 0) {
                    remainingText = `执行: ${task.executeDate} (还有${diffDays}天)`;
                } else if (diffDays === 0) {
                    remainingText = `执行: 今天`;
                } else {
                    remainingText = `执行: ${task.executeDate} (已过期${Math.abs(diffDays)}天)`;
                }
                
                taskMeta.createEl("span", { 
                    text: remainingText, 
                    cls: "yuhanbo-task-execute-date" 
                });
            } else if (task.type === "repeating" && 
                       task.cycle !== "daily" && task.executeDate) {
                taskMeta.createEl("span", { 
                    text: `执行: ${task.executeDate}`, 
                    cls: "yuhanbo-task-execute-date" 
                });
            }
            
            taskMeta.createEl("span", { 
                text: `进度: ${task.progress}%`, 
                cls: "yuhanbo-task-progress" 
            });
            
            // 任务类型和周期
            const taskTypeInfo = taskInfo.createEl("div", { cls: "yuhanbo-task-type" });
            
            taskTypeInfo.createEl("span", { 
                text: task.type === "repeating" ? "重复任务" : "一次性任务", 
                cls: "yuhanbo-task-type-badge" 
            });
            
            if (task.cycle) {
                taskTypeInfo.createEl("span", { 
                    text: this.plugin.taskManager.getCycleNameFromCycle(task.cycle), 
                    cls: "yuhanbo-task-cycle-badge" 
                });
            }
            
            // 操作按钮
            const actionContainer = taskItem.createEl("div", { cls: "yuhanbo-task-actions" });
            
            // 详细按钮（所有任务都显示）
            const detailButton = actionContainer.createEl("button", {
                text: "详细",
                cls: "yuhanbo-detail-button"
            });
            
            detailButton.addEventListener("click", () => {
                this.showTaskDetails(task);
            });
            
            // 未完成任务才显示操作按钮
            if (taskType !== "completed") {
                // 完成按钮
                const completeButton = actionContainer.createEl("button", {
                    text: "完成",
                    cls: "yuhanbo-complete-button"
                });
                
                completeButton.addEventListener("click", async () => {
                    await this.plugin.taskManager.updateTask(task.id, {
                        progress: 100,
                        isCompleted: true
                    });
                    
                    new Notice(`任务 "${task.title}" 已完成！`);
                    this.renderTaskList(container, this.activeTab);
                });
                
                // 编辑按钮
                const editButton = actionContainer.createEl("button", {
                    text: "编辑",
                    cls: "yuhanbo-edit-button"
                });
                
                editButton.addEventListener("click", () => {
                    new TaskProgressModal(this.app, this.plugin, task, () => {
                        // 刷新任务列表
                        this.renderTaskList(container, this.activeTab);
                    }).open();
                });
            }
            
            // 删除按钮
            const deleteButton = actionContainer.createEl("button", {
                text: "删除",
                cls: "yuhanbo-delete-button"
            });
            
            deleteButton.addEventListener("click", async () => {
                const confirmed = await this.confirmDelete(task.title);
                
                if (confirmed) {
                    await this.plugin.taskManager.deleteTask(task.id);
                    this.renderTaskList(container, this.activeTab);
                    new Notice(`任务 "${task.title}" 已删除`);
                }
            });
        }
    }
    
    /**
     * 显示任务详细信息的模态框
     * @param {Object} task - 任务对象
     */
    showTaskDetails(task) {
        const modal = new Modal(this.app);
        modal.contentEl.addClass("yuhanbo-task-detail-modal");
        
        // 标题
        modal.contentEl.createEl("h2", { text: task.title });
        
        // 基本信息
        const infoContainer = modal.contentEl.createDiv({ cls: "yuhanbo-task-detail-info" });
        
        // 任务类型
        infoContainer.createEl("p", { 
            text: `类型: ${task.type === "repeating" ? "重复任务" : "一次性任务"}` 
        });
        
        // 周期信息（重复任务）
        if (task.type === "repeating" && task.cycle) {
            infoContainer.createEl("p", { 
                text: `周期: ${this.plugin.taskManager.getCycleNameFromCycle(task.cycle)}` 
            });
        }
        
        // 进度
        infoContainer.createEl("p", { text: `进度: ${task.progress}%` });
        
        // 创建日期
        if (task.createdDate) {
            infoContainer.createEl("p", { text: `创建日期: ${task.createdDate}` });
        }
        
        // 截止日期
        if (task.dueDate) {
            infoContainer.createEl("p", { text: `截止日期: ${task.dueDate}` });
        }
        
        // 执行日期（重复任务）
        if (task.type === "repeating" && task.executeDate) {
            infoContainer.createEl("p", { text: `执行日期: ${task.executeDate}` });
        }
        
        // 标签
        if (task.tags && task.tags.length > 0) {
            const tagsText = task.tags.map(tag => `#${tag}`).join(" ");
            infoContainer.createEl("p", { text: `标签: ${tagsText}` });
        }
        
        // 描述
        if (task.description && task.description.trim()) {
            modal.contentEl.createEl("h3", { text: "描述" });
            const descContainer = modal.contentEl.createDiv({ cls: "yuhanbo-task-description" });
            descContainer.createEl("p", { text: task.description });
        }
        
        // 子任务
        if (task.subTasks && task.subTasks.length > 0) {
            modal.contentEl.createEl("h3", { text: "子任务" });
            const subTasksContainer = modal.contentEl.createDiv({ cls: "yuhanbo-subtasks-container" });
            
            task.subTasks.forEach(subTask => {
                const subTaskItem = subTasksContainer.createDiv({ cls: "yuhanbo-subtask-item" });
                const checkbox = subTask.completed ? "☑" : "☐";
                subTaskItem.createEl("span", { text: `${checkbox} ${subTask.text}` });
            });
        }
        
        // 关闭按钮
        const buttonContainer = modal.contentEl.createDiv({ cls: "yuhanbo-button-container" });
        const closeButton = buttonContainer.createEl("button", {
            text: "关闭",
            cls: "yuhanbo-secondary-button"
        });
        
        closeButton.addEventListener("click", () => {
            modal.close();
        });
        
        modal.open();
    }

    // 过滤重复性任务：只显示当期应该执行的任务
    filterRepeatingTasks(tasks) {
        const today = this.plugin.taskManager.getBJDate();
        const todayStr = today.toISOString().split('T')[0];
        
        return tasks.filter(task => {
            // 检查截止日期，如果已过期则不显示
            if (task.dueDate && task.dueDate < todayStr) {
                console.log(`【调试】重复性任务 "${task.title}" 已过截止日期 ${task.dueDate}，不显示`);
                return false;
            }
            
            // 检查执行日期
            if (!task.executeDate) {
                console.log(`【调试】重复性任务 "${task.title}" 没有执行日期，显示`);
                return true;
            }
            
            const executeDate = task.executeDate;
            
            switch (task.cycle) {
                case "daily":
                    // 每日任务：只在当天显示
                    const shouldShowDaily = executeDate <= todayStr;
                    console.log(`【调试】每日任务 "${task.title}" 执行日期: ${executeDate}, 今天: ${todayStr}, 显示: ${shouldShowDaily}`);
                    return shouldShowDaily;
                    
                case "weekly":
                    // 每周任务：只在执行日期当天显示
                    const shouldShowWeekly = executeDate === todayStr;
                    console.log(`【调试】每周任务 "${task.title}" 执行日期: ${executeDate}, 今天: ${todayStr}, 显示: ${shouldShowWeekly}`);
                    return shouldShowWeekly;
                    
                case "monthly":
                    // 每月任务：只在执行日期当天显示
                    const shouldShowMonthly = executeDate === todayStr;
                    console.log(`【调试】每月任务 "${task.title}" 执行日期: ${executeDate}, 今天: ${todayStr}, 显示: ${shouldShowMonthly}`);
                    return shouldShowMonthly;
                    
                case "yearly":
                    // 每年任务：只在执行日期当天显示
                    const shouldShowYearly = executeDate === todayStr;
                    console.log(`【调试】每年任务 "${task.title}" 执行日期: ${executeDate}, 今天: ${todayStr}, 显示: ${shouldShowYearly}`);
                    return shouldShowYearly;
                    
                default:
                    console.log(`【调试】未知周期类型 "${task.cycle}"，默认显示任务 "${task.title}"`);
                    return true;
            }
        });
    }

    async confirmDelete(taskTitle) {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            
            modal.contentEl.createEl("h3", { text: "确认删除" });
            modal.contentEl.createEl("p", { text: `确定要删除任务 "${taskTitle}" 吗？` });
            
            const buttonContainer = modal.contentEl.createDiv({ cls: "yuhanbo-button-container" });
            
            const confirmButton = buttonContainer.createEl("button", {
                text: "确认",
                cls: "yuhanbo-delete-button"
            });
            
            const cancelButton = buttonContainer.createEl("button", {
                text: "取消",
                cls: "yuhanbo-secondary-button"
            });
            
            confirmButton.addEventListener("click", () => {
                modal.close();
                resolve(true);
            });
            
            cancelButton.addEventListener("click", () => {
                modal.close();
                resolve(false);
            });
            
            modal.open();
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = YuhanboTaskPlugin;


