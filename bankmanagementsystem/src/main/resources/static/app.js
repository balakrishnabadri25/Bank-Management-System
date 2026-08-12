/* ==========================================================================
   Aurora Bank — frontend application
   Vanilla JS SPA: hash router + API layer + animated views
   Backend API (unchanged): Spring Boot on http://localhost:8080
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------
   API layer — detects where it is being served from so the backend
   URL is always right (same-origin when served by Spring Boot,
   otherwise localhost:8080).
------------------------------------------------------------------ */
const API_BASE = new URLSearchParams(location.search).get('api')
    || ((location.protocol === 'http:' && location.hostname === 'localhost' && location.port === '8080')
        ? ''
        : 'http://localhost:8080');

async function api(path, options = {}) {
    const res = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
        const msg = typeof data === 'string'
            ? (data || `Request failed (${res.status})`)
            : ((data && data.message) || `Request failed (${res.status})`);
        throw new Error(msg);
    }
    return data;
}

const apiCreateAccount = (uname, balance) => api('/create_acc', { method: 'POST', body: JSON.stringify({ uname, balance }) });
const apiGetBalance   = (id) => api(`/balance/${id}`);

/* The backend answers deposit/withdraw with a plain string like
   "Your total balance : 82250" — extract the number from it. */
function extractBalance(res) {
    if (typeof res === 'number' && Number.isFinite(res)) return res;
    const m = String(res).match(/(\d[\d,]*)/);
    if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    return NaN;
}

const apiDeposit = async (id, amount) =>
    extractBalance(await api(`/accounts/${id}/deposit`, { method: 'POST', body: JSON.stringify({ balance: amount }) }));
const apiWithdraw = async (id, amount) =>
    extractBalance(await api(`/accounts/${id}/withdraw`, { method: 'POST', body: JSON.stringify({ balance: amount }) }));

