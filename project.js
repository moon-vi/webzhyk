/* ============================================================
订单系统（project.js）
============================================================ */

let orders = [];
let accountList = [];
let editOrderId = null;
let completeOrderId = null;

/* ============================================================
日志记录
============================================================ */
function addLog(o, action) {
    if (!o.logs) o.logs = [];

    const user = Auth.currentUser || {};
    const account = user.username || "未知账号";
    const name = user.name || "未知姓名";
    const time = new Date().toLocaleString();

    const log = `【${action}】${time} 账号：${account} 姓名：${name}`;
    o.logs.unshift(log);

    if (o.logs.length > 10) {
        o.logs = o.logs.slice(0, 10);
    }
}

/* ============================================================
标签颜色映射
============================================================ */
function getTagType(field, value) {
    const map = {
        contract: {
            "未签约": "red",
            "不签约": "gray",
            "已签约": "green"
        },
        invoice: {
            "未开票": "red",
            "不开票": "gray",
            "已开票": "green"
        },
        payment: {
            "未回款": "red",
            "少回款": "gray",
            "已回款": "green"
        },
        commission: {
            "未结算": "red",
            "无提成": "gray",
            "已结算": "green"
        }
    };

    return map[field]?.[value] || "gray";
}

/* ============================================================
从 Supabase 加载订单
============================================================ */
async function loadOrdersFromSupabase() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("start_date", { ascending: false });

    if (error) {
        console.error("加载订单失败：", error);
        alert("加载订单失败，请检查控制台");
        return;
    }

    orders = data.map(o => ({
        id: o.id,
        startDate: o.start_date,
        unit: o.unit,
        name: o.name,
        amount: o.amount,
        customer: o.customer,
        phone: o.phone,
        manager: o.manager,
        consultant: o.consultant,
        director: o.director,
        contract: o.contract,
        invoice: o.invoice,
        payment: o.payment,
        commission: o.commission,
        remark: o.remark,
        logs: o.logs || [],
        completed: o.completed
    }));

    render();
}

/* ============================================================
从 Supabase 加载人员列表
============================================================ */
async function loadAccounts() {
    const supabase = window.supabaseClient;

    const { data, error } = await supabase
        .from("users")
        .select("name, enabled")
        .order("name");

    if (!error) {
        accountList = data.filter(a => a.enabled !== false);
    }
}

/* ============================================================
渲染主表格 + 分页 + 统计
============================================================ */
function render() {

    const tbody = document.querySelector("#dataTable tbody");

    // ★★★★★ 第一次渲染时 tbody 是空的 → 先渲染一行假数据用于测量行高
    if (tbody.children.length === 0) {
        tbody.innerHTML = `
            <tr><td style="height:40px; padding:0; margin:0;" colspan="20"></td></tr>
        `;
    }

    // ★★★★★ 现在 calcPageSize() 一定能测到正确行高
    const newSize = calcPageSize();
if (newSize && newSize !== PaginationManager.pageSize) {
    PaginationManager.pageSize = newSize;
    PaginationManager.currentPage = 1;
}


    // 清空假数据
    tbody.innerHTML = "";


    const keyword = document.getElementById("keyword").value.trim();
    let data = keyword ? AutoSearch.run(orders, keyword, "dataTable") : orders;

    const user = Auth.currentUser || {};
    const role = user.role;

    // ★ 员工 / 外包：只能看到自己订单
    if (role === "staff" || role === "outsourcing") {
        data = data.filter(o =>
            o.manager === user.name ||
            o.consultant === user.name ||
            o.director === user.name
        );
    }

    data = Utils.sortByDate(data, "startDate");

    const total = data.length;
    const pageData = PaginationManager.slice(data);
/* ============================================================
    渲染表格行
    ============================================================= */
    pageData.forEach(o => {
        const tr = document.createElement("tr");

        const amountDisplay = "¥" + Utils.money(o.amount);
        const hideActions = (role === "staff" || role === "outsourcing");

        tr.innerHTML = `
<td>${o.startDate || ""}</td>

<td>
    ${o.completed 
        ? `<span class="tag tag-green">完成</span>` 
        : `<span class="tag tag-gray">进行</span>`}
</td>

<td>${o.unit || ""}</td>
<td>${o.name || ""}</td>
<td>${o.customer || ""}</td>
<td>${o.manager || ""}</td>
<td>${amountDisplay}</td>

<td>${Tag.render({ text: o.contract, type: getTagType("contract", o.contract) })}</td>
<td>${Tag.render({ text: o.invoice, type: getTagType("invoice", o.invoice) })}</td>
<td>${Tag.render({ text: o.payment, type: getTagType("payment", o.payment) })}</td>
<td>${Tag.render({ text: o.commission, type: getTagType("commission", o.commission) })}</td>

<td class="action-cell">

    <button class="btn-approve"
        onclick="event.stopPropagation(); openEdit('${o.id}')"
        ${o.completed ? "disabled" : ""}>
        编辑
    </button>

    ${hideActions ? "" : `
    <button class="btn-pay-green"
        onclick="event.stopPropagation(); toggleComplete('${o.id}')">
        完成
    </button>`}

    ${hideActions ? "" : `
    <button class="danger"
        onclick="event.stopPropagation(); removeOrder('${o.id}')"
        ${o.completed ? "disabled" : ""}>
        删除
    </button>`}

</td>
`;

        tr.onclick = () => view(o.id);
        tbody.appendChild(tr);
    });

    renderStats(data);

    /* ============================================================
    ★ 分页组件必须使用最新的 pageSize
    ============================================================= */
    PaginationManager.renderPager(total);
}

