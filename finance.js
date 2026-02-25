/* ============================================================
finance.js — 使用 common.js 公共模块后的精简版（Supabase 版最终整合）
============================================================ */

let accountList = [];
let projectNameList = [];

/* ============================================================
一、数据 key 与旧数据迁移
============================================================ */

const KEY_DAILY = "finance_daily";
const KEY_PAYROLL = "finance_payroll";
const KEY_PROJECT = "finance_project";

const OLD_KEY_DAILY = "dailyExpenses";
const OLD_KEY_PAYROLL = "payrollList";
const OLD_KEY_PROJECT = "projectExpenses";

function migrateOldData() {
    const migrate = (oldKey, newKey) => {
        const old = localStorage.getItem(oldKey);
        if (old) {
            localStorage.setItem(newKey, old);
            localStorage.removeItem(oldKey);
        }
    };
    migrate(OLD_KEY_DAILY, KEY_DAILY);
    migrate(OLD_KEY_PAYROLL, KEY_PAYROLL);
    migrate(OLD_KEY_PROJECT, KEY_PROJECT);
}

/* ============================================================
二、数据加载 / 保存 / 默认字段
============================================================ */

let dailyList = [];
let payrollList = [];
let projectList = [];

/* 从 Supabase 加载三大模块数据 */
async function loadFinanceData() {
    const supabase = window.supabaseClient;

    // 报销 finance_daily
    {
        const { data, error } = await supabase
            .from("finance_daily")
            .select("*")
            .order("date", { ascending: false });

        if (error) {
            console.error("加载 finance_daily 失败", error);
            dailyList = [];
        } else {
            dailyList = (data || []).map(row => ({
                id: row.id,
                date: row.date,
                project: row.project,
                item: row.item,
                amount: Number(row.amount || 0),
                payer: row.payer,
                remark: row.remark,
                auditStatus: row.audit_status || "未审",
                cashierStatus: row.cashier_status || "未发",
                logs: Array.isArray(row.logs) ? row.logs : (row.logs || [])
            }));
        }
    }

    // 工资 finance_payroll
    {
        const { data, error } = await supabase
            .from("finance_payroll")
            .select("*")
            .order("month", { ascending: false });

        if (error) {
            console.error("加载 finance_payroll 失败", error);
            payrollList = [];
        } else {
            payrollList = (data || []).map(row => ({
                id: row.id,
                month: row.month,
                name: row.name,
                base: Number(row.base || 0),
                position: Number(row.position || 0),
                perf: Number(row.perf || 0),
                bonus: Number(row.bonus || 0),
                pc: Number(row.pc || 0),
                traffic: Number(row.traffic || 0),
                other: Number(row.other || 0),
                actual: Number(row.actual || 0),
                remark: row.remark,
                auditStatus: row.audit_status || "未审",
                cashierStatus: row.cashier_status || "未发",
                logs: Array.isArray(row.logs) ? row.logs : (row.logs || [])
            }));
        }
    }

    // 项目支出 finance_project
    {
        const { data, error } = await supabase
            .from("finance_project")
            .select("*")
            .order("date", { ascending: false });

        if (error) {
            console.error("加载 finance_project 失败", error);
            projectList = [];
        } else {
            projectList = (data || []).map(row => ({
                id: row.id,
                date: row.date,
                project: row.project,
                item: row.item,
                amount: Number(row.amount || 0),
                payer: row.payer,
                remark: row.remark,
                auditStatus: row.audit_status || "未审",
                cashierStatus: row.cashier_status || "未发",
                logs: Array.isArray(row.logs) ? row.logs : (row.logs || [])
            }));
        }
    }

    // 兼容旧数据
    patchAllRecords();
}

// Supabase 版不再用 localStorage，这里保留空实现占位
function saveFinanceData() {}

function patchRecordDefaults(list) {
    return list.map(e => ({
        auditStatus: e.auditStatus || "未审",
        cashierStatus: e.cashierStatus || "未发",
        logs: Array.isArray(e.logs) ? e.logs : [],
        ...e
    }));
}

function patchAllRecords() {
    dailyList = patchRecordDefaults(dailyList);
    payrollList = patchRecordDefaults(payrollList);
    projectList = patchRecordDefaults(projectList);
}

/* ============================================================
三、通用工具
============================================================ */

function fmtMoney(n) {
    const x = Number(n || 0);
    return isNaN(x)
        ? "0.00"
        : x.toLocaleString("zh-CN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
          });
}

let currentModule = "daily";

function getListByModule(module) {
    return module === "daily"
        ? dailyList
        : module === "payroll"
        ? payrollList
        : projectList;
}

/* ============================================================
统一排序：按日期/月份倒序（最新在最上）
============================================================ */
function sortFinanceList(list, module) {
    return [...list].sort((a, b) => {
        let da, db;

        if (module === "payroll") {
            da = new Date(a.month || 0).getTime();
            db = new Date(b.month || 0).getTime();
        } else {
            da = new Date(a.date || 0).getTime();
            db = new Date(b.date || 0).getTime();
        }

        return db - da;
    });
}

/* ============================================================
从订单系统加载项目名称（orders.name）
============================================================ */
async function loadProjectNamesFromSupabase() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("orders")
        .select("name, completed")
        .order("start_date", { ascending: false });

    if (error) {
        console.error("加载订单项目名称失败：", error);
        projectNameList = [];
        return;
    }

    projectNameList = data
        .filter(r => !r.completed)
        .map(r => r.name)
        .filter(Boolean);
}

/* ============================================================
四、状态机 + 日志
============================================================ */

function getState(r) {
    if (r.cashierStatus === "已发") return "已发";
    if (r.auditStatus === "拒绝") return "拒绝";
    if (r.auditStatus === "已审") return "已审";
    return "未审";
}

function addLog(record, action) {
    record.logs = record.logs || [];
    const user = Auth.currentUser?.username || "未知账号";
    const name = document.getElementById("userName")?.innerText || "未知人员";

    record.logs.push({
        time: new Date().toLocaleString(),
        action,
        user,
        name
    });
}

/* ============================================================
审核 / 拒绝 / 完成
============================================================ */

