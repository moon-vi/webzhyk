/* ============================================================
人员系统（account.js）
Supabase 版：搜索 + 分页 + 新增/修改 + 删除 + 启用禁用 + 日志 + 导出 + 恢复
============================================================ */

let allAccounts = [];
let filteredList = [];
let deleteTarget = null;

/* ============================================================
一、从 Supabase 读取账号列表
============================================================ */
async function loadAccountsFromSupabase() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("job_no", { ascending: true });

    if (error) {
        console.error("加载账号列表失败：", error);
        alert("加载账号列表失败，请检查控制台");
        return;
    }

    allAccounts = (data || []).map(u => ({
        jobId: u.job_no || "",
        name: u.name || "",
        phone: u.phone || "",
        password: u.password_hash || "",
        role: u.role || "staff",
        remark: u.remark || "",
        enabled: u.enabled !== false,

        salary_base: u.salary_base || 0,
        salary_post: u.salary_post || 0,
        salary_performance: u.salary_performance || 0,
        salary_computer: u.salary_computer || 0,
        salary_traffic: u.salary_traffic || 0
    }));

    filteredList = allAccounts.slice();
PaginationManager.currentPage = 1;
PaginationManager.render();
}

/* ============================================================
二、搜索
============================================================ */
function searchAccounts() {
    const keyword = document.getElementById("searchInput").value.trim().toLowerCase();

    if (!keyword) {
        filteredList = allAccounts.slice();
    } else {
        filteredList = allAccounts.filter(acc =>
            (acc.jobId || "").toLowerCase().includes(keyword) ||
            (acc.name || "").toLowerCase().includes(keyword) ||
            (acc.phone || "").toLowerCase().includes(keyword) ||
            (acc.remark || "").toLowerCase().includes(keyword)
        );
    }

    PaginationManager.currentPage = 1;
PaginationManager.render();
}

/* ============================================================
三、添加账号
============================================================ */
async function addAccount() {
    const jobId = acc_jobId.value.trim();
    const name = acc_name.value.trim();
    const phone = acc_phone.value.trim();
    const password = acc_password.value.trim();
    const role = acc_role.value;
    const remark = acc_remark.value.trim();

    const salary_base = Number(acc_salary_base.value || 0);
    const salary_post = Number(acc_salary_post.value || 0);
    const salary_performance = Number(acc_salary_performance.value || 0);
    const salary_computer = Number(acc_salary_computer.value || 0);
    const salary_traffic = Number(acc_salary_traffic.value || 0);

    const errorEl = document.getElementById("addError");
    errorEl.textContent = "";

    if (!jobId || !name || !phone || !password) {
        errorEl.textContent = "请填写完整信息";
        return;
    }

    if (allAccounts.some(acc => acc.jobId === jobId)) {
        errorEl.textContent = "工号已存在";
        return;
    }

    const supabase = window.supabaseClient;

    const { error } = await supabase.from("users").insert({
        job_no: jobId,
        name,
        phone,
        password_hash: password,
        role,
        remark,
        enabled: true,
        salary_base,
        salary_post,
        salary_performance,
        salary_computer,
        salary_traffic
    });

    if (error) {
        console.error("添加账号失败：", error);
        errorEl.textContent = "添加账号失败，请检查控制台";
        return;
    }

    closeAddModal();
    await loadAccountsFromSupabase();
}

/* ============================================================
四、编辑账号
============================================================ */
function openEditModal(jobId) {
    const acc = allAccounts.find(a => a.jobId === jobId);
    if (!acc) return;

    edit_jobId.value = acc.jobId;
    edit_name.value = acc.name;
    edit_phone.value = acc.phone;
    edit_password.value = acc.password;
    edit_role.value = acc.role;
    edit_remark.value = acc.remark || "";

    edit_salary_base.value = acc.salary_base || 0;
    edit_salary_post.value = acc.salary_post || 0;
    edit_salary_performance.value = acc.salary_performance || 0;
    edit_salary_computer.value = acc.salary_computer || 0;
    edit_salary_traffic.value = acc.salary_traffic || 0;

    document.getElementById("editError").textContent = "";
    Modal.open("editModal");
}

