/* ============================================================
common.js — 全局组件 & 登录权限体系（最终整合版）
适用于：项目系统 / 财务系统通用
============================================================ */

/* ============================================================
登录校验：刷新 / 重开必须重新登录，正常跳转保持会话
============================================================ */
function requireLogin() {
    // 1. 从 sessionStorage 读取当前会话用户
    let sessionUser = null;
    try {
        sessionUser = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
    } catch {
        sessionUser = null;
    }

    // 2. 如果没有会话用户，直接跳登录
    if (!sessionUser) {
        window.location.href = "auth.html";
        return false;
    }

    // 3. 检测当前进入方式是否是“刷新”
    const navEntry = performance.getEntriesByType("navigation")[0];
    const navType = navEntry ? navEntry.type : "navigate";

    if (navType === "reload") {
        // 刷新：清除会话、回登录
        sessionStorage.removeItem("sessionUser");
        window.location.href = "auth.html";
        return false;
    }

    // 4. 正常跳转（navigate / back_forward）则允许
    return true;
}


/* ============================================================
1. 时间工具 Time
============================================================ */
const Time = {
    today() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    },

    timestampForFile() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        const ss = String(d.getSeconds()).padStart(2, "0");
        return `${y}${m}${day}-${hh}${mm}${ss}`;
    }
};

/* ============================================================
2. 通用工具 Utils / Tag
============================================================ */
const Utils = {
    search(list, keyword) {
        if (!keyword) return list;
        const k = keyword.toLowerCase();
        return list.filter(o => {
            return [
                o.name,
                o.unit,
                o.customer,
                o.manager,
                o.phone
            ].some(v => String(v || "").toLowerCase().includes(k));
        });
    },

    sortByDate(list, field) {
        return [...list].sort((a, b) => {
            const ta = new Date(a[field] || 0).getTime();
            const tb = new Date(b[field] || 0).getTime();
            return tb - ta;
        });
    },

    money(val) {
        const n = Number(val || 0);
        if (isNaN(n)) return "0.00";
        return n.toFixed(2);
    }
};

const Tag = {
    render({ text, type }) {
        return `<span class="tag tag-${type}">${text}</span>`;
    }
};

/* ============================================================
3. 自动搜索 AutoSearch（从 <th data-field=""> 读取字段）
============================================================ */
const AutoSearch = {
    getFields(tableId) {
        const ths = document.querySelectorAll(`#${tableId} thead th[data-field]`);
        return Array.from(ths).map(th => th.dataset.field);
    },

    run(list, keyword, tableId) {
        const fields = this.getFields(tableId);
        if (!fields.length) return list;
        if (!keyword) return list;

        const k = keyword.toLowerCase();

        return list.filter(o =>
            fields.some(f =>
                String(o[f] || "").toLowerCase().includes(k)
            )
        );
    }
};

/* ============================================================
4. Ripple 按钮点击水波纹效果
============================================================ */
document.addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    btn.classList.remove("ripple-active");
    void btn.offsetWidth;
    btn.classList.add("ripple-active");
    setTimeout(() => btn.classList.remove("ripple-active"), 400);
});

/* ============================================================
5. Modal 组件
============================================================ */
const Modal = {
    open(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        const content = modal.querySelector(".modal-content");
        if (content) content.classList.remove("closing");
        modal.style.display = "flex";
    },

    close(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        const content = modal.querySelector(".modal-content");
        if (content) content.classList.add("closing");
        setTimeout(() => {
            modal.style.display = "none";
            if (content) content.classList.remove("closing");
        }, 220);
    }
};

document.addEventListener("click", function (e) {
    const closeBtn = e.target.closest(".modal-close");
    if (!closeBtn) return;
    const modal = closeBtn.closest(".modal");
    if (modal) Modal.close(modal.id);
});

/* ============================================================
6. Confirm 组件（供 project.js / finance.js 使用）
============================================================ */
const Confirm = {
    _onConfirm: null,
    _modalId: null,

    open({ modalId, textId, text, onConfirm }) {
        this._modalId = modalId;
        this._onConfirm = onConfirm || null;

        const textEl = document.getElementById(textId);
        if (textEl) textEl.textContent = text || "";

        Modal.open(modalId);
    },

    confirm() {
        if (this._onConfirm) this._onConfirm();
        if (this._modalId) Modal.close(this._modalId);

        this._onConfirm = null;
        this._modalId = null;
    }
};

