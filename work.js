/* ============================================================
工作汇报模块（Supabase 版）
============================================================ */

let allReports = [];
let filteredReports = [];
let allUsers = [];          // 从 users 表读取的启用账号，用于“未填写记录”
let deleteTargetId = null;
let approveTargetId = null;
let editTargetId = null;

const PAGE_SIZE = 16;

/* 获取当前登录用户 */
function getSessionUser() {
    return JSON.parse(sessionStorage.getItem("sessionUser") || "null");
}

/* ============================================================
一、加载 users（用于未填写统计 + 登录字段对齐）
============================================================ */
async function loadUsersFromSupabase() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("users")
        .select("job_no, name, role, enabled")
        .order("job_no", { ascending: true });

    if (error) {
        console.error("加载人员列表失败：", error);
        allUsers = [];
        return;
    }

    // 只统计启用账号
    allUsers = (data || []).filter(u => u.enabled !== false);
}

/* ============================================================
二、加载工作汇报
============================================================ */
async function loadReportsFromSupabase() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("work_reports")
        .select("*")
        .order("date", { ascending: false });

    if (error) {
        console.error("加载工作记录失败：", error);
        alert("加载工作记录失败，请检查控制台");
        return;
    }

    allReports = (data || []).map(r => ({
        id: r.id,
        date: r.date,
        jobId: r.job_id,
        name: r.name,
        content: r.content,
        plan: r.plan,
        remark: r.remark || "",
        status: r.status || "pending"
    }));

    filteredReports = allReports.slice();
    Pagination.currentPage = 1;
    renderReports();
}

/* ============================================================
三、搜索
============================================================ */
function searchReports() {
    const kw = document.getElementById("searchInput").value.trim().toLowerCase();

    if (!kw) {
        filteredReports = allReports.slice();
    } else {
        filteredReports = allReports.filter(r =>
            (r.name || "").toLowerCase().includes(kw) ||
            (r.content || "").toLowerCase().includes(kw) ||
            (r.plan || "").toLowerCase().includes(kw) ||
            (r.remark || "").toLowerCase().includes(kw)
        );
    }

    Pagination.currentPage = 1;
    renderReports();
}

/* ============================================================
四、渲染表格 + 分页 + 统计
============================================================ */
function renderReports() {
    const tbody = document.querySelector("#reportTable tbody");
    const user = getSessionUser();

    let list = filteredReports.length ? filteredReports : allReports;

    // 员工只能看自己的（注意这里兼容 jobId / username）
    if (user && user.role === "staff") {
        const myJobId = user.jobId || user.username || user.job_no || "";
        list = list.filter(r => r.jobId === myJobId);
    }

    const total = list.length;
    const size = PAGE_SIZE;
    const current = Pagination.currentPage || 1;
    const start = (current - 1) * size;
    const pageList = list.slice(start, start + size);

    tbody.innerHTML = pageList.map(r => `
        <tr>
            <td>${r.date || ""}</td>
            <td>${renderStatus(r.status)}</td>
            <td>${r.name || ""}</td>
            <td>${r.content || ""}</td>
            <td>${r.plan || ""}</td>
            <td>${r.remark || ""}</td>
            <td class="col-action action-cell">
                <button class="btn-approve" onclick="openEditModal(${r.id})">修改</button>
                <button class="danger" onclick="openDeleteModal(${r.id})">删除</button>
                ${
                    r.status === "approved"
                        ? `<button class="btn-pay-gray" disabled>已审</button>`
                        : `<button class="btn-pay-green" onclick="openApproveModal(${r.id})">审批</button>`
                }
            </td>
        </tr>
    `).join("");

    updateStats(list);
    renderPagination(total);
}

function renderPagination(total) {
    Pagination.render({
        el: "#pagination",
        total,
        pageSize: PAGE_SIZE,
        currentPage: Pagination.currentPage || 1,
        onChange: (p) => {
            Pagination.currentPage = p;
            renderReports();
        }
    });
}

/* 状态 + 颜色标签 */
function renderStatus(status) {
    const text = status === "approved" ? "已审" : "未审";
    const cls = status === "approved" ? "status-approved" : "status-pending";
    return `<span class="${cls}">${text}</span>`;
}