async function saveAccountEdit() {
    const jobId = edit_jobId.value.trim();
    const name = edit_name.value.trim();
    const phone = edit_phone.value.trim();
    const password = edit_password.value.trim();
    const role = edit_role.value;
    const remark = edit_remark.value.trim();

    const salary_base = Number(edit_salary_base.value || 0);
    const salary_post = Number(edit_salary_post.value || 0);
    const salary_performance = Number(edit_salary_performance.value || 0);
    const salary_computer = Number(edit_salary_computer.value || 0);
    const salary_traffic = Number(edit_salary_traffic.value || 0);

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("users")
        .update({
            name,
            phone,
            password_hash: password,
            role,
            remark,
            salary_base,
            salary_post,
            salary_performance,
            salary_computer,
            salary_traffic
        })
        .eq("job_no", jobId);

    if (error) {
        console.error("保存账号修改失败：", error);
        document.getElementById("editError").textContent = "保存失败，请检查控制台";
        return;
    }

    closeEditModal();
    await loadAccountsFromSupabase();
}

/* ============================================================
五、删除账号
============================================================ */
function confirmDelete(jobId) {
    deleteTarget = jobId;
    Modal.open("deleteModal");
}

async function deleteAccount() {
    if (!deleteTarget) return;

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("users")
        .delete()
        .eq("job_no", deleteTarget);

    if (error) {
        console.error("删除账号失败：", error);
        alert("删除失败，请检查控制台");
        return;
    }

    deleteTarget = null;
    closeDeleteModal();
    await loadAccountsFromSupabase();
}

/* ============================================================
六、启用 / 禁用账号
============================================================ */
async function toggleEnable(jobId) {
    const acc = allAccounts.find(a => a.jobId === jobId);
    if (!acc) return;

    const supabase = window.supabaseClient;
    const newEnabled = !acc.enabled;

    const { error } = await supabase
        .from("users")
        .update({ enabled: newEnabled })
        .eq("job_no", jobId);

    if (error) {
        console.error("更新启用状态失败：", error);
        alert("更新启用状态失败，请检查控制台");
        return;
    }

    acc.enabled = newEnabled;
    searchAccounts();
}

/* ============================================================
七、渲染账号列表 + 动态分页
============================================================ */
function renderAccounts() {
    const tbody = document.querySelector("#accountTable tbody");

    /* ------------------------------------------------------------
       ★★★★★ 第一次渲染时 tbody 是空的 → 插入一行假数据用于测量行高
       ------------------------------------------------------------ */
    if (tbody.children.length === 0) {
        tbody.innerHTML = `
            <tr><td style="height:40px; padding:0; margin:0;" colspan="20"></td></tr>
        `;
    }

    /* ------------------------------------------------------------
       ★★★★★ 现在 calcPageSize() 一定能测到正确行高
       ------------------------------------------------------------ */
    const newSize = calcPageSize();
    if (newSize && newSize !== PaginationManager.pageSize) {
        PaginationManager.pageSize = newSize;
        PaginationManager.currentPage = 1;
    }

    // 清空假数据
    tbody.innerHTML = "";

    /* ------------------------------------------------------------
       数据过滤 + 排序
       ------------------------------------------------------------ */
    const list = filteredList.length ? filteredList : allAccounts;
    const total = list.length;

    /* ------------------------------------------------------------
       ★ 使用 PaginationManager 统一分页
       ------------------------------------------------------------ */
    const pageList = PaginationManager.slice(list);

    /* ------------------------------------------------------------
       渲染表格
       ------------------------------------------------------------ */
    tbody.innerHTML = pageList.map(acc => `
        <tr>
            <td>${acc.jobId}</td>
            <td>${acc.name}</td>
            <td>${acc.phone}</td>
            <td>${roleName(acc.role)}</td>
            <td>${acc.password}</td>
            <td>${acc.remark || ""}</td>
            <td>${acc.salary_base}</td>
            <td>${acc.salary_post}</td>
            <td>${acc.salary_performance}</td>
            <td>${acc.salary_computer}</td>
            <td>${acc.salary_traffic}</td>

            <td class="col-action action-cell">
                <button class="btn-approve" onclick="event.stopPropagation(); openEditModal('${acc.jobId}')">修改</button>
                <button class="danger" onclick="event.stopPropagation(); confirmDelete('${acc.jobId}')">删除</button>
                <button class="${acc.enabled ? 'btn-pay-green' : 'btn-pay-gray'}"
                        onclick="event.stopPropagation(); toggleEnable('${acc.jobId}')">
                    ${acc.enabled ? '启用' : '禁用'}
                </button>
            </td>
        </tr>
    `).join("");

    /* ------------------------------------------------------------
       统计卡片
       ------------------------------------------------------------ */
    updateStats(list);

    /* ------------------------------------------------------------
       ★ 渲染分页组件（统一走 PaginationManager）
       ------------------------------------------------------------ */
    PaginationManager.renderPager(total);
}

/* ============================================================
角色名称映射
============================================================ */
function roleName(role) {
    return {
        admin: "管理员",
        boss: "老板",
        staff: "员工",
        finance: "财务",
        outsourcing: "外包"
    }[role] || role;
}