/* ============================================================
7. 通用存储 / 备份 Storage
============================================================ */
const Storage = {
    get(key, def = null) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : def;
        } catch {
            return def;
        }
    },

    set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    },

    // 模块化备份：backups[moduleKey][date] = data
    backupModule(moduleKey, dataKey) {
        const data = this.get(dataKey, []);
        if (!data || !data.length) return;

        const backups = this.get("backups", {});
        const today = Time.today();

        if (!backups[moduleKey]) backups[moduleKey] = {};
        backups[moduleKey][today] = data;

        this.set("backups", backups);
        this.set(`lastBackup_${moduleKey}`, today);
    },

    getModuleBackups(moduleKey) {
        const backups = this.get("backups", {});
        return backups[moduleKey] || {};
    },

    restoreModule(moduleKey, date) {
        const backups = this.get("backups", {});
        return backups[moduleKey]?.[date] || null;
    },

    deleteModuleBackup(moduleKey, date) {
        const backups = this.get("backups", {});
        if (backups[moduleKey]) {
            delete backups[moduleKey][date];
            this.set("backups", backups);
        }
    },

    cleanupModuleBackups(moduleKey, days) {
        const backups = this.get("backups", {});
        if (!backups[moduleKey]) return;

        const threshold = Date.now() - days * 86400000;
        const result = {};

        Object.keys(backups[moduleKey]).forEach(date => {
            const t = new Date(date).getTime();
            if (t >= threshold) result[date] = backups[moduleKey][date];
        });

        backups[moduleKey] = result;
        this.set("backups", backups);
    }
};

/* ============================================================
Backup（备份列表渲染）
============================================================ */
const Backup = {
    renderList(el, moduleKey, onRestore, onDelete) {
        const box = document.getElementById(el);
        const backups = Storage.getModuleBackups(moduleKey);

        if (!Object.keys(backups).length) {
            box.innerHTML = "<p>暂无备份</p>";
            return;
        }

        let html = `
        <table class="table">
            <thead><tr><th>备份日期</th><th>操作</th></tr></thead>
            <tbody>
        `;

        Object.keys(backups).forEach(date => {
            html += `
            <tr>
                <td>${date}</td>
                <td class="action-cell">

                    <button class="btn-approve" onclick="window['${onRestore}']('${date}')">恢复</button>
                    <button class="danger" onclick="window['${onDelete}']('${date}')">删除</button>
                </td>
            </tr>`;
        });

        html += "</tbody></table>";
        box.innerHTML = html;
    },

    restore: Storage.restoreModule.bind(Storage),
    delete: Storage.deleteModuleBackup.bind(Storage)
};

/* ============================================================
每日自动备份 + 清理 10 天前备份
============================================================ */
(function autoDailyBackup() {
    const today = Time.today();

    const modules = [
        { moduleKey: "orders", dataKey: "orders" },
        { moduleKey: "finance_daily", dataKey: "finance_daily" },
        { moduleKey: "finance_payroll", dataKey: "finance_payroll" },
        { moduleKey: "finance_project", dataKey: "finance_project" }
    ];

    modules.forEach(m => {
        const last = Storage.get(`lastBackup_${m.moduleKey}`, "");
        if (today !== last) {
            Storage.backupModule(m.moduleKey, m.dataKey);
            Storage.cleanupModuleBackups(m.moduleKey, 10);
        }
    });
})();