async function doRejectAction(module, index) {
    const list = getListByModule(module);
    const r = list[index];
    const state = getState(r);

    let table = "";
    if (module === "daily") table = "finance_daily";
    if (module === "payroll") table = "finance_payroll";
    if (module === "project") table = "finance_project";

    const supabase = window.supabaseClient;
    const record = { ...r, logs: r.logs || [] };

    if (state === "未审") {
        record.auditStatus = "拒绝";
        addLog(record, "拒绝");
    } else if (state === "拒绝") {
        record.auditStatus = "未审";
        addLog(record, "取消拒绝");
    } else {
        return;
    }

    const { error } = await supabase
        .from(table)
        .update({
            audit_status: record.auditStatus,
            logs: record.logs
        })
        .eq("id", r.id);

    if (error) {
        console.error("更新拒绝状态失败", error);
        alert("更新拒绝状态失败，请检查表结构或网络");
        return;
    }

    await loadFinanceData();
    renderFinance();
}

async function doApproveAction(module, index) {
    const list = getListByModule(module);
    const r = list[index];
    const state = getState(r);

    let table = "";
    if (module === "daily") table = "finance_daily";
    if (module === "payroll") table = "finance_payroll";
    if (module === "project") table = "finance_project";

    const supabase = window.supabaseClient;
    const record = { ...r, logs: r.logs || [] };

    if (state === "未审" || state === "拒绝") {
        record.auditStatus = "已审";
        addLog(record, "审核通过");

        const { error } = await supabase
            .from(table)
            .update({
                audit_status: record.auditStatus,
                logs: record.logs
            })
            .eq("id", r.id);

        if (error) {
            console.error("审核失败", error);
            alert("审核失败，请检查表结构或网络");
            return;
        }

        await loadFinanceData();
        renderFinance();
        return;
    }

    if (state === "已审") {
        Confirm.open({
            modalId: "confirmModal",
            textId: "confirmMessage",
            text: "确定取消审核？",
            async onConfirm() {
                record.auditStatus = "未审";
                addLog(record, "取消审核");

                const { error } = await supabase
                    .from(table)
                    .update({
                        audit_status: record.auditStatus,
                        logs: record.logs
                    })
                    .eq("id", r.id);

                if (error) {
                    console.error("取消审核失败", error);
                    alert("取消审核失败，请检查表结构或网络");
                    return;
                }

                await loadFinanceData();
                renderFinance();
            }
        });
    }
}

async function doFinishAction(module, index) {
    const list = getListByModule(module);
    const r = list[index];
    const state = getState(r);

    let table = "";
    if (module === "daily") table = "finance_daily";
    if (module === "payroll") table = "finance_payroll";
    if (module === "project") table = "finance_project";

    const supabase = window.supabaseClient;
    const record = { ...r, logs: r.logs || [] };

    if (state === "已审") {
        record.cashierStatus = "已发";
        addLog(record, "完成发放");

        const { error } = await supabase
            .from(table)
            .update({
                cashier_status: record.cashierStatus,
                logs: record.logs
            })
            .eq("id", r.id);

        if (error) {
            console.error("完成发放失败", error);
            alert("完成发放失败，请检查表结构或网络");
            return;
        }

        await loadFinanceData();
        renderFinance();
        return;
    }

    if (state === "已发") {
        Confirm.open({
            modalId: "confirmModal",
            textId: "confirmMessage",
            text: "确定取消完成？",
            async onConfirm() {
                record.cashierStatus = "未发";
                record.auditStatus = "已审";
                addLog(record, "取消完成");

                const { error } = await supabase
                    .from(table)
                    .update({
                        cashier_status: record.cashierStatus,
                        audit_status: record.auditStatus,
                        logs: record.logs
                    })
                    .eq("id", r.id);

                if (error) {
                    console.error("取消完成失败", error);
                    alert("取消完成失败，请检查表结构或网络");
                    return;
                }

                await loadFinanceData();
                renderFinance();
            }
        });
        return;
    }

    Confirm.open({
        modalId: "confirmModal",
        textId: "confirmMessage",
        text: "请先审核为已审再完成",
        onConfirm() {}
    });
}

/* ============================================================
操作按钮
============================================================ */

function renderActionButtons(r, index, module) {
    const state = getState(r);

    const btn = {
        reject: { text: "拒绝", class: "danger", disabled: false },
        approve: { text: "同意", class: "btn-approve", disabled: false },
        finish: { text: "完成", class: "btn-pay-gray", disabled: false },
        edit: { text: "编辑", class: "btn-approve", disabled: false },
        del: { text: "删除", class: "danger", disabled: false }
    };

    const user = Auth.currentUser || {};
    const role = user.role;

    /* 财务权限：不能拒绝、不能同意，只能完成 */
    if (role === "finance") {
        btn.reject.disabled = true;
        btn.approve.disabled = true;

        if (state !== "已审") {
            btn.finish.disabled = true;
        }

        const isOwner =
            (module === "daily"   && r.payer === user.name) ||
            (module === "project" && r.payer === user.name) ||
            (module === "payroll" && r.name  === user.name);

        if (!isOwner) {
            btn.del.disabled = true;
        }
    }

    /* 员工 / 外包：隐藏审核按钮 */
    if (role === "staff" || role === "outsourcing") {
        const canEditOrDelete =
            getState(r) === "未审" || getState(r) === "拒绝";

        return `
        <button class="btn-approve" disabled style="display:none"></button>
        <button class="btn-approve" disabled style="display:none"></button>
        <button class="btn-pay-gray" disabled style="display:none"></button>

        <button class="btn-approve" ${canEditOrDelete ? "" : "disabled"}
            onclick="event.stopPropagation(); ${canEditOrDelete ? `editRecord('${module}', ${index})` : ""};">
            编辑
        </button>

        <button class="danger" ${canEditOrDelete ? "" : "disabled"}
            onclick="event.stopPropagation(); ${canEditOrDelete ? `deleteRecord('${module}', ${index})` : ""};">
            删除
        </button>
    `;
    }

    /* 原有状态机逻辑 */
    if (state === "未审") btn.finish.disabled = true;

    if (state === "已审") {
        btn.reject.disabled = true;
        btn.approve.class = "btn-pay-green";
        btn.finish.class = "btn-pay-orange";
        btn.edit.disabled = true;
        btn.del.disabled = true;
    }

    if (state === "拒绝") btn.finish.disabled = true;

    if (state === "已发") {
        btn.reject.disabled = true;
        btn.approve.disabled = true;
        btn.finish.class = "btn-pay-green";
        btn.edit.disabled = true;
        btn.del.disabled = true;
    }

    return `
<button class="${btn.reject.class}" ${btn.reject.disabled ? "disabled" : ""}
    onclick="event.stopPropagation(); doRejectAction('${module}', ${index});">${btn.reject.text}</button>

<button class="${btn.approve.class}" ${btn.approve.disabled ? "disabled" : ""}
    onclick="event.stopPropagation(); doApproveAction('${module}', ${index});">${btn.approve.text}</button>

<button class="${btn.finish.class}" ${btn.finish.disabled ? "disabled" : ""}
    onclick="event.stopPropagation(); doFinishAction('${module}', ${index});">${btn.finish.text}</button>

<button class="${btn.edit.class}" ${btn.edit.disabled ? "disabled" : ""}
    onclick="event.stopPropagation(); editRecord('${module}', ${index});">编辑</button>

<button class="${btn.del.class}" ${btn.del.disabled ? "disabled" : ""}
    onclick="event.stopPropagation(); deleteRecord('${module}', ${index});">删除</button>
`;
}

