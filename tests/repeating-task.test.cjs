const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 执行实际插件源码，仅替换 Obsidian 宿主和文件系统，不改写业务方法。
const source = process.env.TASK_PLUGIN_SOURCE
    ? fs.readFileSync(process.env.TASK_PLUGIN_SOURCE, 'utf8')
    : fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const sandbox = {
    require: () => ({ Plugin: class {}, Notice: class {}, PluginSettingTab: class {},
        Setting: class {}, Modal: class {}, normalizePath: value => value }),
    module: { exports: {} }, console: { log() {}, warn() {}, error() {} },
    Date, Map, Set, setTimeout, clearTimeout
};
vm.runInNewContext(source + '\nmodule.exports = { TaskManager, TaskListModal };', sandbox);
const { TaskManager, TaskListModal } = sandbox.module.exports;

function setup(today = '2026-09-28', overrides = {}) {
    const files = new Map();
    const vault = {
        adapter: {
            exists: async p => files.has(p), read: async p => files.get(p),
            write: async (p, text) => files.set(p, text),
            append: async (p, text) => files.set(p, (files.get(p) || '') + text)
        },
        create: async (p, text) => files.set(p, text),
        createFolder: async p => files.set(p, '')
    };
    const manager = new TaskManager({ app: { vault }, settings: {
        repeatingTasksPath: 'Repeating', oneTimeTasksPath: 'OneTime', completedTasksPath: 'Completed'
    } });
    manager.getBJDate = () => new Date(`${today}T12:00:00`);
    const task = { id: 'monthly-loan', title: '还款测试', type: 'repeating', cycle: 'monthly',
        cyclePeriod: '24', executeDate: '2026-09-24', dueDate: '2026-12-24',
        createdDate: '2026-02-05', progress: 0, isCompleted: false, status: 'active',
        subTasks: [{ text: '检查本期账单', completed: false }], ...overrides };
    manager.tasks.repeating.push(task);
    return { manager, task, files };
}

test('晚四天完成只归档本期，原任务保留到下一期且子任务快照独立', async () => {
    const { manager, task, files } = setup();
    await manager.updateTask(task.id, { progress: 100, isCompleted: true });
    assert.equal(manager.tasks.repeating.length, 1);
    assert.equal(task.executeDate, '2026-10-24');
    assert.equal(task.dueDate, '2026-12-24');
    assert.equal(task.isCompleted, false);
    assert.equal(task.progress, 0);
    assert.equal(task.subTasks[0].completed, false);
    const history = manager.tasks.completed[0];
    assert.equal(history.currentPeriod, '2026-09-24');
    assert.equal(history.completedDate, '2026-09-28');
    assert.equal(history.subTasks[0].completed, true);
    assert.match(files.get('Repeating/repeating_monthly.md'), /- \[ \] 还款测试/);
    const archived = manager.parseTasksFromFile(files.get('Completed/completed_2026-09-28.md'), null, true)[0];
    assert.equal(archived.completedDate, '2026-09-28');
    assert.equal(archived.currentPeriod, '2026-09-24');
    assert.equal(manager.tasks.completed.length, 1);
});

test('编辑进度至 100% 与完成按钮具有相同的本期语义', async () => {
    const { manager, task } = setup();
    await manager.updateTask(task.id, { progress: 100, isCompleted: false });
    assert.equal(task.progress, 0);
    assert.equal(task.executeDate, '2026-10-24');
    assert.equal(manager.tasks.completed.length, 1);
});

test('连续和并发重复点击不会跳过下一期或重复归档', async () => {
    const { manager, task } = setup();
    await Promise.all([manager.updateTask(task.id, { isCompleted: true }), manager.updateTask(task.id, { isCompleted: true })]);
    await manager.updateTask(task.id, { isCompleted: true });
    assert.equal(task.executeDate, '2026-10-24');
    assert.equal(manager.tasks.completed.length, 1);
});