/* ============================================================
统计卡片
============================================================ */
function renderStats(list) {
    const user = Auth.currentUser || {};
    const role = user.role;

    let statOrders = orders;

    if (role === "staff" || role === "outsourcing") {
        statOrders = orders.filter(o =>
            o.manager === user.name ||
            o.consultant === user.name ||
            o.director === user.name
        );
    }

    let total = 0, paid = 0, filtered = 0;

    statOrders.forEach(o => {
        const amt = Number(o.amount || 0);
        total += amt;
        if (o.payment === "已回款") paid += amt;
    });

    list.forEach(o => filtered += Number(o.amount || 0));

    document.getElementById("stat1").textContent = statOrders.length;
    document.getElementById("stat2").textContent = "¥" + Utils.money(total);
    document.getElementById("stat3").textContent = "¥" + Utils.money(paid);
    document.getElementById("stat4").textContent = "¥" + Utils.money(total - paid);
    document.getElementById("stat5").textContent = "¥" + Utils.money(filtered);
}

/* ============================================================
新增订单（默认选择值已修复）
============================================================ */
function openAdd() {
    editOrderId = null;

    document.querySelectorAll("#editModal input, #editModal textarea")
        .forEach(i => i.value = "");

    document.getElementById("m_startDate").value = new Date().toISOString().slice(0, 10);

    document.getElementById("m_contract").value = "未签约";
    document.getElementById("m_invoice").value = "未开票";
    document.getElementById("m_payment").value = "未回款";
    document.getElementById("m_commission").value = "未结算";

    const logBox = document.getElementById("m_logs");
    if (logBox) logBox.innerText = "（保存后自动生成日志）";

    Modal.open("editModal");
}

/* ============================================================
编辑订单
============================================================ */
function openEdit(orderId) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;

    editOrderId = orderId;

    document.getElementById("m_manager").value = "";
    document.getElementById("m_consultant").value = "";
    document.getElementById("m_director").value = "";

    Object.entries(o).forEach(([k, v]) => {
        const el = document.getElementById("m_" + k);
        if (el) el.value = v;
    });

    const logBox = document.getElementById("m_logs");
    logBox.innerText = (o.logs || []).join("\n");

    Modal.open("editModal");
}