/* ============================================================
8. Pagination（统一分页组件）
============================================================ */
const Pagination = {
    currentPage: 1,   // 全局统一当前页
    pageSize: 16,     // 全局统一每页条数

    render({ el, total, pageSize, currentPage, onChange }) {
        const container =
            typeof el === "string" ? document.querySelector(el) : el;
        if (!container) return;

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const current = Math.min(Math.max(1, currentPage), totalPages);
        const windowSize = 16;

        container.innerHTML = "";

        const addBtn = (label, page, disabled = false, isEllipsis = false) => {
            const btn = document.createElement("button");
            btn.textContent = label;

            if (isEllipsis) {
                btn.disabled = true;
                btn.style.cursor = "default";
            }

            if (disabled) btn.disabled = true;
            if (page === current) btn.classList.add("active");

            if (!disabled && !isEllipsis && typeof page === "number") {
                btn.addEventListener("click", () => onChange(page));
            }

            container.appendChild(btn);
        };

        // 首页 / 上一页
        addBtn("首页", 1, current === 1);
        addBtn("上一页", current - 1, current === 1);

        // 窗口页码
        let half = Math.floor(windowSize / 2);
        let start = current - half;
        let end = current + half;

        if (start < 1) {
            end += (1 - start);
            start = 1;
        }

        if (end > totalPages) {
            start -= (end - totalPages);
            end = totalPages;
        }

        if (start < 1) start = 1;

        if (start > 1) {
            addBtn(1, 1);
            if (start > 2) addBtn("…", null, true, true);
        }

        for (let i = start; i <= end; i++) {
            addBtn(i, i);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) addBtn("…", null, true, true);
            addBtn(totalPages, totalPages);
        }

        // 下一页 / 尾页
        addBtn("下一页", current + 1, current === totalPages);
        addBtn("尾页", totalPages, current === totalPages);

        // 输入跳转
        const jumpInput = document.createElement("input");
        jumpInput.type = "number";
        jumpInput.min = 1;
        jumpInput.max = totalPages;
        jumpInput.placeholder = "跳转";
        jumpInput.className = "btn btn-gray btn-small";
        jumpInput.style.width = "auto";
        jumpInput.style.padding = "0 10px";
        jumpInput.style.height = "28px";
        jumpInput.style.lineHeight = "28px";
        jumpInput.style.marginLeft = "10px";
        jumpInput.style.textAlign = "center";
        jumpInput.style.boxSizing = "border-box";
        jumpInput.style.minWidth = "45px";

        jumpInput.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                let p = Number(jumpInput.value);
                if (!p || p < 1) return;
                if (p > totalPages) p = totalPages;
                onChange(p);
            }
        });

        container.appendChild(jumpInput);
    }
};

window.Pagination = Pagination;

/* ============================================================
9. Pager（供 project.js / finance.js 调用）
============================================================ */
const Pager = {
    render(el, total, pageSize, currentPage, onChange) {
        Pagination.render({
            el,
            total,
            pageSize,
            currentPage,
            onChange
        });
    }
};
		
/* ============================================================
10. ExcelUtil（供 project.js / finance.js 调用）
============================================================ */
const ExcelUtil = {
    export(data, filename = "数据导出") {
        if (!Array.isArray(data)) {
            alert("导出失败：数据格式错误");
            return;
        }

        const headerMap = {
            // 订单系统
            startDate: "开始时间",
            unit: "项目单位",
            name: "姓名",
            customer: "客户名",
            phone: "联系电话",
            manager: "客户经理",
            amount: "签约金额",
            contract: "合同",
            invoice: "发票",
            payment: "回款",
            commission: "提成",
            consultant: "课程顾问",
            director: "课程编导",
            remark: "备注",
            createTime: "创建时间",
            completed: "状态",

            // 财务系统
            date: "日期",
            month: "月份",
            payer: "经办人",
            project: "项目",
            item: "支出事由",
            logs: "操作日志",
            base: "基本工资",
            position: "岗位工资",
            perf: "绩效考核",
            bonus: "项目提成",
            pc: "电脑补贴",
            traffic: "交通补贴",
            other: "其他",
            actual: "实际发放",
            auditStatus: "审核状态",
            cashierStatus: "出纳状态"
        };

        const dataWithChineseHeader = data.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => {
                const cn = headerMap[key] || key;
                newRow[cn] = row[key];
            });
            return newRow;
        });

        const ws = XLSX.utils.json_to_sheet(dataWithChineseHeader);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

        const finalName = filename + "_" + Time.timestampForFile() + ".xlsx";
        XLSX.writeFile(wb, finalName);
    },

    import(event, callback) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            if (!Array.isArray(json)) {
                alert("导入失败：Excel 格式不正确");
                return;
            }

            callback(json);
        };

        reader.readAsArrayBuffer(file);
    }
};