/* ------------------------------------------------------------------
   Utilities
------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Animated count-up for numbers */
function countUp(el, target, { duration = 900, formatter = fmt } = {}) {
    if (!el) return;
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = formatter(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

/* Toasts */
function toast(kind, title, message = '') {
    const icons = { success: 'i-check', error: 'i-alert', info: 'i-bank' };
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `
        <svg class="icon"><use href="#${icons[kind]}"/></svg>
        <div><strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
        el.classList.add('out');
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 4200);
}

/* Button loading state */
async function withLoading(btn, fn) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Working…';
    try {
        return await fn();
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* Backend connection status */
const connection = { online: null, checking: false };

async function ping() {
    if (connection.checking) return connection.online;
    connection.checking = true;
    setStatus('checking');
    try {
        // Liveness probe only — a HEAD request returns no body, so no account
        // data ever crosses the wire. A 200 proves the server is up.
        const res = await fetch(API_BASE + '/accounts', { method: 'HEAD' });
        if (res.status === 0) throw new Error('no response');
        connection.online = true;
        setStatus('online');
    } catch {
        connection.online = false;
        setStatus('offline');
    }
    connection.checking = false;
    return connection.online;
}

function setStatus(state) {
    const dot = $('#status-dot');
    const text = $('#status-text');
    const banner = $('#offline-banner');
    dot.className = 'status-dot ' + state;
    text.textContent = state === 'online' ? 'Connected' : state === 'offline' ? 'Offline' : 'Connecting…';
    if (banner) banner.hidden = state !== 'offline';
    $$('.nav-links a').forEach(a => a.classList.toggle('disabled', false));
}

/* ------------------------------------------------------------------
   Router
------------------------------------------------------------------ */
const routes = {};

function parseHash() {
    const raw = location.hash.replace(/^#\/?/, ''); // e.g. "deposit?acc=42"
    const [pathPart, queryPart] = raw.split('?');
    const name = pathPart || 'home';
    const params = {};
    if (queryPart) {
        new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v; });
    }
    return { name, params };
}

function router() {
    const { name, params } = parseHash();
    const view = routes[name] || routes['home'];
    const mount = $('#view');

    // Scroll to top on navigation (except when resuming at a target)
    window.scrollTo({ top: 0 });

    mount.innerHTML = view.render(params);

    // Highlight active nav link
    $$('.nav-links a').forEach(a => a.classList.toggle('active', a.getAttribute('data-nav') === name));

    if (view.after) view.after(mount, params);

    // Re-check backend silently so the status pill stays truthful
    ping();
}

function navigate(path) { location.hash = '#' + path; }

window.addEventListener('hashchange', router);

/* ------------------------------------------------------------------
   Shared form helpers
------------------------------------------------------------------ */
const validators = {
    account(value) {
        const id = parseInt(value, 10);
        return { ok: /^\d+$/.test(String(value).trim()) && id > 0, value: id, error: 'Enter a valid account number.' };
    },
    amount(value, { min = 1 } = {}) {
        const n = parseInt(value, 10);
        const ok = /^\d+$/.test(String(value).trim()) && n >= min;
        return { ok, value: n, error: `Enter a whole amount of at least ${fmt(min)}.` };
    },
    name(value) {
        const ok = String(value).trim().length >= 2;
        return { ok, value: value.trim(), error: 'Enter the account holder’s full name.' };
    },
};

function renderFieldError(input, field, error) {
    field.classList.toggle('input-invalid', !!error);
    const msg = field.parentElement.querySelector('.field-error');
    if (msg) msg.textContent = error || '';
    if (error && input) { input.focus(); input.select(); }
}

/* The account this user belongs to — the app is personal, like a real bank:
   you only ever see and act on your own account number. */
function setMyAccount(id) {
    try { localStorage.setItem('aurora_my_account', String(id)); } catch { /* ignore */ }
}

function getMyAccount() {
    try { return localStorage.getItem('aurora_my_account') || ''; } catch { return ''; }
}

function clearMyAccount() {
    try { localStorage.removeItem('aurora_my_account'); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------
   My Account panel (personal — only ever your own account)
------------------------------------------------------------------ */
function myAccountSkeleton() {
    return `
    <div class="card my-account">
        <div class="skeleton" style="height:14px; width:120px"></div>
        <div class="skeleton" style="height:44px; width:220px; margin-top:16px"></div>
        <div class="skeleton" style="height:12px; width:200px; margin-top:16px"></div>
    </div>`;
}

function myAccountCard(id, balance) {
    return `
    <div class="card my-account reveal">
        <div class="my-account-head">
            <div>
                <span class="stat-label"><svg class="icon"><use href="#i-wallet"/></svg> My Account</span>
                <div class="balance-amount" id="my-balance">${fmt(balance)}</div>
                <p class="my-account-meta">
                    Account <span class="acc-id">#${id}</span>
                    <button class="link-btn" id="switch-account" type="button">Not you? Use a different account</button>
                </p>
            </div>
            <div class="acc-actions">
                <a href="#/deposit?acc=${id}" class="btn btn-success"><svg class="icon"><use href="#i-deposit"/></svg> Deposit</a>
                <a href="#/withdraw?acc=${id}" class="btn btn-danger"><svg class="icon"><use href="#i-withdraw"/></svg> Withdraw</a>
                <a href="#/balance?acc=${id}" class="btn btn-ghost"><svg class="icon"><use href="#i-wallet"/></svg> Balance</a>
            </div>
        </div>
    </div>`;
}

function signedOutCard() {
    return `
    <div class="card my-account reveal">
        <div class="my-account-head" style="justify-content:center; text-align:center">
            <div>
                <span class="stat-label" style="justify-content:center"><svg class="icon"><use href="#i-shield"/></svg> Private Banking</span>
                <h2 style="margin:10px 0 8px; font-size:1.35rem">You only ever see your own account.</h2>
                <p style="color:var(--text-muted); margin:0 auto 18px; max-width:540px">
                    Open an account to get your account number, or enter your existing one to check your balance.
                    Your balance, your deposits, your withdrawals — nothing else.
                </p>
                <div class="form-actions" style="justify-content:center">
                    <a href="#/create" class="btn btn-success btn-lg"><svg class="icon"><use href="#i-user-plus"/></svg> Open an Account</a>
                    <a href="#/balance" class="btn btn-ghost btn-lg"><svg class="icon"><use href="#i-wallet"/></svg> I have an account</a>
                </div>
            </div>
        </div>
    </div>`;
}

function myAccountError(id) {
    return `
    <div class="card empty-state">
        <svg class="icon"><use href="#i-alert"/></svg>
        <h3>Couldn’t load your balance</h3>
        <p>We couldn’t fetch the balance for account #${id}. Is the backend running?</p>
        <button class="btn btn-ghost" id="my-retry"><svg class="icon"><use href="#i-refresh"/></svg> Retry</button>
    </div>`;
}

/* ------------------------------------------------------------------
   View: Home
------------------------------------------------------------------ */
routes.home = {
    render() {
        const hasAccount = !!getMyAccount();
        return `
        <section class="hero reveal">
            <span class="hero-badge"><svg class="icon"><use href="#i-shield"/></svg> Banking, reimagined</span>
            <h1>Your money,<br><span class="grad">beautifully managed.</span></h1>
            <p>Create an account, check balances, deposit and withdraw — everything private to your own account.</p>
            <div class="hero-cta">
                <a href="#/create"><button class="btn btn-success btn-lg"><svg class="icon"><use href="#i-user-plus"/></svg> Open an Account</button></a>
                <a href="#/balance"><button class="btn btn-ghost btn-lg"><svg class="icon"><use href="#i-wallet"/></svg> Check My Balance</button></a>
            </div>
        </section>

        <div id="my-account" class="reveal reveal-1">${hasAccount ? myAccountSkeleton() : signedOutCard()}</div>

        <div class="section-head reveal reveal-2">
            <h2><svg class="icon"><use href="#i-bank"/></svg> What would you like to do?</h2>
            <p>All actions apply to your account only.</p>
        </div>
        <div class="actions-grid reveal reveal-2">
            <div class="card card-hover action-card">
                <div class="card-icon green"><svg class="icon"><use href="#i-user-plus"/></svg></div>
                <h3 class="card-title">Open Account</h3>
                <p>Start your savings journey with a new account in seconds.</p>
                <a href="#/create" class="btn btn-success btn-sm">Get Started</a>
            </div>
            <div class="card card-hover action-card">
                <div class="card-icon"><svg class="icon"><use href="#i-wallet"/></svg></div>
                <h3 class="card-title">Check Balance</h3>
                <p>See your current balance at a glance, any time.</p>
                <a href="#/balance" class="btn btn-primary btn-sm">Check Now</a>
            </div>
            <div class="card card-hover action-card">
                <div class="card-icon violet"><svg class="icon"><use href="#i-deposit"/></svg></div>
                <h3 class="card-title">Deposit Funds</h3>
                <p>Top up your account and watch your savings grow.</p>
                <a href="#/deposit" class="btn btn-primary btn-sm">Deposit</a>
            </div>
            <div class="card card-hover action-card">
                <div class="card-icon rose"><svg class="icon"><use href="#i-withdraw"/></svg></div>
                <h3 class="card-title">Withdraw Funds</h3>
                <p>Access your money quickly and easily, whenever you need.</p>
                <a href="#/withdraw" class="btn btn-danger btn-sm">Withdraw</a>
            </div>
        </div>

        <div class="section-head reveal reveal-3">
            <h2><svg class="icon"><use href="#i-shield"/></svg> Why Aurora?</h2>
        </div>
        <div class="features reveal reveal-3">
            <div class="feature"><svg class="icon"><use href="#i-shield"/></svg><div><strong>Bank-grade security</strong><span>Session-secured with Spring Security.</span></div></div>
            <div class="feature"><svg class="icon"><use href="#i-bank"/></svg><div><strong>Trusted IFSC</strong><span><code>UBIN20250912</code> on every account.</span></div></div>
            <div class="feature"><svg class="icon"><use href="#i-trending"/></svg><div><strong>Instant updates</strong><span>Balances refresh the moment you act.</span></div></div>
        </div>`;
    },

    async after(mount) {
        const box = $('#my-account', mount);
        const myId = getMyAccount();

        const bindSwitch = (root) => {
            $('#switch-account', root)?.addEventListener('click', () => { clearMyAccount(); router(); });
        };
        bindSwitch(mount);

        if (!myId) return;

        try {
            const balance = await apiGetBalance(myId);
            box.innerHTML = myAccountCard(myId, balance);
            countUp($('#my-balance', box), balance);
            bindSwitch(box);
        } catch {
            box.innerHTML = myAccountError(myId);
            $('#my-retry', box)?.addEventListener('click', () => router());
        }
    },
};

/* ------------------------------------------------------------------
   View: Create account
------------------------------------------------------------------ */
routes.create = {
    render() {
        return `
        <div class="card reveal" style="max-width: 620px; margin: 0 auto">
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:4px">
                <div class="card-icon green"><svg class="icon"><use href="#i-user-plus"/></svg></div>
                <div>
                    <h1 class="card-title" style="font-size:1.3rem">Open a New Account</h1>
                    <p class="card-sub" style="margin:0">A few details and you’re in. Free to open, always.</p>
                </div>
            </div>

            <form id="create-form" class="form" novalidate>
                <div class="field">
                    <label for="create-name">Full name</label>
                    <div class="input-wrap">
                        <svg class="icon"><use href="#i-user-plus"/></svg>
                        <input class="input" id="create-name" name="uname" placeholder="e.g. Aryan Sharma" autocomplete="name" required>
                    </div>
                    <span class="field-error" aria-live="polite"></span>
                </div>
                <div class="field">
                    <label for="create-balance">Initial deposit</label>
                    <div class="input-wrap">
                        <svg class="icon"><use href="#i-wallet"/></svg>
                        <input class="input mono" id="create-balance" name="balance" type="text" inputmode="numeric" placeholder="e.g. 5000" autocomplete="off" required>
                    </div>
                    <span class="field-error" aria-live="polite"></span>
                    <span class="field-hint">Minimum deposit is ${fmt(0)} — you can start with as little as you like.</span>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-success btn-lg" id="create-submit">
                        <svg class="icon"><use href="#i-check"/></svg> Create Account
                    </button>
                    <a href="#/" class="btn btn-ghost">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    after(mount) {
        const form = $('#create-form', mount);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = $('#create-name', mount);
            const balInput = $('#create-balance', mount);
            const nameField = nameInput.closest('.field');
            const balField = balInput.closest('.field');

            const vName = validators.name(nameInput.value);
            const vBal = validators.amount(balInput.value, { min: 0 });
            renderFieldError(nameInput, nameField, vName.ok ? '' : vName.error);
            renderFieldError(balInput, balField, vBal.ok ? '' : vBal.error);
            if (!vName.ok || !vBal.ok) return;

            try {
                const account = await withLoading($('#create-submit', mount), () =>
                    apiCreateAccount(vName.value, vBal.value));

                toast('success', 'Account created!', `Account #${account.acc_id} is ready to use.`);
                setMyAccount(account.acc_id);
                form.outerHTML = `
                    <div class="success-panel">
                        <div class="success-check"><svg class="icon"><use href="#i-check"/></svg></div>
                        <h2>Welcome aboard, ${escapeHtml(account.uname)}!</h2>
                        <p>Your account is live. Here are your details:</p>
                        <div class="details-grid">
                            <div class="detail-row"><span class="k">Account Number</span><span class="v" style="color:var(--cyan)">#${account.acc_id}</span></div>
                            <div class="detail-row"><span class="k">Account Holder</span><span class="v">${escapeHtml(account.uname)}</span></div>
                            <div class="detail-row"><span class="k">Opening Balance</span><span class="v" style="color:var(--emerald)">${fmt(account.balance)}</span></div>
                            <div class="detail-row"><span class="k">IFSC Code</span><span class="v">${account.ifsc_code || 'UBIN20250912'}</span></div>
                        </div>
                        <div class="form-actions" style="justify-content:center">
                            <a href="#/deposit?acc=${account.acc_id}" class="btn btn-success">Deposit Now</a>
                            <a href="#/" class="btn btn-ghost">Go to My Account</a>
                        </div>
                    </div>`;
            } catch (err) {
                toast('error', 'Could not create account', err.message);
            }
        });
    },
};