/* ============================================================
保存订单（新增 / 编辑）
============================================================ */
async function saveOrder() {
    const startDate = document.getElementById("m_startDate").value.trim();
    const unit = document.getElementById("m_unit").value.trim();
    const name = document.getElementById("m_name").value.trim();

    if (!startDate) return alert("请填写订单日期");
    if (!unit) return alert("请填写项目单位");
    if (!name) return alert("请填写项目名称");

    const o = {};
    document.querySelectorAll("#editModal [id^='m_']").forEach(el => {
        o[el.id.replace("m_", "")] = el.value;
    });

    const supabase = window.supabaseClient;

    /* -------------------------------
       新增订单
    --------------------------------*/
    if (!editOrderId) {
        addLog(o, "新增订单");

        const { error } = await supabase.from("orders").insert({
            start_date: o.startDate,
            unit: o.unit,
            name: o.name,
            amount: Number(o.amount || 0),
            customer: o.customer,
            phone: o.phone,
            manager: o.manager,
            consultant: o.consultant,
            director: o.director,
            contract: o.contract,
            invoice: o.invoice,
            payment: o.payment,
            commission: o.commission,
            remark: o.remark,
            logs: o.logs || [],
            completed: false
        });

        if (error) {
            console.error("新增订单失败：", error);
            return alert("新增订单失败，请检查控制台");
        }
    }

    /* -------------------------------
       编辑订单
    --------------------------------*/
    else {
        const old = orders.find(x => x.id === editOrderId);
        o.logs = old.logs || [];
        addLog(o, "编辑订单");

        const { error } = await supabase
            .from("orders")
            .update({
                start_date: o.startDate,
                unit: o.unit,
                name: o.name,
                amount: Number(o.amount || 0),
                customer: o.customer,
                phone: o.phone,
                manager: o.manager,
                consultant: o.consultant,
                director: o.director,
                contract: o.contract,
                invoice: o.invoice,
                payment: o.payment,
                commission: o.commission,
                remark: o.remark,
                logs: o.logs
            })
            .eq("id", editOrderId);

        if (error) {
            console.error("编辑订单失败：", error);
            return alert("编辑订单失败，请检查控制台");
        }
    }

    Modal.close("editModal");
    await loadOrdersFromSupabase();
}

/* ============================================================
查看详情
============================================================ */
function view(orderId) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;

    Object.entries(o).forEach(([k, v]) => {
        const el = document.getElementById("v_" + k);
        if (el) el.innerText = v || "";
    });

    const logBox = document.getElementById("v_logs");
    logBox.innerText = (o.logs || []).join("\n");

    Modal.open("viewModal");
}

/* ============================================================
删除订单
============================================================ */
function removeOrder(orderId) {
    const o = orders.find(x => x.id === orderId);

    Confirm.open({
        modalId: "deleteModal",
        textId: "deleteText",
        text: `确定删除订单：${o.name}?`,
        onConfirm: async () => {
            addLog(o, "删除订单");

            const supabase = window.supabaseClient;
            const { error } = await supabase
                .from("orders")
                .delete()
                .eq("id", orderId);

            if (error) {
                console.error("删除订单失败：", error);
                return alert("删除订单失败，请检查控制台");
            }

            await loadOrdersFromSupabase();
        }
    });
}

function confirmDelete() {
    Confirm.confirm();
}

/* ============================================================
完成状态切换
============================================================ */
function toggleComplete(orderId) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;

    completeOrderId = orderId;

    document.getElementById("completeText").innerText =
        o.completed ? "取消完成？" : "标记为完成？";

    Modal.open("completeModal");
}

async function confirmComplete() {
    const o = orders.find(x => x.id === completeOrderId);
    if (!o) return;

    if (o.completed) addLog(o, "取消完成");
    else addLog(o, "标记为完成");

    const supabase = window.supabaseClient;

    const { error } = await supabase
        .from("orders")
        .update({
            completed: !o.completed,
            logs: o.logs
        })
        .eq("id", completeOrderId);

    if (error) {
        console.error("更新完成状态失败：", error);
        return alert("更新完成状态失败，请检查控制台");
    }

    Modal.close("completeModal");
    await loadOrdersFromSupabase();
}

/* ============================================================
备份管理
============================================================ */
function openBackupManager() {
    Modal.open("backupModal");
    Backup.renderList("backupList", "orders", "restoreOrdersBackup", "deleteOrdersBackup");
}

async function restoreOrdersBackup(date) {
    const data = Backup.restore("orders", date);
    if (!data) {
        alert("备份不存在");
        return;
    }

    const supabase = window.supabaseClient;

    const rows = data.map(r => ({
        start_date: r.startDate,
        unit: r.unit,
        name: r.name,
        amount: Number(r.amount || 0),
        customer: r.customer,
        phone: r.phone,
        manager: r.manager,
        consultant: r.consultant,
        director: r.director,
        contract: r.contract,
        invoice: r.invoice,
        payment: r.payment,
        commission: r.commission,
        remark: r.remark,
        logs: Array.isArray(r.logs) ? r.logs : [],
        completed: !!r.completed
    }));

    const { error: delErr } = await supabase
        .from("orders")
        .delete()
        .not("id", "is", null);

    if (delErr) {
        console.error("清空订单失败", delErr);
        alert("清空订单失败，请检查控制台");
        return;
    }

    const { error: insErr } = await supabase
        .from("orders")
        .insert(rows);

    if (insErr) {
        console.error("恢复备份失败", insErr);
        alert("恢复备份失败，请检查控制台");
        return;
    }

    await loadOrdersFromSupabase();
    Modal.close("backupModal");
}