/* ============================================================
11. 主题系统 Theme（使用 html/body.dark-mode，对应你现有 CSS）
============================================================ */
const Theme = {
    init() {
        // 这里不再自己读 localStorage，而是看 <html> 上有没有 dark-mode
        const isDark = document.documentElement.classList.contains("dark-mode");

        if (isDark) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }

        // 标记“主题已经初始化完成”（你原来就有）
        document.body.classList.add("theme-ready");
    },

    toggle() {
        // 当前是否要切到“深色”
        const isDark = !document.documentElement.classList.contains("dark-mode");

        if (isDark) {
            document.documentElement.classList.add("dark-mode");
            document.body.classList.add("dark-mode");
        } else {
            document.documentElement.classList.remove("dark-mode");
            document.body.classList.remove("dark-mode");
        }

        localStorage.setItem("themeMode", isDark ? "dark" : "light");
    }
};

// 提供给 HTML 按钮使用：onclick="toggleTheme()"
function toggleTheme(event) {
    if (event) {
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    Theme.toggle();
}

/* ============================================================
12. 登录日志记录（时间、IP、设备）——改成兼容 Supabase 用户结构
============================================================ */
async function recordLoginLog(user) {
    let ip = "unknown";
    try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ip = data.ip || "unknown";
    } catch (e) {
        console.warn("获取 IP 失败：", e);
    }

    const logItem = {
        username: user.phone || user.username || "",
        displayName: user.name || user.displayName || "",
        role: user.role,
        time: new Date().toLocaleString(),
        ip,
        ua: navigator.userAgent
    };

    const logs = Storage.get("loginLogs", []);
    logs.push(logItem);
    Storage.set("loginLogs", logs);
}

/* ============================================================
13. 登录逻辑（auth.html）——Supabase 版本
============================================================ */
window.login = async function () {
    const phone = document.getElementById("username")?.value.trim();
    const password = document.getElementById("password")?.value.trim();
    const errorEl = document.getElementById("authError");

    if (!phone || !password) {
        if (errorEl) errorEl.textContent = "请输入账号和密码";
        return;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            if (errorEl) errorEl.textContent = "Supabase 初始化失败，请检查 URL 和 anon key";
            return;
        }

        // 1. 从 Supabase 查询用户
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("phone", phone)
            .single();

        if (error || !user) {
            if (errorEl) errorEl.textContent = "账号不存在";
            return;
        }

        // 2. 先用明文密码对比（后面再改成加密）
        if (password !== user.password_hash) {
            if (errorEl) errorEl.textContent = "密码错误";
            return;
        }

        // 3. 登录成功：写入 sessionStorage（统一结构）
        const sessionUser = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            jobNo: user.job_no,
            loginTime: Date.now()
        };
        sessionStorage.setItem("sessionUser", JSON.stringify(sessionUser));

        // 4. 跳转入口页
        window.location.href = "index.html";

        // 5. 登录日志（异步，不阻塞跳转）
        recordLoginLog(sessionUser);

    } catch (e) {
        console.error("登录异常：", e);
        if (errorEl) errorEl.textContent = "登录失败，请查看控制台错误";
    }
};

// 回车触发登录
document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        const loginBtn = document.querySelector(".auth-btn");
        if (loginBtn) login();
    }
});

/* ============================================================
14. 顶部栏用户信息（所有有 topBar 的页面通用）
============================================================ */
const RoleNameMap = {
    admin: "管理员",
    boss: "老板",
    staff: "员工",
    finance: "财务",
    outsourcing: "外包"
};

function loadTopBarUserInfo() {
    let sessionUser = null;
    try {
        sessionUser = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
    } catch {
        sessionUser = null;
    }

    if (!sessionUser || !sessionUser.phone || !sessionUser.role) {
        if (!location.pathname.endsWith("auth.html")) {
            window.location.href = "auth.html";
        }
        return;
    }

    const name = sessionUser.name;
    const role = sessionUser.role;

    const nameEl = document.getElementById("userName");
    const roleEl = document.getElementById("userRole");
    const avatarEl = document.getElementById("userAvatar");

    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = RoleNameMap[role] || role;
    if (avatarEl) avatarEl.textContent = name ? name.charAt(0).toUpperCase() : "?";
}