/* ============================================================
五、统计卡片（含“未填写记录”）
============================================================ */
function updateStats(list) {
    const now = new Date();

    const pending = list.filter(r => r.status !== "approved").length;
    const total = list.length;

    const week = list.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date);
        return (now - d) / 86400000 < 7;
    }).length;

    const month = list.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date);
        return (now - d) / 86400000 < 30;
    }).length;

    // ✅ 未填写记录：按“今天”统计
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayReportsJobIds = allReports
        .filter(r => r.date === todayStr)
        .map(r => r.jobId);

    const missing = allUsers.filter(u => !todayReportsJobIds.includes(u.job_no)).length;

    stat_pending.textContent = pending;
    stat_total.textContent = total;
    stat_week.textContent = week;
    stat_month.textContent = month;
    stat_missing.textContent = missing;
}

/* ============================================================
六、新增汇报
============================================================ */
async function addReport() {
    const user = getSessionUser();

    // ✅ 这里兼容你人员系统的字段：jobId / job_no / username + name / displayName
    const jobId = user && (user.jobId || user.job_no || user.username);
    const name = user && (user.name || user.displayName);

    if (!jobId || !name) {
        alert("登录信息缺失，请重新登录");
        return;
    }

    const date = add_date.value;
    const content = add_content.value.trim();
    const plan = add_plan.value.trim();
    const remark = add_remark.value.trim();

    addError.textContent = "";

    if (!date || !content) {
        addError.textContent = "请填写日期和工作内容";
        return;
    }

    const supabase = window.supabaseClient;

    const { error } = await supabase.from("work_reports").insert({
        date,
        job_id: jobId,
        name,
        content,
        plan,
        remark,
        status: "pending"
    });

    if (error) {
        console.error("新增工作失败：", error);
        addError.textContent = "新增失败，请检查控制台";
        return;
    }

    closeAddModal();
    await loadReportsFromSupabase();
}

function openAddModal() {
    add_date.value = new Date().toISOString().slice(0, 10);
    add_content.value = "";
    add_plan.value = "";
    add_remark.value = "";
    addError.textContent = "";
    Modal.open("addModal");
}

function closeAddModal() {
    Modal.close("addModal");
}

/* ============================================================
七、编辑汇报
============================================================ */
function openEditModal(id) {
    const r = allReports.find(x => x.id === id);
    if (!r) return;

    editTargetId = id;

    edit_date.value = r.date || "";
    edit_content.value = r.content || "";
    edit_plan.value = r.plan || "";
    edit_remark.value = r.remark || "";

    editError.textContent = "";
    Modal.open("editModal");
}

async function saveReportEdit() {
    if (!editTargetId) return;

    const date = edit_date.value;
    const content = edit_content.value.trim();
    const plan = edit_plan.value.trim();
    const remark = edit_remark.value.trim();

    editError.textContent = "";

    if (!date || !content) {
        editError.textContent = "请填写日期和工作内容";
        return;
    }

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("work_reports")
        .update({
            date,
            content,
            plan,
            remark
        })
        .eq("id", editTargetId);

    if (error) {
        console.error("保存失败：", error);
        editError.textContent = "保存失败，请检查控制台";
        return;
    }

    editTargetId = null;
    closeEditModal();
    await loadReportsFromSupabase();
}

function closeEditModal() {
    Modal.close("editModal");
}

/* ============================================================
八、删除汇报
============================================================ */
function openDeleteModal(id) {
    deleteTargetId = id;
    deleteText.textContent = "确认删除该工作汇报吗？";
    Modal.open("deleteModal");
}

function closeDeleteModal() {
    deleteTargetId = null;
    Modal.close("deleteModal");
}

async function confirmDeleteReport() {
    if (!deleteTargetId) return;

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("work_reports")
        .delete()
        .eq("id", deleteTargetId);

    if (error) {
        console.error("删除失败：", error);
        alert("删除失败，请检查控制台");
        return;
    }

    deleteTargetId = null;
    Modal.close("deleteModal");
    await loadReportsFromSupabase();
}

/* ============================================================
九、审批（未审 → 已审）
============================================================ */
function openApproveModal(id) {
    approveTargetId = id;
    approveText.textContent = "确认将该工作汇报标记为“已审”吗？";
    Modal.open("approveModal");
}