function deleteOrdersBackup(date) {
    Backup.delete("orders", date);
    Backup.renderList("backupList", "orders", "restoreOrdersBackup", "deleteOrdersBackup");
}

/* ============================================================
Excel 导出 / 导入（订单系统）
============================================================ */
function exportOrdersExcel() {
    if (!orders.length) return alert("暂无数据");
    ExcelUtil.export(orders, "订单数据");
}

function importOrdersExcel(e) {
    ExcelUtil.import(e, async json => {
        const supabase = window.supabaseClient;

        const rows = json.map(r => {
            const clean = {};
            for (let key in r) {
                const newKey = key.replace(/\s+/g, "").trim();
                clean[newKey] = r[key];
            }

            const o = {
                startDate: clean["开始时间"] || "",
                unit: clean["项目单位"] || "",
                name: clean["项目名称"] || "",
                amount: Number(clean["签约金额"] || 0),
                customer: clean["客户名"] || "",
                phone: clean["联系电话"] || "",
                manager: clean["客户经理"] || "",
                consultant: clean["课程顾问"] || "",
                director: clean["课程编导"] || "",
                contract: clean["合同"] || "",
                invoice: clean["发票"] || "",
                payment: clean["回款"] || "",
                commission: clean["提成"] || "",
                remark: clean["备注"] || "",
                logs: [],
                completed: false
            };

            return {
                start_date: o.startDate,
                unit: o.unit,
                name: o.name,
                amount: o.amount,
                customer: o.customer,
                phone: o.phone,
                manager: o.manager,
                consultant: o.consultant,
                director: o.director,
                contract: o.contract,
                invoice: o.invoice,
                payment: o.payment,
                commission: o.commission,
                remark: o.remark,
                logs: o.logs,
                completed: o.completed
            };
        });

        // ✅ 修复清空错误：uuid 类型不能用 -1
        const { error: delErr } = await supabase
            .from("orders")
            .delete()
            .not("id", "is", null);

        if (delErr) {
            console.error("清空订单失败", delErr);
            alert("清空订单失败，请检查控制台");
            return;
        }

        const { error: insErr } = await supabase
            .from("orders")
            .insert(rows);

        if (insErr) {
            console.error("导入订单失败", insErr);
            alert("导入订单失败，请检查控制台");
            return;
        }

        await loadOrdersFromSupabase();
    });
}

/* ============================================================
弹窗关闭
============================================================ */
function closeModal() { Modal.close("editModal"); }
function closeView() { Modal.close("viewModal"); }
function closeDelete() { Modal.close("deleteModal"); }
function closeComplete() { Modal.close("completeModal"); }
function closeBackupManager() { Modal.close("backupModal"); }

/* ============================================================
初始化：加载订单 + 加载人员 + 搜索绑定 + 权限处理
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {

    await loadAccounts();
    await loadOrdersFromSupabase();

    PaginationManager.attach({
        tableSelector: ".table-scroll",
        renderCallback: render
    });

    const kw = document.getElementById("keyword");
    if (kw) {
        kw.oninput = () => {
            PaginationManager.currentPage = 1;
            render();
        };
    }
});
/* ============================================================
初始化订单系统的智能下拉（客户经理 / 顾问 / 编导）
============================================================ */
function initOrderSmartSelect() {
    attachSmartSelect(
        document.getElementById("m_manager"),
        () => accountList.map(a => a.name)
    );

    attachSmartSelect(
        document.getElementById("m_consultant"),
        () => accountList.map(a => a.name)
    );

    attachSmartSelect(
        document.getElementById("m_director"),
        () => accountList.map(a => a.name)
    );
}

/* 页面加载后自动绑定 */
document.addEventListener("DOMContentLoaded", initOrderSmartSelect);