document.addEventListener("DOMContentLoaded", loadTopBarUserInfo);

/* ============================================================
15. Auth 权限体系（供 project.js / finance.js 使用）
============================================================ */
const Auth = {
    currentUser: null,
    role: null,
    _callbacks: [],

    onLogin(fn) {
        this._callbacks.push(fn);
    },

    init() {
        let sessionUser = null;
        try {
            sessionUser = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
        } catch {
            sessionUser = null;
        }

        if (!sessionUser || !sessionUser.phone) {
            this.role = null;
            this.currentUser = null;
            return;
        }

        this.role = sessionUser.role;
        this.currentUser = {
            username: sessionUser.phone,
            name: sessionUser.name,
            role: sessionUser.role
        };

        this._callbacks.forEach(fn => {
            try {
                fn();
            } catch (e) {
                console.error("Auth.onLogin callback error:", e);
            }
        });
    },

    can(action) {
        if (this.role === "admin" || this.role === "boss") return true;

        if (this.role === "finance") {
            return ["viewAmount", "export", "import"].includes(action);
        }

        if (this.role === "staff") {
            if (["delete", "complete", "export", "import", "viewAmount"].includes(action)) {
                return false;
            }
            return true;
        }

        return true;
    }
};

/* ============================================================
16. 退出登录
============================================================ */
function logout() {
    sessionStorage.removeItem("sessionUser");
    window.location.href = "auth.html";
}

/* ============================================================
17. 页面加载完成后：初始化主题 + Auth
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    Theme.init();     // 从 localStorage 恢复深/浅模式（body.dark-mode）
    Auth.init();      // 初始化权限 / 登录状态
});

/* ============================================================
18. 自动退出：5 分钟无操作
============================================================ */
let lastActivityTime = Date.now();

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(evt => {
    document.addEventListener(evt, () => {
        lastActivityTime = Date.now();
    });
});

setInterval(() => {
    const now = Date.now();
    const diff = now - lastActivityTime;

    if (diff > 300000) { // 5 分钟
        sessionStorage.removeItem("sessionUser");
        alert("长时间未操作，已自动退出");
        location.href = "auth.html";
    }
}, 30000);

/* ============================================================
19. 数据总备份导出（导出为 JSON 字符串）
============================================================ */
function exportAllData() {
    const keys = [
        "orders",
        "finance_daily",
        "finance_payroll",
        "finance_project",
        "accounts",
        "loginLogs",
        "backups"
    ];

    const all = {};
    keys.forEach(k => {
        all[k] = Storage.get(k, []);
    });

    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "system-backup-" + Time.timestampForFile() + ".json";
    a.click();
    URL.revokeObjectURL(url);
}

/* ============================================================
20. 数据总备份导入（从 JSON 文件恢复）
============================================================ */
function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);

            if (json.orders) Storage.set("orders", json.orders);
            if (json.finance_daily) Storage.set("finance_daily", json.finance_daily);
            if (json.finance_payroll) Storage.set("finance_payroll", json.finance_payroll);
            if (json.finance_project) Storage.set("finance_project", json.finance_project);
            if (json.accounts) Storage.set("accounts", json.accounts);
            if (json.loginLogs) Storage.set("loginLogs", json.loginLogs);
            if (json.backups) Storage.set("backups", json.backups);

            alert("数据已导入，请刷新页面查看");
        } catch (err) {
            alert("导入失败：文件格式不正确");
            console.error(err);
        }
    };

    reader.readAsText(file);
}

/* ============================================================
21. 通用智能下拉（可输入 + 模糊搜索 + 滚动显示）
============================================================ */
// ★ 全局唯一下拉框
let GLOBAL_SMART_BOX = null;
let GLOBAL_ACTIVE_INPUT = null;