for (const [name, today, overrides, expected] of [
    ['修正历史漂移的28日', '2026-10-02', { executeDate: '2026-09-28' }, '2026-10-24'],
    ['长期逾期待办保留固定日', '2026-11-16', {}, '2026-11-24'],
    ['月末收敛至二月末', '2026-01-31', { cyclePeriod: '31', executeDate: '2026-01-31' }, '2026-02-28'],
    ['三月恢复31日', '2026-02-28', { cyclePeriod: '31', executeDate: '2026-02-28' }, '2026-03-31'],
    ['跨年', '2026-12-24', { executeDate: '2026-12-24' }, '2027-01-24'],
    ['每周固定周一', '2026-09-30', { cycle: 'weekly', cyclePeriod: '1', executeDate: '2026-09-28' }, '2026-10-05'],
    ['每周周日支持0', '2026-09-28', { cycle: 'weekly', cyclePeriod: '0', executeDate: '2026-09-27' }, '2026-10-04'],
    ['每年固定月日', '2026-09-28', { cycle: 'yearly', cyclePeriod: '9-24' }, '2027-09-24'],
    ['闰日次年落月底', '2028-02-29', { cycle: 'yearly', cyclePeriod: '2-29', executeDate: '2028-02-29' }, '2029-02-28'],
    ['每日次日', '2026-09-28', { cycle: 'daily', cyclePeriod: null }, '2026-09-29']
]) {
    test(name, async () => {
        const { manager, task } = setup(today, overrides);
        await manager.updateTask(task.id, { isCompleted: true });
        assert.equal(task.executeDate, expected);
        assert.equal(task.isCompleted, false);
    });
}

test('最终截止日前和当日不清理，次日才结束重复任务', async () => {
    const { manager, task } = setup('2026-12-24', { executeDate: '2026-12-24' });
    await manager.updateTask(task.id, { isCompleted: true });
    assert.equal(await manager.cleanupExpiredRepeatingTasks(), 0);
    manager.getBJDate = () => new Date('2026-12-25T12:00:00');
    assert.equal(await manager.cleanupExpiredRepeatingTasks(), 1);
});

test('下一期到期后重新出现，列表与番茄钟选择一致', async () => {
    const { manager, task } = setup();
    await manager.updateTask(task.id, { isCompleted: true });
    assert.equal(manager.getAllActiveTasks().length, 0);
    assert.equal(TaskListModal.prototype.filterRepeatingTasks.call({ plugin: { taskManager: manager } }, [task]).length, 0);
    manager.getBJDate = () => new Date('2026-10-24T12:00:00');
    manager.tasks.completed = [];
    assert.equal(manager.getAllActiveTasks().length, 1);
    assert.equal(TaskListModal.prototype.filterRepeatingTasks.call({ plugin: { taskManager: manager } }, [task]).length, 1);
});

test('旧版日归档从标题恢复完成日，执行日期恢复本期期次', () => {
    const { manager, task } = setup();
    const md = '# 已完成任务 - 2026-10-02\n\n' + manager.formatTaskToMarkdown({ ...task, progress: 100, isCompleted: true });
    const parsed = manager.parseTasksFromFile(md, null, true)[0];
    assert.equal(parsed.completedDate, '2026-10-02');
    assert.equal(parsed.currentPeriod, '2026-09-24');
});

test('一次性任务仍在完成后移至归档', async () => {
    const { manager, task } = setup('2026-09-28', { type: 'oneTime' });
    manager.tasks.repeating = [];
    manager.tasks.oneTime = [task];
    await manager.updateTask(task.id, { progress: 100, isCompleted: true });
    assert.equal(manager.tasks.oneTime.length, 0);
    assert.equal(task.isCompleted, true);
    assert.equal(manager.tasks.completed[0].completedDate, '2026-09-28');
});

test('北京时间零点日历日期不退回前一天', () => {
    const { manager } = setup();
    manager.getBJDate = () => new Date(2026, 8, 28, 0, 5);
    assert.equal(manager.getBJDateString(), '2026-09-28');
});

test('零点完成后使用北京时间归档', async () => {
    const { manager, task } = setup();
    manager.getBJDate = () => new Date(2026, 8, 28, 0, 5);
    await manager.updateTask(task.id, { isCompleted: true });
    assert.equal(manager.tasks.completed.length, 1);
    assert.equal(manager.tasks.completed[0].completedDate, '2026-09-28');
});

test('创建每月24日任务不会因本地零点转UTC退成23日', async () => {
    const { manager, task } = setup('2026-02-05');
    await manager.handleMonthlyTask(task);
    assert.equal(task.executeDate, '2026-02-24');
});

test('不同重复任务同时完成时各自写入正确的归档快照', async () => {
    const { manager, task, files } = setup();
    const other = { ...task, id: 'another', title: '另一个任务', subTasks: [] };
    manager.tasks.repeating.push(other);
    await Promise.all([manager.updateTask(task.id, { isCompleted: true }), manager.updateTask(other.id, { isCompleted: true })]);
    const archived = manager.parseTasksFromFile(files.get('Completed/completed_2026-09-28.md'), null, true);
    assert.equal(archived.length, 2);
    assert.equal(new Set(archived.map(t => t.id)).size, 2);
});