function closeApproveModal() {
    approveTargetId = null;
    Modal.close("approveModal");
}

async function confirmApprove() {
    if (!approveTargetId) return;

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("work_reports")
        .update({ status: "approved" })
        .eq("id", approveTargetId);

    if (error) {
        console.error("审批失败：", error);
        alert("审批失败，请检查控制台");
        return;
    }

    approveTargetId = null;
    Modal.close("approveModal");
    await loadReportsFromSupabase();
}

/* ============================================================
十、导出 / 导入（保持不变）
============================================================ */
async function exportReportsExcel() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("work_reports")
        .select("*")
        .order("date", { ascending: false });

    if (error) {
        console.error("导出失败：", error);
        alert("导出失败，请检查控制台");
        return;
    }

    if (window.ExcelUtil && ExcelUtil.export) {
        ExcelUtil.export(data, "工作汇报");
    } else {
        const ws = XLSX.utils.json_to_sheet(data || []);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "工作汇报");
        XLSX.writeFile(wb, "工作汇报.xlsx");
    }
}

async function importReportsExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const mapped = rows.map(r => ({
            date: r.date || r.日期 || null,
            job_id: r.job_id || r.工号 || null,
            name: r.name || r.姓名 || "",
            content: r.content || r.工作内容 || "",
            plan: r.plan || r.明日计划 || "",
            remark: r.remark || r.备注 || "",
            status: r.status || r.状态 || "pending"
        }));

        const supabase = window.supabaseClient;

        const { error } = await supabase
            .from("work_reports")
            .insert(mapped);

        if (error) {
            console.error("导入失败：", error);
            alert("导入失败，请检查控制台");
            return;
        }

        alert("导入成功");
        await loadReportsFromSupabase();
    };

    reader.readAsArrayBuffer(file);
}

/* ============================================================
十一、备份管理（保持原逻辑）
============================================================ */
function openBackupManager() {
    loadBackups();
    Modal.open("backupModal");
}

function closeBackupManager() {
    Modal.close("backupModal");
}

async function loadBackups() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("work_backups")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        backupList.textContent = "加载失败";
        return;
    }

    if (!data.length) {
        backupList.textContent = "暂无备份";
        return;
    }

    backupList.innerHTML = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>名称</th>
                    <th>创建时间</th>
                    <th>记录数</th>
                    <th class="col-action">操作</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(b => `
                    <tr>
                        <td>${b.name}</td>
                        <td>${b.created_at}</td>
                        <td>${b.count}</td>
                        <td class="col-action action-cell">
                            <button class="btn-approve" onclick="restoreBackup(${b.id})">恢复</button>
                            <button class="danger" onclick="deleteBackup(${b.id})">删除</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

async function createBackup() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("work_reports")
        .select("*");

    if (error) {
        alert("创建备份失败");
        return;
    }

    const name = "工作汇报备份 " + new Date().toLocaleString();

    const { error: insErr } = await supabase
        .from("work_backups")
        .insert({
            name,
            created_at: new Date().toISOString(),
            count: data.length,
            data
        });

    if (insErr) {
        alert("创建备份失败");
        return;
    }

    loadBackups();
}

async function restoreBackup(id) {
    if (!confirm("确认恢复该备份？")) return;

    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("work_backups")
        .select("data")
        .eq("id", id)
        .single();

    if (error) {
        alert("读取备份失败");
        return;
    }

    const rows = data.data || [];

    await supabase.from("work_reports").delete().neq("id", -1);
    await supabase.from("work_reports").insert(rows);

    alert("恢复完成");
    await loadReportsFromSupabase();
}

async function deleteBackup(id) {
    if (!confirm("确认删除该备份？")) return;

    const supabase = window.supabaseClient;

    await supabase.from("work_backups").delete().eq("id", id);
    loadBackups();
}

/* ============================================================
十二、初始化
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    const user = getSessionUser();
    if (!user) {
        alert("未登录，请先登录");
        location.href = "login.html";
        return;
    }

    await loadUsersFromSupabase();      // 先加载人员
    await loadReportsFromSupabase();    // 再加载汇报
});