/* ============================================================
轻量级拼音首字母转换（支持模糊匹配）
============================================================ */
function getPinyinInitials(str) {
    const map = {
        '啊':'a','阿':'a','安':'a','爱':'a','八':'b','白':'b','班':'b','包':'b','北':'b','本':'b','比':'b','边':'b','表':'b','别':'b',
        '蔡':'c','曹':'c','曾':'c','陈':'c','程':'c','池':'c','崔':'c','戴':'d','单':'d','邓':'d','丁':'d','董':'d','杜':'d',
        '方':'f','樊':'f','范':'f','房':'f','费':'f','冯':'f','符':'f','高':'g','葛':'g','耿':'g','龚':'g','郭':'g',
        '韩':'h','何':'h','贺':'h','洪':'h','胡':'h','黄':'h','江':'j','姜':'j','蒋':'j','金':'j','靳':'j','景':'j','孔':'k','柯':'k',
        '赖':'l','蓝':'l','劳':'l','乐':'l','雷':'l','黎':'l','李':'l','连':'l','梁':'l','廖':'l','林':'l','刘':'l','龙':'l','卢':'l','陆':'l','罗':'l','吕':'l',
        '马':'m','梅':'m','孟':'m','莫':'m','母':'m','穆':'m','倪':'n','宁':'n','牛':'n','潘':'p','彭':'p','皮':'p','平':'p',
        '齐':'q','戚':'q','钱':'q','强':'q','秦':'q','邱':'q','饶':'r','任':'r','沈':'s','申':'s','施':'s','石':'s','史':'s','宋':'s','苏':'s',
        '谭':'t','汤':'t','唐':'t','陶':'t','田':'t','童':'t','万':'w','汪':'w','王':'w','韦':'w','魏':'w','温':'w','文':'w','吴':'w','武':'w',
        '夏':'x','萧':'x','谢':'x','熊':'x','徐':'x','许':'x','薛':'x','严':'y','颜':'y','杨':'y','姚':'y','叶':'y','易':'y','殷':'y','尤':'y','余':'y','俞':'y','袁':'y',
        '张':'z','章':'z','赵':'z','郑':'z','钟':'z','周':'z','朱':'z','庄':'z','祝':'z','邹':'z'
    };

    let result = "";
    for (let ch of str) {
        if (map[ch]) result += map[ch];
        else if (/[a-zA-Z]/.test(ch)) result += ch.toLowerCase();
    }
    return result;
}

/* ============================================================
attachSmartSelect（含拼音搜索）
============================================================ */
function attachSmartSelect(inputEl, listGetter) {
    if (!inputEl) return;

    // ★ 创建全局唯一下拉框
    if (!GLOBAL_SMART_BOX) {
        GLOBAL_SMART_BOX = document.createElement("div");
        GLOBAL_SMART_BOX.className = "smart-select-box";
        GLOBAL_SMART_BOX.style.display = "none";
        GLOBAL_SMART_BOX.style.position = "fixed";
        GLOBAL_SMART_BOX.style.zIndex = 9999;
        GLOBAL_SMART_BOX.style.maxHeight = "200px"; // 8 条高度
        GLOBAL_SMART_BOX.style.overflowY = "auto";
        document.body.appendChild(GLOBAL_SMART_BOX);
    }

    let suppressOnce = false;

    function applyTheme(el) {
        const dark = document.body.classList.contains("dark-mode");
        el.style.background = dark ? "#2b2b2b" : "#fff";
        el.style.color = dark ? "#eee" : "#333";
        el.style.border = dark ? "1px solid #555" : "1px solid #ddd";
    }

    function positionBox() {
        const rect = inputEl.getBoundingClientRect();
        GLOBAL_SMART_BOX.style.left = rect.left + "px";
        GLOBAL_SMART_BOX.style.top = rect.bottom + "px";
        GLOBAL_SMART_BOX.style.minWidth = rect.width + "px";
    }

    function renderList(keyword) {
        const kw = keyword.toLowerCase();
        const kwPy = getPinyinInitials(keyword);

        const list = listGetter().filter(v => {
            const text = v.toLowerCase();
            const py = getPinyinInitials(v);
            return text.includes(kw) || py.includes(kwPy);
        });

        GLOBAL_SMART_BOX.innerHTML = "";
        applyTheme(GLOBAL_SMART_BOX);

        list.forEach(v => {
            const item = document.createElement("div");
            item.style.padding = "4px 8px";
            item.style.cursor = "pointer";
            applyTheme(item);
            item.innerText = v;

            item.onclick = () => {
                inputEl.value = v;
                GLOBAL_SMART_BOX.style.display = "none";
                suppressOnce = true;
                inputEl.dispatchEvent(new Event("input"));
            };

            item.onmouseenter = () => {
                const dark = document.body.classList.contains("dark-mode");
                item.style.background = dark ? "#3a3a3a" : "#f0f0f0";
            };
            item.onmouseleave = () => applyTheme(item);

            GLOBAL_SMART_BOX.appendChild(item);
        });

        if (list.length) {
            positionBox();
            GLOBAL_SMART_BOX.style.display = "block";
            GLOBAL_ACTIVE_INPUT = inputEl;
        } else {
            GLOBAL_SMART_BOX.style.display = "none";
        }
    }

    inputEl.addEventListener("focus", () => {
        if (suppressOnce) {
            suppressOnce = false;
            return;
        }
        renderList(inputEl.value);
    });

    inputEl.addEventListener("input", () => {
        if (suppressOnce) {
            suppressOnce = false;
            return;
        }
        renderList(inputEl.value);
    });

    document.addEventListener("mousedown", e => {
        if (
            GLOBAL_ACTIVE_INPUT &&
            !GLOBAL_ACTIVE_INPUT.contains(e.target) &&
            !GLOBAL_SMART_BOX.contains(e.target)
        ) {
            GLOBAL_SMART_BOX.style.display = "none";
            GLOBAL_ACTIVE_INPUT = null;
        }
    });
}