/* ============================================================
状态标签
============================================================ */

function renderStatusMark(r) {
    const s = getState(r);
    const map = {
        "未审": "gray",
        "已审": "blue",
        "拒绝": "red",
        "已发": "green"
    };
    return `<span class="tag tag-${map[s]}">${s === "已发" ? "完成" : s}</span>`;
}

/* ============================================================
五、三大表格渲染（已改为动态分页 calcPageSize）
============================================================ */
function renderDailyTable(list) {
    const tbody = document.querySelector("#dailyTable tbody");

    // ★ 第一次渲染时 tbody 为空 → 插入一行假数据用于测量行高
    if (tbody.children.length === 0) {
        tbody.innerHTML = `
            <tr><td style="height:40px; padding:0; margin:0;" colspan="20"></td></tr>
        `;
    }
const newSize = calcPageSize();
if (newSize && newSize !== PaginationManager.pageSize) {
    PaginationManager.pageSize = newSize;
}

    // 清空假数据
    tbody.innerHTML = "";

    const total = list.length;
    const pageData = PaginationManager.slice(list);

    pageData.forEach(r => {
        const idx = dailyList.indexOf(r);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${r.date}</td>
<td>${renderStatusMark(r)}</td>
<td>${r.payer}</td>
<td>${r.project}</td>
<td>${r.item}</td>
<td>¥${fmtMoney(r.amount)}</td>
<td>${r.remark}</td>
<td class="action-cell">${renderActionButtons(r, idx, "daily")}</td>
`;
        tr.onclick = () => openDetail("daily", idx);
        tbody.appendChild(tr);
    });

    PaginationManager.renderPager(total);
}

function renderPayrollTable(list) {
    const tbody = document.querySelector("#payrollTable tbody");

    // ★ 和 daily 保持一致：用固定高度的假行来测量行高
    if (tbody.children.length === 0) {
        tbody.innerHTML = `
            <tr><td style="height:40px; padding:0; margin:0;" colspan="20"></td></tr>
        `;
    }
const newSize = calcPageSize();
if (newSize && newSize !== PaginationManager.pageSize) {
    PaginationManager.pageSize = newSize;
}

    // 清空假行
    tbody.innerHTML = "";

    const total = list.length;
    const pageData = PaginationManager.slice(list);

    pageData.forEach(r => {
        const idx = payrollList.indexOf(r);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${r.month}</td>
<td>${renderStatusMark(r)}</td>
<td>${r.name}</td>
<td>¥${fmtMoney(r.base)}</td>
<td>¥${fmtMoney(r.position)}</td>
<td>¥${fmtMoney(r.perf)}</td>
<td>¥${fmtMoney(r.bonus)}</td>
<td>¥${fmtMoney(r.pc)}</td>
<td>¥${fmtMoney(r.traffic)}</td>
<td>¥${fmtMoney(r.other)}</td>
<td>¥${fmtMoney(r.actual)}</td>
<td>${r.remark}</td>
<td class="action-cell">${renderActionButtons(r, idx, "payroll")}</td>
`;
        tr.onclick = () => openDetail("payroll", idx);
        tbody.appendChild(tr);
    });

    PaginationManager.renderPager(total);
}