/* ============================================================
八、日志系统
============================================================ */
async function openLogModal() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("account_logs")
        .select("*")
        .order("time", { ascending: false });

    if (error) {
        console.error("加载日志失败：", error);
        alert("加载日志失败，请检查控制台");
        return;
    }

    window._allLogs = data || [];
    window._filteredLogs = data || [];

    renderLogTable();
    Modal.open("logModal");
}

function renderLogTable() {
    const tbody = document.querySelector("#logTable tbody");
    const list = window._filteredLogs || [];

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">暂无日志</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(log => `
        <tr>
            <td>${log.time}</td>
            <td>${log.username}</td>
            <td>${log.display_name}</td>
            <td>${log.role}</td>
            <td>${log.ip}</td>
            <td>${log.ua}</td>
        </tr>
    `).join("");
}

function searchLogs() {
    const keyword = document.getElementById("logSearchInput").value.trim().toLowerCase();

    if (!keyword) {
        window._filteredLogs = window._allLogs;
    } else {
        window._filteredLogs = window._allLogs.filter(log =>
            (log.username || "").toLowerCase().includes(keyword) ||
            (log.display_name || "").toLowerCase().includes(keyword) ||
            (log.ip || "").toLowerCase().includes(keyword) ||
            (log.role || "").toLowerCase().includes(keyword) ||
            (log.ua || "").toLowerCase().includes(keyword)
        );
    }

    renderLogTable();
}

async function clearLogs() {
    const sessionUser = JSON.parse(sessionStorage.getItem("sessionUser") || "null");

    if (!sessionUser || sessionUser.role !== "admin") {
        alert("只有管理员可以清空日志");
        return;
    }

    if (!confirm("确定要清空所有系统日志吗？")) return;

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("account_logs")
        .delete()
        .neq("id", -1);

    if (error) {
        console.error("清空日志失败：", error);
        alert("清空日志失败，请检查控制台");

        return;
    }

    window._allLogs = [];
    window._filteredLogs = [];
    renderLogTable();
}

/* ============================================================
九、导出全部账号
============================================================ */
async function exportAllAccounts() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("job_no", { ascending: true });

    if (error) {
        console.error("导出失败：", error);
        alert("导出失败，请检查控制台");
        return;
    }

    ExcelUtil.export(data, "人员系统");
}

/* ============================================================
十、恢复全部账号
============================================================ */
async function restoreAllAccounts(backupRows) {
    const supabase = window.supabaseClient;

    const { error: delErr } = await supabase
        .from("users")
        .delete()
        .neq("job_no", "");

    if (delErr) {
        console.error("清空失败：", delErr);
        alert("清空失败，请检查控制台");
        return;
    }

    const { error: insErr } = await supabase
        .from("users")
        .insert(backupRows);

    if (insErr) {
        console.error("恢复失败：", insErr);
        alert("恢复失败，请检查表结构");
        return;
    }

    await loadAccountsFromSupabase();
}

/* ============================================================
十一、统计卡片
============================================================ */
function updateStats(list) {
    document.getElementById("stat_count").textContent = list.length;

    const base = list.reduce((s, a) => s + (a.salary_base || 0), 0);
    const post = list.reduce((s, a) => s + (a.salary_post || 0), 0);
    const comp = list.reduce((s, a) => s + (a.salary_computer || 0), 0);
    const traf = list.reduce((s, a) => s + (a.salary_traffic || 0), 0);

    document.getElementById("stat_salary_base").textContent = base;
    document.getElementById("stat_salary_post").textContent = post;
    document.getElementById("stat_salary_computer").textContent = comp;
    document.getElementById("stat_salary_traffic").textContent = traf;
}

/* ============================================================
十二、弹窗控制
============================================================ */
function openAddModal() { Modal.open("addModal"); }
function closeAddModal() { Modal.close("addModal"); }
function closeEditModal() { Modal.close("editModal"); }
function closeDeleteModal() { Modal.close("deleteModal"); }
function closeLogModal() { Modal.close("logModal"); }

/* ============================================================
十三、初始化
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    // ★ 先绑定分页管理器（必须在第一次渲染前）
    PaginationManager.attach({
        tableSelector: ".table-scroll",   // 如果人员页面用的是别的容器类名，这里改成对应的
        renderCallback: renderAccounts
    });

    await loadAccountsFromSupabase();
});

/* ============================================================
十四、窗口大小变化 → 自动刷新分页（动态分页）
============================================================ */
window.addEventListener("resize", () => {
    PaginationManager.render();
});