/* ============================================================
23. ★★★★★ 动态计算 pageSize（核心）
============================================================ */
function calcPageSize() {
    // 找到当前真正可见的 table（宽度和高度都大于 0）
    const tables = document.querySelectorAll(".table-scroll table");
    let table = null;

    tables.forEach(t => {
        const rect = t.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            table = t;
        }
    });

    if (!table) return 10;

    const scroll = table.closest(".table-scroll");
    if (!scroll) return 10;

    const tbody = table.querySelector("tbody");
    if (!tbody) return 10;

    const firstRow = tbody.querySelector("tr");
    if (!firstRow) return 10;

    const rowHeight = firstRow.getBoundingClientRect().height;
    if (!rowHeight || rowHeight < 5) return 10;

    // ★ 给底部预留一点空间，避免最后一行被遮挡
    const bottomFix = 10; // 你可以根据视觉效果调成 6~12

    const scrollHeight = scroll.clientHeight - bottomFix;
    return Math.max(1, Math.floor(scrollHeight / rowHeight));
}

/* ============================================================
通用分页管理器 PaginationManager
============================================================ */
const PaginationManager = {
    pageSize: 10,
    currentPage: 1,
    tableSelector: "",
    renderCallback: null,

    /* 绑定表格容器 + 渲染函数 */
    attach({ tableSelector, renderCallback }) {
        this.tableSelector = tableSelector;
        this.renderCallback = renderCallback;

        // 初始化时计算一次
        this.updatePageSize();

        // 监听窗口变化
        window.addEventListener("resize", () => {
            this.updatePageSize();
            this.render();
        });
    },

    /* 计算 pageSize */
    updatePageSize() {
    const scroll = document.querySelector(this.tableSelector);
    if (!scroll) return;

    const tbody = scroll.querySelector("tbody");
    if (!tbody) return;

    const firstRow = tbody.querySelector("tr");
    if (!firstRow) return;

    const rowHeight = firstRow.getBoundingClientRect().height;
    if (!rowHeight || rowHeight < 5) return;

    // ★ 同样预留一点底部空间
    const bottomFix = 10;
    const scrollHeight = scroll.clientHeight - bottomFix;

    const newSize = Math.max(1, Math.floor(scrollHeight / rowHeight));

    if (newSize !== this.pageSize) {
        this.pageSize = newSize;
        this.currentPage = 1;
    }
},


    /* 分页切片 */
    slice(data) {
        const start = (this.currentPage - 1) * this.pageSize;
        return data.slice(start, start + this.pageSize);
    },

    /* 渲染分页组件 */
    renderPager(total) {
        Pager.render("#pagination", total, this.pageSize, this.currentPage, p => {
            this.currentPage = p;
            this.render();
        });
    },

    /* 统一渲染入口 */
    render() {
        if (typeof this.renderCallback === "function") {
            this.renderCallback();
        }
    }
};