function renderProjectTable(list) {
    const tbody = document.querySelector("#projectTable tbody");

    // ★ 同样用固定高度的假行
    if (tbody.children.length === 0) {
        tbody.innerHTML = `
            <tr><td style="height:40px; padding:0; margin:0;" colspan="20"></td></tr>
        `;
    }
const newSize = calcPageSize();
if (newSize && newSize !== PaginationManager.pageSize) {
    PaginationManager.pageSize = newSize;
}

    // 清空假行
    tbody.innerHTML = "";

    const total = list.length;
    const pageData = PaginationManager.slice(list);

    pageData.forEach(r => {
        const idx = projectList.indexOf(r);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${r.date}</td>
<td>${renderStatusMark(r)}</td>
<td>${r.payer}</td>
<td>${r.project}</td>
<td>${r.item}</td>
<td>¥${fmtMoney(r.amount)}</td>
<td>${r.remark}</td>
<td class="action-cell">${renderActionButtons(r, idx, "project")}</td>
`;
        tr.onclick = () => openDetail("project", idx);
        tbody.appendChild(tr);
    });

    PaginationManager.renderPager(total);
}

/* ============================================================
六、详情弹窗
============================================================ */

function renderLogs(logs) {
    if (!logs || !logs.length) return "暂无日志";

    return logs
        .slice(-50)
        .map(l => `【${l.action}】${l.time} 账号：${l.user} 姓名：${l.name}`)
        .join("<br>");
}

function openDetail(module, index) {
    const r = getListByModule(module)[index];

    if (module === "daily") {
        document.getElementById("v_d_status").innerText   = r.auditStatus || "未审";
        document.getElementById("v_d_cashier").innerText  = r.cashierStatus || "未发";
        document.getElementById("v_d_project").innerText  = r.project || "";
        document.getElementById("v_d_item").innerText     = r.item || "";
        document.getElementById("v_d_date").innerText     = r.date || "";
        document.getElementById("v_d_amount").innerText   = "¥" + fmtMoney(r.amount);
        document.getElementById("v_d_payer").innerText    = r.payer || "";
        document.getElementById("v_d_remark").innerText   = r.remark || "";
        document.getElementById("v_d_logs").innerHTML     = renderLogs(r.logs);

        Modal.open("dailyViewModal");
        return;
    }

    if (module === "payroll") {
        document.getElementById("v_p_status").innerText   = r.auditStatus || "未审";
        document.getElementById("v_p_cashier").innerText  = r.cashierStatus || "未发";
        document.getElementById("v_p_month").innerText    = r.month || "";
        document.getElementById("v_p_name").innerText     = r.name || "";
        document.getElementById("v_p_base").innerText     = "¥" + fmtMoney(r.base);
        document.getElementById("v_p_position").innerText = "¥" + fmtMoney(r.position);
        document.getElementById("v_p_perf").innerText     = "¥" + fmtMoney(r.perf);
        document.getElementById("v_p_bonus").innerText    = "¥" + fmtMoney(r.bonus);
        document.getElementById("v_p_pc").innerText       = "¥" + fmtMoney(r.pc);
        document.getElementById("v_p_traffic").innerText  = "¥" + fmtMoney(r.traffic);
        document.getElementById("v_p_other").innerText    = "¥" + fmtMoney(r.other);
        document.getElementById("v_p_actual").innerText   = "¥" + fmtMoney(r.actual);
        document.getElementById("v_p_remark").innerText   = r.remark || "";
        document.getElementById("v_p_logs").innerHTML     = renderLogs(r.logs);

        Modal.open("payrollViewModal");
        return;
    }

    if (module === "project") {
        document.getElementById("v_j_status").innerText   = r.auditStatus || "未审";
        document.getElementById("v_j_cashier").innerText  = r.cashierStatus || "未发";
        document.getElementById("v_j_date").innerText     = r.date || "";
        document.getElementById("v_j_payer").innerText    = r.payer || "";
        document.getElementById("v_j_amount").innerText   = "¥" + fmtMoney(r.amount);
        document.getElementById("v_j_project").innerText  = r.project || "";
        document.getElementById("v_j_item").innerText     = r.item || "";
        document.getElementById("v_j_remark").innerText   = r.remark || "";
        document.getElementById("v_j_logs").innerHTML     = renderLogs(r.logs);

        Modal.open("projectViewModal");
        return;
    }
}

function closeDailyView()   { Modal.close("dailyViewModal"); }
function closePayrollView() { Modal.close("payrollViewModal"); }
function closeProjectView() { Modal.close("projectViewModal"); }

/* ============================================================
七、删除
============================================================ */

let _pendingDelete = null;

function deleteRecord(module, index) {
    _pendingDelete = { module, index };
    const r = getListByModule(module)[index];

    document.getElementById("financeDeleteText").innerText =
        `确定删除该记录？（${r.project || r.name || r.item}）`;

    Modal.open("financeDeleteModal");
}

function closeFinanceDelete() {
    Modal.close("financeDeleteModal");
    _pendingDelete = null;
}

async function confirmFinanceDelete() {
    if (!_pendingDelete) return;

    const role = Auth.currentUser?.role;

    // ★★★ 员工和外包账号禁止删除工资记录
    if (_pendingDelete.module === "payroll" && (role === "staff" || role === "outsourcing")) {
        alert("您没有权限删除工资记录");
        closeFinanceDelete();
        return;
    }

    const { module, index } = _pendingDelete;
    const list = getListByModule(module);
    const r = list[index];

    let table = "";
    if (module === "daily") table = "finance_daily";
    if (module === "payroll") table = "finance_payroll";
    if (module === "project") table = "finance_project";

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", r.id);

    if (error) {
        console.error("删除失败", error);
        alert("删除失败，请检查表结构或网络");
        return;
    }

    closeFinanceDelete();
    await loadFinanceData();
    renderFinance();
}

/* ============================================================
八、新增 / 编辑
============================================================ */

function openAddFinance() {
    const user = Auth.currentUser || {};
    const role = user.role;

    if (currentModule === "payroll" && (role === "staff" || role === "outsourcing")) {
        alert("您没有权限新增工资记录");
        return;
    }

    if (currentModule === "daily") openDailyModal();
    if (currentModule === "payroll") openPayrollModal();
    if (currentModule === "project") openProjectModal();
}

/* ---------------- daily ---------------- */

function openDailyModal() {
    window._editDailyIndex = null;

    ["d_date","d_project","d_item","d_amount","d_remark"]
        .forEach(id => document.getElementById(id).value = "");
    document.getElementById("d_date").value = new Date().toISOString().slice(0, 10);

    const user = Auth.currentUser || {};
    const name = user.name || "";

    document.getElementById("d_payer_display").innerText = name;
    document.getElementById("d_payer").value = name;

    Modal.open("dailyModal");
}

function closeDailyModal() { Modal.close("dailyModal"); }

async function saveDaily() {
    if (!d_date.value) {
        alert("请填写日期");
        return;
    }

    const supabase = window.supabaseClient;
    const isEdit = window._editDailyIndex != null;
    const user = Auth.currentUser || {};
    const name = user.name || "";

    let old = null;
    if (isEdit) old = dailyList[window._editDailyIndex];

    const record = {
        date: d_date.value,
        project: d_project.value,
        item: d_item.value,
        amount: Number(d_amount.value || 0),
        payer: name,
        remark: d_remark.value,
        auditStatus: isEdit ? (old.auditStatus || "未审") : "未审",
        cashierStatus: isEdit ? (old.cashierStatus || "未发") : "未发",
        logs: isEdit ? (old.logs || []) : []
    };

    addLog(record, isEdit ? "编辑保存" : "新增记录");

    if (isEdit) {
        const { error } = await supabase
            .from("finance_daily")
            .update({
                date: record.date,
                project: record.project,
                item: record.item,
                amount: record.amount,
                payer: record.payer,
                remark: record.remark,
                audit_status: record.auditStatus,
                cashier_status: record.cashierStatus,
                logs: record.logs
            })
            .eq("id", old.id);

        if (error) {
            console.error("更新报销失败", error);
            alert("更新报销失败，请检查表结构或网络");
            return;
        }

        window._editDailyIndex = null;
    } else {
        const { error } = await supabase
            .from("finance_daily")
            .insert({
                date: record.date,
                project: record.project,
                item: record.item,
                amount: record.amount,
                payer: record.payer,
                remark: record.remark,
                audit_status: record.auditStatus,
                cashier_status: record.cashierStatus,
                logs: record.logs
            });

        if (error) {
            console.error("新增报销失败", error);
            alert("新增报销失败，请检查表结构或网络");
            return;
        }
    }

    closeDailyModal();
    await loadFinanceData();
    renderFinance();
}

function editRecord_daily(i) {
    const r = dailyList[i];
    window._editDailyIndex = i;

    d_date.value = r.date;
    d_project.value = r.project;
    d_item.value = r.item;
    d_amount.value = r.amount;
    d_remark.value = r.remark;

    const user = Auth.currentUser || {};
    const name = user.name || "";

    document.getElementById("d_payer_display").innerText = name;
    document.getElementById("d_payer").value = name;

    Modal.open("dailyModal");
}

/* ---------------- payroll ---------------- */

function openPayrollModal() {
    window._editPayrollIndex = null;

    ["p_month","p_base","p_position","p_bonus","p_pc","p_traffic","p_other","p_actual","p_remark"]
        .forEach(id => document.getElementById(id).value = "");
    document.getElementById("p_month").value = new Date().toISOString().slice(0, 7);

    const user = Auth.currentUser || {};
    const role = user.role;

    const nameInput = document.getElementById("p_name");
    nameInput.value = "";

    if (role !== "admin" && role !== "boss" && role !== "finance") {
        nameInput.value = user.name || "";
    }

    if (p_name.value) onPayrollNameChange();

    Modal.open("payrollModal");
}

function closePayrollModal() { Modal.close("payrollModal"); }

async function savePayroll() {
    if (!p_month.value) {
        alert("请填写月份");
        return;
    }

    const supabase = window.supabaseClient;
    const isEdit = window._editPayrollIndex != null;

    let old = null;
    if (isEdit) old = payrollList[window._editPayrollIndex];

    const record = {
        month: p_month.value,
        name: p_name.value,
        base: Number(p_base.value || 0),
        position: Number(p_position.value || 0),
        perf: Number(p_perf.value || 0),
        bonus: Number(p_bonus.value || 0),
        pc: Number(p_pc.value || 0),
        traffic: Number(p_traffic.value || 0),
        other: Number(p_other.value || 0),
        actual: Number(p_actual.value || 0),
        remark: p_remark.value,
        auditStatus: isEdit ? (old.auditStatus || "未审") : "未审",
        cashierStatus: isEdit ? (old.cashierStatus || "未发") : "未发",
        logs: isEdit ? (old.logs || []) : []
    };

    addLog(record, isEdit ? "编辑保存" : "新增记录");

    if (isEdit) {
        const { error } = await supabase
            .from("finance_payroll")
            .update({
                month: record.month,
                name: record.name,
                base: record.base,
                position: record.position,
                perf: record.perf,
                bonus: record.bonus,
                pc: record.pc,
                traffic: record.traffic,
                other: record.other,
                actual: record.actual,
                remark: record.remark,
                audit_status: record.auditStatus,
                cashier_status: record.cashierStatus,
                logs: record.logs
            })
            .eq("id", old.id);

        if (error) {
            console.error("更新工资失败", error);
            alert("更新工资失败，请检查表结构或网络");
            return;
        }

        window._editPayrollIndex = null;
    } else {
        const { error } = await supabase
            .from("finance_payroll")
            .insert({
                month: record.month,
                name: record.name,
                base: record.base,
                position: record.position,
                perf: record.perf,
                bonus: record.bonus,
                pc: record.pc,
                traffic: record.traffic,
                other: record.other,
                actual: record.actual,
                remark: record.remark,
                audit_status: record.auditStatus,
                cashier_status: record.cashierStatus,
                logs: record.logs
            });

        if (error) {
            console.error("新增工资失败", error);
            alert("新增工资失败，请检查表结构或网络");
            return;
        }
    }

    closePayrollModal();
    await loadFinanceData();
    renderFinance();
}

function editRecord_payroll(i) {
    const role = Auth.role;
    if (role === "staff" || role === "outsourcing") {
        alert("您没有权限编辑工资记录");
        return;
    }

    const r = payrollList[i];
    window._editPayrollIndex = i;

    p_month.value = r.month;
    p_base.value = r.base;
    p_position.value = r.position;
    p_bonus.value = r.bonus;
    p_pc.value = r.pc;
    p_traffic.value = r.traffic;
    p_other.value = r.other;
    p_actual.value = r.actual;
    p_remark.value = r.remark;
    p_name.value = r.name;

    const acc =
    accountList.find(a => a.name === r.name) ||
    (JSON.parse(localStorage.getItem("accounts") || "[]").find(a => a.name === r.name) || null);

	const raw = acc ? acc.salary_performance || 0 : 0;

    p_perf.innerHTML = `
        <option value="${Math.round(raw * 1.2)}">A（${Math.round(raw * 1.2)}）</option>
        <option value="${Math.round(raw * 1.0)}">B（${Math.round(raw * 1.0)}）</option>
        <option value="${Math.round(raw * 0.7)}">C（${Math.round(raw * 0.7)}）</option>
        <option value="0">D（0）</option>
    `;

    p_perf.value = r.perf;

    calcPayrollTotal();

    Modal.open("payrollModal");
}

/* 工资管理：自动读取人员系统工资 + 绩效等级计算 + 实际发放计算 */

function onPayrollNameChange() {
    const name = p_name.value;

    const list = (accountList || []).filter(a => a.enabled !== false && !a.disabled);
    const acc =
        list.find(a => a.name === name) ||
        (JSON.parse(localStorage.getItem("accounts") || "[]").find(a => a.name === name) || null);

    if (!acc) return;

    p_base.value = acc.salary_base || 0;
    p_position.value = acc.salary_post || 0;
    p_pc.value = acc.salary_computer || 0;
    p_traffic.value = acc.salary_traffic || 0;

    p_base.readOnly = true;
    p_position.readOnly = true;
    p_pc.readOnly = true;
    p_traffic.readOnly = true;
    p_actual.readOnly = true;

    p_bonus.value = 0;
    p_other.value = 0;

    const raw = acc.salary_performance || 0;

    p_perf.innerHTML = `
        <option value="${Math.round(raw * 1.2)}">A（${Math.round(raw * 1.2)}）</option>
        <option value="${Math.round(raw * 1.0)}">B（${Math.round(raw * 1.0)}）</option>
        <option value="${Math.round(raw * 0.7)}">C（${Math.round(raw * 0.7)}）</option>
        <option value="0">D（0）</option>
    `;

    p_perf.value = Math.round(raw * 1.0);

    calcPayrollTotal();
}

function onPerfLevelChange() {
    calcPayrollTotal();
}

function calcPayrollTotal() {
    const base = Number(p_base.value || 0);
    const position = Number(p_position.value || 0);
    const perf = Number(p_perf.value || 0);
    const pc = Number(p_pc.value || 0);
    const traffic = Number(p_traffic.value || 0);
    const bonus = Number(p_bonus.value || 0);
    const other = Number(p_other.value || 0);

    p_actual.value = base + position + perf + pc + traffic + bonus + other;
}

/* ---------------- project ---------------- */

function openProjectModal() {
    window._editProjectIndex = null;

    ["j_date","j_project","j_item","j_amount","j_remark"]
        .forEach(id => document.getElementById(id).value = "");
    document.getElementById("j_date").value = new Date().toISOString().slice(0, 10);

    const user = Auth.currentUser || {};
    const name = user.name || "";

    document.getElementById("j_payer_display").innerText = name;
    document.getElementById("j_payer").value = name;

    Modal.open("projectModal");
}

function closeProjectModal() { Modal.close("projectModal"); }

async function saveProject() {
    if (!j_date.value) {
        alert("请填写日期");
        return;
    }

    const supabase = window.supabaseClient;
    const isEdit = window._editProjectIndex != null;
    const user = Auth.currentUser || {};
    const name = user.name || "";

    let old = null;
    if (isEdit) old = projectList[window._editProjectIndex];

    const record = {
        date: j_date.value,
        project: j_project.value,
        item: j_item.value,
        amount: Number(j_amount.value || 0),
        payer: name,
        remark: j_remark.value,
        auditStatus: isEdit ? (old.auditStatus || "未审") : "未审",
        cashierStatus: isEdit ? (old.cashierStatus || "未发") : "未发",
        logs: isEdit ? (old.logs || []) : []
    };

    addLog(record, isEdit ? "编辑保存" : "新增记录");

    if (isEdit) {
        const { error } = await supabase
            .from("finance_project")
            .update({
                date: record.date,
                project: record.project,
                item: record.item,
                amount: record.amount,
                payer: record.payer,
                remark: record.remark,
                audit_status: record.auditStatus,
                cashier_status: record.cashierStatus,
                logs: record.logs
            })
            .eq("id", old.id);

        if (error) {
            console.error("更新项目支出失败", error);
            alert("更新项目支出失败，请检查表结构或网络");
            return;
        }

        window._editProjectIndex = null;
    } else {
        const { error } = await supabase
            .from("finance_project")
            .insert({
                date: record.date,
                project: record.project,
                item: record.item,
                amount: record.amount,
                payer: record.payer,
                remark: record.remark,
                audit_status: record.auditStatus,
                cashier_status: record.cashierStatus,
                logs: record.logs
            });

        if (error) {
            console.error("新增项目支出失败", error);
            alert("新增项目支出失败，请检查表结构或网络");
            return;
        }
    }

    closeProjectModal();
    await loadFinanceData();
    renderFinance();
}

function editRecord_project(i) {
    const r = projectList[i];
    window._editProjectIndex = i;

    j_date.value = r.date;
    j_project.value = r.project;
    j_item.value = r.item;
    j_amount.value = r.amount;
    j_remark.value = r.remark;

    const user = Auth.currentUser || {};
    const name = user.name || "";

    document.getElementById("j_payer_display").innerText = name;
    document.getElementById("j_payer").value = name;

    Modal.open("projectModal");
}

/* 统一 editRecord 入口 */
function editRecord(module, index) {
    if (module === "daily") return editRecord_daily(index);
    if (module === "payroll") return editRecord_payroll(index);
    if (module === "project") return editRecord_project(index);
}

/* ============================================================
九、Excel 导入导出（导入 = 覆盖）
============================================================ */

function mapExcelRow(row, map) {
    const obj = {};
    for (const key in row) {
        if (map[key]) obj[map[key]] = row[key];
    }
    return obj;
}

const dailyImportMap = {
    "日期": "date",
    "经办人": "payer",
    "项目": "project",
    "支出事由": "item",
    "金额": "amount",
    "备注": "remark",
    "审核状态": "auditStatus",
    "出纳状态": "cashierStatus"
};

const payrollImportMap = {
    "月份": "month",
    "姓名": "name",
    "基本工资": "base",
    "岗位工资": "position",
    "绩效考核": "perf",
    "项目提成": "bonus",
    "电脑补贴": "pc",
    "交通补贴": "traffic",
    "其他": "other",
    "实际发放": "actual",
    "备注": "remark",
    "审核状态": "auditStatus",
    "出纳状态": "cashierStatus"
};

const projectImportMap = {
    "日期": "date",
    "经办人": "payer",
    "项目": "project",
    "支出事由": "item",
    "金额": "amount",
    "备注": "remark",
    "审核状态": "auditStatus",
    "出纳状态": "cashierStatus"
};

function exportFinanceExcel() {
    if (currentModule === "daily") return exportDailyExcel();
    if (currentModule === "payroll") return exportPayrollExcel();
    if (currentModule === "project") return exportProjectExcel();
}

function importFinanceExcel(e) {
    if (currentModule === "daily") return importDailyExcel(e);
    if (currentModule === "payroll") return importPayrollExcel(e);
    if (currentModule === "project") return importProjectExcel(e);
}

/* ---------------- daily ---------------- */

function exportDailyExcel() {
    if (!dailyList.length) return alert("暂无数据");
    ExcelUtil.export(dailyList, "报账中心");
}

function importDailyExcel(e) {
    ExcelUtil.import(e, async json => {
        const supabase = window.supabaseClient;

        const { error: delErr } = await supabase
            .from("finance_daily")
            .delete()
            .not("id", "is", null);

        if (delErr) {
            console.error("清空 finance_daily 失败", delErr);
            alert("清空失败");
            return;
        }

        const rows = json.map(r => {
            const mapped = mapExcelRow(r, dailyImportMap);
            const patched = patchRecordDefaults([mapped])[0];
            return {
                date: patched.date,
                project: patched.project,
                item: patched.item,
                amount: Number(patched.amount || 0),
                payer: patched.payer,
                remark: patched.remark,
                audit_status: patched.auditStatus || "未审",
                cashier_status: patched.cashierStatus || "未发",
                logs: patched.logs || []
            };
        });

        const { error } = await supabase
            .from("finance_daily")
            .insert(rows);

        if (error) {
            console.error("导入报销失败", error);
            alert("导入报销失败，请检查表结构");
            return;
        }

        await loadFinanceData();
        renderFinance();
    });
}

/* ---------------- payroll ---------------- */

function exportPayrollExcel() {
    if (!payrollList.length) return alert("暂无数据");
    ExcelUtil.export(payrollList, "薪资记录");
}

function importPayrollExcel(e) {
    ExcelUtil.import(e, async json => {
        const supabase = window.supabaseClient;

        const { error: delErr } = await supabase
            .from("finance_payroll")
            .delete()
            .not("id", "is", null);

        if (delErr) {
            console.error("清空 finance_payroll 失败", delErr);
            alert("清空失败");
            return;
        }

        const rows = json.map(r => {
            const mapped = mapExcelRow(r, payrollImportMap);
            const patched = patchRecordDefaults([mapped])[0];
            return {
                month: patched.month,
                name: patched.name,
                base: Number(patched.base || 0),
                position: Number(patched.position || 0),
                perf: Number(patched.perf || 0),
                bonus: Number(patched.bonus || 0),
                pc: Number(patched.pc || 0),
                traffic: Number(patched.traffic || 0),
                other: Number(patched.other || 0),
                actual: Number(patched.actual || 0),
                remark: patched.remark,
                audit_status: patched.auditStatus || "未审",
                cashier_status: patched.cashierStatus || "未发",
                logs: patched.logs || []
            };
        });

        const { error } = await supabase
            .from("finance_payroll")
            .insert(rows);

        if (error) {
            console.error("导入工资失败", error);
            alert("导入工资失败，请检查表结构");
            return;
        }

        await loadFinanceData();
        renderFinance();
    });
}

/* ---------------- project ---------------- */

function exportProjectExcel() {
    if (!projectList.length) return alert("暂无数据");
    ExcelUtil.export(projectList, "项目支出");
}

function importProjectExcel(e) {
    ExcelUtil.import(e, async json => {
        const supabase = window.supabaseClient;

        const { error: delErr } = await supabase
            .from("finance_project")
            .delete()
            .not("id", "is", null);

        if (delErr) {
            console.error("清空 finance_project 失败", delErr);
            alert("清空失败");
            return;
        }

        const rows = json.map(r => {
            const mapped = mapExcelRow(r, projectImportMap);
            const patched = patchRecordDefaults([mapped])[0];
            return {
                date: patched.date,
                project: patched.project,
                item: patched.item,
                amount: Number(patched.amount || 0),
                payer: patched.payer,
                remark: patched.remark,
                audit_status: patched.auditStatus || "未审",
                cashier_status: patched.cashierStatus || "未发",
                logs: patched.logs || []
            };
        });

        const { error } = await supabase
            .from("finance_project")
            .insert(rows);

        if (error) {
            console.error("导入项目支出失败", error);
            alert("导入项目支出失败，请检查表结构");
            return;
        }

        await loadFinanceData();
        renderFinance();
    });
}

/* ============================================================
十、统计卡片
============================================================ */

function sumMonthlyByField(list, fieldKey, dateKey) {
    const now = new Date();
    const ym = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    return list
        .filter(o => (o[dateKey] || "").startsWith(ym))
        .reduce((s, o) => s + Number(o[fieldKey] || 0), 0);
}

function sumByState(list, targetState, fieldKey) {
    return list
        .filter(o => getState(o) === targetState)
        .reduce((s, o) => s + Number(o[fieldKey] || 0), 0);
}

function sumListField(list, fieldKey) {
    return list.reduce((s, o) => s + Number(o[fieldKey] || 0), 0);
}

function renderFinanceStats(module, filteredList) {
    const user = Auth.currentUser || {};
    const role = user.role;
    const username = user.name;

    let dailyData = dailyList;
    let payrollData = payrollList;
    let projectData = projectList;

    if (role === "staff" || role === "outsourcing") {
        dailyData = dailyList.filter(r => r.payer === username);
        payrollData = payrollList.filter(r => r.name === username);
        projectData = projectList.filter(r => r.payer === username);
    }

    const t1 = document.getElementById("statTitle1");
    const t2 = document.getElementById("statTitle2");
    const t3 = document.getElementById("statTitle3");
    const t4 = document.getElementById("statTitle4");
    const t5 = document.getElementById("statTitle5");

    const v1 = document.getElementById("stat1");
    const v2 = document.getElementById("stat2");
    const v3 = document.getElementById("stat3");
    const v4 = document.getElementById("stat4");
    const v5 = document.getElementById("stat5");

    if (module === "daily") {
        t1.innerText = "本月报销金额";
        t2.innerText = "待审报销金额";
        t3.innerText = "已报销总额";
        t4.innerText = "待发放总额";
        t5.innerText = "筛选报销金额";

        v1.innerText = "¥" + fmtMoney(sumMonthlyByField(dailyData, "amount", "date"));
        v2.innerText = "¥" + fmtMoney(sumByState(dailyData, "未审", "amount"));
        v3.innerText = "¥" + fmtMoney(sumByState(dailyData, "已审", "amount"));
        v4.innerText = "¥" + fmtMoney(sumByState(dailyData, "已审", "amount"));
        v5.innerText = "¥" + fmtMoney(sumListField(filteredList, "amount"));
    }

    if (module === "payroll") {
        t1.innerText = "本月工资金额";
        t2.innerText = "待审工资金额";
        t3.innerText = "已发工资总额";
        t4.innerText = "待发工资总额";
        t5.innerText = "筛选工资金额";

        v1.innerText = "¥" + fmtMoney(sumMonthlyByField(payrollData, "actual", "month"));
        v2.innerText = "¥" + fmtMoney(sumByState(payrollData, "未审", "actual"));
        v3.innerText = "¥" + fmtMoney(sumByState(payrollData, "已发", "actual"));
        v4.innerText = "¥" + fmtMoney(sumByState(payrollData, "已审", "actual"));
        v5.innerText = "¥" + fmtMoney(sumListField(filteredList, "actual"));
    }

    if (module === "project") {
        t1.innerText = "本月支出金额";
        t2.innerText = "待审支出金额";
        t3.innerText = "已发支出总额";
        t4.innerText = "待发支出总额";
        t5.innerText = "筛选支出金额";

        v1.innerText = "¥" + fmtMoney(sumMonthlyByField(projectData, "amount", "date"));
        v2.innerText = "¥" + fmtMoney(sumByState(projectData, "未审", "amount"));
        v3.innerText = "¥" + fmtMoney(sumByState(projectData, "已发", "amount"));
        v4.innerText = "¥" + fmtMoney(sumByState(projectData, "已审", "amount"));
        v5.innerText = "¥" + fmtMoney(sumListField(filteredList, "amount"));
    }
}

/* ============================================================
十一、模块切换 + 搜索 + 主渲染
============================================================ */

function toggleModuleMenu() {
    const menu = document.getElementById("moduleMenu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function switchModule(module) {
    currentModule = module;

    document.getElementById("dailyTable").style.display   = module === "daily"   ? "" : "none";
    document.getElementById("payrollTable").style.display = module === "payroll" ? "" : "none";
    document.getElementById("projectTable").style.display = module === "project" ? "" : "none";

    const btn = document.getElementById("moduleBtn");
    if (module === "daily")   btn.innerText = "财务报销 ▼";
    if (module === "payroll") btn.innerText = "工资管理 ▼";
    if (module === "project") btn.innerText = "项目支出 ▼";

    document.getElementById("moduleMenu").style.display = "none";

    // ★ 不再用 page[module]，统一用 PaginationManager
    PaginationManager.currentPage = 1;
    renderFinance();
}

/* 搜索过滤 */
function getFilteredList() {
    const kwInput = document.getElementById("keyword");
    const kw = (kwInput ? kwInput.value : "").trim().toLowerCase();

    let list = getListByModule(currentModule);

    const user = Auth.currentUser || {};
    const role = user.role;

    if (role === "staff" || role === "outsourcing") {
        if (currentModule === "daily")  list = list.filter(r => r.payer === user.name);
        if (currentModule === "payroll") list = list.filter(r => r.name === user.name);
        if (currentModule === "project") list = list.filter(r => r.payer === user.name);
    }

    if (!kw) return list;

    const fields =
        currentModule === "daily"
            ? ["date", "payer", "project", "item", "remark"]
        : currentModule === "payroll"
            ? ["month", "name", "remark"]
        : ["date", "payer", "project", "item", "remark"];

    return list.filter(r =>
        fields.some(f => {
            const v = (r[f] == null ? "" : String(r[f])).toLowerCase();
            return v.includes(kw);
        })
    );
}

/* 主渲染（已兼容动态分页） */
function renderFinance() {
    let filtered = getFilteredList();
    filtered = sortFinanceList(filtered, currentModule);

    if (currentModule === "daily") renderDailyTable(filtered);
    if (currentModule === "payroll") renderPayrollTable(filtered);
    if (currentModule === "project") renderProjectTable(filtered);

    renderFinanceStats(currentModule, filtered);
}

/* ============================================================
十二、备份管理（Supabase 覆盖恢复）
============================================================ */

function openBackupModal() {
    Modal.open("backupModal");

    let moduleKey = "";
    if (currentModule === "daily") moduleKey = "finance_daily";
    if (currentModule === "payroll") moduleKey = "finance_payroll";
    if (currentModule === "project") moduleKey = "finance_project";

    Backup.renderList("backupList", moduleKey, "restoreFinanceBackup", "deleteFinanceBackup");
}

async function restoreFinanceBackup(date) {
    let moduleKey = "";
    let table = "";

    if (currentModule === "daily") {
        moduleKey = "finance_daily";
        table = "finance_daily";
    }
    if (currentModule === "payroll") {
        moduleKey = "finance_payroll";
        table = "finance_payroll";
    }
    if (currentModule === "project") {
        moduleKey = "finance_project";
        table = "finance_project";
    }

    const data = Backup.restore(moduleKey, date);
    if (!data) {
        alert("备份不存在");
        return;
    }

    const supabase = window.supabaseClient;

    const { error: delErr } = await supabase
        .from(table)
        .delete()
        .not("id", "is", null);

    if (delErr) {
        console.error("清空表失败", delErr);
        alert("清空表失败");
        return;
    }

    const rows = data.map(r => {
        if (table === "finance_payroll") {
            return {
                month: r.month,
                name: r.name,
                base: Number(r.base || 0),
                position: Number(r.position || 0),
                perf: Number(r.perf || 0),
                bonus: Number(r.bonus || 0),
                pc: Number(r.pc || 0),
                traffic: Number(r.traffic || 0),
                other: Number(r.other || 0),
                actual: Number(r.actual || 0),
                remark: r.remark,
                audit_status: r.auditStatus || "未审",
                cashier_status: r.cashierStatus || "未发",
                logs: Array.isArray(r.logs) ? r.logs : []
            };
        }

        return {
            date: r.date,
            project: r.project,
            item: r.item,
            amount: Number(r.amount || 0),
            payer: r.payer,
            remark: r.remark,
            audit_status: r.auditStatus || "未审",
            cashier_status: r.cashierStatus || "未发",
            logs: Array.isArray(r.logs) ? r.logs : []
        };
    });

    const { error: insErr } = await supabase
        .from(table)
        .insert(rows);

    if (insErr) {
        console.error("恢复备份失败", insErr);
        alert("恢复备份失败，请检查表结构");
        return;
    }

    await loadFinanceData();
    renderFinance();
}

function deleteFinanceBackup(date) {
    let moduleKey = "";
    if (currentModule === "daily") moduleKey = "finance_daily";
    if (currentModule === "payroll") moduleKey = "finance_payroll";
    if (currentModule === "project") moduleKey = "finance_project";

    Backup.delete(moduleKey, date);
    Backup.renderList("backupList", moduleKey, "restoreFinanceBackup", "deleteFinanceBackup");
}

function closeBackupModal() {
    Modal.close("backupModal");
}

/* ============================================================
十三、从 Supabase 加载人员列表（users 表）
============================================================ */

async function loadAccountListFromSupabase() {
    const supabase = window.supabaseClient;
    if (!supabase) {
        console.error("Supabase 未初始化");
        return;
    }

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("job_no", { ascending: true });

    if (error) {
        console.error("加载人员列表失败：", error);
        accountList = Storage.get("accounts", []) || [];
        return;
    }

    accountList = (data || []).map(u => ({
        jobId: u.job_no || "",
        name: u.name || "",
        phone: u.phone || "",
        role: u.role || "staff",
        remark: u.remark || "",
        enabled: u.enabled !== false,
        salary_base: u.salary_base || 0,
        salary_post: u.salary_post || 0,
        salary_performance: u.salary_performance || 0,
        salary_computer: u.salary_computer || 0,
        salary_traffic: u.salary_traffic || 0
    }));
}

/* ============================================================
十四、最终初始化（DOMContentLoaded）
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    migrateOldData();

    await loadAccountListFromSupabase();
    await loadProjectNamesFromSupabase();
    await loadFinanceData();

    // ★ 绑定 PaginationManager（必须在第一次 renderFinance 之前）
    PaginationManager.attach({
        tableSelector: ".table-scroll",   // 财务页面外层滚动容器
        renderCallback: renderFinance
    });

    const role = Auth.currentUser?.role;
    if (role === "staff" || role === "outsourcing" || role === "finance") {
        ["btnBackupManager", "btnExport", "btnImport"].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = true;
                el.classList.add("btn-disabled");
            }
        });
    }

    const kw = document.getElementById("keyword");
    if (kw) kw.oninput = () => {
        PaginationManager.currentPage = 1;
        renderFinance();
    };

    attachSmartSelect(document.getElementById("d_project"), () => projectNameList);
    attachSmartSelect(document.getElementById("j_project"), () => projectNameList);
    attachSmartSelect(document.getElementById("p_name"), () => {
        return accountList
            .filter(a => a.enabled !== false && !a.disabled)
            .map(a => a.name);
    });

    // ★ 不再手动监听 resize，这个工作交给 PaginationManager
    // window.addEventListener("resize", () => { renderFinance(); });

    switchModule("daily");
});