/* ------------------------------------------------------------------
   Shared single-input action view (balance / deposit / withdraw)
------------------------------------------------------------------ */
function buildActionView({ title, subtitle, icon, iconTone, amountLabel, submitLabel, submitClass, resultKind }) {
    return {
        render(params) {
            const acc = params.acc || getMyAccount();
            return `
            <div class="card reveal" style="max-width: 560px; margin: 0 auto">
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:4px">
                    <div class="card-icon ${iconTone}"><svg class="icon"><use href="#${icon}"/></svg></div>
                    <div>
                        <h1 class="card-title" style="font-size:1.3rem">${title}</h1>
                        <p class="card-sub" style="margin:0">${subtitle}</p>
                    </div>
                </div>

                <form id="action-form" class="form" novalidate>
                    <div class="field">
                        <label for="acc-id"><svg class="icon"><use href="#i-bank"/></svg> Account number</label>
                        <div class="input-wrap">
                            <svg class="icon"><use href="#i-bank"/></svg>
                            <input class="input mono" id="acc-id" name="acc_id" type="text" inputmode="numeric" placeholder="e.g. 42" value="${escapeHtml(acc)}" autocomplete="off" required>
                        </div>
                        <span class="field-error" aria-live="polite"></span>
                        <span class="field-hint">Your account number — you only ever see your own.</span>
                    </div>
                    ${amountLabel ? `
                    <div class="field">
                        <label for="amount">${amountLabel}</label>
                        <div class="input-wrap">
                            <svg class="icon"><use href="#i-wallet"/></svg>
                            <input class="input mono" id="amount" name="amount" type="text" inputmode="numeric" placeholder="e.g. 1000" autocomplete="off" required>
                        </div>
                        <span class="field-error" aria-live="polite"></span>
                    </div>` : ''}
                    <div class="form-actions">
                        <button type="submit" class="btn ${submitClass} btn-lg" id="action-submit">
                            <svg class="icon"><use href="#${icon}"/></svg> ${submitLabel}
                        </button>
                        <a href="#/" class="btn btn-ghost">Back to Home</a>
                    </div>
                </form>
            </div>
            <div id="action-result"></div>`;
        },

        async after(mount, params) {
            const form = $('#action-form', mount);
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const accInput = $('#acc-id', mount);
                const amountInput = $('#amount', mount);
                const accField = accInput.closest('.field');
                const amtField = amountInput?.closest('.field');

                const vAcc = validators.account(accInput.value);
                renderFieldError(accInput, accField, vAcc.ok ? '' : vAcc.error);

                let vAmt = null;
                if (amountInput) {
                    vAmt = validators.amount(amountInput.value);
                    renderFieldError(amountInput, amtField, vAmt.ok ? '' : vAmt.error);
                }
                if (!vAcc.ok || (vAmt && !vAmt.ok)) return;

                const resultBox = $('#action-result', mount);
                try {
                    const submit = $('#action-submit', mount);
                    const outcome = await withLoading(submit, async () => {
                        if (resultKind === 'balance') return { value: await apiGetBalance(vAcc.value) };
                        if (resultKind === 'deposit') return { value: await apiDeposit(vAcc.value, vAmt.value) };
                        return { value: await apiWithdraw(vAcc.value, vAmt.value) };
                    });

                    setMyAccount(vAcc.value);
                    form.outerHTML = `
                        <div class="balance-hero reveal">
                            <span class="balance-label">${resultKind === 'balance' ? 'Current balance' : resultKind === 'deposit' ? 'New balance after deposit' : 'New balance after withdrawal'}</span>
                            <div class="balance-amount" id="new-balance">${fmt(outcome.value)}</div>
                            <p style="color:var(--text-muted); margin-top:14px">
                                Account <span class="acc-id">#${vAcc.value}</span> · updated just now
                            </p>
                        </div>`;
                    resultBox.innerHTML = `
                        <div class="form-actions" style="justify-content:center; margin-top:6px">
                            <a href="#/deposit?acc=${vAcc.value}" class="btn btn-ghost btn-sm">Deposit more</a>
                            <a href="#/withdraw?acc=${vAcc.value}" class="btn btn-danger btn-sm">Withdraw</a>
                            <a href="#/" class="btn btn-ghost btn-sm">My Account</a>
                        </div>`;

                    toast('success', resultKind === 'deposit' ? 'Deposit successful' : resultKind === 'withdraw' ? 'Withdrawal successful' : 'Balance fetched', `Account #${vAcc.value}`);
                } catch (err) {
                    toast('error', resultKind === 'deposit' ? 'Deposit failed' : resultKind === 'withdraw' ? 'Withdrawal failed' : 'Could not fetch balance', err.message);
                }
            });
        },
    };
}

routes.balance = buildActionView({
    title: 'Check Balance',
    subtitle: 'See your current balance in real time.',
    icon: 'i-wallet', iconTone: '',
    amountLabel: null,
    submitLabel: 'Check Balance', submitClass: 'btn-primary',
    resultKind: 'balance',
});

routes.deposit = buildActionView({
    title: 'Deposit Funds',
    subtitle: 'Top up your account and grow your savings.',
    icon: 'i-deposit', iconTone: 'violet',
    amountLabel: 'Amount to deposit',
    submitLabel: 'Deposit', submitClass: 'btn-success',
    resultKind: 'deposit',
});

routes.withdraw = buildActionView({
    title: 'Withdraw Funds',
    subtitle: 'Access your money whenever you need it.',
    icon: 'i-withdraw', iconTone: 'rose',
    amountLabel: 'Amount to withdraw',
    submitLabel: 'Withdraw', submitClass: 'btn-danger',
    resultKind: 'withdraw',
});

/* ------------------------------------------------------------------
   Boot
------------------------------------------------------------------ */
function boot() {
    $('#footer-year').textContent = new Date().getFullYear();
    $('#retry-btn')?.addEventListener('click', () => { ping(); router(); });
    router();
}

document.addEventListener('DOMContentLoaded', boot);
