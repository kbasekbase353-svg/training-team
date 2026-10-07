var app = {
    // Initial Data
    accounts: JSON.parse(localStorage.getItem('accounts')) || [],

    trainers: JSON.parse(localStorage.getItem('trainers')) || [],
    leaders: JSON.parse(localStorage.getItem('leaders')) || [],
    managers: JSON.parse(localStorage.getItem('managers')) || [],

    isEditingSchedule: false,

    videos: JSON.parse(localStorage.getItem('videos')) || [],
    exams: JSON.parse(localStorage.getItem('exams')) || [],
    materials: JSON.parse(localStorage.getItem('materials')) || [],
    adminCreds: JSON.parse(localStorage.getItem('adminCreds')) || { user: '0', pass: '0' },

    currentExam: null,
    activeExamQuestions: [], // Randomized version for the current session
    editingExamId: null, // Track if editing
    examTimer: null,
    examSecondsLeft: 0,

    selectedCategory: null, // 'national' or 'offshore'
    targetCategoryView: null, // To store where to go after selection


    currentExcelTab: null,

    init() {
        lucide.createIcons();
        this.setupEventListeners();
        this.checkLogin();

        // Initialize Firebase Realtime Cloud Synchronization
        if (window.TrainingFirebase) {
            window.TrainingFirebase.initRealtimeSync(this);
        }

        // Load theme
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-mode');
            const btn = document.querySelector('.btn-theme-toggle');
            if (btn) btn.innerHTML = '<i data-lucide="moon"></i> <span>Dark Mode</span>';
        }

        // Initialize categories for existing data
        let modified = false;
        this.accounts.forEach(a => { if (!a.category) { a.category = 'national'; modified = true; } });
        this.leaders.forEach(l => { if (!l.category) { l.category = 'national'; modified = true; } });
        if (modified) this.saveData();

        this.checkExpiries();
        this.managerCharts = { bar: null, doughnut: null };

        // Back to Top functionality
        window.addEventListener('scroll', () => {
            const btn = document.getElementById('back-to-top-btn');
            if (btn) {
                if (window.scrollY > 300) {
                    btn.classList.add('show');
                } else {
                    btn.classList.remove('show');
                }
            }
        });
    },

    getValidImg(url, fallback) {
        if (!url || typeof url !== 'string') return fallback || 'https://placehold.co/400x300?text=Image';
        const trimmed = url.trim();
        if (!trimmed || trimmed === '0' || trimmed === '00' || trimmed === 'null' || trimmed === 'undefined') {
            return fallback || 'https://placehold.co/400x300?text=Image';
        }
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/') || trimmed.startsWith('images/') || trimmed.startsWith('./') || trimmed.startsWith('/')) {
            return trimmed;
        }
        return fallback || 'https://placehold.co/400x300?text=Image';
    },

    formatDateEnglish(dateStr) {
        if (!dateStr) return 'N/A';
        const map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', 'ص': 'AM', 'م': 'PM' };
        let result = dateStr.split('').map(c => map[c] || c).join('');
        // Remove seconds if present (matches HH:MM:SS)
        return result.replace(/:(\d{2}):(\d{2})/, ':$1');
    },


    shuffle(array) {

        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    },


    runTypingAnimation() {
        if (this._isTyping) return; // Prevent multiple instances

        const h1 = document.getElementById('typing-welcome');
        if (!h1) return;

        // Store original text in a custom attribute to prevent it being lost on re-runs
        if (!h1.dataset.originalText) {
            h1.dataset.originalText = h1.innerText;
        }

        const text = h1.dataset.originalText;
        if (!text) return;

        this._isTyping = true;
        h1.innerText = '';
        h1.style.opacity = '1';
        h1.style.borderColor = 'var(--secondary)';

        let i = 0;
        const speed = 70;

        const type = () => {
            if (i < text.length) {
                h1.innerHTML = text.slice(0, i + 1);
                i++;
                this._typeTimeout = setTimeout(type, speed);
            } else {
                h1.style.borderRight = 'none';
                this._isTyping = false;
                this._typeTimeout = null;
            }
        };
        type();
    },

    // ===== Custom Alert System =====
    showAlert(message, type = 'info', title = '') {
        const overlay = document.getElementById('custom-alert-overlay');
        const card = document.getElementById('custom-alert-card');
        const iconWrap = document.getElementById('custom-alert-icon');
        const titleEl = document.getElementById('custom-alert-title');
        const msgEl = document.getElementById('custom-alert-msg');
        if (!overlay) { console.log(message); return; }

        // Lucide icons per type
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        const titles = {
            success: title || 'Success',
            error: title || 'Error',
            warning: title || 'Warning',
            info: title || 'Notice'
        };

        if (iconWrap) iconWrap.innerHTML = `<i data-lucide="${icons[type] || icons.info}"></i>`;
        if (titleEl) titleEl.textContent = titles[type];
        if (msgEl) msgEl.textContent = message;

        // Remove old type classes, add new
        if (card) {
            card.className = 'custom-alert-card'; // Reset
            card.classList.add(`type-${type}`);
        }

        overlay.classList.add('visible');
        lucide.createIcons();
    },

    showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast type-${type}`;
        const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');

        toast.innerHTML = `
            <div class="toast-content">
                <i data-lucide="${icon}"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(toast);
        lucide.createIcons();

        // Animation in
        setTimeout(() => toast.classList.add('visible'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    closeAlert() {
        const overlay = document.getElementById('custom-alert-overlay');
        if (overlay) overlay.classList.remove('visible');
    },

    showConfirm(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            let overlay = document.getElementById('custom-confirm-overlay');
            if (!overlay) {
                const wrap = document.createElement('div');
                wrap.innerHTML = `
                  <div id="custom-confirm-overlay">
                    <div class="custom-confirm-card" id="custom-confirm-card">
                      <div class="custom-confirm-icon-wrap" id="custom-confirm-icon">
                        <i data-lucide="help-circle"></i>
                      </div>
                      <div class="custom-confirm-title" id="custom-confirm-title">Confirm Action</div>
                      <div class="custom-confirm-msg" id="custom-confirm-msg"></div>
                      <div class="custom-confirm-btns">
                        <button class="confirm-btn-yes" id="confirm-btn-yes">OK</button>
                        <button class="confirm-btn-no" id="confirm-btn-no">Cancel</button>
                      </div>
                    </div>
                  </div>
                `;
                document.body.appendChild(wrap.firstElementChild);
                overlay = document.getElementById('custom-confirm-overlay');
                if (window.lucide) lucide.createIcons();
            }

            const msgEl = document.getElementById('custom-confirm-msg');
            const titleEl = document.getElementById('custom-confirm-title');
            const yesBtn = document.getElementById('confirm-btn-yes');
            const noBtn = document.getElementById('confirm-btn-no');

            if (msgEl) msgEl.textContent = message;
            if (titleEl) titleEl.textContent = title;

            overlay.classList.add('visible');

            const handleYes = (e) => {
                e?.stopPropagation();
                cleanup();
                resolve(true);
            };

            const handleNo = (e) => {
                e?.stopPropagation();
                cleanup();
                resolve(false);
            };

            const cleanup = () => {
                overlay.classList.remove('visible');
                if (yesBtn) yesBtn.removeEventListener('click', handleYes);
                if (noBtn) noBtn.removeEventListener('click', handleNo);
            };

            if (yesBtn) yesBtn.addEventListener('click', handleYes, { once: true });
            if (noBtn) noBtn.addEventListener('click', handleNo, { once: true });
        });
    },

    closeConfirm() {
        const overlay = document.getElementById('custom-confirm-overlay');
        if (overlay) overlay.classList.remove('visible');
    },

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        const excelUpload = document.getElementById('excel-upload');
        if (excelUpload) {
            excelUpload.addEventListener('change', (e) => {
                this.handleExcelUpload(e.target);
            });
        }
    },

    login() {
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        // Admin Auth
        if (user === this.adminCreds.user && pass === this.adminCreds.pass) {
            this.currentUser = { role: 'admin', name: 'General Manager' };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            document.getElementById('manager-nav-profile').classList.add('hidden');
            this.navigateTo('admin-dashboard');
            this.renderAccounts();
            return;
        }

        // Leader Auth
        const foundLeader = this.leaders.find(l => l.user === user && l.pass === pass);
        if (foundLeader) {
            this.currentUser = { ...foundLeader, role: 'leader' };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.navigateTo('leader-dashboard');
            this.renderLeaderDashboard();
            return;
        }

        const manager = this.managers.find(m => m.user === user && m.pass === pass);
        if (manager) {
            this.currentUser = { ...manager, role: 'manager' };
            this.selectedCategory = null;
            localStorage.removeItem('managerCategory');
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.navigateTo('category-selection');
            return;
        }

        // Trainer Auth
        const trainer = this.trainers.find(t => t.username === user && t.password === pass);
        if (trainer) {
            // Allow login even if not active, but ensure we have an activeAccountId for the UI
            this.currentUser = {
                ...trainer,
                role: 'trainer',
                activeAccountId: trainer.activeAccountId || trainer.accountId
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.navigateTo('trainer-dashboard');
            this.renderTrainerProfile();
            return;
        }

        errorMsg.classList.remove('hidden');
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('managerCategory');
        window.location.href = 'index.html';
    },

    navigateTo(viewId) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) targetView.classList.add('active');

        if (viewId === 'landing') {
            this.runTypingAnimation();
        }

        // Handle Main Navbar visibility
        const mainNav = document.getElementById('main-nav');
        if (mainNav) {
            const showNavOn = ['landing', 'login', 'video-accounts', 'video-list', 'material-accounts', 'material-list', 'exam-accounts', 'exam-view', 'category-selection'];
            if (showNavOn.includes(viewId)) {
                mainNav.classList.remove('hidden');
                if (targetView) targetView.classList.add('has-fixed-nav');
            } else {
                mainNav.classList.add('hidden');
                if (targetView) targetView.classList.remove('has-fixed-nav');
            }
        }

        // Handle Exam Center Badge in Navbar
        const navExamCenter = document.getElementById('nav-exam-center');
        if (navExamCenter) {
            if (viewId === 'exam-view') {
                navExamCenter.classList.remove('hidden');
            } else {
                navExamCenter.classList.add('hidden');
            }
        }

        // Close sidebar on navigation if on mobile
        if (viewId !== 'trainer-dashboard') {
            const sidebar = document.getElementById('dashboard-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) sidebar.classList.remove('sidebar-open');
            if (overlay) overlay.classList.remove('active');
        }

        // Handle AI Chatbot button visibility
        if (typeof chatbot !== 'undefined') {
            if (viewId === 'manager-dashboard') {
                chatbot.show();
            } else {
                chatbot.hide();
            }
        }

        lucide.createIcons();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.toggle('sidebar-open');
        if (overlay) overlay.classList.toggle('active');
    },

    toggleManagerSidebar() {
        const sidebar = document.querySelector('.manager-dashboard-layout');
        const overlay = document.getElementById('manager-sidebar-overlay');
        if (sidebar) sidebar.classList.toggle('sidebar-open');
        if (overlay) overlay.classList.toggle('active');
    },

    toggleLogin() {
        const path = window.location.pathname.toLowerCase();
        // Redirect to main index.html for login to ensure the updated dashboard is used
        if (path.includes('video.html') || path.includes('quzi.html') || path.includes('quiz.html') || path.includes('materials.html')) {
            window.location.href = 'index.html?action=login';
            return;
        }
        this.selectedCategory = null; // Reset category on login page
        this.navigateTo('login');
    },

    selectCategory(cat) {
        this.selectedCategory = cat;
        if (this.currentUser && this.currentUser.role === 'manager') {
            localStorage.setItem('managerCategory', cat);
            this.navigateTo('manager-dashboard');
            this.renderManagerDashboard();
        } else if (this.targetCategoryView) {
            const target = this.targetCategoryView;
            this.targetCategoryView = null;
            if (target === 'videos') this.showVideoAccounts();
            else if (target === 'exams') this.showExamAccounts();
            else if (target === 'materials') this.showMaterialAccounts();
        }
    },

    toggleTheme() {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        const btn = document.querySelector('.btn-theme-toggle');
        if (btn) {
            btn.innerHTML = isLight ? '<i data-lucide="moon"></i> <span>Dark Mode</span>' : '<i data-lucide="sun"></i> <span>Light Mode</span>';
            lucide.createIcons();
        }
    },

    renderAccounts() {
        const grid = document.getElementById('account-grid');
        grid.innerHTML = (this.accounts || []).map(acc => `
            <div class="card glass" style="position: relative;">
                <span class="category-badge ${acc.category || 'national'}">${acc.category || 'national'}</span>
                <button class="btn-delete" onclick="event.stopPropagation(); app.deleteAccount('${acc.id}')" title="Delete Account">
                    <i data-lucide="trash-2"></i>
                </button>
                <div onclick="app.viewAccount('${acc.id}')">
                    <img src="${this.getValidImg(acc.img, 'https://placehold.co/400x300?text=' + encodeURIComponent(acc.name))}" alt="${acc.name}" class="card-img" onerror="this.src='https://placehold.co/400x300?text=${acc.name}'">
                    <h3>${acc.name}</h3>
                    <p>Manage trainers for this account</p>
                </div>
            </div>
        `).join('') + `
            <div class="card glass" style="border: 2px dashed var(--primary); display: flex; align-items: center; justify-content: center;" onclick="app.addNewAccount()">
                <div style="color: var(--primary)">
                    <i data-lucide="plus-circle" style="width: 48px; height: 48px;"></i>
                    <p style="margin-top: 1rem; font-weight: 700;">Add New Company</p>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    renderLeaderDashboard() {
        const container = document.getElementById('leader-accounts-container');
        if (!container) return;

        // Display Current Leader Info in Navbar (Centered Badge)
        const profileCenter = document.getElementById('leader-profile-center');
        if (profileCenter && this.currentUser && this.currentUser.role === 'leader') {
            profileCenter.innerHTML = `
                <div class="manager-profile-badge">
                    <img src="${this.currentUser.img || 'https://placehold.co/40x40?text=L'}" onerror="this.src='https://placehold.co/40x40?text=L'" alt="Leader Photo">
                    <div>
                        <div class="manager-name">${this.currentUser.name}</div>
                        <div class="manager-role-tag">Leader (${this.currentUser.category || 'National'})</div>
                    </div>
                </div>
            `;
        }

        const filteredAccounts = this.accounts.filter(acc => {
            if (this.currentUser.accountId) return acc.id === this.currentUser.accountId;
            return acc.category === (this.currentUser.category || 'national');
        });

        if (filteredAccounts.length === 0) {
            container.innerHTML = `<p style="text-align: center; padding: 2rem;">No ${this.currentUser.category || 'National'} accounts available.</p>`;
            return;
        }

        container.innerHTML = filteredAccounts.map(acc => {
            const accTrainers = this.trainers.filter(t => {
                const matchesAccount = t.accountId === acc.id || (t.secondaryAccountIds && t.secondaryAccountIds.includes(acc.id));
                if (!matchesAccount) return false;
                if (t.leaderId) return String(t.leaderId) === String(this.currentUser.id);
                return true;
            });

            // Calculate highest batch among all trainers in this account correctly
            const allAccountBatches = accTrainers.flatMap(t => (t.pitchResults || []))
                .map(p => Number(p.batch))
                .filter(b => !isNaN(b));

            const maxBatch = allAccountBatches.length > 0 ? Math.max(...allAccountBatches) : 100;
            const nextBatch = maxBatch + 1;

            const trainersHtml = accTrainers.length === 0
                ? '<p style="margin-top: 1rem; color: var(--text-muted);">No trainers in this account.</p>'
                : `
                <div class="leader-trainers-container">
                    <div class="trainer-grid" style="margin: 0; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
                        ${accTrainers.map(t => `
                            <div class="leader-trainer-card">
                                <div class="leader-trainer-img-wrapper">
                                    <img src="${this.getValidImg(t.img, 'https://placehold.co/400x300?text=👤')}" alt="${t.name}">
                                </div>
                                <div class="leader-trainer-details">
                                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e293b;">${t.name}</h4>
                                    <p style="margin: 0.2rem 0 0.8rem 0; font-size: 0.75rem; color: #64748b;">User: ${t.username}</p>
                                    
                                    <div style="display: flex; gap: 0.4rem; justify-content: center; margin-top: auto;">
                                        <button style="flex: 1; padding: 0.45rem; border: none; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer; color: white; background: ${t.isActive && t.activeAccountId === acc.id ? 'var(--secondary)' : 'var(--danger)'};" onclick="app.toggleTrainerActive(${t.id}, '${acc.id}')">
                                            ${t.isActive && t.activeAccountId === acc.id ? 'Active' : 'Inactive'}
                                        </button>
                                        <button style="flex: 1; padding: 0.45rem; border: none; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer; color: white; background: var(--primary); display: flex; justify-content: center; align-items: center; gap: 0.3rem;" onclick="app.loginAsTrainer(${t.id})">
                                            <i data-lucide="external-link" style="width: 12px; height: 12px;"></i> Login
                                        </button>
                                    </div>
                                    <button style="width: 100%; margin-top: 0.4rem; padding: 0.45rem; border: none; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer; color: white; background: var(--secondary); display: flex; justify-content: center; align-items: center; gap: 0.3rem;" onclick="app.addPitchModal(${t.id})">
                                        <i data-lucide="plus-circle" style="width: 12px; height: 12px;"></i> Certification
                                    </button>
                                    <button style="width: 100%; margin-top: 0.35rem; padding: 0.45rem; border: none; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer; color: white; background: linear-gradient(135deg, #6366f1, #3b82f6); display: flex; justify-content: center; align-items: center; gap: 0.3rem;" onclick="app.openTrainerKPIsModal(${t.id})">
                                        <i data-lucide="bar-chart-2" style="width: 12px; height: 12px;"></i> KPIs
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;

            return `
                <div class="leader-account-row">
                    <div class="leader-account-info">
                        <div style="position: relative; width: 60px; margin: 0 auto 0.8rem auto;">
                            <img src="${this.getValidImg(acc.img, 'https://placehold.co/100x100?text=' + encodeURIComponent(acc.name))}" alt="${acc.name}" style="width: 60px; height: 60px; border-radius: 10px; object-fit: cover; border: 2px solid var(--primary);">
                            <div style="position: absolute; top: -8px; right: -8px; background: var(--primary); color: white; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 850; font-size: 0.7rem; box-shadow: 0 4px 10px rgba(0,0,0,0.25); white-space: nowrap; z-index: 5; border: 1px solid rgba(255,255,255,0.3);">
                                Next: ${nextBatch}
                            </div>
                        </div>
                        <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary);">${acc.name}</h3>
                        <span class="badge" style="margin-top: 0.5rem; background: var(--secondary); color: #ffffff; padding: 0.3rem 1rem; font-size: 0.8rem; font-weight: 850; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); border: 1px solid rgba(255,255,255,0.2);">${accTrainers.length} Trainers</span>
                    </div>
                    <div class="leader-trainers-container">
                        ${trainersHtml}
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    },

    switchAdminTab(tabId, el) {
        document.querySelectorAll('.admin-tab:not(.btn-admin-logout):not(.btn-admin-settings)').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

        const targetBtn = el || (typeof event !== 'undefined' ? event.target.closest('.admin-tab') : null);
        if (targetBtn) targetBtn.classList.add('active');
        const panel = document.getElementById(`admin-panel-${tabId}`);
        if (panel) panel.classList.add('active');

        if (tabId === 'videos') this.renderVideoAdmin();
        if (tabId === 'materials') this.renderMaterialAdmin();
        if (tabId === 'exams') this.renderExamAdmin();
        if (tabId === 'leaders') this.renderLeaderAdmin();
        if (tabId === 'managers') this.renderManagers();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    renderManagers() {
        const list = document.getElementById('managers-list');
        if (!list) return;
        list.innerHTML = this.managers.length === 0
            ? '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">No managers added yet.</p>'
            : this.managers.map(m => `
                <div class="admin-list-item" style="display: flex; align-items: center; gap: 1rem;">
                    <img src="${this.getValidImg(m.img, 'https://i.pravatar.cc/150?u=' + m.id)}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
                    <div style="flex: 1;">
                        <strong style="font-size: 1rem;">${m.name}</strong>
                        <p style="font-size: 0.8rem; color: var(--text-muted)">User: ${m.user}</p>
                    </div>
                    <button class="btn-delete" onclick="app.deleteManager('${m.id}')" style="position: static; transform: none;">
                        <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                    </button>
                </div>
            `).join('');
        lucide.createIcons();
    },

    addNewManager() {
        const html = `
            <div class="login-header">
                <i data-lucide="shield" class="icon-primary larger"></i>
                <h3>Add New Manager</h3>
                <p>Global analytics access for all accounts and trainers</p>
            </div>
            <div class="input-group">
                <label>Full Name</label>
                <input type="text" id="new-manager-name" placeholder="Manager's full name">
            </div>
            <div class="input-group">
                <label>Username</label>
                <input type="text" id="new-manager-user" placeholder="Login username">
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" id="new-manager-pass" placeholder="Password">
            </div>
            <div class="input-group">
                <label>Photo URL (optional)</label>
                <input type="text" id="new-manager-img" placeholder="https://...">
            </div>
            <button class="btn-primary" style="width:100%; margin-top: 1rem;" onclick="app.saveNewManager()">
                <i data-lucide="save"></i> Save Manager Account
            </button>
        `;
        this.showModal(html);
    },

    saveNewManager() {
        const name = document.getElementById('new-manager-name').value.trim();
        const user = document.getElementById('new-manager-user').value.trim();
        const pass = document.getElementById('new-manager-pass').value.trim();
        const img = document.getElementById('new-manager-img').value.trim();

        if (!name || !user || !pass) {
            this.showAlert('Please fill in Name, Username, and Password.', 'warning');
            return;
        }
        const id = Date.now().toString();
        this.managers.push({ id, name, user, pass, img });
        this.saveData();
        this.renderManagers();
        this.closeModal();
        this.showAlert('Manager added successfully!', 'success');
    },

    async deleteManager(id) {
        if (await this.showConfirm('Are you sure you want to delete this manager account?')) {
            this.managers = this.managers.filter(m => m.id !== id);
            this.saveData();
            this.renderManagers();
            this.showAlert('Manager deleted successfully', 'success');
        }
    },

    showModal(content) {
        const container = document.getElementById('modal-container');
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `
            <button class="btn-delete" style="position: absolute; top: 1rem; right: 1rem;" onclick="app.closeModal()">×</button>
            ${content}
        `;
        container.classList.remove('hidden');
        lucide.createIcons();
    },

    closeModal() {
        const modal = document.getElementById('modal-container');
        const card = document.getElementById('modal-content');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('has-kpi-modal');
        }
        if (card) {
            card.classList.remove('modal-full');
            card.classList.remove('kpi-modal-card');
            card.style.maxWidth = '';
            card.style.width = '';
            card.style.overflowY = '';
        }
    },

    renderLeaderAdmin() {
        const list = document.getElementById('leaders-list');
        list.innerHTML = (this.leaders || []).map(l => {
            const acc = this.accounts.find(a => a.id === l.accountId);
            const accName = acc ? acc.name : 'All ' + (l.category || 'national');
            return `
            <div class="admin-list-item" style="display: flex; align-items: center; gap: 1rem;">
                <img src="${this.getValidImg(l.img, 'https://placehold.co/100x100?text=👤')}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                <div style="flex: 1;">
                    <strong>${l.name}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted)">User: ${l.user} | Pass: ${l.pass} | Account: <strong style="color: var(--primary);">${accName}</strong> (${l.category || 'national'})</p>
                </div>
                <button class="btn-delete" style="position: static;" onclick="app.deleteLeader(${l.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            `;
        }).join('') || '<p style="text-align: center; padding: 2rem;">No leaders, add a new leader</p>';
        lucide.createIcons();
    },

    addNewLeader() {
        const content = `
            <div class="login-header" style="margin-bottom: 1.5rem;">
                <i data-lucide="shield" class="icon-primary"></i>
                <h3>Add New Leader</h3>
                <p>Assign leader to a specific category and company account</p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Leader Name</label>
                    <input type="text" id="new-leader-name" placeholder="Example: Ahmed Mohamed">
                </div>
                <div class="input-group">
                    <label>Leader Category</label>
                    <div class="radio-group" style="margin-bottom: 0.5rem;">
                        <div class="radio-item">
                            <input type="radio" name="leader-cat" id="l-cat-national" value="national" checked onchange="app.filterLeaderAccountSelect(this.value)">
                            <label for="l-cat-national">National</label>
                        </div>
                        <div class="radio-item">
                            <input type="radio" name="leader-cat" id="l-cat-offshore" value="offshore" onchange="app.filterLeaderAccountSelect(this.value)">
                            <label for="l-cat-offshore">Offshore</label>
                        </div>
                        <div class="radio-item">
                            <input type="radio" name="leader-cat" id="l-cat-vodafone" value="vodafone" onchange="app.filterLeaderAccountSelect(this.value)">
                            <label for="l-cat-vodafone">Vodafone</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="input-group" style="margin-top: 0.5rem;">
                <label>Assign to Account / Company</label>
                <select id="new-leader-account" style="width: 100%; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 0.88rem; background: white;">
                    <!-- Filled dynamically -->
                </select>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Username (Login)</label>
                    <input type="text" id="new-leader-user" placeholder="Example: ahmed_leader">
                </div>
                <div class="input-group">
                    <label>Password</label>
                    <input type="password" id="new-leader-pass" placeholder="******">
                </div>
            </div>
            <div class="input-group">
                <label>Leader Photo URL (optional)</label>
                <input type="text" id="new-leader-img" placeholder="https://example.com/photo.jpg">
            </div>
            <button class="btn-primary" onclick="app.saveNewLeader()" style="margin-top: 1rem;">Save Leader</button>
        `;
        this.showModal(content);
        this.filterLeaderAccountSelect('national');
    },

    filterLeaderAccountSelect(category) {
        const select = document.getElementById('new-leader-account');
        if (!select) return;
        const catAccounts = (this.accounts || []).filter(a => (a.category || 'national') === category);
        if (catAccounts.length === 0) {
            select.innerHTML = '<option value="">-- No accounts under this category yet --</option>';
        } else {
            select.innerHTML = catAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        }
    },

    saveNewLeader() {
        const name = document.getElementById('new-leader-name').value.trim();
        const user = document.getElementById('new-leader-user').value.trim();
        const pass = document.getElementById('new-leader-pass').value.trim();
        let img = document.getElementById('new-leader-img').value.trim();
        if (!img) img = 'https://placehold.co/400x300?text=' + encodeURIComponent(name || 'Leader');

        const accSelect = document.getElementById('new-leader-account');
        const accountId = accSelect ? accSelect.value : null;

        if (name && user && pass) {
            if (this.leaders.find(l => l.user === user) || this.trainers.find(t => t.user === user) || (this.adminCreds && this.adminCreds.user === user)) {
                return this.showAlert('Username is already taken, please choose another one.', 'error');
            }
            const category = document.querySelector('input[name="leader-cat"]:checked').value;
            this.leaders.push({ id: Date.now(), name, user, pass, img, category, accountId: accountId || null });
            this.saveData();
            this.renderLeaderAdmin();
            this.closeModal();
            this.showAlert('Leader added successfully.', 'success');
        } else {
            this.showAlert('Please fill in Name, Username, and Password.', 'warning');
        }
    },

    async deleteLeader(id) {
        if (await this.showConfirm('Are you sure you want to delete this leader account?')) {
            this.leaders = this.leaders.filter(l => l.id !== id);
            this.saveData();
            this.renderLeaderAdmin();
            this.showAlert('Leader deleted successfully', 'success');
        }
    },

    editAdminProfile() {
        const content = `
            <div class="login-header">
                <i data-lucide="shield-check" class="icon-primary"></i>
                <h3>Admin Settings</h3>
                <p>Change admin username and password</p>
            </div>
            <div class="input-group">
                <label>New Username</label>
                <input type="text" id="admin-new-user" value="${this.adminCreds.user}">
            </div>
            <div class="input-group">
                <label>New Password</label>
                <input type="password" id="admin-new-pass" value="${this.adminCreds.pass}">
            </div>
            <button class="btn-primary" onclick="app.saveAdminProfile()">Save Changes</button>
        `;
        this.showModal(content);
    },

    saveAdminProfile() {
        const user = document.getElementById('admin-new-user').value.trim();
        const pass = document.getElementById('admin-new-pass').value.trim();

        if (user && pass) {
            this.adminCreds = { user, pass };
            this.saveData();
            this.showAlert('Admin details updated successfully. Please use new credentials next time.', 'success');
            this.closeModal();
        } else {
            this.showAlert('Please enter username and password', 'warning');
        }
    },

    renderMaterialAdmin() {
        const select = document.getElementById('material-select-account');
        select.innerHTML = this.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');

        const list = document.getElementById('material-admin-list');
        list.innerHTML = this.materials.map(m => `
            <div class="admin-list-item">
                <div>
                    <strong>${this.accounts.find(a => a.id === m.accountId)?.name || 'N/A'}</strong>: ${m.name}
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">Link: ${m.url}</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn-primary" style="padding: 0.5rem; width: auto; background: var(--primary);" onclick="app.downloadMaterial(${m.id})" title="Download/View Material">
                        <i data-lucide="download" style="width: 18px; height: 18px;"></i>
                    </button>
                    <button class="btn-delete" style="position: static;" onclick="app.deleteMaterial(${m.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `).join('') || '<p style="text-align: center; padding: 1rem;">No materials added</p>';
        lucide.createIcons();
    },

    addMaterial() {
        const accountId = document.getElementById('material-select-account').value;
        const name = document.getElementById('material-name').value.trim();
        const url = document.getElementById('material-url').value.trim();

        if (!accountId || !name || !url) {
            this.showAlert('Please fill all fields', 'warning');
            return;
        }

        // Convert Google Drive share link to preview link if needed
        let finalUrl = url;
        if (url.includes('drive.google.com')) {
            const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
            if (match) {
                finalUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
            }
        }

        this.materials.push({ id: Date.now(), accountId, name, url: finalUrl });
        this.saveData();
        this.renderMaterialAdmin();
        document.getElementById('material-name').value = '';
        document.getElementById('material-url').value = '';
        this.showAlert('Material added successfully', 'success');
    },

    async deleteMaterial(id) {
        if (await this.showConfirm('Do you want to delete this material?')) {
            this.materials = this.materials.filter(m => m.id !== id);
            this.saveData();
            this.renderMaterialAdmin();
            this.showAlert('Material deleted successfully', 'success');
        }
    },

    renderVideoAdmin() {
        const select = document.getElementById('video-select-account');
        select.innerHTML = this.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');

        const list = document.getElementById('video-admin-list');
        list.innerHTML = this.videos.map(v => `
            <div class="admin-list-item">
                <div>
                    <strong>${this.accounts.find(a => a.id === v.accountId)?.name || 'N/A'}</strong>: ${v.title}
                </div>
                <button class="btn-delete" style="position: static;" onclick="app.deleteVideo(${v.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `).join('') || '<p style="text-align: center; padding: 1rem;">No videos added</p>';
        lucide.createIcons();
    },

    addVideo() {
        const accountId = document.getElementById('video-select-account').value;
        const title = document.getElementById('video-title').value;
        const url = document.getElementById('video-url').value;

        if (title && url) {
            // Transform YouTube links to embed format if needed
            let embedUrl = url;
            if (url.includes('youtube.com/watch?v=')) {
                embedUrl = url.replace('watch?v=', 'embed/');
            } else if (url.includes('youtu.be/')) {
                embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
            } else if (url.includes('drive.google.com')) {
                const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
                if (match) {
                    embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                }
            }

            this.videos.push({ id: Date.now(), accountId, title, url: embedUrl });
            this.saveData();
            this.renderVideoAdmin();
            document.getElementById('video-title').value = '';
            document.getElementById('video-url').value = '';
        }
    },

    async deleteVideo(id) {
        if (await this.showConfirm('Are you sure you want to delete the video?')) {
            this.videos = this.videos.filter(v => v.id !== id);
            this.saveData();
            this.renderVideoAdmin();
            this.showAlert('Video deleted successfully', 'success');
        }
    },

    renderExamAdmin() {
        // Fill the account selector
        const select = document.getElementById('exam-select-account');
        if (select) {
            select.innerHTML = this.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
        }

        const list = document.getElementById('exam-admin-list');
        // Only show accounts that HAVE an exam entry
        const accountsWithExams = this.accounts.filter(acc => this.exams.some(e => e.accountId === acc.id));

        if (accountsWithExams.length === 0) {
            list.innerHTML = '<p style="text-align: center; padding: 2rem;">No programmed exams currently. Select an account from the menu above to start.</p>';
            return;
        }

        list.innerHTML = accountsWithExams.map(acc => {
            const exam = this.exams.find(e => e.accountId === acc.id);
            const isActive = exam ? exam.isActive : false;
            return `
                <div class="admin-list-item">
                    <div>
                        <strong>${acc.name}</strong>
                        <p style="font-size: 0.8rem; color: var(--text-muted)">
                            Password: ${exam.password} | Duration: ${exam.duration} minutes
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-primary" style="padding: 0.5rem 1rem; width: auto;" onclick="app.setupExamPrompt('${acc.id}')">Edit</button>
                        <button class="btn-primary" style="padding: 0.5rem 1rem; width: auto; background: ${isActive ? 'var(--secondary)' : 'var(--danger)'};" onclick="app.toggleExam('${acc.id}')">
                            ${isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn-delete" style="position: static;" onclick="app.deleteExam('${acc.id}')" title="Delete exam programming">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    },

    setupNewExam() {
        const accId = document.getElementById('exam-select-account').value;
        this.setupExamPrompt(accId);
    },

    async deleteExam(accId) {
        if (await this.showConfirm('Are you sure you want to delete the exam programming for this account? All associated questions and results will be deleted.')) {
            this.exams = this.exams.filter(e => e.accountId !== accId);
            this.saveData();
            this.renderExamAdmin();
            this.showAlert('Exam programming deleted successfully', 'success');
        }
    },

    setupExamPrompt(accId) {
        const exam = this.exams.find(e => e.accountId === accId);
        const content = `
            <div class="login-header">
                <i data-lucide="settings" class="icon-primary"></i>
                <h3>Exam Programming</h3>
                <p>Set password and duration for this account's test</p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Password</label>
                    <input type="text" id="exam-new-pass" value="${exam ? exam.password : ''}" placeholder="Access code">
                </div>
                <div class="input-group">
                    <label>Duration (minutes)</label>
                    <input type="number" id="exam-new-dur" value="${exam ? exam.duration : '15'}" placeholder="Example: 30">
                </div>
            </div>
            <button class="btn-primary" style="margin-top: 1rem;" onclick="app.saveExamSettings('${accId}')">Save Settings</button>
        `;
        this.showModal(content);
    },

    saveExamSettings(accId) {
        const pass = document.getElementById('exam-new-pass').value.trim();
        const dur = parseInt(document.getElementById('exam-new-dur').value);

        if (pass && dur) {
            let exam = this.exams.find(e => e.accountId === accId);
            if (!exam) {
                exam = {
                    id: Date.now(), accountId: accId, isActive: false, questions: [
                        { text: 'Default Question?', options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'], correct: 0 }
                    ]
                };
                this.exams.push(exam);
            }
            exam.password = pass;
            exam.duration = dur;
            this.saveData();
            this.renderExamAdmin();
            this.closeModal();
        } else {
            this.showAlert('Please fill in all data correctly', 'warning');
        }
    },

    toggleExam(accId) {
        const exam = this.exams.find(e => e.accountId === accId);
        if (!exam) {
            this.showAlert('Please program the exam first (add password and duration)', 'warning');
            return;
        }
        exam.isActive = !exam.isActive;
        this.saveData();
        this.renderExamAdmin();
    },

    showVideoAccounts() {
        if (!this.selectedCategory) {
            this.targetCategoryView = 'videos';
            this.navigateTo('category-selection');
            return;
        }
        const grid = document.getElementById('video-account-grid');
        const filteredAccounts = (this.accounts || []).filter(acc => acc.category === this.selectedCategory);

        if (filteredAccounts.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 4rem;">No ${this.selectedCategory} accounts available for videos.</p>`;
        } else {
            grid.innerHTML = filteredAccounts.map(acc => `
                <div class="card glass" onclick="app.viewVideoAccount('${acc.id}')">
                    <img src="${this.getValidImg(acc.img, 'https://placehold.co/400x300?text=' + encodeURIComponent(acc.name))}" alt="${acc.name}" class="card-img" onerror="this.src='https://placehold.co/400x300?text=${acc.name}'">
                    <h3>${acc.name}</h3>
                    <p>Watch videos for ${acc.name}</p>
                </div>
            `).join('');
        }
        this.navigateTo('video-accounts');
    },

    viewVideoAccount(id) {
        const acc = this.accounts.find(a => a.id === id);
        document.getElementById('video-account-title').innerText = `${acc.name} Videos`;

        const grid = document.getElementById('video-grid');
        const accVideos = this.videos.filter(v => v.accountId === id);

        if (accVideos.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem;">No videos currently added for this account</p>';
        } else {
            grid.innerHTML = accVideos.map(v => {
                let safeUrl = v.url;
                if (safeUrl.includes('drive.google.com/uc')) {
                    const match = safeUrl.match(/id=([^&]+)/);
                    if (match) safeUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                }
                return `
                <div class="video-card glass" onclick="app.playVideo('${safeUrl}', '${v.title.replace(/'/g, "\\'")}')">
                    <div class="video-thumb">
                        <div class="video-overlay">
                            <i data-lucide="play-circle" style="width: 36px; height: 36px; color: white;"></i>
                            <span style="font-size: 0.75rem;">Click to watch full screen</span>
                        </div>
                        <img src="${this.getValidImg(acc.img, 'https://placehold.co/800x450?text=Video+Thumbnail')}" alt="${v.title}" onerror="this.src='https://placehold.co/800x450?text=${acc.name}'">
                    </div>
                    <div class="video-info">
                        <h4>${v.title}</h4>
                        <p>${v.desc || 'Watch video in high quality'}</p>
                    </div>
                </div>
            `;
            }).join('');
        }
        this.navigateTo('video-list');
        lucide.createIcons();
    },

    playVideo(url, title) {
        // Open the video directly in a new window/tab
        const externalUrl = url.replace('/preview', '/view');
        window.open(externalUrl, '_blank');
    },

    showExamAccounts() {
        if (!this.selectedCategory) {
            this.targetCategoryView = 'exams';
            this.navigateTo('category-selection');
            return;
        }
        const grid = document.getElementById('exam-account-grid');

        const filteredAccounts = (this.accounts || []).filter(acc => acc.category === this.selectedCategory);

        if (filteredAccounts.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 4rem;">No ${this.selectedCategory} accounts available for quizzes.</p>`;
            this.navigateTo('exam-accounts');
            return;
        }

        let cardsHtml = '';

        filteredAccounts.forEach(acc => {
            const activeExams = (this.exams || []).filter(e => String(e.accountId).toLowerCase() === String(acc.id).toLowerCase() && this.checkIsExamActive(e));

            if (activeExams.length > 0) {
                // If this account has 1 or more active exams, render a distinct card for each active exam!
                activeExams.forEach(exam => {
                    cardsHtml += `
                        <div class="card glass" onclick="app.prepareExamById(${exam.id})">  
                            <img src="${this.getValidImg(acc.img, 'https://placehold.co/400x300?text=' + encodeURIComponent(acc.name))}" alt="${acc.name}" class="card-img" onerror="this.src='https://placehold.co/400x300?text=${acc.name}'">
                            <h3>${acc.name}</h3>
                            <p style="font-weight: 700; color: var(--primary); margin: 0.25rem 0 0.4rem 0;">${exam.title || 'Quiz'}</p>
                            <span class="status-indicator active">Available</span>
                        </div>
                    `;
                });
            } else {
                cardsHtml += `
                    <div class="card glass disabled-card" onclick="app.showAlert('No quiz available for this account currently', 'warning')">  
                        <img src="${this.getValidImg(acc.img, 'https://placehold.co/400x300?text=' + encodeURIComponent(acc.name))}" alt="${acc.name}" class="card-img" onerror="this.src='https://placehold.co/400x300?text=${acc.name}'">
                        <h3>${acc.name}</h3>
                        <p>No quiz currently</p>
                    </div>
                `;
            }
        });

        grid.innerHTML = cardsHtml;
        this.navigateTo('exam-accounts');
    },

    showMaterialAccounts() {
        if (!this.selectedCategory) {
            this.targetCategoryView = 'materials';
            this.navigateTo('category-selection');
            return;
        }
        const grid = document.getElementById('material-account-grid');

        // Find accounts that have at least one shared material
        const sharedAccountIds = [...new Set(this.materials.filter(m => m.shared).map(m => m.accountId))];
        const filteredAccounts = (this.accounts || []).filter(acc => acc.category === this.selectedCategory);

        if (filteredAccounts.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 4rem;">No ${this.selectedCategory} accounts available for materials.</p>`;
        } else {
            grid.innerHTML = filteredAccounts.map(acc => {
                const hasShared = sharedAccountIds.includes(acc.id);
                return `
                    <div class="card glass ${!hasShared ? 'disabled-card' : ''}" onclick="${hasShared ? `app.viewMaterialAccount('${acc.id}')` : 'app.showAlert(\'No materials shared for this account yet\', \'warning\')'}">  
                        <img src="${this.getValidImg(acc.img, 'https://placehold.co/400x300?text=' + encodeURIComponent(acc.name))}" alt="${acc.name}" class="card-img" onerror="this.src='https://placehold.co/400x300?text=${acc.name}'">
                        <h3>${acc.name}</h3>
                        <p>${hasShared ? 'Available materials' : 'No materials'}</p>
                        ${hasShared ? '<span class="status-indicator active">Available</span>' : ''}
                    </div>
                `;
            }).join('');
        }
        this.navigateTo('material-accounts');
    },

    viewMaterialAccount(accountId) {
        const acc = this.accounts.find(a => a.id === accountId);
        document.getElementById('material-account-title').innerText = `${acc.name} Materials`;

        const grid = document.getElementById('student-material-grid');
        const sharedMaterials = this.materials.filter(m => m.accountId === accountId && m.shared);

        if (sharedMaterials.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem;">No materials shared for this account yet</p>';
        } else {
            grid.innerHTML = sharedMaterials.map(m => `
                <div class="material-card glass" onclick="app.viewSharedMaterial(${m.id})">
                    <i data-lucide="file-text" style="width: 36px; height: 36px; color: var(--primary);"></i>
                    <div style="text-align: center;">
                        <h4 style="margin-bottom: 0.25rem;">${m.name}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">Protected Material</p>
                    </div>
                </div>
            `).join('');
        }
        this.navigateTo('material-list');
        lucide.createIcons();
    },

    viewSharedMaterial(id) {
        const m = this.materials.find(mat => mat.id === id);
        if (!m) return;

        const content = `
            <div class="login-header">
                <i data-lucide="lock" class="icon-primary"></i>
                <h3>Enter Password</h3>
                <p>Please enter the 4-digit password for this material</p>
            </div>
            <div class="input-group">
                <input type="password" id="shared-mat-pass" placeholder="****" maxlength="4" style="text-align:center; font-size:1.5rem; letter-spacing:0.5rem;">
            </div>
            <button class="btn-primary" style="margin-top:1rem;" onclick="app.confirmSharedMaterial(${id})">Access Material</button>
        `;
        this.showModal(content);
        lucide.createIcons();
    },

    confirmSharedMaterial(id) {
        const m = this.materials.find(mat => mat.id === id);
        const pass = document.getElementById('shared-mat-pass').value;

        if (pass === m.shareCode) {
            this.closeModal();
            const card = document.getElementById('modal-content');
            card.classList.add('modal-full');

            // Show material in a protected view
            const content = `
                <div class="login-header" style="margin-bottom: 0.25rem; display: flex; align-items: center; justify-content: space-between; padding-right: 3rem;">
                    <div>
                        <h3 style="margin:0; font-size: 1.2rem;">${m.name}</h3>
                        <p style="color:var(--danger); font-size:0.7rem; margin:0;">Protected View - Download Disabled</p>
                    </div>
                </div>
                <div class="material-viewer-container" style="flex: 1; height: calc(100% - 45px); position: relative;">
                    <div class="pop-out-hider"></div>
                    <iframe src="${m.url.replace('/view', '/preview')}" style="width: 100%; height: 100%; border: none; pointer-events: auto;"></iframe>
                    <div class="protection-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none;"></div>
                </div>
            `;
            this.showModal(content);
        } else {
            this.showAlert('Incorrect password', 'error');
        }
    },

    prepareExamById(examId) {
        const exam = (this.exams || []).find(e => Number(e.id) === Number(examId) && this.checkIsExamActive(e));

        if (!exam) {
            this.showAlert('Sorry, quiz time has ended or not started yet', 'warning');
            this.showExamAccounts();
            return;
        }

        this.currentExam = exam;
        const titleEl = document.getElementById('exam-title-display');
        if (titleEl) titleEl.innerText = exam.title || 'Quiz';

        document.getElementById('exam-pass-input').value = '';
        document.getElementById('exam-pass-panel').classList.remove('hidden');
        const infoPanel = document.getElementById('exam-info-panel');
        if (infoPanel) infoPanel.classList.add('hidden');
        document.getElementById('exam-questions-panel').classList.add('hidden');

        this.navigateTo('exam-view');
    },

    prepareExam(accId) {
        const activeExams = (this.exams || []).filter(e => String(e.accountId).toLowerCase() === String(accId).toLowerCase() && this.checkIsExamActive(e));
        if (activeExams.length === 0) {
            this.showAlert('Sorry, quiz time has ended or not started yet', 'warning');
            this.showExamAccounts();
            return;
        }
        this.prepareExamById(activeExams[0].id);
    },

    startExam() {
        const passInput = document.getElementById('exam-pass-input').value;
        if (passInput !== this.currentExam.password) {
            this.showAlert('Incorrect quiz password', 'error');
            return;
        }

        // Hide password panel, show info panel
        document.getElementById('exam-pass-panel').classList.add('hidden');
        document.getElementById('exam-info-panel').classList.remove('hidden');

        // Clear previous inputs
        const nameInput = document.getElementById('student-name-input');
        const mobileInput = document.getElementById('student-mobile-input');
        const batchInput = document.getElementById('student-batch-input');
        const attendanceInput = document.getElementById('student-attendance-input');
        const trainerInput = document.getElementById('student-trainer-input');

        if (nameInput) nameInput.value = '';
        if (mobileInput) mobileInput.value = '';
        if (batchInput) batchInput.value = '';
        if (attendanceInput) attendanceInput.value = '';
        if (trainerInput) trainerInput.value = '';

        if (nameInput) nameInput.focus();
    },

    proceedToQuestions() {
        const name = (document.getElementById('student-name-input')?.value || '').trim();
        const mobile = (document.getElementById('student-mobile-input')?.value || '').trim();
        const batch = (document.getElementById('student-batch-input')?.value || '').trim();
        const attendance = (document.getElementById('student-attendance-input')?.value || '').trim();
        const trainer = (document.getElementById('student-trainer-input')?.value || '').trim();

        if (!name || !mobile || !batch || !attendance || !trainer) {
            this.showAlert('Please fill in all 5 required fields / يرجى ملء جميع الحقول المطلوبة', 'warning');
            return;
        }

        if (mobile.length !== 11) {
            this.showAlert('Mobile Number must be exactly 11 digits / يجب أن يتكون رقم الهاتف من 11 رقم بالضبط', 'warning');
            const mobileInput = document.getElementById('student-mobile-input');
            if (mobileInput) mobileInput.focus();
            return;
        }

        this.currentExamStudent = {
            name,
            mobile,
            batch,
            attendance,
            trainer,
            id: attendance
        };

        document.getElementById('exam-info-panel').classList.add('hidden');
        const panel = document.getElementById('exam-questions-panel');
        panel.classList.remove('hidden');

        // Randomize Questions and Options
        this.activeExamQuestions = JSON.parse(JSON.stringify(this.currentExam.questions));
        this.shuffle(this.activeExamQuestions);
        this.activeExamQuestions.forEach(q => {
            if (q.type !== 'essay') {
                if (q.options && q.options.length > 0) {
                    const correctVal = q.options[q.correct];
                    this.shuffle(q.options);
                    q.correct = q.options.indexOf(correctVal);
                }
            }
        });

        // Render Questions
        let examHtml = `
            <div class="exam-main-title">${this.currentExam.title}</div>
        `;

        examHtml += this.activeExamQuestions.map((q, idx) => {
            if (q.type === 'essay') {
                return `
                    <div class="question-block">
                        <h4>${idx + 1}. ${q.text} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">(Essay Question - Not graded)</span></h4>
                        <div style="margin-top: 1rem;">
                            <textarea class="essay-textarea" placeholder="Write your answer here / اكتب إجابتك هنا..." oninput="app.saveEssayAnswer(${idx}, this.value)" style="width: 100%; min-height: 120px; padding: 0.8rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-family: inherit; font-size: 1rem; resize: vertical; background: rgba(255,255,255,0.7);"></textarea>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="question-block">
                        <h4>${idx + 1}. ${q.text}</h4>
                        <div class="options-list">
                            ${(q.options || []).map((opt, optIdx) => `
                                <div class="option-item" onclick="app.selectOption(${idx}, ${optIdx}, this)">
                                    ${opt}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }).join('') + `
            <button class="btn-primary" onclick="app.submitExam()">Submit Exam</button>
        `;


        panel.innerHTML = examHtml;

        // Start Timer
        this.examSecondsLeft = this.currentExam.duration * 60;
        this.startExamTimer();
    },

    saveEssayAnswer(qIdx, val) {
        this.activeExamQuestions[qIdx].userAnswer = val;
    },


    startExamTimer() {
        const display = document.getElementById('exam-timer');
        if (this.examTimer) clearInterval(this.examTimer);

        const updateDisplay = () => {
            const mins = Math.floor(Math.max(0, this.examSecondsLeft) / 60);
            const secs = Math.max(0, this.examSecondsLeft) % 60;
            if (display) display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        updateDisplay();

        this.examTimer = setInterval(() => {
            if (this.examSecondsLeft <= 0) {
                clearInterval(this.examTimer);
                this.showAlert('Exam time is up!', 'warning');
                this.submitExam();
                return;
            }
            this.examSecondsLeft--;
            updateDisplay();
        }, 1000);
    },

    selectOption(qIdx, optIdx, el) {
        const parent = el.parentElement;
        parent.querySelectorAll('.option-item').forEach(item => item.classList.remove('selected'));
        el.classList.add('selected');
        this.activeExamQuestions[qIdx].userAnswer = optIdx;
    },


    submitExam() {
        if (!this.currentExamStudent) return;
        const studentName = this.currentExamStudent.name;
        const studentId = this.currentExamStudent.id;


        clearInterval(this.examTimer);
        let score = 0;
        let totalGradeable = 0;
        const studentAnswers = [];

        this.activeExamQuestions.forEach((q, idx) => {
            const answer = q.userAnswer !== undefined ? q.userAnswer : null;
            if (q.type === 'essay') {
                studentAnswers.push({
                    type: 'essay',
                    question: q.text,
                    selected: answer
                });
            } else {
                totalGradeable++;
                if (answer === q.correct) score++;
                studentAnswers.push({
                    type: 'multiple',
                    question: q.text,
                    options: q.options,
                    selected: answer,
                    correct: q.correct
                });
            }
            // Clean up temporary userAnswer for next trainee
            delete q.userAnswer;
        });

        // Save to results
        if (!this.currentExam.results) this.currentExam.results = [];
        this.currentExam.results.push({
            studentName: this.currentExamStudent.name,
            studentMobile: this.currentExamStudent.mobile,
            studentBatch: this.currentExamStudent.batch,
            studentAttendance: this.currentExamStudent.attendance,
            studentTrainer: this.currentExamStudent.trainer,
            studentId: this.currentExamStudent.attendance,
            score,
            total: totalGradeable,
            date: new Date().toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', ' |'),
            answers: studentAnswers,
            activatingTrainerId: this.currentExam.activatingTrainerId // Save who had the exam active
        });


        this.saveData();
        const scoreText = totalGradeable > 0 ? ` — Score: ${score} / ${totalGradeable}` : '';
        this.showAlert(`Exam submitted! Trainee: ${this.currentExamStudent.name}${scoreText}`, 'success', 'Exam Submitted');
        this.navigateTo('landing');
    },

    async deleteAccount(id) {
        if (await this.showConfirm('Are you sure you want to delete this account? All associated trainers will also be deleted.')) {
            this.accounts = this.accounts.filter(acc => acc.id !== id);
            this.trainers = this.trainers.filter(t => t.accountId !== id);
            this.saveData();
            this.renderAccounts();
            this.showAlert('Account deleted successfully', 'success');
        }
    },

    addNewAccount() {
        const content = `
            <div class="login-header">
                <i data-lucide="plus-circle" class="icon-primary"></i>
                <h3>Add New Account</h3>
                <p>Enter the details for the new account</p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Account / Company Name</label>
                    <input type="text" id="new-acc-name" placeholder="Example: Samsung">
                </div>
                <div class="input-group">
                    <label>Account Category</label>
                    <div class="radio-group" style="margin-bottom: 1rem;">
                        <div class="radio-item">
                            <input type="radio" name="acc-cat" id="cat-national" value="national" checked>
                            <label for="cat-national">National</label>
                        </div>
                        <div class="radio-item">
                            <input type="radio" name="acc-cat" id="cat-offshore" value="offshore">
                            <label for="cat-offshore">Offshore</label>
                        </div>
                        <div class="radio-item">
                            <input type="radio" name="acc-cat" id="cat-vodafone" value="vodafone">
                            <label for="cat-vodafone">Vodafone</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="input-group">
                <label>Logo Image URL</label>
                <input type="text" id="new-acc-img" placeholder="Image URL (URL)">
            </div>
            <button class="btn-primary" onclick="app.saveNewAccount()">Add Company</button>
        `;
        this.showModal(content);
    },

    saveNewAccount() {
        const name = document.getElementById('new-acc-name').value.trim();
        const img = document.getElementById('new-acc-img').value.trim();

        if (name && img) {
            const id = name.toLowerCase().replace(/\s+/g, '-');
            const category = document.querySelector('input[name="acc-cat"]:checked').value;
            const newAcc = { id, name, img, category };
            this.accounts.push(newAcc);
            this.saveData();
            this.renderAccounts();
            this.closeModal();
        } else {
            this.showAlert('Please enter company name and logo image', 'warning');
        }
    },

    viewAccount(accountId) {
        this.currentAccount = this.accounts.find(a => a.id === accountId);
        this.currentLeader = null;
        if (!this.currentAccount) return;
        this.renderAccountLeaders(accountId);
        this.navigateTo('account-leaders-view');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    renderAccountLeaders(accountId) {
        const acc = this.accounts.find(a => a.id === accountId) || this.currentAccount;
        if (!acc) return;
        this.currentAccount = acc;

        const logoEl = document.getElementById('account-leaders-logo-name');
        if (logoEl) logoEl.innerText = acc.name;
        const titleEl = document.getElementById('account-leaders-title');
        if (titleEl) titleEl.innerText = `${acc.name} - Leaders`;
        const subEl = document.getElementById('account-leaders-subtitle');
        if (subEl) subEl.innerText = `Choose a leader to manage their trainers for ${acc.name}`;

        const grid = document.getElementById('account-leaders-grid');
        if (!grid) return;

        // Find leaders assigned to this specific account or matching category
        const accountLeaders = (this.leaders || []).filter(l =>
            (l.accountId && String(l.accountId) === String(accountId)) ||
            (l.accountIds && l.accountIds.includes(accountId)) ||
            (!l.accountId && !l.accountIds && l.category === acc.category)
        );

        grid.innerHTML = accountLeaders.map(l => {
            const leaderTrainers = this.getTrainersForLeaderAndAccount(l.id, accountId);
            return `
                <div class="card glass" style="position: relative;">
                    <span class="category-badge ${l.category || acc.category || 'national'}">${l.category || acc.category || 'national'}</span>
                    <button class="btn-delete" onclick="event.stopPropagation(); app.deleteLeaderFromAccount(${l.id}, '${accountId}')" title="Delete Leader">
                        <i data-lucide="trash-2"></i>
                    </button>
                    <div onclick="app.viewLeaderTrainers('${accountId}', ${l.id})">
                        <img src="${this.getValidImg(l.img, 'https://placehold.co/400x300?text=' + encodeURIComponent(l.name))}" alt="${l.name}" class="card-img" onerror="this.src='https://placehold.co/400x300?text=${l.name}'">
                        <h3 style="margin-top: 0.6rem; font-size: 1.15rem;">${l.name}</h3>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem;">Username: <strong>${l.user}</strong></p>
                        <div style="background: rgba(99, 102, 241, 0.12); color: var(--primary); font-weight: 700; font-size: 0.8rem; padding: 0.3rem 0.75rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem;">
                            <i data-lucide="users" style="width: 14px; height: 14px;"></i> ${leaderTrainers.length} Trainer${leaderTrainers.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <div style="margin-top: 1rem; display: flex; gap: 0.4rem;">
                        <button class="btn-primary" style="flex: 1; font-size: 0.82rem; padding: 0.55rem 0.6rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem;" onclick="app.viewLeaderTrainers('${accountId}', ${l.id})">
                            <i data-lucide="folder-open" style="width: 14px; height: 14px;"></i> Open Trainers
                        </button>
                    </div>
                </div>
            `;
        }).join('') + `
            <div class="card glass" style="border: 2px dashed var(--primary); display: flex; align-items: center; justify-content: center; min-height: 240px; cursor: pointer;" onclick="app.addNewLeaderForAccount('${accountId}')">
                <div style="color: var(--primary); text-align: center;">
                    <i data-lucide="plus-circle" style="width: 48px; height: 48px;"></i>
                    <p style="margin-top: 1rem; font-weight: 700; font-size: 1.05rem;">Add New Leader</p>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Assign to ${acc.name}</span>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    addNewLeaderForAccount(accountId) {
        const acc = this.accounts.find(a => a.id === accountId);
        const accName = acc ? acc.name : 'Account';
        const content = `
            <div class="login-header" style="margin-bottom: 1.5rem;">
                <i data-lucide="shield" class="icon-primary"></i>
                <h3>Add New Leader</h3>
                <p>Create a leader for <strong>${accName}</strong></p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Leader Name</label>
                    <input type="text" id="new-leader-name" placeholder="Example: Ahmed Mohamed">
                </div>
                <div class="input-group">
                    <label>Assigned Account</label>
                    <input type="text" value="${accName}" disabled style="background: #f1f5f9; color: #475569; font-weight: 700;">
                </div>
            </div>
            <div class="input-group">
                <label>Username (Login)</label>
                <input type="text" id="new-leader-user" placeholder="Example: ahmed_leader">
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" id="new-leader-pass" placeholder="******">
            </div>
            <div class="input-group">
                <label>Leader Photo URL (optional)</label>
                <input type="text" id="new-leader-img" placeholder="https://example.com/photo.jpg">
            </div>
            <button class="btn-primary" onclick="app.saveNewLeaderForAccount('${accountId}')" style="margin-top: 1rem;">Save Leader</button>
        `;
        this.showModal(content);
    },

    saveNewLeaderForAccount(accountId) {
        const name = document.getElementById('new-leader-name').value.trim();
        const user = document.getElementById('new-leader-user').value.trim();
        const pass = document.getElementById('new-leader-pass').value.trim();
        let img = document.getElementById('new-leader-img').value.trim();
        if (!img) img = 'https://placehold.co/400x300?text=' + encodeURIComponent(name || 'Leader');

        if (name && user && pass) {
            if (this.leaders.find(l => l.user === user) || this.trainers.find(t => t.user === user) || (this.adminCreds && this.adminCreds.user === user)) {
                return this.showAlert('Username is already taken, please choose another one.', 'error');
            }
            const acc = this.accounts.find(a => a.id === accountId);
            const category = acc ? (acc.category || 'national') : 'national';
            const newLeader = {
                id: Date.now(),
                name,
                user,
                pass,
                img,
                category,
                accountId
            };
            this.leaders.push(newLeader);
            this.saveData();
            this.renderAccountLeaders(accountId);
            this.closeModal();
            this.showAlert('Leader added successfully.', 'success');
        } else {
            this.showAlert('Please fill in Name, Username, and Password.', 'warning');
        }
    },

    async deleteLeaderFromAccount(leaderId, accountId) {
        if (await this.showConfirm('Are you sure you want to delete this leader?')) {
            this.leaders = this.leaders.filter(l => l.id !== leaderId);
            this.saveData();
            this.renderAccountLeaders(accountId);
            this.showAlert('Leader deleted successfully.', 'success');
        }
    },

    viewLeaderTrainers(accountId, leaderId) {
        this.currentAccount = this.accounts.find(a => a.id === accountId);
        this.currentLeader = this.leaders.find(l => l.id === leaderId);
        if (!this.currentAccount || !this.currentLeader) return;

        const nameEl = document.getElementById('current-account-name');
        if (nameEl) nameEl.innerText = `${this.currentAccount.name} • ${this.currentLeader.name}`;
        const titleEl = document.getElementById('current-account-title');
        if (titleEl) titleEl.innerText = `Trainers: ${this.currentLeader.name}`;
        const subEl = document.getElementById('current-account-subtitle');
        if (subEl) subEl.innerText = `Trainers under ${this.currentLeader.name} (${this.currentAccount.name})`;

        this.renderTrainers(accountId, leaderId);
        this.navigateTo('account-view');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    getTrainersForLeaderAndAccount(leaderId, accountId) {
        return (this.trainers || []).filter(t => {
            const matchesAcc = t.accountId === accountId || (t.secondaryAccountIds && t.secondaryAccountIds.includes(accountId));
            if (!matchesAcc) return false;
            if (leaderId) {
                if (t.leaderId) return String(t.leaderId) === String(leaderId);
                return true;
            }
            return true;
        });
    },

    renderTrainers(accountId, leaderId) {
        accountId = accountId || (this.currentAccount ? this.currentAccount.id : null);
        leaderId = leaderId || (this.currentLeader ? this.currentLeader.id : null);

        const grid = document.getElementById('trainer-grid');
        if (!grid) return;

        const accountTrainers = this.getTrainersForLeaderAndAccount(leaderId, accountId);

        grid.innerHTML = accountTrainers.map(t => `
            <div class="card glass" style="position: relative;">
                <button class="btn-delete" onclick="event.stopPropagation(); app.deleteTrainer(${t.id})" title="Delete Trainer">
                    <i data-lucide="trash-2"></i>
                </button>
                <img src="${this.getValidImg(t.img, 'https://i.pravatar.cc/150?u=' + t.id)}" alt="${t.name}" class="card-img" onerror="this.src='https://i.pravatar.cc/150?u=${t.id}'">
                <h3 style="margin-top: 0.5rem;">${t.name}</h3>
                <p>Username: ${t.username}</p>
                <div class="admin-actions" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
                    <div style="display: flex; gap: 0.5rem; width: 100%; justify-content: center;">
                        <button class="btn-primary" style="background: ${t.isActive && t.activeAccountId === accountId ? '#10b981' : '#ef4444'}; flex: 1;" onclick="app.toggleTrainerActive(${t.id}, '${accountId}')">
                            ${t.isActive && t.activeAccountId === accountId ? 'Active' : 'Inactive'}
                        </button>
                        <button class="btn-secondary" style="flex: 1;" onclick="app.editTrainer(${t.id})" title="Edit Profile">
                            <i data-lucide="edit-3"></i> Edit
                        </button>
                    </div>
                    <div style="display: flex; gap: 0.5rem; width: 100%;">
                        <button class="btn-secondary" style="flex: 1; font-size: 0.8rem;" onclick="app.showAddToOtherAccountModal(${t.id})">Link Account</button>
                        <button class="btn-primary" style="flex: 1; background: var(--primary);" onclick="app.loginAsTrainer(${t.id})">
                            <i data-lucide="external-link"></i> Login
                        </button>
                    </div>
                    <button class="btn-primary" style="width: 100%; margin-top: 0.5rem; background: var(--secondary); display: flex; justify-content: center; align-items: center; gap: 0.4rem; padding: 0.6rem; border-radius: 8px;" onclick="app.addPitchModal(${t.id})">
                        <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Certification
                    </button>
                    <button class="btn-primary" style="width: 100%; margin-top: 0.4rem; background: linear-gradient(135deg, #6366f1, #3b82f6); display: flex; justify-content: center; align-items: center; gap: 0.4rem; padding: 0.6rem; border-radius: 8px;" onclick="app.openTrainerKPIsModal(${t.id})">
                        <i data-lucide="bar-chart-2" style="width: 16px; height: 16px;"></i> KPIs
                    </button>
                </div>
            </div>
        `).join('') + `
            <div class="card glass" style="border: 2px dashed var(--primary); display: flex; align-items: center; justify-content: center; min-height: 240px; cursor: pointer;" onclick="app.addNewTrainerForLeader('${accountId}', ${leaderId})">
                <div style="color: var(--primary); text-align: center;">
                    <i data-lucide="plus-circle" style="width: 48px; height: 48px;"></i>
                    <p style="margin-top: 1rem; font-weight: 700; font-size: 1.05rem;">Add New Trainer</p>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${this.currentLeader ? 'Under ' + this.currentLeader.name : 'Add Trainer'}</span>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    async deleteTrainer(id) {
        if (await this.showConfirm('Are you sure you want to delete this trainer?')) {
            const trainer = this.trainers.find(t => t.id === id);
            const accId = trainer ? trainer.accountId : (this.currentAccount ? this.currentAccount.id : null);
            const leaderId = trainer ? trainer.leaderId : (this.currentLeader ? this.currentLeader.id : null);
            this.trainers = this.trainers.filter(t => t.id !== id);
            this.saveData();
            this.renderTrainers(accId, leaderId);
            this.showAlert('Trainer deleted successfully', 'success');
        }
    },

    loginAsTrainer(id) {
        const trainer = this.trainers.find(t => t.id === id);
        if (trainer) {
            const previousRole = this.currentUser ? this.currentUser.role : 'admin';
            const previousName = this.currentUser ? this.currentUser.name : 'General Manager';

            this.currentUser = {
                ...trainer,
                role: 'trainer',
                isProxy: true,
                proxyRole: previousRole,
                proxyName: previousName,
                activeAccountId: trainer.accountId
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            document.body.classList.remove('proxy-leader');

            this.navigateTo('trainer-dashboard');
            this.renderTrainerProfile();
            // Show a back button for proxy
            const logoutSidebar = document.querySelector('.btn-logout-sidebar');
            if (logoutSidebar) {
                logoutSidebar.innerHTML = `<i data-lucide="arrow-left"></i> Back to ${previousRole === 'admin' ? 'Admin' : 'Leader'}`;
                logoutSidebar.onclick = () => {
                    document.body.classList.remove('proxy-leader');
                    if (previousRole === 'admin') {
                        this.currentUser = { role: 'admin', name: previousName || 'General Manager' };
                        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                        this.navigateTo('admin-dashboard');
                        this.renderAccounts();
                    } else if (previousRole === 'leader') {
                        // Restore leader context
                        const leader = this.leaders.find(l => l.name === previousName) || this.leaders[0];
                        this.currentUser = { ...leader, role: 'leader' };
                        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                        this.navigateTo('leader-dashboard');
                        this.renderLeaderDashboard();
                    }
                };
                lucide.createIcons();
            }
        }
    },

    toggleTrainerActive(id, accountId) {
        const trainer = this.trainers.find(t => t.id === id);
        const isCurrentlyActiveInThisAcc = trainer.isActive && trainer.activeAccountId === accountId;

        if (isCurrentlyActiveInThisAcc) {
            trainer.isActive = false;
            trainer.activeAccountId = null;
        } else {
            trainer.isActive = true;
            trainer.activeAccountId = accountId;
        }
        this.saveData();

        if (this.currentUser.role === 'leader') {
            this.renderLeaderDashboard();
        } else if (this.currentAccount) {
            this.renderTrainers(this.currentAccount.id);
        }
    },

    editTrainerExpiry(id) {
        const trainer = this.trainers.find(t => t.id === id);
        const content = `
            <div class="login-header">
                <i data-lucide="calendar" class="icon-primary"></i>
                <h3>Update Expiry Date</h3>
                <p>Change account validity for trainer: ${trainer.name}</p>
            </div>
            <div class="input-group">
                <label>Expiry Date</label>
                <input type="date" id="new-expiry-date" value="${trainer.expiryDate}">
            </div>
            <button class="btn-primary" onclick="app.saveTrainerExpiry(${id})">Update Date</button>
        `;
        this.showModal(content);
    },

    saveTrainerExpiry(id) {
        const trainer = this.trainers.find(t => t.id === id);
        const newDate = document.getElementById('new-expiry-date').value;
        if (newDate) {
            trainer.expiryDate = newDate;
            this.saveData();
            this.renderTrainers(trainer.accountId);
            this.closeModal();
        } else {
            this.showAlert('Please choose a date', 'warning');
        }
    },

    editTrainer(id) {
        const t = this.trainers.find(trainer => trainer.id === id);
        if (!t) return;

        const content = `
            <div class="login-header">
                <i data-lucide="user-cog" class="icon-primary"></i>
                <h3>Edit Trainer Data</h3>
                <p>Edit account data for trainer: ${t.name}</p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Name</label>
                    <input type="text" id="edit-t-name" value="${t.name}">
                </div>
                <div class="input-group">
                    <label>Username</label>
                    <input type="text" id="edit-t-user" value="${t.username}">
                </div>
                <div class="input-group">
                    <label>Password</label>
                    <input type="text" id="edit-t-pass" value="${t.password}">
                </div>
                <div class="input-group">
                    <label>Image URL</label>
                    <input type="text" id="edit-t-img" value="${t.img}">
                </div>
            </div>
            <button class="btn-primary" style="margin-top: 1rem;" onclick="app.saveEditedTrainer(${id})">Save Changes</button>
        `;
        this.showModal(content);
    },

    saveEditedTrainer(id) {
        const name = document.getElementById('edit-t-name').value.trim();
        const user = document.getElementById('edit-t-user').value.trim();
        const pass = document.getElementById('edit-t-pass').value.trim();
        const img = document.getElementById('edit-t-img').value.trim();

        if (name && user && pass && img) {
            const trainer = this.trainers.find(t => t.id === id);
            trainer.name = name;
            trainer.username = user;
            trainer.password = pass;
            trainer.img = img;

            this.saveData();
            this.renderTrainers(trainer.accountId);
            this.closeModal();
            this.showAlert('Trainer data updated successfully', 'success');
        } else {
            this.showAlert('Please fill all fields', 'warning');
        }
    },

    addNewTrainerForLeader(accountId, leaderId) {
        accountId = accountId || (this.currentAccount ? this.currentAccount.id : null);
        leaderId = leaderId || (this.currentLeader ? this.currentLeader.id : null);
        const leader = this.leaders.find(l => l.id === leaderId) || this.currentLeader;
        const acc = this.accounts.find(a => a.id === accountId) || this.currentAccount;
        const leaderName = leader ? leader.name : 'Leader';
        const accName = acc ? acc.name : 'Account';

        const content = `
            <div class="login-header">
                <i data-lucide="user-plus" class="icon-primary"></i>
                <h3>Add New Trainer</h3>
                <p>Assign under Leader: <strong>${leaderName}</strong> (${accName})</p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Trainer Name</label>
                    <input type="text" id="t-name" placeholder="Full Name">
                </div>
                <div class="input-group">
                    <label>Username</label>
                    <input type="text" id="t-user" placeholder="username">
                </div>
                <div class="input-group">
                    <label>Password</label>
                    <input type="password" id="t-pass" placeholder="password">
                </div>
                <div class="input-group">
                    <label>Profile Image URL</label>
                    <input type="text" id="t-img" placeholder="Image URL (optional)">
                </div>
            </div>
            <button class="btn-primary" style="margin-top: 1rem;" onclick="app.saveNewTrainerForLeader('${accountId}', ${leaderId})">Add Trainer</button>
        `;
        this.showModal(content);
    },

    saveNewTrainerForLeader(accountId, leaderId) {
        const name = document.getElementById('t-name').value.trim();
        const user = document.getElementById('t-user').value.trim();
        const pass = document.getElementById('t-pass').value.trim();
        let img = document.getElementById('t-img').value.trim();
        if (!img) img = 'https://i.pravatar.cc/150?u=' + Date.now();

        if (name && user && pass) {
            const newTrainer = {
                id: Date.now(),
                name,
                username: user,
                password: pass,
                accountId,
                leaderId: leaderId || null,
                secondaryAccountIds: [],
                img,
                isActive: true,
                expiryDate: '2026-12-31',
                history: []
            };
            this.trainers.push(newTrainer);
            this.saveData();
            this.renderTrainers(accountId, leaderId);
            this.closeModal();
            this.showAlert('Trainer added successfully', 'success');
        } else {
            this.showAlert('Please fill in Name, Username, and Password', 'warning');
        }
    },

    addNewTrainer(accountId) {
        this.addNewTrainerForLeader(accountId, this.currentLeader ? this.currentLeader.id : null);
    },

    saveNewTrainer(accountId) {
        this.saveNewTrainerForLeader(accountId, this.currentLeader ? this.currentLeader.id : null);
    },

    // --- Trainer Exam Management ---

    renderTrainerExams() {
        document.body.classList.remove('proxy-leader');
        const list = document.getElementById('trainer-exam-list');
        if (!list) return;

        const creatorBtn = document.querySelector('[onclick="app.showExamCreator()"]');
        if (creatorBtn) {
            creatorBtn.style.display = 'inline-flex';
        }

        const activeAccId = String(this.currentUser.activeAccountId || this.currentUser.accountId || "").toLowerCase();

        const trainerExams = (this.exams || []).filter(e => {
            const examAccId = String(e.accountId || "").toLowerCase();
            return examAccId === activeAccId;
        });

        if (trainerExams.length === 0) {
            list.innerHTML = `
                <div class="empty-state glass" style="padding: 3.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 1rem; border-radius: 1.2rem;">
                    <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(99, 102, 241, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 1.2rem;">
                        <i data-lucide="file-question" style="width: 36px; height: 36px; color: var(--primary);"></i>
                    </div>
                    <h3 style="margin-top: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-main);">No exams created yet</h3>
                    <p style="color: var(--text-muted); max-width: 400px; margin: 0.4rem auto 1.5rem auto; font-size: 0.95rem;">
                        Start by creating your first quiz for this account.
                    </p>
                    <button class="btn-primary" style="padding: 0.75rem 1.8rem; display: inline-flex; align-items: center; gap: 0.6rem; border-radius: 12px; font-weight: 700; width: auto;" onclick="app.showExamCreator()">
                        <i data-lucide="plus-circle"></i> Create New Quiz
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        list.innerHTML = trainerExams.map(e => {
            let statusText = 'Disabled';
            let btnText = 'Enable';
            let btnClass = 'var(--secondary)';
            const isCreator = e.creatorId === this.currentUser.id;

            if (e.isActive) {
                const isActiveNow = this.checkIsExamActive(e);
                if (e.scheduledStart) {
                    const start = new Date(e.scheduledStart);
                    if (!isActiveNow && new Date() < start) {
                        statusText = `Scheduled (Starts: ${start.toLocaleString('en-US')})`;
                    } else if (isActiveNow) {
                        statusText = `<span style="color:var(--secondary)">Active now (Code: ${e.password})</span>`;
                    } else {
                        statusText = 'Time ended (Disabled)';
                    }
                } else {
                    statusText = `<span style="color:var(--secondary)">Activated manually (Code: ${e.password})</span>`;
                }
                btnText = 'Disable';
                btnClass = 'var(--danger)';
            }

            return `
                <div class="admin-list-item" style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="flex: 1;">
                        <strong>${e.title || 'No Name'}</strong>
                        <p style="font-size: 0.8rem; color: var(--text-muted)">
                            Status: ${statusText} | Duration: ${e.duration} min
                        </p>
                    </div>
                    <div style="flex: 1; text-align: center; font-weight: 600; color: var(--primary);">
                        <i data-lucide="user" style="width: 16px; height: 16px; vertical-align: middle; margin-inline-end: 4px;"></i>
                        <span>${e.trainerName || 'System Trainer'}</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; flex: 1;">
                        <button class="btn-primary" style="padding: 0.5rem 1rem; width: auto; background: var(--primary);" onclick="app.showExamResults(${e.id})">Results</button>
                        <button class="btn-primary" style="padding: 0.5rem 1rem; width: auto; background: ${btnClass};" onclick="app.activateTrainerExam(${e.id})">${btnText}</button>
                        ${isCreator || this.currentUser.role === 'admin' || this.currentUser.isProxy ? `
                            <button class="btn-secondary" style="padding: 0.5rem 1rem; width: auto;" onclick="app.editTrainerExam(${e.id})">Edit</button>
                            <button class="btn-danger-sleek" onclick="app.deleteTrainerExam(${e.id})"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> <span>Delete</span></button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    },

    showExamCreator() {
        this.editingExamId = null;
        document.getElementById('creator-title').innerText = 'Create New Exam';
        document.getElementById('new-exam-name').value = '';
        document.getElementById('questions-container').innerHTML = '';
        this.addQuestionToCreator();
        document.getElementById('exam-creator-panel').classList.remove('hidden');
        document.getElementById('trainer-exam-list').classList.add('hidden');
    },

    hideExamCreator() {
        document.getElementById('exam-creator-panel').classList.add('hidden');
        document.getElementById('trainer-exam-list').classList.remove('hidden');
    },

    addQuestionToCreator(qData = null) {
        const container = document.getElementById('questions-container');
        const qIdx = container.children.length;
        const div = document.createElement('div');
        div.className = 'question-editor';
        div.setAttribute('data-q-idx', qIdx);

        const qType = (qData && qData.type) ? qData.type : 'multiple';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <label style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">Question ${qIdx + 1}</label>
                <button class="btn-danger-sleek" type="button" onclick="this.closest('.question-editor').remove(); app.renumberQuestions();">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> <span>Delete Question</span>
                </button>
            </div>
            
            <div class="input-group" style="margin-bottom: 1rem;">
                <label>Question Type</label>
                <select class="q-type" onchange="app.toggleQuestionType(this)" style="padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 0.4rem; width: 100%;">
                    <option value="multiple" ${qType === 'multiple' ? 'selected' : ''}>Multiple Choice</option>
                    <option value="essay" ${qType === 'essay' ? 'selected' : ''}>Essay Question - Not graded</option>
                </select>
            </div>

            <div class="input-group">
                <label>Question Text</label>
                <input type="text" class="q-text" placeholder="Write the question here..." value="${qData ? qData.text : ''}">
            </div>

            <div class="options-editor-wrapper" style="${qType === 'essay' ? 'display: none;' : ''}">
                <label style="display: block; margin-top: 1rem; margin-bottom: 0.5rem; font-weight: 600;">Choices</label>
                <div class="options-list-container">
                    <!-- Dynamic option rows -->
                </div>
                <button class="btn-secondary btn-add-opt" type="button" style="margin-top: 0.5rem; padding: 0.4rem 0.8rem; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;" onclick="app.addOptionToQuestionEditor(this)">
                    <i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i> Add Option
                </button>
            </div>
        `;

        container.appendChild(div);

        const optionsListContainer = div.querySelector('.options-list-container');
        if (qData && qData.options) {
            qData.options.forEach((optVal, optIdx) => {
                this.renderOptionRow(optionsListContainer, qIdx, optIdx, optVal, qData.correct === optIdx);
            });
        } else {
            // Default 4 options
            for (let i = 0; i < 4; i++) {
                this.renderOptionRow(optionsListContainer, qIdx, i, '', i === 0);
            }
        }

        lucide.createIcons();
    },

    renumberQuestions() {
        const qNodes = document.querySelectorAll('.question-editor');
        qNodes.forEach((node, qIdx) => {
            node.setAttribute('data-q-idx', qIdx);
            const label = node.querySelector('label');
            if (label) {
                label.innerHTML = `Question ${qIdx + 1}`;
            }
            const correctRadios = node.querySelectorAll('.q-correct');
            correctRadios.forEach(radio => {
                radio.setAttribute('name', `correct-${qIdx}`);
            });
        });
    },

    toggleQuestionType(selectEl) {
        const qEditor = selectEl.closest('.question-editor');
        const wrapper = qEditor.querySelector('.options-editor-wrapper');
        if (selectEl.value === 'essay') {
            wrapper.style.display = 'none';
        } else {
            wrapper.style.display = 'block';
        }
    },

    renderOptionRow(container, qIdx, optIdx, val = '', isCorrect = false) {
        const div = document.createElement('div');
        div.className = 'option-row';
        div.innerHTML = `
            <input type="radio" name="correct-${qIdx}" class="q-correct" value="${optIdx}" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="q-opt" placeholder="Choice" value="${val}">
            <button class="btn-delete-opt" type="button" style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.3rem; display: flex; align-items: center; justify-content: center;" onclick="app.deleteOptionRow(this)" title="Delete option">
                <i data-lucide="minus-circle" style="width: 18px; height: 18px;"></i>
            </button>
        `;
        container.appendChild(div);
        lucide.createIcons();
    },

    addOptionToQuestionEditor(btnEl) {
        const qEditor = btnEl.closest('.question-editor');
        const qIdx = parseInt(qEditor.getAttribute('data-q-idx'), 10);
        const container = qEditor.querySelector('.options-list-container');
        const nextOptIdx = container.children.length;
        this.renderOptionRow(container, qIdx, nextOptIdx, '', nextOptIdx === 0);
    },

    deleteOptionRow(btnEl) {
        const row = btnEl.closest('.option-row');
        const container = row.parentElement;
        const qEditor = container.closest('.question-editor');
        const qIdx = parseInt(qEditor.getAttribute('data-q-idx'), 10);

        row.remove();

        const rows = container.querySelectorAll('.option-row');
        let hasChecked = false;
        rows.forEach((r, idx) => {
            const radio = r.querySelector('.q-correct');
            radio.value = idx;
            if (radio.checked) hasChecked = true;
        });

        if (!hasChecked && rows.length > 0) {
            rows[0].querySelector('.q-correct').checked = true;
        }
    },

    saveCreatedExam() {
        const title = document.getElementById('new-exam-name').value;
        if (!title) return this.showAlert('Please write the exam name', 'warning');

        const qNodes = document.querySelectorAll('.question-editor');
        const questions = [];

        for (let node of qNodes) {
            const text = node.querySelector('.q-text').value.trim();
            const type = node.querySelector('.q-type').value;

            if (!text) {
                return this.showAlert('Please complete all question texts', 'warning');
            }

            if (type === 'essay') {
                questions.push({
                    type: 'essay',
                    text: text
                });
            } else {
                const optionInputs = Array.from(node.querySelectorAll('.q-opt'));
                const options = optionInputs.map(i => i.value.trim());

                if (options.length === 0) {
                    return this.showAlert('Please add at least one choice for multiple choice questions', 'warning');
                }

                if (options.some(o => !o)) {
                    return this.showAlert('Please complete all choices for multiple choice questions', 'warning');
                }

                const correctRadio = node.querySelector('input[type="radio"]:checked');
                const correct = correctRadio ? parseInt(correctRadio.value, 10) : 0;

                questions.push({
                    type: 'multiple',
                    text: text,
                    options: options,
                    correct: correct
                });
            }
        }

        if (this.editingExamId) {
            const exam = this.exams.find(e => e.id === this.editingExamId);
            exam.title = title;
            exam.questions = questions;
            if (!exam.results) exam.results = [];
        } else {
            this.exams.push({
                id: Date.now(),
                accountId: this.currentUser.activeAccountId || this.currentUser.accountId,
                creatorId: this.currentUser.id,
                trainerName: this.currentUser.name,
                title,
                questions,
                isActive: false,
                password: '', // Will be set on activation
                duration: 15, // Default
                results: []
            });
        }

        this.saveData();
        this.hideExamCreator();
        this.renderTrainerExams();
        this.showAlert('Quiz saved successfully', 'success');
    },

    async deleteTrainerExam(id) {
        if (await this.showConfirm('Are you sure you want to delete this exam?')) {
            this.exams = this.exams.filter(e => e.id !== id);
            this.saveData();
            this.renderTrainerExams();
            this.showAlert('Quiz deleted successfully', 'success');
        }
    },

    editTrainerExam(id) {
        const exam = this.exams.find(e => e.id === id);
        if (!exam) return;

        this.editingExamId = id;
        document.getElementById('creator-title').innerText = 'Edit Exam';
        document.getElementById('new-exam-name').value = exam.title;
        const container = document.getElementById('questions-container');
        container.innerHTML = '';

        exam.questions.forEach(q => this.addQuestionToCreator(q));

        document.getElementById('exam-creator-panel').classList.remove('hidden');
        document.getElementById('trainer-exam-list').classList.add('hidden');
    },

    async activateTrainerExam(id) {
        const exam = this.exams.find(e => e.id === id);
        if (exam.isActive) {
            if (await this.showConfirm('Do you want to disable this exam?')) {
                exam.isActive = false;
                exam.scheduledStart = null;
                this.saveData();
                this.renderTrainerExams();
                this.showAlert('Quiz has been disabled', 'info');
            }
            return;
        }

        // Show Activation Modal
        const modal = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');

        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="login-header" style="margin-bottom: 2rem;">
                <i data-lucide="bell-ring" class="icon-primary"></i>
                <h3>Activate Exam: ${exam.title || 'No Name'}</h3>
                <p>Select start time and access code</p>
            </div>
            <div class="input-group">
                <label>Activation Code (4 digits)</label>
                <input type="text" id="act-code" placeholder="Example: 1234" maxlength="4" style="text-align: center; font-size: 1.3rem; letter-spacing: 0.4rem; font-weight: 700; padding: 0.6rem;">
            </div>
            <div class="input-group">
                <label>Start Date and Time</label>
                <input type="datetime-local" id="act-start" style="padding: 0.7rem; border-radius: 0.8rem;">
            </div>
            <div class="input-group">
                <label>Exam duration (minutes)</label>
                <input type="number" id="act-duration" value="${exam.duration || 10}" style="padding: 0.7rem; border-radius: 0.8rem;">
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button class="btn-primary" onclick="app.confirmActivation(${id})">Confirm Activation</button>
                <button class="btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancel</button>
            </div>
        `;
        lucide.createIcons();

        // Set default time to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('act-start').value = now.toISOString().slice(0, 16);
    },

    confirmActivation(id) {
        const exam = this.exams.find(e => e.id === id);
        const code = document.getElementById('act-code').value;
        const start = document.getElementById('act-start').value;
        const dur = document.getElementById('act-duration').value;

        if (code.length === 4 && start && dur) {
            exam.password = code;
            exam.scheduledStart = start;
            exam.duration = parseInt(dur);
            exam.isActive = true;
            exam.activatingTrainerId = this.currentUser.id; // Record who activated it
            this.saveData();
            document.getElementById('modal-container').classList.add('hidden');
            this.renderTrainerExams();
            this.showToast('Quiz scheduled and activated successfully', 'success');
        } else {
            this.showAlert('Please complete all data correctly', 'error');
        }
    },

    showExamResults(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (!exam) return;

        // Only show results for trainees who took the exam while I had it activated
        const results = (exam.results || []).filter(r => r.activatingTrainerId === this.currentUser.id);
        const modal = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');

        modal.classList.remove('hidden');
        content.style.maxWidth = 'min(1040px, 94vw)';
        content.style.width = 'min(1040px, 94vw)';
        content.innerHTML = `
            <div class="login-header" style="margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; text-align: left;">
                        <i data-lucide="clipboard-check" class="icon-primary larger"></i>
                        <div>
                            <h3 style="margin:0; font-size: 1.2rem;">Results: ${exam.title}</h3>
                            <p style="margin:0; font-size: 0.85rem; opacity: 0.75;">Trainees: ${results.length}</p>
                        </div>
                    </div>
                    ${results.length > 0 ? `
                    <button class="btn-sleek" onclick="app.exportExamResultsToExcel(${examId})" style="padding: 0.5rem 1.1rem; width: auto; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                        <i data-lucide="download" style="width:15px; height:15px;"></i> <span>Excel</span>
                    </button>` : ''}
                </div>
            </div>

            <div class="results-table-container">
                <table class="exam-results-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Trainee Name</th>
                            <th>Mobile</th>
                            <th>Batch</th>
                            <th>Att #</th>
                            <th>Trainer</th>
                            <th>Date</th>
                            <th style="text-align: center; white-space: nowrap; min-width: 85px;">Score</th>
                            <th style="text-align: center; width: 70px;">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.length === 0 ? `
                        <tr>
                            <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                                <i data-lucide="inbox" style="width: 32px; height: 32px; margin: 0 auto 0.5rem; display: block; opacity: 0.5;"></i>
                                <p style="margin: 0; font-size: 0.95rem;">No results recorded yet</p>
                            </td>
                        </tr>
                        ` : results.map((r, idx) => {
            const isPassing = r.score >= (r.total / 2);
            return `
                        <tr>
                            <td style="color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                            <td style="font-weight: 700; color: #1e1b4b; white-space: nowrap;">${r.studentName}</td>
                            <td style="font-variant-numeric: tabular-nums;">${r.studentMobile || 'N/A'}</td>
                            <td>${r.studentBatch || 'N/A'}</td>
                            <td>${r.studentAttendance || r.studentId || 'N/A'}</td>
                            <td>${r.studentTrainer || 'N/A'}</td>
                            <td style="font-size: 0.8rem; color: #64748b; white-space: nowrap;"><span dir="ltr">${this.formatDateEnglish(r.date)}</span></td>
                            <td style="text-align: center; white-space: nowrap;">
                                <span class="score-pill ${isPassing ? 'pass' : 'fail'}">
                                    ${r.score}&nbsp;/&nbsp;${r.total}
                                </span>
                            </td>
                            <td style="text-align: center;">
                                <button class="btn-sleek" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.3rem;" onclick="app.viewStudentResultDetail(${examId}, ${idx})">
                                    <i data-lucide="eye" style="width: 13px; height: 13px;"></i> View
                                </button>
                            </td>
                        </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>

            <button class="btn-secondary" style="margin-top: 1.5rem; width: 100%; font-weight: 700;" onclick="document.getElementById('modal-container').classList.add('hidden'); document.getElementById('modal-content').style.maxWidth=''; document.getElementById('modal-content').style.width='';">Close</button>
        `;
        lucide.createIcons();
    },

    exportExamResultsToExcel(examId) {
        const exam = this.exams.find(e => e.id === examId);
        if (!exam) return;

        const results = (exam.results || []).filter(r => r.activatingTrainerId === this.currentUser.id);
        if (results.length === 0) return this.showAlert('No results to download', 'info');

        // Create Header Row
        const excelRows = [];
        const header = ['Trainee Name', 'Mobile Number', 'Batch Number', 'Attendance Number', 'Trainer Name', 'Date', 'Score', 'Total Questions', 'Percentage'];

        // Add dynamic headers for each question
        exam.questions.forEach((q, i) => {
            header.push(`Q${i + 1}: ${q.text}`);
            header.push(`Result Q${i + 1}`);
        });
        excelRows.push(header);

        // Add Data Rows
        results.forEach(r => {
            const percentage = r.total > 0 ? `${((r.score / r.total) * 100).toFixed(1)}%` : 'N/A';
            const row = [
                r.studentName,
                r.studentMobile || 'N/A',
                r.studentBatch || 'N/A',
                r.studentAttendance || r.studentId || 'N/A',
                r.studentTrainer || 'N/A',
                r.date,
                r.score,
                r.total,
                percentage
            ];


            r.answers.forEach(ans => {
                if (ans.type === 'essay') {
                    row.push(ans.selected !== null && ans.selected !== undefined ? ans.selected : 'No Answer');
                    row.push('Essay (Not Graded)');
                } else {
                    const selectedText = ans.selected !== null && ans.selected !== undefined && ans.options ? ans.options[ans.selected] : 'No Answer';
                    const isCorrect = ans.selected === ans.correct ? 'Correct' : 'Wrong';
                    row.push(selectedText);
                    row.push(isCorrect);
                }
            });
            excelRows.push(row);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Results');

        const timestamp = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

        XLSX.writeFile(wb, `Results_${exam.title}_${this.currentUser.name}_${timestamp}.xlsx`);
        this.showToast('Downloading Results File...');
    },

    viewStudentResultDetail(examId, studentIdx) {
        const exam = this.exams.find(e => e.id === examId);
        const result = exam.results[studentIdx];
        const content = document.getElementById('modal-content');

        content.innerHTML = `
            <div class="login-header" style="margin-bottom: 1.5rem; text-align: left;">
                <h3 style="margin: 0 0 0.5rem 0;">Response Details for Trainee: ${result.studentName}</h3>
                <div style="font-size: 0.85rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 0.6rem;">
                    <div><strong>Mobile:</strong> ${result.studentMobile || 'N/A'}</div>
                    <div><strong>Batch:</strong> ${result.studentBatch || 'N/A'}</div>
                    <div><strong>Attendance #:</strong> ${result.studentAttendance || result.studentId || 'N/A'}</div>
                    <div><strong>Trainer:</strong> ${result.studentTrainer || 'N/A'}</div>
                </div>
                <p style="font-weight: 700; color: var(--primary); margin: 0;">Score: ${result.score} out of ${result.total}</p>
            </div>

            <div style="max-height: 500px; overflow-y: auto; padding: 0.5rem; text-align: left;" dir="ltr">
                ${result.answers.map((a, i) => {
            if (a.type === 'essay') {
                return `
                        <div style="margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                            <p><strong>Q${i + 1}: ${a.question}</strong> <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">(Essay Question)</span></p>
                            <div style="margin-top: 0.5rem;">
                                <div style="padding: 0.8rem; border-radius: 0.4rem; font-size: 0.9rem; background: rgba(59, 130, 246, 0.05); border: 1px solid #3b82f6; color: #1e3a8a; white-space: pre-wrap;">
                                    <strong>Trainee Answer / إجابة المتدرب:</strong><br>${a.selected || 'No Answer / لا توجد إجابة'}
                                </div>
                            </div>
                        </div>
                    `;
            } else {
                const isCorrect = a.selected === a.correct;
                return `
                        <div style="margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                            <p><strong>Q${i + 1}: ${a.question}</strong></p>
                            <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
                                 ${(a.options || []).map((opt, oIdx) => {
                    let style = "padding: 0.4rem 0.8rem; border-radius: 0.4rem; font-size: 0.9rem;";
                    let icon = "";

                    if (oIdx === a.correct) {
                        style += "background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; color: #059669;";
                        icon = " (Correct Answer)";
                    } else if (oIdx === a.selected && !isCorrect) {
                        style += "background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #dc2626;";
                        icon = " (Trainee Choice - Wrong)";
                    } else {
                        style += "background: #f9fafb; border: 1px solid #e5e7eb;";
                    }

                    return `<div style="${style}">${opt}${icon}</div>`;
                }).join('')}
                            </div>
                        </div>
                    `;
            }
        }).join('')}
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button class="btn-primary" onclick="app.showExamResults(${examId})">Back to List</button>
                <button class="btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Close</button>
            </div>
        `;
    },

    renderTrainerProfile() {
        const t = this.currentUser;
        const activeAcc = this.accounts.find(a => a.id === t.activeAccountId);

        document.getElementById('sidebar-trainer-name').innerText = t.name;
        document.getElementById('sidebar-account-name').innerText = activeAcc ? activeAcc.name : 'Unknown';

        // Show switch account if trainer has multiple accounts
        const allAccIds = [t.accountId, ...(t.secondaryAccountIds || [])];
        if (allAccIds.length > 1) {
            const accNames = allAccIds.map(id => this.accounts.find(a => a.id === id)?.name).filter(Boolean);
            document.getElementById('sidebar-account-name').innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="app.showAccountSwitcher()">
                    <span>${activeAcc?.name}</span>
                    <i data-lucide="repeat" style="width: 14px; height: 14px;"></i>
                </div>
            `;
        }

        document.getElementById('sidebar-avatar').style.backgroundImage = `url(${t.img})`;
        const expiryEl = document.getElementById('auto-expiry-date');
        if (expiryEl) expiryEl.innerText = t.expiryDate;

        // Update all status indicators (sidebar and dashboard)
        document.querySelectorAll('.status-indicator').forEach(statusInd => {
            if (t.isActive) {
                statusInd.innerText = 'Active';
                statusInd.className = 'status-indicator active';
            } else {
                statusInd.innerText = 'Inactive';
                statusInd.className = 'status-indicator inactive';
            }
        });

        // Setup initial tab
        this.switchTrainerTab('dashboard');
        this.renderDashboard();
        this.renderSchedule();
        this.renderMaterials();
        this.renderHistory();
        this.renderTrainerExams();
    },

    switchTrainerTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

        const targetTab = document.getElementById(`trainer-content-${tabId}`);
        if (targetTab) targetTab.classList.add('active');

        // Close sidebar on mobile
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (window.innerWidth <= 768) {
            if (sidebar) sidebar.classList.remove('sidebar-open');
            if (overlay) overlay.classList.remove('active');
        }

        // Highlight active nav button
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const text = item.innerText.toLowerCase();
            if (tabId === 'exams' && (text.includes('quzi') || text.includes('quiz') || text.includes('exam'))) {
                item.classList.add('active');
            } else if (text.includes(tabId)) {
                item.classList.add('active');
            }
        });

        if (tabId === 'dashboard') this.renderDashboard();
        if (tabId === 'schedule') this.renderSchedule();
        if (tabId === 'material') this.renderMaterials ? this.renderMaterials() : this.renderMaterial();
        if (tabId === 'exams') this.renderTrainerExams();
        if (tabId === 'kpis') this.renderKPIs();
        if (tabId === 'updata') this.renderUpData ? this.renderUpData() : (this.renderUpdata ? this.renderUpdata() : null);
        if (tabId === 'history') this.renderHistory();

        lucide.createIcons();
    },

    renderMaterials() {
        const list = document.getElementById('material-list');
        if (!list) return;
        const accountMaterials = this.materials.filter(m => m.accountId === this.currentUser.activeAccountId);

        if (accountMaterials.length === 0) {
            list.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i data-lucide="book-open" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                    <p>No scientific materials added for this account yet</p>
                </div>`;
        } else {
            list.innerHTML = accountMaterials.map(m => `
                <div class="material-card glass" style="position: relative;">
                    <div onclick="window.open('${m.url}', '_blank')" style="cursor: pointer; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <i data-lucide="file-text" style="width: 36px; height: 36px; color: var(--primary);"></i>
                        <div style="text-align: center;">
                            <h4 style="margin-bottom: 0.25rem;">${m.name}</h4>
                            <p style="font-size: 0.8rem; color: var(--text-muted);">Click to open file</p>
                        </div>
                    </div>
                    <div style="position: absolute; bottom: 0.5rem; left: 0.5rem;">
                        <button class="btn-share" onclick="event.stopPropagation(); app.downloadMaterial(${m.id})" title="Download Material" style="background: var(--primary); color: white; border: none; border-radius: 50%; padding: 0.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                    <div style="position: absolute; bottom: 0.5rem; right: 0.5rem;">
                        <button class="btn-share" onclick="event.stopPropagation(); app.shareMaterial(${m.id})" title="Share Material" style="background: var(--secondary); color: white; border: none; border-radius: 50%; padding: 0.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            <i data-lucide="share-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                    ${m.shared ? '<span style="position: absolute; top: 0.5rem; left: 0.5rem; padding: 2px 6px; background: var(--secondary); color: white; font-size: 0.7rem; border-radius: 4px; z-index: 10;">Shared</span>' : ''}
                </div>
            `).join('');
        }
        lucide.createIcons();
    },

    downloadMaterial(id) {
        const m = this.materials.find(mat => mat.id === id);
        if (!m || !m.url) {
            this.showAlert('Material URL not found', 'error');
            return;
        }

        let rawUrl = m.url.trim();
        let fileName = (m.name || 'material').trim();

        // 1. Google Drive direct download handling
        if (rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com') || rawUrl.includes('drive.usercontent.google.com')) {
            const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const fileId = match[1];
                const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

                const a = document.createElement('a');
                a.href = downloadUrl;
                a.setAttribute('download', fileName);
                document.body.appendChild(a);
                a.click();
                setTimeout(() => document.body.removeChild(a), 100);
                this.showToast('Starting file download...', 'info');
                return;
            }
        }

        // 2. Dropbox direct download handling
        if (rawUrl.includes('dropbox.com')) {
            let directUrl = rawUrl.replace('?dl=0', '?dl=1');
            if (!directUrl.includes('dl=1')) {
                directUrl += (directUrl.includes('?') ? '&' : '?') + 'dl=1';
            }
            const a = document.createElement('a');
            a.href = directUrl;
            a.setAttribute('download', fileName);
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 100);
            this.showToast('Starting file download...', 'info');
            return;
        }

        // 3. OneDrive direct download handling
        if (rawUrl.includes('1drv.ms') || rawUrl.includes('onedrive.live.com')) {
            let directUrl = rawUrl.replace('/redir?', '/download?').replace('?embed=1', '?download=1');
            if (!directUrl.includes('download=1')) {
                directUrl += (directUrl.includes('?') ? '&' : '?') + 'download=1';
            }
            const a = document.createElement('a');
            a.href = directUrl;
            a.setAttribute('download', fileName);
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 100);
            this.showToast('Starting file download...', 'info');
            return;
        }

        // 4. Direct / Local file download
        const a = document.createElement('a');
        a.href = rawUrl;
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        this.showToast('Starting file download...', 'info');
    },

    shareMaterial(id) {
        const m = this.materials.find(mat => mat.id === id);
        if (!m) return;

        let content = `
            <div class="login-header">
                <i data-lucide="share-2" class="icon-primary"></i>
                <h3>${m.shared ? 'Update Share Settings' : 'Share Material'}</h3>
                <p>Set a 4-digit code to share this material with trainees</p>
            </div>
            <div class="input-group">
                <label>Access Code (4 digits)</label>
                <input type="text" id="share-code-input" value="${m.shareCode || ''}" placeholder="1234" maxlength="4" style="text-align:center; font-size:1.5rem; letter-spacing:0.5rem; font-weight: 700;">
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button class="btn-primary" onclick="app.confirmShare(${id})">${m.shared ? 'Update Code' : 'Share Now'}</button>
                ${m.shared ? `<button class="btn-secondary" style="background:var(--danger); color:white; border-color:var(--danger);" onclick="app.stopSharingMaterial(${id})">Stop Sharing</button>` : ''}
                <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
            </div>
        `;
        this.showModal(content);
        lucide.createIcons();
    },

    async stopSharingMaterial(id) {
        if (!await this.showConfirm('Are you sure you want to stop sharing this material? It will no longer be visible to trainees.')) return;
        const m = this.materials.find(mat => mat.id === id);
        if (m) {
            m.shared = false;
            m.shareCode = null;
            this.saveData();
            this.closeModal();
            this.renderMaterials();
            this.showAlert('Material unshared successfully', 'success');
        }
    },

    confirmShare(id) {
        const code = document.getElementById('share-code-input').value;
        if (code.length === 4) {
            const m = this.materials.find(mat => mat.id === id);
            m.shared = true;
            m.shareCode = code;
            this.saveData();
            this.closeModal();
            this.renderMaterials();
            this.showAlert('Material shared successfully!', 'success');
        } else {
            this.showAlert('Please enter a 4-digit code', 'warning');
        }
    },

    renderUpData() {
        const container = document.getElementById('updata-container');
        if (!container) return;

        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key));

        if (!upData || upData.length === 0) {
            upData = [
                ['Column 1', 'Column 2', 'Column 3'],
                ['Data 1', 'Data 2', 'Data 3']
            ];
            localStorage.setItem(key, JSON.stringify(upData));
        }

        const isLeader = this.currentUser && (this.currentUser.role === 'leader' || this.currentUser.isProxy);
        const canEdit = !isLeader;

        let html = '<div class="table-responsive"><table class="excel-table" style="table-layout: auto;"><tbody>';

        if (canEdit) {
            // Row for column controls
            html += '<tr>';
            for (let j = 0; j < upData[0].length; j++) {
                html += `<td style="text-align:center; padding: 4px; border-bottom: none; background: transparent;">
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <i data-lucide="plus-circle" style="cursor:pointer; color:var(--success); width:18px; height:18px;" onclick="app.insertUpDataCol(${j})"></i>
                        <i data-lucide="minus-circle" style="cursor:pointer; color:var(--danger); width:18px; height:18px;" onclick="app.removeUpDataCol(${j})"></i>
                    </div>
                </td>`;
            }
            // Blank cell at the end to align with the row control column
            html += '<td style="border:none; background:transparent;"></td></tr>';
        }

        for (let i = 0; i < upData.length; i++) {
            const isHeader = i === 0;
            const trClass = isHeader ? 'bg-navy' : '';
            html += `<tr class="${trClass}">`;
            upData[i].forEach((cell, j) => {
                html += `<td ${canEdit ? 'contenteditable="true"' : ''} data-row="${i}" data-col="${j}" onblur="app.updateUpDataValue(this)">${cell || ''}</td>`;
            });
            if (canEdit) {
                // Controls at the end of the row
                html += `<td style="padding: 4px; border-left: none; background: transparent; width: 60px;">
                    <div style="display:flex; gap:8px;">
                        <i data-lucide="plus-circle" style="cursor:pointer; color:var(--success); width:18px; height:18px;" onclick="app.insertUpDataRow(${i})"></i>
                        <i data-lucide="minus-circle" style="cursor:pointer; color:var(--danger); width:18px; height:18px;" onclick="app.removeUpDataRow(${i})"></i>
                    </div>
                </td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
        lucide.createIcons();
    },

    updateUpDataValue(el) {
        if (!el || !el.hasAttribute) return;
        const row = parseInt(el.getAttribute('data-row'), 10);
        const col = parseInt(el.getAttribute('data-col'), 10);

        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData[row]) {
            upData[row][col] = el.textContent.trim();
            localStorage.setItem(key, JSON.stringify(upData));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, upData);
        }
    },

    insertUpDataRow(index) {
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData.length > 0) {
            const cols = upData[0].length;
            const newRow = Array(cols).fill('');
            upData.splice(index + 1, 0, newRow);
            localStorage.setItem(key, JSON.stringify(upData));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, upData);
            this.renderUpData();
        }
    },

    async removeUpDataRow(index) {
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData.length > 1) { // must keep at least 1 row (header)
            if (index === 0) {
                this.showToast('Cannot delete header row', 'error');
                return;
            }
            if (!await this.showConfirm('Are you sure you want to delete this row?')) return;
            upData.splice(index, 1);
            localStorage.setItem(key, JSON.stringify(upData));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, upData);
            this.renderUpData();
        } else {
            this.showToast('Cannot delete the only remaining row', 'error');
        }
    },

    insertUpDataCol(index) {
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData.length > 0) {
            upData.forEach((row, i) => {
                const val = i === 0 ? `Col ${upData[0].length + 1}` : '';
                row.splice(index + 1, 0, val);
            });
            localStorage.setItem(key, JSON.stringify(upData));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, upData);
            this.renderUpData();
        }
    },

    addUpDataCol() { // For the trailing plus button on the top right
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData.length > 0) {
            upData.forEach((row, i) => {
                const val = i === 0 ? `Col ${upData[0].length + 1}` : '';
                row.push(val);
            });
            localStorage.setItem(key, JSON.stringify(upData));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, upData);
            this.renderUpData();
        }
    },

    async removeUpDataCol(index) {
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        let upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData.length > 0 && upData[0].length > 1) {
            if (!await this.showConfirm('Are you sure you want to delete this column?')) return;
            upData.forEach(row => row.splice(index, 1));
            localStorage.setItem(key, JSON.stringify(upData));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, upData);
            this.renderUpData();
        } else {
            this.showToast('Cannot delete the last column', 'error');
        }
    },

    saveUpData() {
        // Force blur on the active element to save current edit
        const active = document.activeElement;
        if (active && active.hasAttribute('contenteditable')) {
            this.updateUpDataValue(active);
            active.blur();
        }
        this.showToast('Updates saved successfully');
        this.renderUpData();
    },

    exportUpDataToExcel() {
        const active = document.activeElement;
        if (active && active.hasAttribute('contenteditable')) {
            this.updateUpDataValue(active);
            active.blur();
        }

        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `updata_account_${activeAccId}`;
        const upData = JSON.parse(localStorage.getItem(key)) || [];

        if (upData.length === 0) {
            this.showToast('No data to download', 'error');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(upData);
        XLSX.utils.book_append_sheet(wb, ws, 'Up Data');

        const timestamp = new Date().toLocaleDateString().replace(/\//g, '-');
        XLSX.writeFile(wb, `UpData_${this.currentUser.name}_${timestamp}.xlsx`);
        this.showToast('Downloading...');
    },

    switchExcelTab(tabId) {
        this.currentExcelTab = tabId;
        document.querySelectorAll('.ex-tab').forEach(t => t.classList.remove('active'));
        // Find button by name or index? Better by ID if we add it, but for now we iterate
        const btn = Array.from(document.querySelectorAll('.ex-tab')).find(b => b.getAttribute('onclick').includes(tabId));
        if (btn) btn.classList.add('active');
        this.renderSchedule();
    },

    renderSchedule() {
        const adminActions = document.getElementById('schedule-admin-actions');
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `schedule_img_account_${activeAccId}`;
        const scheduleImg = localStorage.getItem(key);

        if (adminActions) {
            adminActions.classList.remove('hidden');
            if (scheduleImg) {
                adminActions.innerHTML = `
                    <button class="btn-sleek" onclick="app.importScheduleImage()" title="Change Image">
                        <i data-lucide="refresh-cw"></i> <span>Change</span>
                    </button>
                    <button class="btn-sleek" onclick="app.downloadScheduleImage()" title="Download Image">
                        <i data-lucide="download"></i> <span>Download</span>
                    </button>
                    <button class="btn-sleek danger" onclick="app.deleteScheduleImage()" title="Delete Image">
                        <i data-lucide="trash-2"></i> <span>Delete</span>
                    </button>
                    <input type="file" id="schedule-img-upload" accept="image/*" onchange="app.handleScheduleImageUpload(this)" hidden>
                `;
            } else {
                adminActions.innerHTML = `
                    <button class="btn-sleek" onclick="app.importScheduleImage()">
                        <i data-lucide="upload"></i> <span>Upload Image</span>
                    </button>
                    <input type="file" id="schedule-img-upload" accept="image/*" onchange="app.handleScheduleImageUpload(this)" hidden>
                `;
            }
        }

        const tabsContainer = document.querySelector('.excel-tabs');
        if (tabsContainer) tabsContainer.innerHTML = '';

        const container = document.getElementById('excel-sheet-container');
        if (!container) return;

        if (!scheduleImg) {
            container.innerHTML = `
                <div class="empty-state glass" style="padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(var(--primary-rgb), 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                        <i data-lucide="image" style="width: 40px; height: 40px; color: var(--primary);"></i>
                    </div>
                    <h3 style="margin-top: 0; font-size: 1.3rem; font-weight: 700; color: var(--text-main);">No Schedule Image Available</h3>
                    <p style="color: var(--text-muted); max-width: 450px; margin: 0.5rem auto 1.5rem auto; font-size: 0.95rem;">
                        Please upload a schedule image for this account. It will stay displayed until you replace or remove it.
                    </p>
                    <button class="btn-primary" style="padding: 0.75rem 2rem; display: inline-flex; align-items: center; gap: 0.6rem; border-radius: 12px; font-weight: 700; width: auto;" onclick="app.importScheduleImage()">
                        <i data-lucide="upload"></i> Upload Schedule Image
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
                <img src="${scheduleImg}" alt="Account Schedule" class="schedule-img-styled">
                <div style="display: flex; gap: 0.8rem; flex-wrap: wrap; justify-content: center;">
                    <button class="btn-sleek" onclick="app.downloadScheduleImage()">
                        <i data-lucide="download"></i> <span>Download</span>
                    </button>
                    <button class="btn-sleek" onclick="app.importScheduleImage()">
                        <i data-lucide="refresh-cw"></i> <span>Change Image</span>
                    </button>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    importScheduleImage() {
        let input = document.getElementById('schedule-img-upload');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'schedule-img-upload';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.onchange = (e) => this.handleScheduleImageUpload(e.target);
            document.body.appendChild(input);
        }
        input.click();
    },

    handleScheduleImageUpload(input) {
        if (!input || !input.files || !input.files[0]) return;
        const file = input.files[0];
        if (!file.type.startsWith('image/')) {
            this.showAlert('Please select a valid image file (PNG, JPG, JPEG, WEBP)', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Resize if oversized to avoid localStorage quota issues
                const maxDim = 1920;
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
                const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;

                try {
                    localStorage.setItem(`schedule_img_account_${activeAccId}`, optimizedDataUrl);
                    if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(`schedule_img_account_${activeAccId}`, optimizedDataUrl);
                    this.renderSchedule();
                    this.showAlert('Schedule image uploaded and saved successfully!', 'success');
                } catch (err) {
                    console.error('Storage error:', err);
                    this.showAlert('Image file is too large for local browser storage. Please select a smaller image.', 'error');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        input.value = '';
    },

    downloadScheduleImage() {
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `schedule_img_account_${activeAccId}`;
        const scheduleImg = localStorage.getItem(key);
        if (!scheduleImg) {
            this.showToast('No image available to download', 'error');
            return;
        }

        const accName = this.accounts.find(a => a.id === activeAccId)?.name || 'Account';
        const a = document.createElement('a');
        a.href = scheduleImg;
        a.download = `Schedule_${accName}_${this.currentUser.name || 'Trainer'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast('Downloading schedule image...');
    },

    async deleteScheduleImage() {
        if (await this.showConfirm('Are you sure you want to delete the schedule image?')) {
            const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
            localStorage.removeItem(`schedule_img_account_${activeAccId}`);
            if (window.TrainingFirebase) window.TrainingFirebase.removeCustomKey(`schedule_img_account_${activeAccId}`);
            this.renderSchedule();
            this.showToast('Schedule image deleted successfully.', 'info');
        }
    },

    viewScheduleFullscreen() {
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `schedule_img_account_${activeAccId}`;
        const scheduleImg = localStorage.getItem(key);
        if (!scheduleImg) return;

        const accName = this.accounts.find(a => a.id === activeAccId)?.name || 'Account';
        const content = `
            <div style="text-align: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="calendar" class="icon-primary"></i>
                        <h3 style="margin: 0; font-size: 1.15rem;">Schedule: ${accName}</h3>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-sleek" onclick="app.downloadScheduleImage()">
                            <i data-lucide="download"></i> <span>Download</span>
                        </button>
                        <button class="btn-delete" style="background: transparent; color: #ef4444; font-size: 1.5rem; line-height: 1; padding: 0.2rem 0.5rem;" onclick="app.closeModal()">×</button>
                    </div>
                </div>
                <div style="max-height: 80vh; overflow: auto; border-radius: 0.8rem; background: rgba(0,0,0,0.03); padding: 0.5rem; display: flex; justify-content: center;">
                    <img src="${scheduleImg}" alt="Schedule Full" style="max-width: 100%; height: auto; border-radius: 0.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                </div>
            </div>
        `;
        this.showModal(content);
        lucide.createIcons();
    },

    updateSheetV2(sheet, row, col, el) {
        if (this.currentUser.role !== 'admin' && !this.currentUser.isProxy) return;
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `sheet_${sheet}_account_${activeAccId}`;
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data[row]) {
            data[row][col] = el.innerText;
            localStorage.setItem(key, JSON.stringify(data));
            if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, data);
        }
    },

    updateCell(row, col, el) {
        // This is mainly for when Admin logs in as a trainer (simulation) or if we allow editing
        const activeAccId = this.currentUser.activeAccountId || this.currentUser.accountId;
        const key = `schedule_account_${activeAccId}`;
        let sData = JSON.parse(localStorage.getItem(key)) || [];
        if (!sData[row]) sData[row] = [];
        sData[row][col] = el.innerText;
        localStorage.setItem(key, JSON.stringify(sData));
        if (window.TrainingFirebase) window.TrainingFirebase.saveCustomKey(key, sData);
    },

    formatDateValue(val) {
        if (val === undefined || val === null || String(val).trim() === "") return "";
        if (typeof val === 'string' && /[a-zA-Z\/-]/.test(val)) return val;
        let num = Number(val);
        if (!isNaN(num) && num > 30000) {
            const date = new Date(Math.round((num - 25569) * 86400 * 1000));
            return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        }
        return val;
    },

    formatTimeValue(val) {
        if (val === undefined || val === null || String(val).trim() === "") return "";
        if (typeof val === 'string' && /[pPaAmM:]/.test(val)) return val;
        let num = Number(val);
        if (!isNaN(num) && num < 1 && num > 0) {
            const totalMinutes = Math.round(num * 24 * 60);
            let hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const minsStr = mins < 10 ? '0' + mins : mins;
            return `${hours}:${minsStr} ${ampm}`;
        }
        return val;
    },

    addPitchModal(trainerId) {
        const trainer = this.trainers.find(t => t.id === trainerId);
        if (!trainer) return;

        const content = `
            <div class="login-header">
                <i data-lucide="target" class="icon-primary"></i>
                <h3>Certification</h3>
                <p>Enter performance data for trainer: <strong>${trainer.name}</strong></p>
            </div>
            <div class="modal-grid">
                <div class="input-group">
                    <label>Pitch (Batch #)</label>
                    <input type="number" id="pitch-batch" placeholder="Example: ...">
                </div>
                <div class="input-group">
                    <label>Pass</label>
                    <input type="number" id="pitch-pass" oninput="app.calculatePitchTotal()" placeholder="0">
                </div>
                <div class="input-group">
                    <label>Fail</label>
                    <input type="number" id="pitch-fail" oninput="app.calculatePitchTotal()" placeholder="0">
                </div>
                <div class="input-group">
                    <label>Total</label>
                    <input type="number" id="pitch-total" readonly placeholder="0" style="background: #f3f4f6;">
                </div>
            </div>
            <button class="btn-primary" style="margin-top: 1.5rem;" onclick="app.savePitchResult(${trainerId})">Save Certification</button>
        `;
        this.showModal(content);
        lucide.createIcons();
    },

    calculatePitchTotal() {
        const pass = parseInt(document.getElementById('pitch-pass').value) || 0;
        const fail = parseInt(document.getElementById('pitch-fail').value) || 0;
        document.getElementById('pitch-total').value = pass + fail;
    },

    savePitchResult(trainerId) {
        const trainer = this.trainers.find(t => t.id === trainerId);
        const batch = document.getElementById('pitch-batch').value;
        const pass = parseInt(document.getElementById('pitch-pass').value) || 0;
        const fail = parseInt(document.getElementById('pitch-fail').value) || 0;
        const total = pass + fail;

        if (batch) {
            if (!trainer.pitchResults) trainer.pitchResults = [];
            trainer.pitchResults.push({
                id: Date.now(),
                batch,
                pass,
                fail,
                total,
                date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                recordedBy: this.currentUser.name
            });
            this.saveData();
            // Ensure local state is updated if in proxy mode
            if (this.currentUser.id === trainerId) {
                this.currentUser.pitchResults = [...trainer.pitchResults];
            }
            this.closeModal();
            this.renderHistory();
            this.showAlert('Certification recorded successfully', 'success');
        } else {
            this.showAlert('Please enter the batch number', 'warning');
        }
    },

    renderHistory() {
        const tab = document.getElementById('trainer-content-history');
        const body = document.getElementById('history-body');
        if (!tab || !body) return;

        // Ensure header layout
        let headerDiv = tab.querySelector('.history-header-wrapper');
        if (!headerDiv) {
            const title = tab.querySelector('.tab-title');
            if (title) {
                headerDiv = document.createElement('div');
                headerDiv.className = 'history-header-wrapper';
                headerDiv.style.display = 'flex';
                headerDiv.style.justifyContent = 'space-between';
                headerDiv.style.alignItems = 'center';
                headerDiv.style.marginBottom = '1.5rem';

                title.parentNode.insertBefore(headerDiv, title);
                title.style.marginBottom = '0';
                headerDiv.appendChild(title);

                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'leader-history-actions';
                headerDiv.appendChild(actionsContainer);
            }
        }

        const actionsDiv = tab.querySelector('.leader-history-actions');
        if (actionsDiv) {
            if (this.currentUser.isProxy) {
                actionsDiv.innerHTML = `
                    <button class="btn-primary" onclick="app.addPitchModal(${this.currentUser.id})" style="width: auto; background: var(--secondary); padding: 0.6rem 1.5rem;">
                        <i data-lucide="plus-circle" style="width: 18px; height: 18px; margin-inline-end: 6px; vertical-align: middle;"></i> Certification
                    </button>
                `;
            } else {
                actionsDiv.innerHTML = '';
            }
        }

        const existingOldActions = tab.querySelector(':scope > .leader-history-actions');
        if (existingOldActions) existingOldActions.remove();

        const pitches = this.currentUser.pitchResults || [];

        if (pitches.length === 0) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2.5rem; color: var(--text-muted); font-size: 1.1rem;">No training history available.</td></tr>';
            return;
        }

        // Header styling with icons
        const table = tab.querySelector('.history-table');
        if (table) {
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.classList.add('glass');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="padding: 1rem; text-align: left; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;"><i data-lucide="tag" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;"></i> Batch Info</th>
                        <th style="padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;"><i data-lucide="calendar" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;"></i> Date</th>
                        <th style="padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;"><i data-lucide="user-check" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;"></i> Passed</th>
                        <th style="padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;"><i data-lucide="user-x" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;"></i> Failed</th>
                        <th style="padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;"><i data-lucide="users" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;"></i> Total</th>
                        <th style="padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;"><i data-lucide="bar-chart-3" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;"></i> Performance</th>
                    </tr>
                </thead>
                <tbody class="history-table-body"></tbody>
            `;
        }

        const tableBody = tab.querySelector('.history-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = pitches.map(p => {
            const pass = p.pass || 0;
            const fail = p.fail || 0;
            const total = p.total || 0;
            const rate = total > 0 ? (pass / total) * 100 : 0;

            let statusColor = '#10b981';

            if (rate < 70) {
                statusColor = '#ef4444';
            } else if (rate < 85) {
                statusColor = '#f59e0b';
            }

            // Clean up date formatting
            const dateStr = String(p.date || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d\/ :APMapm-]/g, '');

            return `
            <tr class="history-row" style="border-bottom: 1px solid rgba(0,0,0,0.03); transition: all 0.2s; cursor: default;">
                <td style="padding: 1.25rem 1rem;">
                    <span style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 800; font-size: 0.96rem; border: 1px solid rgba(var(--primary-rgb), 0.2); box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.1);">
                        Batch ${p.batch}
                    </span>
                </td>
                <td style="padding: 1.25rem 1rem; text-align: center;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: #475569;">${dateStr}</div>
                </td>
                <td style="padding: 1.25rem 1rem; text-align: center;">
                    <span style="color: #10b981; font-weight: 850; font-size: 1.1rem;">${pass}</span>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">PASS</div>
                </td>
                <td style="padding: 1.25rem 1rem; text-align: center;">
                    <span style="color: #ef4444; font-weight: 850; font-size: 1.1rem;">${fail}</span>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">FAIL</div>
                </td>
                <td style="padding: 1.25rem 1rem; text-align: center;">
                    <span style="font-weight: 850; font-size: 1.1rem; color: #475569;">${total}</span>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">TOTAL</div>
                </td>
                <td style="padding: 1.25rem 1rem; text-align: center;">
                    <div style="font-weight: 900; font-size: 1.1rem; color: var(--primary);">${rate.toFixed(1)}%</div>
                    <div style="width: 80px; height: 5px; background: #f1f5f9; border-radius: 10px; margin: 5px auto; overflow: hidden;">
                        <div style="width: ${rate}%; height: 100%; background: ${statusColor};"></div>
                    </div>
                </td>
            </tr>
            `;
        }).reverse().join('');
        lucide.createIcons();
    },





    renderDashboard() {
        const pitches = this.currentUser.pitchResults || [];
        const statsGrid = document.querySelector('.dashboard-stats-grid');
        if (!statsGrid) return;

        // Calculate Stats
        const totalBatches = pitches.length;
        const totalPass = pitches.reduce((sum, p) => sum + (p.pass || 0), 0);
        const totalFail = pitches.reduce((sum, p) => sum + (p.fail || 0), 0);
        const totalOverall = totalPass + totalFail;
        const avgPassRate = totalOverall > 0 ? ((totalPass / totalOverall) * 100).toFixed(1) : 0;

        statsGrid.innerHTML = `
            <div class="stat-card glass" style="background: rgba(var(--primary-rgb), 0.05);">
                <h4>Total Batches</h4>
                <p>${totalBatches}</p>
            </div>
            <div class="stat-card glass" style="background: rgba(16, 185, 129, 0.05);">
                <h4>Average Pass Rate</h4>
                <p style="color: var(--secondary)">${avgPassRate}%</p>
            </div>
            <div class="stat-card glass" style="background: rgba(99, 102, 241, 0.05);">
                <h4>Total Trainees</h4>
                <p>${totalOverall}</p>
            </div>
            <div class="stat-card glass" style="background: rgba(16, 185, 129, 0.1);">
                <h4>Passed</h4>
                <p style="color: var(--secondary)">${totalPass}</p>
            </div>
            <div class="stat-card glass" style="background: rgba(239, 68, 68, 0.05);">
                <h4>Failed</h4>
                <p style="color: var(--danger)">${totalFail}</p>
            </div>
        `;

        if (totalBatches === 0) {
            const chartGrid = document.querySelector('.dashboard-charts-grid');
            if (chartGrid) chartGrid.style.opacity = '0.3';
            return;
        } else {
            const chartGrid = document.querySelector('.dashboard-charts-grid');
            if (chartGrid) chartGrid.style.opacity = '1';
        }

        // Chart Data (Last 6 Batches only)
        const recentPitches = pitches.slice(-6);
        const labels = recentPitches.map(p => `B-${p.batch}`);
        const passData = recentPitches.map(p => p.pass || 0);
        const failData = recentPitches.map(p => p.fail || 0);

        // Bar Chart (History)
        const ctxBar = document.getElementById('batch-performance-chart');
        if (ctxBar) {
            if (this.batchChart) this.batchChart.destroy();
            this.batchChart = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Pass',
                            data: passData,
                            backgroundColor: '#10b981',
                            borderRadius: 6
                        },
                        {
                            label: 'Fail',
                            data: failData,
                            backgroundColor: '#ef4444',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            bottom: 18,
                            top: 4,
                            left: 6,
                            right: 6
                        }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: 'var(--text-main)', font: { family: 'Outfit', weight: '700' } } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { family: 'Outfit', weight: '600' } } },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#1e293b',
                                font: { family: 'Outfit', weight: '700', size: 11 },
                                padding: 4,
                                maxRotation: 0,
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        }

        // Pie Chart (Distribution)
        const ctxPie = document.getElementById('pass-fail-pie-chart');
        if (ctxPie) {
            if (this.pieChart) this.pieChart.destroy();
            this.pieChart = new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: ['Pass', 'Fail'],
                    datasets: [{
                        data: [totalPass, totalFail],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: 8
                    },
                    cutout: '52%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: 'var(--text-main)', font: { family: 'Outfit', weight: '700', size: 13 }, padding: 15 } }
                    }
                }
            });
        }
    },

    getDefaultKPIScorecard() {
        return [
            {
                id: 1,
                kra: "Overall Throughput",
                kpi: "Key performance Indicator",
                weight: 10,
                target: ">=90",
                rubric: ">=90%: 5\n85%-89%: 4\n80%-85%: 3\n<70%: 1",
                options: [
                    { text: ">=90%", points: 5, status: "Excellent", score: 10.0 },
                    { text: "85%-89%", points: 4, status: "Very Good", score: 8.0 },
                    { text: "80%-85%", points: 3, status: "Fair", score: 6.0 },
                    { text: "<70%", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 3
            },
            {
                id: 2,
                kra: "Knowledge & Updates Trainer Awareness",
                kpi: "Quality Of Training",
                weight: 10,
                target: "95%",
                rubric: ">=95%: 5\n94%-93%: 4\n92%-91%: 3\n<=90%: 1",
                options: [
                    { text: ">=95%", points: 5, status: "Excellent", score: 10.0 },
                    { text: "94%-93%", points: 4, status: "Very Good", score: 8.0 },
                    { text: "92%-91%", points: 3, status: "Fair", score: 6.0 },
                    { text: "<=90%", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 3,
                kra: "Trainees' and trainer satisfaction evaluation",
                kpi: "Quality Of Training",
                weight: 10,
                target: "95%",
                rubric: ">=95%: 5\n94%-93%: 4\n92%-91%: 3\n<90%: 1",
                options: [
                    { text: ">=95%", points: 5, status: "Excellent", score: 10.0 },
                    { text: "94%-93%", points: 4, status: "Very Good", score: 8.0 },
                    { text: "92%-91%", points: 3, status: "Fair", score: 6.0 },
                    { text: "<90%", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 4,
                kra: "Following and responding to roles, polices and tasks deadline without delay",
                kpi: "Flexibility",
                weight: 10,
                target: "Yes",
                rubric: "Yes: 5\nNo: 1",
                options: [
                    { text: "yes", points: 5, status: "Excellent", score: 10.0 },
                    { text: "no", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 5,
                kra: "Number of trainees who passed from 1st time",
                kpi: "Quality Of Training",
                weight: 15,
                target: "94%",
                rubric: ">=94%: 5\n93%-92%: 4\n90-91%: 3\n<90%: 1",
                options: [
                    { text: ">=94%", points: 5, status: "Excellent", score: 15.0 },
                    { text: "93%-92%", points: 4, status: "Very Good", score: 12.0 },
                    { text: "90-91%", points: 3, status: "Fair", score: 9.0 },
                    { text: "<90%", points: 1, status: "Need Improvement", score: 3.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 6,
                kra: "Generating accurate reports Daily with matching the deadline at the end of each batch",
                kpi: "Training administration",
                weight: 10,
                target: "All reports accurate & On time",
                rubric: "All reports accurate & On time: 5\n75% of reports accurate & on time: 4\n50% of reports accurate & on time: 3\nNo sheets accurate & on time: 1",
                options: [
                    { text: "All reports accurate & On time", points: 5, status: "Excellent", score: 10.0 },
                    { text: "75% of reports accurate & on time", points: 4, status: "Very Good", score: 8.0 },
                    { text: "50% of reports accurate & on time", points: 3, status: "Fair", score: 6.0 },
                    { text: "No sheets accurate & on time", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 7,
                kra: "Coaching and Development",
                kpi: "Quality Of Training",
                weight: 10,
                target: "75%",
                rubric: ">=75%: 5\n74%-65%: 4\n64%-60%: 3\n<60%: 1",
                options: [
                    { text: ">=75%", points: 5, status: "Excellent", score: 10.0 },
                    { text: "74%-65%", points: 4, status: "Very Good", score: 8.0 },
                    { text: "64%-60%", points: 3, status: "Fair", score: 6.0 },
                    { text: "<60%", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 8,
                kra: "Mentors' feedback (Operation, Client, Quality Control)",
                kpi: "Quality Of Training",
                weight: 15,
                target: "Achieved all KPIs",
                rubric: "Achieved all KPIs: 5\nAchieved 2 kpis: 4\nAchieved one KPI: 3\nNon achieved: 1",
                options: [
                    { text: "Achieved all KPIs", points: 5, status: "Excellent", score: 15.0 },
                    { text: "Achieved 2 kpis", points: 4, status: "Very Good", score: 12.0 },
                    { text: "Achieved one KPI", points: 3, status: "Fair", score: 9.0 },
                    { text: "Non achieved", points: 1, status: "Need Improvement", score: 3.0 }
                ],
                selectedOptionIndex: 0
            },
            {
                id: 9,
                kra: "OJT Quality and NPS",
                kpi: "Quality Of Training",
                weight: 10,
                target: "80%",
                rubric: ">=80%: 5\n79%-70%: 4\n69%-60%: 3\n<60%: 1",
                options: [
                    { text: ">=80%", points: 5, status: "Excellent", score: 10.0 },
                    { text: "79%-70%", points: 4, status: "Very Good", score: 8.0 },
                    { text: "69%-60%", points: 3, status: "Fair", score: 6.0 },
                    { text: "<60%", points: 1, status: "Need Improvement", score: 1.0 }
                ],
                selectedOptionIndex: 0
            }
        ];
    },

    getDefaultAllOverData() {
        return {
            batchName: "Horizon SME Batch 22",
            mentorBatchName: "Horizon SME Batch 21",
            metrics: {
                overallThroughputPct: "77%",
                knowledgePct: "95%",
                satisfactionPct: "100%",
                policiesCompliance: "No",
                pass1stTimeHC: "17",
                pass1stTimePass: "17",
                pass1stTimeAvg: "100%",
                accurateReports: "yes",
                coachingDevelopment: "yes",
                authNPS: "51%",
                authTargetNPS: "56%",
                authRCS: "74%",
                authTargetRCS: "56%",
                euNPS: "74%",
                euTargetNPS: "66%",
                euRCS: "56%",
                euTargetRCS: "55%",
                ojtNPS: "13%",
                ojtTargetNPS: "40%",
                ojtQ: "Pass",
                ojtTargetQ: "85%"
            }
        };
    },

    getDefaultEvaluationData() {
        const questions = [
            {
                id: 1,
                en: "Trainer was Knowledgeable of the program material and uses his experince to enrich the content.",
                ar: "كان المدرب متمكناً من المحتوي التدريبي و اضاف لي من خبرته الشخصية."
            },
            {
                id: 2,
                en: "Your trainer have a thorough grasp of the subject.",
                ar: "المدرب لديه فهم شامل بالموضوع."
            },
            {
                id: 3,
                en: "The trainer was very interactive with the participants.",
                ar: "كان المدرب متفاعلاً جداً مع المتدربين."
            },
            {
                id: 4,
                en: "Your trainer answer the question posed.",
                ar: "المدرب يجيب على السؤال المطروح عليه."
            },
            {
                id: 5,
                en: "The trainer was well prepared and organized.",
                ar: "كان المدرب معد و مستعد و منظم."
            },
            {
                id: 6,
                en: "Trainer provide time for follow-ups and questions",
                ar: "المدرب يقدم وقت للأسئله و المتابعه."
            },
            {
                id: 7,
                en: "The Trainer has a good command of English language.",
                ar: "كان المدرب متمكناً من اللغة كما ينبغي."
            },
            {
                id: 8,
                en: "Training Team communication skills and interactivity wereprofessional & effective.",
                ar: "مهارات تواصل و تفاعل فريق التدريب كانت فعالة و تمت باسلوب علمي."
            }
        ];

        const agentCount = 17;
        const ratings = {};
        questions.forEach(q => {
            ratings[q.id] = Array(agentCount).fill(4);
        });

        return {
            agentCount,
            questions,
            ratings
        };
    },

    getCurrentMonthKey(d = new Date()) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    },

    getRolling12Months() {
        const months = [];
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        for (let i = 0; i < 12; i++) {
            let targetMonth = currentMonth - i;
            let targetYear = currentYear;
            while (targetMonth < 0) {
                targetMonth += 12;
                targetYear -= 1;
            }
            const key = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
            const monthName = monthNames[targetMonth];
            months.push({
                key,
                year: targetYear,
                monthNum: targetMonth + 1,
                monthName,
                label: `${monthName} ${targetYear}`,
                isCurrent: i === 0
            });
        }
        return months;
    },

    formatMonthLabel(key) {
        if (!key) return '';
        const parts = key.split('-');
        if (parts.length !== 2) return key;
        const year = parseInt(parts[0]);
        const monthNum = parseInt(parts[1]);
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[monthNum - 1] || 'Month ' + monthNum} ${year}`;
    },

    pruneOldKPIRecords(trainer) {
        if (!trainer || !trainer.monthlyKPIs) return;
        const validMonths = new Set(this.getRolling12Months().map(m => m.key));
        Object.keys(trainer.monthlyKPIs).forEach(k => {
            if (!validMonths.has(k)) delete trainer.monthlyKPIs[k];
        });
    },

    getTrainerMonthlyKPI(trainerId, monthKey = null) {
        const trainer = this.trainers.find(t => t.id === trainerId) || (this.currentUser && this.currentUser.id === trainerId ? this.currentUser : null);
        if (!monthKey) monthKey = this.selectedKPIMonth || this.getCurrentMonthKey();
        const defaultScorecard = this.getDefaultKPIScorecard();

        if (!trainer) return { monthKey, scorecard: defaultScorecard, isEvaluated: false };

        if (!trainer.monthlyKPIs) {
            trainer.monthlyKPIs = {};
            if (trainer.kpiScorecard) {
                trainer.monthlyKPIs[this.getCurrentMonthKey()] = {
                    scorecard: JSON.parse(JSON.stringify(trainer.kpiScorecard)),
                    isEvaluated: !!trainer.kpiEvaluated
                };
            }
        }

        this.pruneOldKPIRecords(trainer);

        if (!trainer.monthlyKPIs[monthKey]) {
            trainer.monthlyKPIs[monthKey] = {
                scorecard: JSON.parse(JSON.stringify(defaultScorecard)),
                allOverData: this.getDefaultAllOverData(),
                evaluationData: this.getDefaultEvaluationData(),
                isEvaluated: false
            };
        }

        const data = trainer.monthlyKPIs[monthKey];
        if (!data.allOverData) {
            data.allOverData = this.getDefaultAllOverData();
        }
        if (!data.evaluationData) {
            data.evaluationData = this.getDefaultEvaluationData();
        }

        data.scorecard.forEach((item, idx) => {
            const def = defaultScorecard[idx];
            if (def) {
                item.kra = def.kra;
                item.kpi = def.kpi;
                item.options = def.options;
                item.rubric = def.rubric;
                item.target = def.target;
                item.weight = def.weight;
                if (item.selectedOptionIndex === undefined) item.selectedOptionIndex = def.selectedOptionIndex;
            }
        });

        return {
            monthKey,
            scorecard: data.scorecard,
            allOverData: data.allOverData,
            evaluationData: data.evaluationData,
            isEvaluated: !!data.isEvaluated
        };
    },

    changeKPIMonth(newMonthKey) {
        this.selectedKPIMonth = newMonthKey;
        this.renderKPIs();
    },

    getTrainerKPIScorecard(trainerId, monthKey = null) {
        return this.getTrainerMonthlyKPI(trainerId, monthKey).scorecard;
    },

    calculateKPISummary(scorecard, isEvaluated = true) {
        if (!isEvaluated) return { totalWeight: 100, totalScore: 0, avgFinalScore: "0.00", totalWithLD: "0%", isEvaluated: false };
        let totalWeight = 0, totalScore = 0, totalPoints = 0;
        scorecard.forEach(item => {
            const opt = item.options[item.selectedOptionIndex || 0] || item.options[0];
            totalWeight += item.weight;
            totalScore += opt.score;
            totalPoints += opt.points;
        });
        const avg = (totalPoints / scorecard.length).toFixed(2);
        return { totalWeight, totalScore: Math.round(totalScore), avgFinalScore: avg, totalWithLD: `${Math.round(totalScore)}%`, isEvaluated: true };
    },



    renderKPIs() {
        const container = document.getElementById('trainer-kpis-container');
        if (!container || !this.currentUser) return;

        this.selectedKPIMonth = this.getCurrentMonthKey();
        const activeMonthKey = this.selectedKPIMonth;
        const rollingMonths = this.getRolling12Months();
        const monthData = this.getTrainerMonthlyKPI(this.currentUser.id, activeMonthKey);
        const isEvaluated = monthData.isEvaluated;
        const scorecard = monthData.scorecard;
        const summary = this.calculateKPISummary(scorecard, isEvaluated);
        const selectedMonthObj = rollingMonths.find(m => m.key === activeMonthKey) || rollingMonths[0];
        const activeTrainerTab = this.activeTrainerKPITab || 'kpis';

        container.innerHTML = `
            <!-- Tabs Header in Trainer Dashboard -->
            <div class="kpi-modal-tabs-header" style="margin-bottom: 1.2rem;">
                <button class="kpi-tab-btn ${activeTrainerTab === 'kpis' ? 'active' : ''}" id="trainer-tab-btn-kpis" onclick="app.switchTrainerKPITab('kpis')">
                    <i data-lucide="award" style="width: 14px; height: 14px;"></i> <span>KPIs</span>
                </button>
                <button class="kpi-tab-btn ${activeTrainerTab === 'allover' ? 'active' : ''}" id="trainer-tab-btn-allover" onclick="app.switchTrainerKPITab('allover')">
                    <i data-lucide="layers" style="width: 14px; height: 14px;"></i> <span>Over all</span>
                </button>
                <button class="kpi-tab-btn ${activeTrainerTab === 'evaluation' ? 'active' : ''}" id="trainer-tab-btn-evaluation" onclick="app.switchTrainerKPITab('evaluation')">
                    <i data-lucide="users" style="width: 14px; height: 14px;"></i> <span>Evaluation</span>
                </button>
            </div>

            <!-- Pane 1: KPIs -->
            <div id="trainer-kpi-pane-kpis" class="trainer-kpi-pane" style="display: ${activeTrainerTab === 'kpis' ? 'block' : 'none'};">
                <div class="kpi-overview-grid" style="margin-bottom: 1.5rem;">
                    <div class="kpi-card glass">
                    <div class="kpi-card-header">
                        <span class="kpi-card-title">Total KPI Score</span>
                        <div class="kpi-card-icon" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5;">
                            <i data-lucide="award"></i>
                        </div>
                    </div>
                    <div class="kpi-card-val" style="color: #4f46e5;">${summary.totalScore}%</div>
                    <div class="kpi-card-sub">
                        <span class="kpi-badge-pill ${isEvaluated ? 'purple' : 'gray'}"><i data-lucide="${isEvaluated ? 'trending-up' : 'clock'}" style="width:12px;height:12px;"></i> ${isEvaluated ? `Final Grade: ${summary.avgFinalScore} / 5.0` : 'Pending Evaluation'}</span>
                    </div>
                </div>

                <div class="kpi-card glass">
                    <div class="kpi-card-header">
                        <span class="kpi-card-title">Total + L&D</span>
                        <div class="kpi-card-icon" style="background: rgba(16, 185, 129, 0.15); color: #059669;">
                            <i data-lucide="check-circle-2"></i>
                        </div>
                    </div>
                    <div class="kpi-card-val" style="color: #059669;">${summary.totalWithLD}</div>
                    <div class="kpi-card-sub">
                        <span class="kpi-badge-pill ${isEvaluated ? 'success' : 'gray'}">Total Weight: ${summary.totalWeight}%</span>
                    </div>
                </div>

                <div class="kpi-card glass">
                    <div class="kpi-card-header">
                        <span class="kpi-card-title">Average Rating</span>
                        <div class="kpi-card-icon" style="background: rgba(59, 130, 246, 0.15); color: #2563eb;">
                            <i data-lucide="star"></i>
                        </div>
                    </div>
                    <div class="kpi-card-val" style="color: #2563eb;">${summary.avgFinalScore}</div>
                    <div class="kpi-card-sub">
                        <span>Status: <strong>${isEvaluated ? (summary.avgFinalScore >= 4.0 ? 'Excellent' : (summary.avgFinalScore >= 3.0 ? 'Good' : 'Needs Focus')) : 'Not Evaluated Yet'}</strong></span>
                    </div>
                </div>
            </div>

            <div class="kpi-section-box glass" style="padding: 1rem 0.65rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; padding: 0 0.25rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="table" style="color: var(--primary);"></i> Key Performance Indicator (KPI) Matrix - ${selectedMonthObj.monthName} ${selectedMonthObj.year}
                        </h3>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-sleek" onclick="app.exportKPIsToExcel(${this.currentUser.id}, '${activeMonthKey}')" style="padding: 0.45rem 1rem; font-size: 0.82rem; display: flex; align-items: center; gap: 0.3rem;">
                            <i data-lucide="download" style="width:14px; height:14px;"></i> Export Excel
                        </button>
                        <button class="btn-sleek" onclick="app.exportKPIsToPdf(${this.currentUser.id}, '${activeMonthKey}')" style="padding: 0.45rem 1rem; font-size: 0.82rem; display: flex; align-items: center; gap: 0.3rem;">
                            <i data-lucide="file-text" style="width:14px; height:14px;"></i> Export PDF
                        </button>
                    </div>
                </div>

                <div class="kpi-matrix-table-container">
                    <table class="kpi-matrix-table">
                        <thead>
                            <tr>
                                <th style="width: 20%;">Key Result areas</th>
                                <th style="width: 12.5%;">Key performance<br>indicator</th>
                                <th style="width: 5%;">Weight</th>
                                <th style="width: 7%;">Target</th>
                                <th style="width: 10.5%;">Grade (Level)</th>
                                <th style="width: 11%;">Rating</th>
                                <th style="width: 20%;">Grades (Rubric)</th>
                                <th style="width: 4.5%;">Actual</th>
                                <th style="width: 4.5%;">Score</th>
                                <th style="width: 5%;">Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${scorecard.map((item, idx) => {
            const selectedOpt = item.options[item.selectedOptionIndex || 0] || item.options[0];
            let badgeClass = 'purple';
            if (selectedOpt.status === 'Excellent') badgeClass = 'success';
            else if (selectedOpt.status === 'Very Good') badgeClass = 'purple';
            else if (selectedOpt.status === 'Fair' || selectedOpt.status === 'Good') badgeClass = 'blue';
            else if (selectedOpt.status === 'Need Improvement' || selectedOpt.status === 'Non achieved') badgeClass = 'warning';

            const displayLevel = isEvaluated ? selectedOpt.text : '-';
            const displayRating = isEvaluated ? selectedOpt.status : 'Pending';
            const ratingBadgeClass = isEvaluated ? badgeClass : 'gray';
            const displayActual = isEvaluated ? selectedOpt.score.toFixed(1) : '-';
            const displayScore = isEvaluated ? selectedOpt.score.toFixed(1) : '-';
            const displayFinal = isEvaluated ? selectedOpt.points : '-';

            return `
                                <tr>
                                    <td style="font-weight: 700; color: #1e1b4b;">${item.kra}</td>
                                    <td style="color: #475569; font-weight: 600;">${item.kpi}</td>
                                    <td style="text-align: center; font-weight: 800; color: var(--primary); padding: 0.4rem 0.1rem;">${item.weight}</td>
                                    <td style="text-align: center; font-weight: 600; color: #334155;">${item.target}</td>
                                    <td>
                                        <div class="kpi-level-display ${isEvaluated ? '' : 'pending'}">
                                            ${displayLevel}
                                        </div>
                                    </td>
                                    <td style="text-align: center; padding: 0.4rem 0.15rem;">
                                        <span class="kpi-badge-pill ${ratingBadgeClass}">
                                            ${displayRating}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="kpi-rubric-list">
                                            ${item.options.map((opt, oIdx) => {
                const isSelected = isEvaluated && (item.selectedOptionIndex || 0) === oIdx;
                let ptsColor = '#64748b';
                let ptsBg = '#f1f5f9';
                if (opt.points === 5) { ptsColor = '#059669'; ptsBg = 'rgba(16, 185, 129, 0.15)'; }
                else if (opt.points === 4) { ptsColor = '#4f46e5'; ptsBg = 'rgba(99, 102, 241, 0.15)'; }
                else if (opt.points === 3) { ptsColor = '#2563eb'; ptsBg = 'rgba(59, 130, 246, 0.15)'; }
                else if (opt.points === 1) { ptsColor = '#d97706'; ptsBg = 'rgba(245, 158, 11, 0.15)'; }

                return `
                                                <div class="kpi-rubric-row ${isSelected ? 'selected' : ''}">
                                                    <span class="rubric-text">${opt.text}</span>
                                                    <span class="rubric-pts" style="color: ${ptsColor}; background: ${ptsBg};">${opt.points}</span>
                                                </div>
                                                `;
            }).join('')}
                                        </div>
                                    </td>
                                    <td style="text-align: center; font-weight: 700; color: #0f172a; padding: 0.4rem 0.1rem;">${displayActual}</td>
                                    <td style="text-align: center; font-weight: 700; color: #0f172a; padding: 0.4rem 0.1rem;">${displayScore}</td>
                                    <td style="text-align: center; font-weight: 800; font-size: 0.95rem; color: var(--primary); padding: 0.4rem 0.1rem;">${displayFinal}</td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="7"></td>
                                <td style="text-align: center; font-weight: 800; font-size: 0.85rem; color: #1e293b;">Total</td>
                                <td style="text-align: center; color: #059669; font-size: 0.95rem; font-weight: 800;">${summary.totalScore}%</td>
                                <td style="text-align: center; color: #4f46e5; font-size: 0.95rem; font-weight: 800;">${summary.avgFinalScore}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        <!-- Pane 2: All Over (Lazy loaded on click) -->
        <div id="trainer-kpi-pane-allover" class="trainer-kpi-pane" style="display: ${activeTrainerTab === 'allover' ? 'block' : 'none'};">
            ${activeTrainerTab === 'allover' ? `
            <div class="kpi-section-box glass" style="padding: 1rem 0.65rem; border-radius: 12px; margin-bottom: 1rem; overflow-x: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0 0.25rem;">
                    <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="layers" style="color: var(--primary);"></i> Overall Performance Summary (Over all) - ${selectedMonthObj.monthName} ${selectedMonthObj.year}
                    </h3>
                </div>
                ${this.renderAllOverTableHTML(monthData.allOverData, false, this.currentUser.id, activeMonthKey)}
            </div>` : ''}
        </div>

        <!-- Pane 3: Evaluation (Lazy loaded on click) -->
        <div id="trainer-kpi-pane-evaluation" class="trainer-kpi-pane" style="display: ${activeTrainerTab === 'evaluation' ? 'block' : 'none'};">
            ${activeTrainerTab === 'evaluation' ? `
            <div class="kpi-section-box glass" style="padding: 1rem 0.65rem; border-radius: 12px; margin-bottom: 1rem; overflow-x: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0 0.25rem;">
                    <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="users" style="color: var(--primary);"></i> Trainees Satisfaction & Evaluation Feedback - ${selectedMonthObj.monthName} ${selectedMonthObj.year}
                    </h3>
                </div>
                ${this.renderEvaluationTableHTML(monthData.evaluationData, false, this.currentUser.id, activeMonthKey)}
            </div>` : ''}
        </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    },

    updateKPIScorecardRow(trainerId, rowIndex, optionIndex, viewContext = 'trainer-dashboard', monthKey = null) {
        if (viewContext === 'trainer-dashboard') return;
        if (!monthKey) monthKey = this.modalSelectedKPIMonth || this.selectedKPIMonth || this.getCurrentMonthKey();

        const trainer = this.trainers.find(t => t.id === trainerId) || (this.currentUser && this.currentUser.id === trainerId ? this.currentUser : null);
        if (!trainer) return;

        const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);
        const scorecard = monthData.scorecard;
        if (scorecard && scorecard[rowIndex]) {
            scorecard[rowIndex].selectedOptionIndex = parseInt(optionIndex);
            if (!trainer.monthlyKPIs) trainer.monthlyKPIs = {};
            if (!trainer.monthlyKPIs[monthKey]) {
                trainer.monthlyKPIs[monthKey] = { scorecard, isEvaluated: false };
            } else {
                trainer.monthlyKPIs[monthKey].scorecard = scorecard;
            }
            trainer.kpiScorecard = scorecard;
            if (this.currentUser && this.currentUser.id === trainerId) {
                this.currentUser.kpiScorecard = scorecard;
                this.currentUser.monthlyKPIs = trainer.monthlyKPIs;
            }
        }

        if (viewContext === 'modal') {
            const summary = this.calculateKPISummary(scorecard, true);
            const opt = scorecard[rowIndex].options[optionIndex];
            if (opt) {
                const ratingEl = document.getElementById(`modal-kpi-rating-${rowIndex}`);
                if (ratingEl) {
                    ratingEl.textContent = opt.status;
                    let badgeClass = 'purple';
                    if (opt.status === 'Excellent') badgeClass = 'success';
                    else if (opt.status === 'Very Good') badgeClass = 'purple';
                    else if (opt.status === 'Fair' || opt.status === 'Good') badgeClass = 'blue';
                    else if (opt.status === 'Need Improvement' || opt.status === 'Non achieved') badgeClass = 'warning';
                    ratingEl.className = `kpi-badge-pill ${badgeClass}`;
                }
                const actualEl = document.getElementById(`modal-kpi-actual-${rowIndex}`);
                if (actualEl) actualEl.textContent = opt.score.toFixed(1);
                const scoreEl = document.getElementById(`modal-kpi-score-${rowIndex}`);
                if (scoreEl) scoreEl.textContent = opt.score.toFixed(1);
                const finalEl = document.getElementById(`modal-kpi-final-${rowIndex}`);
                if (finalEl) finalEl.textContent = opt.points;

                const row = document.getElementById(`modal-kpi-row-${rowIndex}`);
                if (row) {
                    const rubricRows = row.querySelectorAll('.kpi-rubric-row');
                    rubricRows.forEach((r, oIdx) => {
                        r.classList.toggle('selected', oIdx === parseInt(optionIndex));
                    });
                }
            }
            const headerTotal = document.getElementById('modal-kpi-header-total');
            if (headerTotal) headerTotal.textContent = `${summary.totalScore}%`;
            const headerGrade = document.getElementById('modal-kpi-header-grade');
            if (headerGrade) headerGrade.textContent = summary.avgFinalScore;
            const footTotal = document.getElementById('modal-kpi-foot-total');
            if (footTotal) footTotal.textContent = `${summary.totalScore}%`;
            const footGrade = document.getElementById('modal-kpi-foot-grade');
            if (footGrade) footGrade.textContent = summary.avgFinalScore;
        }
    },

    saveTrainerKPIScorecard(trainerId, monthKey = null) {
        if (!monthKey) monthKey = this.modalSelectedKPIMonth || this.selectedKPIMonth || this.getCurrentMonthKey();
        const trainer = this.trainers.find(t => t.id === trainerId) || (this.currentUser && this.currentUser.id === trainerId ? this.currentUser : null);
        if (trainer) {
            const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);
            const scorecard = monthData.scorecard;
            if (!trainer.monthlyKPIs) trainer.monthlyKPIs = {};

            trainer.monthlyKPIs[monthKey] = {
                scorecard: scorecard,
                allOverData: monthData.allOverData || this.getDefaultAllOverData(),
                evaluationData: monthData.evaluationData || this.getDefaultEvaluationData(),
                isEvaluated: true,
                evaluatedAt: new Date().toISOString()
            };
            trainer.kpiScorecard = scorecard;
            trainer.kpiEvaluated = true;
            trainer.kpiAllOverData = trainer.monthlyKPIs[monthKey].allOverData;
            trainer.kpiEvaluationData = trainer.monthlyKPIs[monthKey].evaluationData;

            this.pruneOldKPIRecords(trainer);

            if (this.currentUser && this.currentUser.id === trainerId) {
                this.currentUser.monthlyKPIs = trainer.monthlyKPIs;
                this.currentUser.kpiScorecard = scorecard;
                this.currentUser.kpiEvaluated = true;
                this.currentUser.kpiAllOverData = trainer.kpiAllOverData;
                this.currentUser.kpiEvaluationData = trainer.kpiEvaluationData;
            }
            this.saveData();

            // Update period status in header if present in modal
            const periodEl = document.getElementById('kpi-modal-period-text');
            if (periodEl) {
                periodEl.textContent = `Period: ${this.formatMonthLabel(monthKey)} (Evaluated)`;
            }

            // Visual feedback on the button
            const saveBtn = document.getElementById('kpi-save-eval-btn');
            if (saveBtn) {
                const originalHTML = saveBtn.innerHTML;
                saveBtn.innerHTML = `<i data-lucide="check" style="width: 14px; height: 14px;"></i> Saved Successfully!`;
                saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                setTimeout(() => {
                    saveBtn.innerHTML = originalHTML;
                    saveBtn.style.background = '';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }, 2000);
            }

            this.showToast(`KPI Evaluation for ${this.formatMonthLabel(monthKey)} saved and published successfully!`, 'success');
        }
    },

    switchModalKPITab(tabId) {
        this.activeModalKPITab = tabId;
        const tabs = ['kpis', 'allover', 'evaluation'];
        const trainerId = this.modalTrainerId || (this.currentUser ? this.currentUser.id : null);
        const monthKey = this.modalSelectedKPIMonth || this.getCurrentMonthKey();
        const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);

        tabs.forEach(t => {
            const btn = document.getElementById(`modal-tab-btn-${t}`);
            const pane = document.getElementById(`modal-kpi-pane-${t}`);
            if (btn) btn.classList.toggle('active', t === tabId);
            if (pane) {
                const isActive = (t === tabId);
                pane.style.display = isActive ? 'block' : 'none';
                if (isActive && (!pane.innerHTML || pane.innerHTML.trim() === '')) {
                    if (t === 'allover') {
                        pane.innerHTML = this.renderAllOverTableHTML(monthData.allOverData, true, trainerId, monthKey);
                    } else if (t === 'evaluation') {
                        pane.innerHTML = this.renderEvaluationTableHTML(monthData.evaluationData, true, trainerId, monthKey);
                    }
                }
            }
        });
        const modalContent = document.getElementById('modal-content');
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: modalContent || document.body });
    },

    switchTrainerKPITab(tabId) {
        this.activeTrainerKPITab = tabId;
        const tabs = ['kpis', 'allover', 'evaluation'];
        const monthKey = this.selectedKPIMonth || this.getCurrentMonthKey();
        const monthData = this.getTrainerMonthlyKPI(this.currentUser.id, monthKey);

        tabs.forEach(t => {
            const btn = document.getElementById(`trainer-tab-btn-${t}`);
            const pane = document.getElementById(`trainer-kpi-pane-${t}`);
            if (btn) btn.classList.toggle('active', t === tabId);
            if (pane) {
                const isActive = (t === tabId);
                pane.style.display = isActive ? 'block' : 'none';
                if (isActive && (!pane.innerHTML || pane.innerHTML.trim() === '')) {
                    if (t === 'allover') {
                        pane.innerHTML = `
                            <div class="kpi-section-box glass" style="padding: 1rem 0.65rem; border-radius: 12px; margin-bottom: 1rem; overflow-x: auto;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0 0.25rem;">
                                    <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                                        <i data-lucide="layers" style="color: var(--primary);"></i> Overall Performance Summary (Over all)
                                    </h3>
                                </div>
                                ${this.renderAllOverTableHTML(monthData.allOverData, false, this.currentUser.id, monthKey)}
                            </div>`;
                    } else if (t === 'evaluation') {
                        pane.innerHTML = `
                            <div class="kpi-section-box glass" style="padding: 1rem 0.65rem; border-radius: 12px; margin-bottom: 1rem; overflow-x: auto;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0 0.25rem;">
                                    <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                                        <i data-lucide="users" style="color: var(--primary);"></i> Trainees Satisfaction & Evaluation Feedback
                                    </h3>
                                </div>
                                ${this.renderEvaluationTableHTML(monthData.evaluationData, false, this.currentUser.id, monthKey)}
                            </div>`;
                    }
                }
            }
        });
        const container = document.getElementById('trainer-kpis-container');
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: container || document.body });
    },

    updateAllOverField(trainerId, monthKey, key, value) {
        const trainer = this.trainers.find(t => t.id === trainerId) || (this.currentUser && this.currentUser.id === trainerId ? this.currentUser : null);
        if (!trainer) return;
        const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);
        if (!monthData.allOverData) monthData.allOverData = this.getDefaultAllOverData();

        if (key === 'batchName' || key === 'mentorBatchName') {
            monthData.allOverData[key] = value;
        } else {
            if (!monthData.allOverData.metrics) monthData.allOverData.metrics = {};
            monthData.allOverData.metrics[key] = value;

            if (key === 'pass1stTimeHC' || key === 'pass1stTimePass') {
                const hc = parseFloat(monthData.allOverData.metrics.pass1stTimeHC) || 0;
                const pass = parseFloat(monthData.allOverData.metrics.pass1stTimePass) || 0;
                if (hc > 0) {
                    monthData.allOverData.metrics.pass1stTimeAvg = `${Math.round((pass / hc) * 100)}%`;
                }
            }
        }

        if (trainer.monthlyKPIs && trainer.monthlyKPIs[monthKey]) {
            trainer.monthlyKPIs[monthKey].allOverData = monthData.allOverData;
        }
    },

    updateEvaluationRating(trainerId, monthKey, qId, agentIndex, value) {
        const trainer = this.trainers.find(t => t.id === trainerId) || (this.currentUser && this.currentUser.id === trainerId ? this.currentUser : null);
        if (!trainer) return;
        const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);
        if (!monthData.evaluationData) monthData.evaluationData = this.getDefaultEvaluationData();

        const val = parseFloat(value) || 4;
        if (!monthData.evaluationData.ratings) monthData.evaluationData.ratings = {};
        if (!monthData.evaluationData.ratings[qId]) {
            monthData.evaluationData.ratings[qId] = Array(monthData.evaluationData.agentCount || 17).fill(4);
        }
        monthData.evaluationData.ratings[qId][agentIndex] = val;

        if (trainer.monthlyKPIs && trainer.monthlyKPIs[monthKey]) {
            trainer.monthlyKPIs[monthKey].evaluationData = monthData.evaluationData;
        }

        const modalPane = document.getElementById('modal-kpi-pane-evaluation');
        if (modalPane && modalPane.style.display !== 'none') {
            modalPane.innerHTML = this.renderEvaluationTableHTML(monthData.evaluationData, true, trainerId, monthKey);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        const trainerPane = document.getElementById('trainer-kpi-pane-evaluation');
        if (trainerPane && trainerPane.style.display !== 'none') {
            trainerPane.innerHTML = `<div class="kpi-section-box glass" style="padding: 1rem 0.65rem; border-radius: 12px; overflow-x: auto;">${this.renderEvaluationTableHTML(monthData.evaluationData, false, trainerId, monthKey)}</div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    renderKPIScorecardTableHTML(scorecard, summary, isEvaluated = true) {
        return `
            <div class="kpi-matrix-table-container" style="overflow: visible; width: 100%; margin-top: 0.2rem; box-shadow: none; border: 1.5px solid #cbd5e1;">
                <table class="kpi-matrix-table">
                    <thead>
                        <tr>
                            <th style="width: 19%; padding: 0.35rem 0.25rem; font-size: 0.72rem; line-height: 1.15;">Key Result areas</th>
                            <th style="width: 12%; padding: 0.35rem 0.25rem; font-size: 0.72rem; line-height: 1.15;">Key performance<br>indicator</th>
                            <th style="width: 4.5%; padding: 0.35rem 0.15rem; font-size: 0.72rem; line-height: 1.15;">Weight</th>
                            <th style="width: 6.5%; padding: 0.35rem 0.2rem; font-size: 0.72rem; line-height: 1.15;">Target</th>
                            <th style="width: 13%; padding: 0.35rem 0.2rem; font-size: 0.72rem; line-height: 1.15;">Grade (Level)</th>
                            <th style="width: 10.5%; padding: 0.35rem 0.2rem; font-size: 0.72rem; line-height: 1.15;">Rating</th>
                            <th style="width: 19.5%; padding: 0.35rem 0.25rem; font-size: 0.72rem; line-height: 1.15;">Grades (Rubric)</th>
                            <th style="width: 5%; padding: 0.35rem 0.15rem; font-size: 0.72rem; line-height: 1.15;">Actual</th>
                            <th style="width: 5%; padding: 0.35rem 0.15rem; font-size: 0.72rem; line-height: 1.15;">Score</th>
                            <th style="width: 5%; padding: 0.35rem 0.15rem; font-size: 0.72rem; line-height: 1.15;">Final</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${scorecard.map(item => {
            const selectedOpt = item.options[item.selectedOptionIndex || 0] || item.options[0];
            let badgeClass = 'purple';
            if (selectedOpt.status === 'Excellent') badgeClass = 'success';
            else if (selectedOpt.status === 'Very Good') badgeClass = 'purple';
            else if (selectedOpt.status === 'Fair' || selectedOpt.status === 'Good') badgeClass = 'blue';
            else if (selectedOpt.status === 'Need Improvement' || selectedOpt.status === 'Non achieved') badgeClass = 'warning';

            const displayLevel = isEvaluated ? selectedOpt.text : '-';
            const displayRating = isEvaluated ? selectedOpt.status : 'Pending';
            const ratingBadgeClass = isEvaluated ? badgeClass : 'gray';
            const displayActual = isEvaluated ? selectedOpt.score.toFixed(1) : '-';
            const displayScore = isEvaluated ? selectedOpt.score.toFixed(1) : '-';
            const displayFinal = isEvaluated ? selectedOpt.points : '-';

            return `
                            <tr>
                                <td style="font-weight: 700; color: #1e1b4b; font-size: 0.74rem; padding: 0.35rem 0.4rem; line-height: 1.2;">${item.kra}</td>
                                <td style="color: #475569; font-weight: 600; font-size: 0.72rem; padding: 0.35rem 0.35rem;">${item.kpi}</td>
                                <td style="text-align: center; font-weight: 800; color: var(--primary); padding: 0.35rem 0.15rem; font-size: 0.74rem;">${item.weight}</td>
                                <td style="text-align: center; font-weight: 600; color: #334155; font-size: 0.72rem; padding: 0.35rem 0.2rem;">${item.target}</td>
                                <td style="padding: 0.35rem 0.25rem;">
                                    <div class="kpi-level-display ${isEvaluated ? '' : 'pending'}">
                                        ${displayLevel}
                                    </div>
                                </td>
                                <td style="text-align: center; padding: 0.35rem 0.2rem;">
                                    <span class="kpi-badge-pill ${ratingBadgeClass}" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">
                                        ${displayRating}
                                    </span>
                                </td>
                                <td style="padding: 0.35rem 0.3rem;">
                                    <div class="kpi-rubric-list" style="gap: 0.05rem;">
                                        ${item.options.map((opt, oIdx) => {
                const isSelected = isEvaluated && (item.selectedOptionIndex || 0) === oIdx;
                let ptsColor = '#64748b';
                let ptsBg = '#f1f5f9';
                if (opt.points === 5) { ptsColor = '#059669'; ptsBg = 'rgba(16, 185, 129, 0.15)'; }
                else if (opt.points === 4) { ptsColor = '#4f46e5'; ptsBg = 'rgba(99, 102, 241, 0.15)'; }
                else if (opt.points === 3) { ptsColor = '#2563eb'; ptsBg = 'rgba(59, 130, 246, 0.15)'; }
                else if (opt.points === 1) { ptsColor = '#d97706'; ptsBg = 'rgba(245, 158, 11, 0.15)'; }

                return `
                                            <div class="kpi-rubric-row ${isSelected ? 'selected' : ''}" style="padding: 0.05rem 0.25rem; font-size: 0.62rem; line-height: 1.15;">
                                                <span class="rubric-text">${opt.text}</span>
                                                <span class="rubric-pts" style="color: ${ptsColor}; background: ${ptsBg}; font-size: 0.6rem; padding: 0 0.2rem; min-width: 12px;">${opt.points}</span>
                                            </div>
                                            `;
            }).join('')}
                                    </div>
                                </td>
                                <td style="text-align: center; font-weight: 700; color: #0f172a; padding: 0.35rem 0.15rem; font-size: 0.74rem;">${displayActual}</td>
                                <td style="text-align: center; font-weight: 700; color: #0f172a; padding: 0.35rem 0.15rem; font-size: 0.74rem;">${displayScore}</td>
                                <td style="text-align: center; font-weight: 800; font-size: 0.78rem; color: var(--primary); padding: 0.35rem 0.15rem;">${displayFinal}</td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" style="background: #f8fafc; text-align: right; font-weight: 800; padding: 0.35rem 0.5rem; font-size: 0.75rem; color: #475569;">Total Weight: ${summary.totalWeight}%</td>
                            <td style="text-align: center; font-weight: 800; font-size: 0.76rem; color: #1e293b; background: #f1f5f9;">Total</td>
                            <td style="text-align: center; color: #059669; font-size: 0.84rem; font-weight: 800; background: #f1f5f9;">${summary.totalScore}%</td>
                            <td style="text-align: center; color: #4f46e5; font-size: 0.84rem; font-weight: 800; background: #f1f5f9;">${summary.avgFinalScore}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    renderAllOverTableHTML(data, isEditable, trainerId, monthKey) {
        if (!data) data = this.getDefaultAllOverData();
        const m = data.metrics || {};
        const batch1 = data.batchName || 'Horizon SME Batch 22';
        const mentorBatch = data.mentorBatchName || 'Horizon SME Batch 21';

        const val = (key, fallback = '') => m[key] !== undefined ? m[key] : fallback;

        const cell = (key, fallback = '') => {
            const v = val(key, fallback);
            if (!isEditable) return `<span style="font-weight:700;">${v}</span>`;
            return `<input type="text" value="${v}" onchange="app.updateAllOverField(${trainerId}, '${monthKey}', '${key}', this.value)">`;
        };

        return `
            <div style="width: 100%; overflow-x: auto; background: #ffffff; padding: 4px; border-radius: 6px;">
                <table class="allover-excel-table">
                    <colgroup>
                        <col style="width: 32%;">
                        <col style="width: 8%;">
                        <col style="width: 18%;">
                        <col style="width: 10%;">
                        <col style="width: 10%;">
                        <col style="width: 10%;">
                        <col style="width: 12%;">
                        <col style="width: 10%;">
                    </colgroup>
                    <tbody>
                        <!-- SECTION 1: Overall Throughput -->
                        <tr>
                            <th style="text-align: left; padding-left: 0.75rem;">Overall Throughput</th>
                            <th></th>
                            <th>${isEditable ? `<input type="text" value="${batch1}" style="color:#ffffff; font-weight:700;" onchange="app.updateAllOverField(${trainerId}, '${monthKey}', 'batchName', this.value)">` : batch1}</th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th>Average</th>
                            <th></th>
                        </tr>
                        <tr>
                            <td style="font-weight: 700; text-align: center;">%</td>
                            <td></td>
                            <td style="text-align: center;">${cell('overallThroughputPct', '77%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('overallThroughputPct', '77%')}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Knowledge & Updates Trainer Awareness</td>
                            <td></td>
                            <td style="text-align: center;">${cell('knowledgePct', '95%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('knowledgePct', '95%')}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Trainees' and trainer satisfaction evaluation</td>
                            <td></td>
                            <td style="text-align: center;">${cell('satisfactionPct', '100%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('satisfactionPct', '100%')}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Following and responding to roles, polices and tasks deadline without delay</td>
                            <td></td>
                            <td style="text-align: center;">${cell('policiesCompliance', 'No')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('policiesCompliance', 'No')}</td>
                            <td></td>
                        </tr>

                        <!-- SECTION 2: Number of trainees who passed from 1st time -->
                        <tr>
                            <th style="text-align: left; padding-left: 0.75rem;">Number of trainees who passed from 1st time</th>
                            <th></th>
                            <th>${isEditable ? `<input type="text" value="${batch1}" style="color:#ffffff; font-weight:700;" onchange="app.updateAllOverField(${trainerId}, '${monthKey}', 'batchName', this.value)">` : batch1}</th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th>Total</th>
                            <th>Averager</th>
                        </tr>
                        <tr>
                            <td style="font-weight: 700; text-align: center;">HC</td>
                            <td></td>
                            <td style="text-align: center;">${cell('pass1stTimeHC', '17')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('pass1stTimeHC', '17')}</td>
                            <td rowspan="2" style="text-align: center; font-weight: 800; background: #f8fafc; color: #059669; vertical-align: middle;">
                                ${cell('pass1stTimeAvg', '100%')}
                            </td>
                        </tr>
                        <tr>
                            <td style="font-weight: 700; text-align: center;">Pass</td>
                            <td></td>
                            <td style="text-align: center;">${cell('pass1stTimePass', '17')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('pass1stTimePass', '17')}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Generating accurate reports Daily with matching the deadline at the end of each batch</td>
                            <td></td>
                            <td style="text-align: center;">${cell('accurateReports', 'yes')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('accurateReports', 'yes')}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Coaching and Development</td>
                            <td></td>
                            <td style="text-align: center;">${cell('coachingDevelopment', 'yes')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('coachingDevelopment', 'yes')}</td>
                            <td></td>
                        </tr>

                        <!-- SECTION 3: Mentors' feedback -->
                        <tr>
                            <th style="text-align: left; padding-left: 0.75rem;">Mentors' feedback (Operation, Client, Quality Control)</th>
                            <th>Target</th>
                            <th>${isEditable ? `<input type="text" value="${mentorBatch}" style="color:#ffffff; font-weight:700;" onchange="app.updateAllOverField(${trainerId}, '${monthKey}', 'mentorBatchName', this.value)">` : mentorBatch}</th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th>Average</th>
                            <th>Target</th>
                        </tr>
                        <tr>
                            <td rowspan="2" style="font-weight: 800; text-align: center; vertical-align: middle;">Auth</td>
                            <td style="text-align: center; font-weight: 700; background: #f1f5f9;">NPS</td>
                            <td style="text-align: center;">${cell('authNPS', '51%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('authNPS', '51%')}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${cell('authTargetNPS', '56%')}</td>
                        </tr>
                        <tr>
                            <td style="text-align: center; font-weight: 700; background: #f1f5f9;">RCS</td>
                            <td style="text-align: center;">${cell('authRCS', '74%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('authRCS', '74%')}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${cell('authTargetRCS', '56%')}</td>
                        </tr>
                        <tr>
                            <td rowspan="2" style="font-weight: 800; text-align: center; vertical-align: middle;">EU</td>
                            <td style="text-align: center; font-weight: 700; background: #f1f5f9;">NPS</td>
                            <td style="text-align: center;">${cell('euNPS', '74%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('euNPS', '74%')}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${cell('euTargetNPS', '66%')}</td>
                        </tr>
                        <tr>
                            <td style="text-align: center; font-weight: 700; background: #f1f5f9;">RCS</td>
                            <td style="text-align: center;">${cell('euRCS', '56%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('euRCS', '56%')}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${cell('euTargetRCS', '55%')}</td>
                        </tr>

                        <!-- SECTION 4: OJT Quality and NPS -->
                        <tr>
                            <th style="text-align: left; padding-left: 0.75rem;">OJT Quality and NPS</th>
                            <th></th>
                            <th>${isEditable ? `<input type="text" value="${batch1}" style="color:#ffffff; font-weight:700;" onchange="app.updateAllOverField(${trainerId}, '${monthKey}', 'batchName', this.value)">` : batch1}</th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th>Average</th>
                            <th>Target</th>
                        </tr>
                        <tr>
                            <td style="font-weight: 800; text-align: center;">NPS</td>
                            <td></td>
                            <td style="text-align: center;">${cell('ojtNPS', '13%')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('ojtNPS', '13%')}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${cell('ojtTargetNPS', '40%')}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 800; text-align: center;">Q</td>
                            <td></td>
                            <td style="text-align: center;">${cell('ojtQ', 'Pass')}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: center; font-weight: 700;">${val('ojtQ', 'Pass')}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${cell('ojtTargetQ', '85%')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    },

    renderEvaluationTableHTML(data, isEditable, trainerId, monthKey) {
        if (!data) data = this.getDefaultEvaluationData();
        const questions = data.questions || [];
        const agentCount = data.agentCount || 17;
        const ratings = data.ratings || {};

        const questionAverages = questions.map(q => {
            const rowRatings = ratings[q.id] || Array(agentCount).fill(4);
            const sum = rowRatings.reduce((acc, r) => acc + (parseFloat(r) || 0), 0);
            return (sum / agentCount).toFixed(2);
        });

        const overallSum = questionAverages.reduce((acc, a) => acc + parseFloat(a), 0);
        const overallAvg = questions.length > 0 ? (overallSum / questions.length).toFixed(2) : "4.00";
        const satisfactionRate = Math.round((parseFloat(overallAvg) / 4.0) * 100);

        return `
            <div style="width: 100%; overflow-x: auto; background: #ffffff; padding: 4px; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; padding: 0 0.4rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #1e293b;">
                        <span>Evaluation Matrix (${agentCount} Trainees / Agents)</span>
                    </div>
                    <div style="display: flex; gap: 0.8rem; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: #4f46e5; background: #eef2ff; padding: 0.2rem 0.5rem; border-radius: 6px;">Average Rating: ${overallAvg} / 4.0</span>
                        <span style="font-size: 0.75rem; font-weight: 700; color: #059669; background: #ecfdf5; padding: 0.2rem 0.5rem; border-radius: 6px;">Satisfaction: ${satisfactionRate}%</span>
                    </div>
                </div>
                <table class="evaluation-matrix-table">
                    <thead>
                        <tr>
                            <th class="criteria-col">Evaluation Criteria / معايير التقييم</th>
                            ${Array.from({ length: agentCount }, (_, i) => `<th class="agent-col">Agent ${i + 1}</th>`).join('')}
                            <th class="avg-col" style="background: #1e1b4b;">Average</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${questions.map((q, qIdx) => {
            const rowRatings = ratings[q.id] || Array(agentCount).fill(4);
            const rowAvg = questionAverages[qIdx];
            return `
                                <tr>
                                    <td class="criteria-cell">
                                        <div class="criteria-en">${q.en}</div>
                                        <div class="criteria-ar" dir="rtl">${q.ar}</div>
                                    </td>
                                    ${rowRatings.map((rating, aIdx) => `
                                        <td>
                                            ${isEditable
                    ? `<input type="number" min="1" max="5" value="${rating}" onchange="app.updateEvaluationRating(${trainerId}, '${monthKey}', ${q.id}, ${aIdx}, this.value)">`
                    : `<span style="font-weight: 700;">${rating}</span>`
                }
                                        </td>
                                    `).join('')}
                                    <td style="font-weight: 800; color: #4f46e5; background: #f8fafc; font-size: 0.75rem;">
                                        ${rowAvg}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f1f5f9; font-weight: 800;">
                            <td style="text-align: right; padding-right: 0.75rem; font-size: 0.75rem;">Total Rating Average:</td>
                            ${Array.from({ length: agentCount }, (_, aIdx) => {
            const colSum = questions.reduce((sum, q) => {
                const r = (ratings[q.id] || [])[aIdx];
                return sum + (parseFloat(r) || 4);
            }, 0);
            const colAvg = (colSum / questions.length).toFixed(1);
            return `<td style="color: #1e293b; font-size: 0.72rem;">${colAvg}</td>`;
        }).join('')}
                            <td style="color: #059669; font-size: 0.8rem; background: #e0e7ff;">${overallAvg}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    openTrainerKPIsModal(trainerId, monthKey = null) {
        const trainer = this.trainers.find(t => t.id === trainerId);
        if (!trainer) return;

        // Automatically detect and use current month
        monthKey = this.getCurrentMonthKey();
        this.modalSelectedKPIMonth = monthKey;
        this.modalTrainerId = trainerId;

        const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);
        const scorecard = monthData.scorecard;
        const summary = this.calculateKPISummary(scorecard, true);
        const rollingMonths = this.getRolling12Months();
        const selectedMonthObj = rollingMonths.find(m => m.key === monthKey) || rollingMonths[0];
        const activeTab = this.activeModalKPITab || 'kpis';

        const content = `
            <div id="kpi-modal-capture-area" style="background: #ffffff; padding: 0.4rem; border-radius: 8px;">
                <div class="login-header" style="margin-bottom: 0.35rem; padding-right: 2.2rem; text-align: left; display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 0.6rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.4rem;">
                    <!-- Left: Trainer Info -->
                    <div style="display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;">
                        <img src="${trainer.img || 'https://placehold.co/400x300?text=👤'}" alt="${trainer.name}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; border: 1.5px solid var(--primary);">
                        <div>
                            <h3 style="margin: 0; font-size: 0.95rem; line-height: 1.1; white-space: nowrap;">KPIs Scorecard: ${trainer.name}</h3>
                            <p id="kpi-modal-period-text" style="margin: 0; font-size: 0.68rem; color: var(--text-muted); white-space: nowrap;">Period: ${selectedMonthObj.monthName} ${selectedMonthObj.year} (${monthData.isEvaluated ? 'Evaluated' : 'Not Evaluated Yet'})</p>
                        </div>
                    </div>

                    <!-- Center: Tabs on the same line -->
                    <div class="kpi-modal-tabs-header" style="margin: 0; border-bottom: none; padding-bottom: 0; display: flex; align-items: center; gap: 0.35rem;">
                        <button class="kpi-tab-btn ${activeTab === 'kpis' ? 'active' : ''}" id="modal-tab-btn-kpis" onclick="app.switchModalKPITab('kpis')">
                            <i data-lucide="award" style="width: 14px; height: 14px;"></i> <span>KPIs</span>
                        </button>
                        <button class="kpi-tab-btn ${activeTab === 'allover' ? 'active' : ''}" id="modal-tab-btn-allover" onclick="app.switchModalKPITab('allover')">
                            <i data-lucide="layers" style="width: 14px; height: 14px;"></i> <span>Over all</span>
                        </button>
                        <button class="kpi-tab-btn ${activeTab === 'evaluation' ? 'active' : ''}" id="modal-tab-btn-evaluation" onclick="app.switchModalKPITab('evaluation')">
                            <i data-lucide="users" style="width: 14px; height: 14px;"></i> <span>Evaluation</span>
                        </button>
                    </div>

                    <!-- Right: Month, Total Score & Grade -->
                    <div style="display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span style="font-size: 0.72rem; font-weight: 700; color: #475569;">Month:</span>
                            <span style="display: inline-flex; align-items: center; gap: 0.3rem; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 0.2rem 0.55rem; border-radius: 6px; font-weight: 800; font-size: 0.75rem;">
                                <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                                ${selectedMonthObj.monthName} ${selectedMonthObj.year}
                            </span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 0.62rem; color: var(--text-muted); display: block; line-height: 1;">Total Score</span>
                            <strong id="modal-kpi-header-total" style="font-size: 1rem; color: #4f46e5; line-height: 1;">${summary.totalScore}%</strong>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 0.62rem; color: var(--text-muted); display: block; line-height: 1;">Grade</span>
                            <strong id="modal-kpi-header-grade" style="font-size: 1rem; color: #059669; line-height: 1;">${summary.avgFinalScore}</strong>
                        </div>
                    </div>
                </div>

                <!-- Tab 1: KPIs Matrix -->
                <div id="modal-kpi-pane-kpis" class="modal-kpi-pane" style="display: ${activeTab === 'kpis' ? 'block' : 'none'};">
                    <div class="kpi-matrix-table-container" style="overflow: visible; width: 100%; margin-top: 0.2rem;">
                        <table class="kpi-matrix-table">
                        <thead>
                            <tr>
                                <th style="width: 19%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Key Result areas</th>
                                <th style="width: 12%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Key performance<br>indicator</th>
                                <th style="width: 4.5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Weight</th>
                                <th style="width: 6.5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Target</th>
                                <th style="width: 13%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Grade (Level)</th>
                                <th style="width: 10.5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Rating</th>
                                <th style="width: 19.5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Grades (Rubric)</th>
                                <th style="width: 5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Actual</th>
                                <th style="width: 5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Score</th>
                                <th style="width: 5%; padding: 0.2rem 0.15rem; font-size: 0.66rem; line-height: 1.1;">Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${scorecard.map((item, idx) => {
            const selectedOpt = item.options[item.selectedOptionIndex || 0] || item.options[0];
            let badgeClass = 'purple';
            if (selectedOpt.status === 'Excellent') badgeClass = 'success';
            else if (selectedOpt.status === 'Very Good') badgeClass = 'purple';
            else if (selectedOpt.status === 'Fair' || selectedOpt.status === 'Good') badgeClass = 'blue';
            else if (selectedOpt.status === 'Need Improvement' || selectedOpt.status === 'Non achieved') badgeClass = 'warning';

            return `
                            <tr id="modal-kpi-row-${idx}">
                                <td style="font-weight: 700; color: #1e1b4b; font-size: 0.7rem; padding: 0.1rem 0.2rem; line-height: 1.15;">${item.kra}</td>
                                <td style="color: #475569; font-size: 0.7rem; padding: 0.1rem 0.2rem; line-height: 1.15;">${item.kpi}</td>
                                <td style="text-align: center; font-weight: 800; color: var(--primary); padding: 0.1rem 0.1rem; font-size: 0.7rem;">${item.weight}</td>
                                <td style="text-align: center; font-size: 0.7rem; padding: 0.1rem 0.15rem;">${item.target}</td>
                                <td style="padding: 0.1rem 0.15rem;">
                                    <select class="kpi-select-grade" onchange="app.updateKPIScorecardRow(${trainer.id}, ${idx}, this.value, 'modal', '${monthKey}')">
                                        ${item.options.map((opt, oIdx) => `
                                            <option value="${oIdx}" ${item.selectedOptionIndex === oIdx ? 'selected' : ''}>
                                                ${opt.text}
                                            </option>
                                        `).join('')}
                                    </select>
                                </td>
                                <td style="text-align: center; padding: 0.1rem 0.12rem;">
                                    <span id="modal-kpi-rating-${idx}" class="kpi-badge-pill ${badgeClass}" style="font-size: 0.6rem; padding: 0.05rem 0.25rem;">
                                        ${selectedOpt.status}
                                    </span>
                                </td>
                                <td style="padding: 0.1rem 0.2rem;">
                                    <div class="kpi-rubric-list" style="gap: 0.02rem;">
                                        ${item.options.map((opt, oIdx) => {
                const isSelected = (item.selectedOptionIndex || 0) === oIdx;
                let ptsColor = '#64748b';
                let ptsBg = '#f1f5f9';
                if (opt.points === 5) { ptsColor = '#059669'; ptsBg = 'rgba(16, 185, 129, 0.15)'; }
                else if (opt.points === 4) { ptsColor = '#4f46e5'; ptsBg = 'rgba(99, 102, 241, 0.15)'; }
                else if (opt.points === 3) { ptsColor = '#2563eb'; ptsBg = 'rgba(59, 130, 246, 0.15)'; }
                else if (opt.points === 1) { ptsColor = '#d97706'; ptsBg = 'rgba(245, 158, 11, 0.15)'; }

                return `
                                            <div class="kpi-rubric-row ${isSelected ? 'selected' : ''}" style="padding: 0.02rem 0.2rem; font-size: 0.58rem; line-height: 1.05;">
                                                <span class="rubric-text">${opt.text}</span>
                                                <span class="rubric-pts" style="color: ${ptsColor}; background: ${ptsBg}; font-size: 0.56rem; padding: 0 0.15rem; min-width: 10px;">${opt.points}</span>
                                            </div>
                                            `;
            }).join('')}
                                    </div>
                                </td>
                                <td id="modal-kpi-actual-${idx}" style="text-align: center; font-weight: 700; padding: 0.1rem 0.1rem; font-size: 0.7rem;">${selectedOpt.score.toFixed(1)}</td>
                                <td id="modal-kpi-score-${idx}" style="text-align: center; font-weight: 700; padding: 0.1rem 0.1rem; font-size: 0.7rem;">${selectedOpt.score.toFixed(1)}</td>
                                <td id="modal-kpi-final-${idx}" style="text-align: center; font-weight: 800; color: var(--primary); padding: 0.1rem 0.1rem; font-size: 0.74rem;">${selectedOpt.points}</td>
                            </tr>
                                `;
        }).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="7"></td>
                                <td style="text-align: center; font-weight: 800; padding: 0.14rem 0.25rem; font-size: 0.72rem; color: #1e293b;">Total</td>
                                <td id="modal-kpi-foot-total" style="text-align: center; color: #059669; font-weight: 800; padding: 0.14rem 0.25rem; font-size: 0.76rem;">${summary.totalScore}%</td>
                                <td id="modal-kpi-foot-grade" style="text-align: center; color: #4f46e5; font-weight: 800; padding: 0.14rem 0.25rem; font-size: 0.76rem;">${summary.avgFinalScore}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- Tab 2: All Over Sheet (Lazy loaded on click) -->
            <div id="modal-kpi-pane-allover" class="modal-kpi-pane" style="display: ${activeTab === 'allover' ? 'block' : 'none'}; margin-top: 0.2rem;">
                ${activeTab === 'allover' ? this.renderAllOverTableHTML(monthData.allOverData, true, trainer.id, monthKey) : ''}
            </div>

            <!-- Tab 3: Evaluation Sheet (Lazy loaded on click) -->
            <div id="modal-kpi-pane-evaluation" class="modal-kpi-pane" style="display: ${activeTab === 'evaluation' ? 'block' : 'none'}; margin-top: 0.2rem;">
                ${activeTab === 'evaluation' ? this.renderEvaluationTableHTML(monthData.evaluationData, true, trainer.id, monthKey) : ''}
            </div>
        </div>

            <div style="display: flex; gap: 0.4rem; margin-top: 0.45rem;">
                <button id="kpi-save-eval-btn" class="btn-primary" style="flex: 2; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.35rem 0.6rem; font-size: 0.78rem; border-radius: 6px;" onclick="app.saveTrainerKPIScorecard(${trainer.id}, '${monthKey}')">
                    <i data-lucide="save" style="width: 14px; height: 14px;"></i> Save Evaluation (${selectedMonthObj.monthName})
                </button>
                <button class="btn-sleek" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.35rem 0.6rem; font-size: 0.78rem; border-radius: 6px;" onclick="app.exportKPIsToExcel(${trainer.id}, '${monthKey}')">
                    <i data-lucide="download" style="width: 14px; height: 14px;"></i> Excel
                </button>
                <button class="btn-sleek" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.35rem 0.6rem; font-size: 0.78rem; border-radius: 6px;" onclick="app.exportKPIsToPdf(${trainer.id}, '${monthKey}')" title="Download PDF Report">
                    <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> PDF
                </button>
                <button class="btn-primary" style="flex: 1.2; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.35rem 0.6rem; font-size: 0.78rem; border-radius: 6px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #0284c7; color: white;" onclick="app.sendKPIViaOutlook(${trainer.id}, '${monthKey}')" title="Generate PDF & Open Outlook on the Web">
                    <i data-lucide="send" style="width: 14px; height: 14px;"></i> Send
                </button>
            </div>
        `;

        const modal = document.getElementById('modal-container');
        const modalContent = document.getElementById('modal-content');
        if (modal && modalContent) {
            modal.classList.add('has-kpi-modal');
            modalContent.classList.add('kpi-modal-card');
            modalContent.style.maxWidth = 'min(1380px, 98vw)';
            modalContent.style.width = '98vw';
            modalContent.style.padding = '0.45rem 0.85rem 0.55rem 0.85rem';
            modalContent.style.maxHeight = '98vh';
            modalContent.style.marginTop = '0.5rem';
            modalContent.style.marginBottom = 'auto';
            modalContent.style.overflowY = 'auto';
            modalContent.innerHTML = `
                <button class="btn-delete" style="position: absolute; top: 0.35rem; right: 0.6rem; font-size: 1.1rem; line-height: 1; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;" onclick="app.closeModal()">×</button>
                ${content}
            `;
            modal.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: modalContent });
        }
    },

    async ensureHtml2Canvas() {
        if (window.html2canvas) return window.html2canvas;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve(window.html2canvas);
            script.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
        });
    },

    async ensureJsPdf() {
        if (window.jspdf && (window.jspdf.jsPDF || typeof window.jspdf === 'function')) {
            return window.jspdf.jsPDF || window.jspdf;
        }
        if (window.jsPDF) return window.jsPDF;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                const ctor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || window.jspdf);
                if (ctor) resolve(ctor);
                else reject(new Error('jsPDF constructor not found'));
            };
            script.onerror = () => reject(new Error('Failed to load jsPDF library'));
            document.head.appendChild(script);
        });
    },

    async generateKPIReportDoc(trainerId, monthKey = null) {
        if (!monthKey) monthKey = this.modalSelectedKPIMonth || this.selectedKPIMonth || this.getCurrentMonthKey();
        const trainer = this.trainers.find(t => t.id === trainerId) || (this.currentUser && this.currentUser.id === trainerId ? this.currentUser : null);
        if (!trainer) return null;

        const monthData = this.getTrainerMonthlyKPI(trainerId, monthKey);
        const scorecard = monthData.scorecard;
        const summary = this.calculateKPISummary(scorecard, true);
        const monthLabel = this.formatMonthLabel(monthKey);

        const ed = monthData.evaluationData || this.getDefaultEvaluationData();
        const questions = ed.questions || [];
        const agentCount = ed.agentCount || 17;
        const ratings = ed.ratings || {};
        const questionAverages = questions.map(q => {
            const rowRatings = ratings[q.id] || Array(agentCount).fill(4);
            const sum = rowRatings.reduce((acc, r) => acc + (parseFloat(r) || 0), 0);
            return (sum / agentCount).toFixed(2);
        });
        const overallSum = questionAverages.reduce((acc, a) => acc + parseFloat(a), 0);
        const evalOverallAvg = questions.length > 0 ? (overallSum / questions.length).toFixed(2) : "4.00";
        const satisfactionRate = Math.round((parseFloat(evalOverallAvg) / 4.0) * 100);

        // Create temporary offscreen container to render all 3 sections in one unified document
        const reportContainer = document.createElement('div');
        reportContainer.id = 'kpi-combined-export-area';
        reportContainer.style.position = 'fixed';
        reportContainer.style.left = '-9999px';
        reportContainer.style.top = '0';
        reportContainer.style.width = '1360px';
        reportContainer.style.background = '#ffffff';
        reportContainer.style.color = '#1e293b';
        reportContainer.style.padding = '26px 30px';
        reportContainer.style.borderRadius = '12px';
        reportContainer.style.boxSizing = 'border-box';
        reportContainer.style.zIndex = '-9999';
        reportContainer.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        reportContainer.innerHTML = `
            <!-- Header Banner -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 1.1rem; margin-bottom: 1.3rem;">
                <div style="display: flex; align-items: center; gap: 0.9rem;">
                    <img src="${trainer.img || 'https://placehold.co/400x300?text=👤'}" crossorigin="anonymous" alt="${trainer.name}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover; border: 2px solid #4f46e5; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
                    <div>
                        <h2 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #1e1b4b; line-height: 1.2;">KPI Performance Scorecard: ${trainer.name}</h2>
                        <div style="display: flex; align-items: center; gap: 0.6rem; margin-top: 0.35rem;">
                            <span style="background: #eef2ff; color: #4338ca; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700; font-size: 0.78rem; border: 1px solid #c7d2fe;">
                                Evaluation Period: ${monthLabel}
                            </span>
                            <span style="background: #ecfdf5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700; font-size: 0.78rem; border: 1px solid #a7f3d0;">
                                Status: Evaluated
                            </span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.75rem;">
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 1rem; text-align: center; min-width: 105px;">
                        <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block;">Total Score</span>
                        <strong style="font-size: 1.35rem; font-weight: 900; color: #4f46e5;">${summary.totalScore}%</strong>
                    </div>
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 1rem; text-align: center; min-width: 105px;">
                        <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block;">Grade</span>
                        <strong style="font-size: 1.35rem; font-weight: 900; color: #059669;">${summary.avgFinalScore} / 5.0</strong>
                    </div>
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 1rem; text-align: center; min-width: 105px;">
                        <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block;">Satisfaction</span>
                        <strong style="font-size: 1.35rem; font-weight: 900; color: #2563eb;">${satisfactionRate}%</strong>
                    </div>
                </div>
            </div>

            <!-- SECTION 1: KPIs Scorecard Matrix -->
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
                    <span style="background: #4f46e5; color: #ffffff; width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800;">1</span>
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e1b4b;">Key Performance Indicators (KPIs) Matrix</h3>
                </div>
                ${this.renderKPIScorecardTableHTML(scorecard, summary, true)}
            </div>

            <!-- SECTION 2: Over all (Performance & Batch Breakdown) -->
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
                    <span style="background: #1f3864; color: #ffffff; width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800;">2</span>
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e1b4b;">Overall Performance & Batch Breakdown (Over all)</h3>
                </div>
                ${this.renderAllOverTableHTML(monthData.allOverData, false, trainer.id, monthKey)}
            </div>

            <!-- SECTION 3: Evaluation (Survey & Feedback) -->
            <div style="margin-bottom: 1.1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
                    <span style="background: #334155; color: #ffffff; width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800;">3</span>
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e1b4b;">Trainees Satisfaction & Evaluation Feedback (17 Trainees)</h3>
                </div>
                ${this.renderEvaluationTableHTML(monthData.evaluationData, false, trainer.id, monthKey)}
            </div>

            <!-- Footer -->
            <div style="border-top: 1.5px solid #e2e8f0; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b;">
                <div style="display: flex; flex-direction: column; gap: 2px; text-align: left;">
                    <span style="font-weight: 700; color: #1e293b; font-size: 0.78rem; letter-spacing: 0.2px;">By.Eng.AhmedMohamed</span>
                    <span style="color: #64748b; font-size: 0.72rem; font-weight: 500;">01159768514</span>
                </div>
                <span>Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
        `;

        document.body.appendChild(reportContainer);

        try {
            await this.ensureHtml2Canvas();
            const jsPdfClass = await this.ensureJsPdf();
            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(reportContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(reportContainer);

            // Generate Crisp Vector-Wrapped High-DPI PDF
            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdfWidth = 297; // A4 landscape width (mm) for maximum legibility of 17 columns
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            const orientation = pdfWidth >= pdfHeight ? 'landscape' : 'portrait';

            const pdf = new jsPdfClass({
                orientation: orientation,
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            const fileName = `KPI_Report_${trainer.name.replace(/\s+/g, '_')}_${monthKey}.pdf`;

            const trainerFirstName = trainer && trainer.name ? trainer.name.trim().split(' ')[0] : 'Habiba';
            const monthParts = (monthKey || '').split('-');
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const monthIndex = monthParts.length === 2 ? parseInt(monthParts[1], 10) - 1 : -1;
            const monthNameOnly = (monthIndex >= 0 && monthIndex < 12) ? monthNames[monthIndex] : 'July';

            return {
                canvas,
                pdf,
                fileName,
                trainer,
                monthKey,
                monthLabel,
                summary,
                satisfactionRate,
                trainerFirstName,
                monthNameOnly
            };
        } catch (err) {
            if (reportContainer && reportContainer.parentNode) {
                document.body.removeChild(reportContainer);
            }
            throw err;
        }
    },

    async sendKPIViaOutlook(trainerId, monthKey = null) {
        try {
            this.showToast('Generating 3-section unified KPI PDF Report & preparing Outlook...', 'info');

            const result = await this.generateKPIReportDoc(trainerId, monthKey);
            if (!result) return;

            const { canvas, pdf, fileName, trainer, monthLabel, summary, satisfactionRate, trainerFirstName, monthNameOnly } = result;

            // 1. Download the official PDF report file
            pdf.save(fileName);

            // 2. Attempt to write PDF blob to clipboard if the browser supports it
            if (navigator.clipboard && navigator.clipboard.write) {
                try {
                    const pdfBlob = pdf.output('blob');
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'application/pdf': pdfBlob
                        })
                    ]);
                } catch (clipErr) {
                    // Browser sandbox restricts direct application/pdf clipboard write
                    console.log('Direct application/pdf clipboard write not supported by browser sandbox');
                }
            }

            // 3. Open Outlook on the Web with prefilled subject and body
            const subject = encodeURIComponent(`KPI Performance Report - ${trainer.name} - ${monthLabel}`);
            const bodyText = `Hi ${trainerFirstName},\n\nPlease find attached ${monthNameOnly}'s KPI PDF Report, and we discussed the KPI points during our one-on-one meeting :\n\n1. For any issues that may impact our OJT targets, we will reply to the OJT plan email thread to flag the specific issue.\n2. Any delay in starting training on time or unauthorized change to batch schedules will result in appropriate action being taken.\n\n• Evaluation Period: ${monthLabel}\n• Overall Score: ${summary.totalScore}%\n• Final Grade: ${summary.avgFinalScore} / 5.0\n• Trainees Satisfaction: ${satisfactionRate}%`;
            const body = encodeURIComponent(bodyText);

            const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
            const win = window.open(outlookWebUrl, '_blank');
            if (!win) {
                window.location.href = outlookWebUrl;
            }

            this.showToast('✅ PDF Report downloaded & Outlook Web opened! Drag & drop or attach the PDF into your email.', 'success');

        } catch (err) {
            console.error('sendKPIViaOutlook error:', err);
            this.showToast('An error occurred while generating PDF. Please try again.', 'error');
        }
    },

    async exportKPIsToPdf(trainerId, monthKey = null) {
        try {
            this.showToast('Generating KPI PDF Report...', 'info');
            const result = await this.generateKPIReportDoc(trainerId, monthKey);
            if (!result) return;
            result.pdf.save(result.fileName);
            this.showToast('✅ KPI PDF Report generated & downloaded successfully!', 'success');
        } catch (err) {
            console.error('exportKPIsToPdf error:', err);
            this.showToast('An error occurred while generating PDF. Please try again.', 'error');
        }
    },

    exportKPIsToExcel(trainerId, monthKey = null) {
        const targetId = trainerId || (this.currentUser ? this.currentUser.id : null);
        const trainer = this.trainers.find(t => t.id === targetId) || (this.currentUser && this.currentUser.id === targetId ? this.currentUser : null);
        if (!trainer) return;

        if (!monthKey) monthKey = this.selectedKPIMonth || this.getCurrentMonthKey();
        const monthData = this.getTrainerMonthlyKPI(targetId, monthKey);
        const isEvaluated = monthData.isEvaluated;
        const scorecard = monthData.scorecard;
        const summary = this.calculateKPISummary(scorecard, isEvaluated);
        const monthLabel = this.formatMonthLabel(monthKey);

        if (typeof XLSX !== 'undefined') {
            const wb = XLSX.utils.book_new();

            // Sheet 1: KPIs
            const kpiRows = [
                ['Trainer KPI Performance Evaluation Matrix'],
                ['Trainer Name:', trainer.name, 'Period:', monthLabel, 'Date:', new Date().toLocaleDateString('en-US')],
                ['Evaluation Status:', isEvaluated ? 'Evaluated' : 'Pending Evaluation'],
                [],
                ['Key Result areas', 'Key performance indicator', 'Weight', 'Target', 'Grade (Level)', 'Rating', 'Grades (Rubric)', 'Actual', 'Score', 'Final']
            ];

            scorecard.forEach(item => {
                const opt = item.options[item.selectedOptionIndex || 0] || item.options[0];
                const cleanRubric = item.rubric.replace(/\n/g, ' | ');
                kpiRows.push([
                    item.kra,
                    item.kpi,
                    item.weight,
                    item.target,
                    isEvaluated ? opt.text : '-',
                    isEvaluated ? opt.status : 'Pending',
                    cleanRubric,
                    isEvaluated ? opt.score : 0,
                    isEvaluated ? opt.score : 0,
                    isEvaluated ? opt.points : 0
                ]);
            });
            kpiRows.push(['', '', '', '', '', '', 'Total', summary.totalScore + '%', summary.totalScore + '%', summary.avgFinalScore]);
            const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows);
            XLSX.utils.book_append_sheet(wb, wsKpi, "KPIs");

            // Sheet 2: All Over
            const ao = monthData.allOverData || this.getDefaultAllOverData();
            const m = ao.metrics || {};
            const batch1 = ao.batchName || 'Horizon SME Batch 22';
            const mentorBatch = ao.mentorBatchName || 'Horizon SME Batch 21';
            const allOverRows = [
                ['Overall Throughput', '', batch1, '', '', '', 'Average', ''],
                ['%', '', m.overallThroughputPct || '77%', '', '', '', m.overallThroughputPct || '77%', ''],
                ['Knowledge & Updates Trainer Awareness', '', m.knowledgePct || '95%', '', '', '', m.knowledgePct || '95%', ''],
                ['Trainees\' and trainer satisfaction evaluation', '', m.satisfactionPct || '100%', '', '', '', m.satisfactionPct || '100%', ''],
                ['Following and responding to roles, polices and tasks deadline without delay', '', m.policiesCompliance || 'No', '', '', '', m.policiesCompliance || 'No', ''],
                ['Number of trainees who passed from 1st time', '', batch1, '', '', '', 'Total', 'Averager'],
                ['HC', '', m.pass1stTimeHC || '17', '', '', '', m.pass1stTimeHC || '17', m.pass1stTimeAvg || '100%'],
                ['Pass', '', m.pass1stTimePass || '17', '', '', '', m.pass1stTimePass || '17', ''],
                ['Generating accurate reports Daily with matching the deadline at the end of each batch', '', m.accurateReports || 'yes', '', '', '', m.accurateReports || 'yes', ''],
                ['Coaching and Development', '', m.coachingDevelopment || 'yes', '', '', '', m.coachingDevelopment || 'yes', ''],
                ['Mentors\' feedback (Operation, Client, Quality Control)', 'Target', mentorBatch, '', '', '', 'Average', 'Target'],
                ['Auth', 'NPS', m.authNPS || '51%', '', '', '', m.authNPS || '51%', m.authTargetNPS || '56%'],
                ['', 'RCS', m.authRCS || '74%', '', '', '', m.authRCS || '74%', m.authTargetRCS || '56%'],
                ['EU', 'NPS', m.euNPS || '74%', '', '', '', m.euNPS || '74%', m.euTargetNPS || '66%'],
                ['', 'RCS', m.euRCS || '56%', '', '', '', m.euRCS || '56%', m.euTargetRCS || '55%'],
                ['OJT Quality and NPS', '', batch1, '', '', '', 'Average', 'Target'],
                ['NPS', '', m.ojtNPS || '13%', '', '', '', m.ojtNPS || '13%', m.ojtTargetNPS || '40%'],
                ['Q', '', m.ojtQ || 'Pass', '', '', '', m.ojtQ || 'Pass', m.ojtTargetQ || '85%']
            ];
            const wsAllOver = XLSX.utils.aoa_to_sheet(allOverRows);
            XLSX.utils.book_append_sheet(wb, wsAllOver, "Over all");

            // Sheet 3: Evaluation
            const ed = monthData.evaluationData || this.getDefaultEvaluationData();
            const questions = ed.questions || [];
            const agentCount = ed.agentCount || 17;
            const ratings = ed.ratings || {};

            const evalHeader = ['Criteria (EN)', 'معايير التقييم (AR)'];
            for (let i = 1; i <= agentCount; i++) evalHeader.push(`Agent ${i}`);
            evalHeader.push('Average');

            const evalRows = [
                ['Trainees Satisfaction & Evaluation Feedback Matrix'],
                ['Trainer:', trainer.name, 'Month:', monthLabel],
                [],
                evalHeader
            ];

            const questionAverages = questions.map(q => {
                const rowRatings = ratings[q.id] || Array(agentCount).fill(4);
                const sum = rowRatings.reduce((acc, r) => acc + (parseFloat(r) || 0), 0);
                return (sum / agentCount).toFixed(2);
            });

            questions.forEach((q, qIdx) => {
                const rowRatings = ratings[q.id] || Array(agentCount).fill(4);
                const row = [q.en, q.ar];
                rowRatings.forEach(r => row.push(parseFloat(r) || 4));
                row.push(questionAverages[qIdx]);
                evalRows.push(row);
            });

            const overallSum = questionAverages.reduce((acc, a) => acc + parseFloat(a), 0);
            const overallAvg = questions.length > 0 ? (overallSum / questions.length).toFixed(2) : "4.00";
            const totalRow = ['Total Rating Average', ''];
            for (let aIdx = 0; aIdx < agentCount; aIdx++) {
                const colSum = questions.reduce((sum, q) => {
                    const r = (ratings[q.id] || [])[aIdx];
                    return sum + (parseFloat(r) || 4);
                }, 0);
                totalRow.push((colSum / questions.length).toFixed(1));
            }
            totalRow.push(overallAvg);
            evalRows.push(totalRow);

            const wsEval = XLSX.utils.aoa_to_sheet(evalRows);
            XLSX.utils.book_append_sheet(wb, wsEval, "Evaluation");

            XLSX.writeFile(wb, `KPI_Performance_${trainer.name.replace(/\s+/g, '_')}_${monthKey}.xlsx`);
            this.showToast('KPI Performance workbook (KPIs, Over all, Evaluation) exported successfully!', 'success');
            return;
        }

        // Fallback to CSV
        const rows = [
            ['Trainer KPI Performance Evaluation Matrix'],
            ['Trainer Name:', trainer.name, 'Period:', monthLabel, 'Date:', new Date().toLocaleDateString('en-US')],
            ['Evaluation Status:', isEvaluated ? 'Evaluated' : 'Pending Evaluation'],
            [],
            ['Key Result areas', 'Key performance indicator', 'Weight of KPI\'s', 'Target', 'Grade', 'Rating', 'Grades (Rubric)', 'Actual', 'Score', 'Final Score']
        ];

        scorecard.forEach(item => {
            const opt = item.options[item.selectedOptionIndex || 0] || item.options[0];
            const cleanRubric = item.rubric.replace(/\n/g, ' | ');
            rows.push([
                `"${item.kra.replace(/"/g, '""')}"`,
                `"${item.kpi.replace(/"/g, '""')}"`,
                item.weight,
                `"${item.target}"`,
                `"${isEvaluated ? opt.text : '-'}"`,
                `"${isEvaluated ? opt.status : 'Pending'}"`,
                `"${cleanRubric}"`,
                isEvaluated ? opt.score.toFixed(1) : '0.0',
                isEvaluated ? opt.score.toFixed(1) : '0.0',
                isEvaluated ? opt.points : '-'
            ]);
        });

        rows.push(['', '', '', '', '', '', '', 'Total', `${summary.totalScore}%`, summary.avgFinalScore]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `KPI_Scorecard_${trainer.name.replace(/\s+/g, '_')}_${monthKey}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('KPI Scorecard spreadsheet exported successfully!', 'success');
    },

    saveData() {
        localStorage.setItem('trainers', JSON.stringify(this.trainers));
        localStorage.setItem('accounts', JSON.stringify(this.accounts));
        localStorage.setItem('videos', JSON.stringify(this.videos));
        localStorage.setItem('exams', JSON.stringify(this.exams));
        localStorage.setItem('materials', JSON.stringify(this.materials));
        localStorage.setItem('adminCreds', JSON.stringify(this.adminCreds));
        localStorage.setItem('leaders', JSON.stringify(this.leaders));
        localStorage.setItem('managers', JSON.stringify(this.managers));

        if (window.TrainingFirebase) {
            window.TrainingFirebase.saveAll(this);
        }
    },

    refreshCurrentView() {
        if (!this.currentUser) return;
        try {
            if (this.currentUser.role === 'admin') {
                if (typeof this.renderTrainers === 'function') this.renderTrainers();
                if (typeof this.renderAccounts === 'function') this.renderAccounts();
                if (typeof this.renderLeaders === 'function') this.renderLeaders();
                if (typeof this.renderManagers === 'function') this.renderManagers();
                if (typeof this.renderVideos === 'function') this.renderVideos();
                if (typeof this.renderExams === 'function') this.renderExams();
                if (typeof this.renderMaterials === 'function') this.renderMaterials();
            } else if (this.currentUser.role === 'trainer') {
                if (typeof this.renderKPIs === 'function') this.renderKPIs();
                if (typeof this.renderUpData === 'function') this.renderUpData();
                if (typeof this.renderSchedule === 'function') this.renderSchedule();
                if (typeof this.renderVideos === 'function') this.renderVideos();
                if (typeof this.renderExams === 'function') this.renderExams();
                if (typeof this.renderMaterials === 'function') this.renderMaterials();
            } else if (this.currentUser.role === 'leader') {
                if (typeof this.renderLeaderDashboard === 'function') this.renderLeaderDashboard();
            } else if (this.currentUser.role === 'manager') {
                if (typeof this.renderManagerDashboard === 'function') this.renderManagerDashboard();
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (e) {
            console.warn("View refresh error:", e);
        }
    },

    checkExpiries() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        let modified = false;

        // Trainer Expiry Check
        this.trainers.forEach(t => {
            if (t.isActive && t.expiryDate < today) {
                t.isActive = false;
                modified = true;
            }
        });

        // Exam Expiry Check
        this.exams.forEach(e => {
            if (e.isActive && e.scheduledStart) {
                if (!this.checkIsExamActive(e) && now > new Date(e.scheduledStart)) {
                    e.isActive = false;
                    e.scheduledStart = null;
                    modified = true;
                }
            }
        });

        if (modified) {
            this.saveData();
            const trainerExamsPanel = document.getElementById('trainer-content-exams');
            if (trainerExamsPanel && trainerExamsPanel.classList.contains('active')) {
                this.renderTrainerExams();
            }
        }
    },

    checkIsExamActive(e) {
        if (!e.isActive) return false;
        if (!e.scheduledStart) return true; // Legacy/Manual activation

        const now = new Date();
        // Replacing 'T' with ' ' ensures more consistent parsing across browsers as local time
        const start = new Date(e.scheduledStart.replace('T', ' '));
        const end = new Date(start.getTime() + (e.duration * 60 * 1000));

        return now >= start && now <= end;
    },

    checkLogin() {
        // Multi-page routing support
        const path = window.location.pathname.toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);

        if (path.includes('video.html')) {
            this.showVideoAccounts();
            return;
        } else if (path.includes('materials.html')) {
            this.showMaterialAccounts();
            return;
        } else if (path.includes('quzi.html') || path.includes('quiz.html')) {
            this.showExamAccounts();
            return;
        }

        // Restore logged in user session on refresh
        const savedUser = JSON.parse(localStorage.getItem('currentUser'));
        if (savedUser && urlParams.get('action') !== 'login') {
            if (savedUser.role === 'admin') {
                this.currentUser = savedUser;
                const profileNav = document.getElementById('manager-nav-profile');
                if (profileNav) profileNav.classList.add('hidden');
                this.navigateTo('admin-dashboard');
                this.renderAccounts();
                return;
            } else if (savedUser.role === 'leader') {
                const freshLeader = this.leaders.find(l => l.id === savedUser.id || (l.user === savedUser.user && l.pass === savedUser.pass)) || savedUser;
                this.currentUser = { ...freshLeader, role: 'leader' };
                this.navigateTo('leader-dashboard');
                this.renderLeaderDashboard();
                return;
            } else if (savedUser.role === 'manager') {
                const freshManager = this.managers.find(m => m.id === savedUser.id || (m.user === savedUser.user && m.pass === savedUser.pass)) || savedUser;
                this.currentUser = { ...freshManager, role: 'manager' };
                const savedCat = localStorage.getItem('managerCategory');
                if (savedCat) {
                    this.selectedCategory = savedCat;
                    this.navigateTo('manager-dashboard');
                    this.renderManagerDashboard();
                } else {
                    this.selectedCategory = null;
                    this.navigateTo('category-selection');
                }
                return;
            } else if (savedUser.role === 'trainer') {
                const freshTrainer = this.trainers.find(t => t.id === savedUser.id) || savedUser;
                this.currentUser = {
                    ...freshTrainer,
                    role: 'trainer',
                    activeAccountId: savedUser.activeAccountId || freshTrainer.activeAccountId || freshTrainer.accountId,
                    isProxy: savedUser.isProxy,
                    proxyRole: savedUser.proxyRole,
                    proxyName: savedUser.proxyName
                };
                this.navigateTo('trainer-dashboard');
                this.renderTrainerProfile();

                if (savedUser.isProxy) {
                    const previousRole = savedUser.proxyRole;
                    const previousName = savedUser.proxyName;
                    document.body.classList.remove('proxy-leader');
                    const logoutSidebar = document.querySelector('.btn-logout-sidebar');
                    if (logoutSidebar) {
                        logoutSidebar.innerHTML = `<i data-lucide="arrow-left"></i> Back to ${previousRole === 'admin' ? 'Admin' : 'Leader'}`;
                        logoutSidebar.onclick = () => {
                            document.body.classList.remove('proxy-leader');
                            if (previousRole === 'admin') {
                                this.currentUser = { role: 'admin', name: previousName || 'General Manager' };
                                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                                this.navigateTo('admin-dashboard');
                                this.renderAccounts();
                            } else if (previousRole === 'leader') {
                                const leader = this.leaders.find(l => l.name === previousName) || this.leaders[0];
                                this.currentUser = { ...leader, role: 'leader' };
                                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                                this.navigateTo('leader-dashboard');
                                this.renderLeaderDashboard();
                            }
                        };
                        lucide.createIcons();
                    }
                }
                return;
            }
        }

        // Start on landing page for index.html
        if (urlParams.get('action') === 'login') {
            this.navigateTo('login');
            // Clean URL after navigation to avoid persisting the query param (avoid unique origin warning on file:/// protocol)
            if (window.location.protocol !== 'file:') {
                try {
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (e) { }
            }
        } else {
            this.navigateTo('landing');
        }
    },

    // --- Multi-Account Support ---

    showAddToOtherAccountModal(trainerId) {
        const trainer = this.trainers.find(t => t.id === trainerId);
        if (!trainer) return;

        const otherAccounts = this.accounts.filter(a => a.id !== trainer.accountId && !(trainer.secondaryAccountIds || []).includes(a.id));

        if (otherAccounts.length === 0) {
            this.showAlert('This trainer is already added to all available accounts.', 'info');
            return;
        }

        const content = `
            <div class="login-header">
                <i data-lucide="link" class="icon-primary"></i>
                <h3>Link Trainer to Another Account</h3>
                <p>Select the account you want to link trainer <strong>${trainer.name}</strong> to</p>
            </div>
            <div class="input-group">
                <label>Select Account</label>
                <select id="link-account-select" style="width: 100%; padding: 0.8rem; border-radius: 0.8rem; border: 1px solid #ddd;">
                    ${otherAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
            </div>
            <button class="btn-primary" style="margin-top: 1rem; width: 100%;" onclick="app.saveTrainerToOtherAccount(${trainerId})">Add to Account</button>
        `;
        this.showModal(content);
        lucide.createIcons();
    },

    saveTrainerToOtherAccount(trainerId) {
        const trainer = this.trainers.find(t => t.id === trainerId);
        const accountId = document.getElementById('link-account-select').value;

        if (trainer && accountId) {
            if (!trainer.secondaryAccountIds) trainer.secondaryAccountIds = [];
            trainer.secondaryAccountIds.push(accountId);
            this.saveData();
            this.closeModal();
            this.renderTrainers(trainer.accountId);
            this.showAlert(`Trainer linked to account successfully.`, 'success');
        }
    },

    showAccountSwitcher() {
        const t = this.currentUser;
        const allAccIds = [t.accountId, ...(t.secondaryAccountIds || [])];
        const accounts = allAccIds.map(id => this.accounts.find(a => a.id === id)).filter(Boolean);

        const content = `
            <div class="login-header">
                <i data-lucide="refresh-cw" class="icon-primary"></i>
                <h3>Switch Account</h3>
                <p>Choose the account you want to work on now</p>
            </div>
            <div class="admin-list" style="margin-top: 1rem;">
                ${accounts.map(acc => `
                    <div class="admin-list-item" style="cursor: pointer; ${acc.id === t.activeAccountId ? 'border: 2px solid var(--primary); background: rgba(var(--primary-rgb), 0.05);' : ''}" 
                        onclick="app.switchAccountProfile('${acc.id}')">
                        <img src="${this.getValidImg(acc.img, 'https://placehold.co/100x100?text=' + encodeURIComponent(acc.name))}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                        <span style="flex: 1; font-weight: 600;">${acc.name}</span>
                        ${acc.id === t.activeAccountId ? '<i data-lucide="check-circle" style="color: var(--primary)"></i>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
        this.showModal(content);
        lucide.createIcons();
    },

    switchAccountProfile(accountId) {
        // Just verify this account belongs to the trainer
        const t = this.trainers.find(tr => tr.id === this.currentUser.id);
        const allAccIds = [t.accountId, ...(t.secondaryAccountIds || [])];

        if (!allAccIds.includes(accountId)) {
            this.showAlert('Sorry, you are not authorized to access this account.', 'error');
            return;
        }

        this.currentUser.activeAccountId = accountId;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        this.closeModal();
        this.renderTrainerProfile();
        this.showToast(`Switched to account: ${this.accounts.find(a => a.id === accountId).name}`);
    },

    getAccountLogo(acc) {
        if (!acc || !acc.name) return null;
        if (acc.img) return acc.img;

        const name = acc.name.toLowerCase();
        if (name.includes('b-tech')) return 'https://logos-world.net/wp-content/uploads/2023/07/B.Tech-Logo.png';
        if (name.includes('electrolux')) return 'https://logovtor.com/wp-content/uploads/2023/04/electrolux-logo-vector.png';
        if (name.includes('watch-it')) return 'https://yt3.googleusercontent.com/ytc/AIdro_m6hL9zS6H_7Xz0b6l7qD_-Zp_F0oZ7uO8N-Z-Z=s900-c-k-c0x00ffffff-no-rj';
        if (name.includes('minlo')) return 'https://yt3.googleusercontent.com/ytc/AIdro_l6-b_X_m_Z_Z_Z_Z_Z_Z_Z=s900-c-k-c0x00ffffff-no-rj';

        return null;
    },

    renderManagerDashboard(filter = {}) {
        // Handle Category Selection
        if (!this.selectedCategory) {
            this.navigateTo('category-selection');
            return;
        }

        // Update centered profile in the manager header
        const profileCenter = document.getElementById('manager-profile-center');
        if (profileCenter) {
            profileCenter.innerHTML = `
                <div class="manager-profile-badge" style="cursor: pointer;" onclick="app.navigateTo('category-selection')">
                    <img src="${this.getValidImg(this.currentUser.img, 'https://placehold.co/40x40?text=M')}" onerror="this.src='https://placehold.co/40x40?text=M'" alt="Manager Photo">
                    <div>
                        <div class="manager-name">${this.currentUser.name}</div>
                        <div class="manager-role-tag">Manager Dashboard (${this.selectedCategory}) <i data-lucide="repeat" style="width:10px;height:10px;margin-left:5px;"></i></div>
                    </div>
                </div>
            `;
        }

        const navProfile = document.getElementById('manager-nav-profile');
        if (navProfile) navProfile.classList.add('hidden');

        // Filter accounts by category
        const filteredAccounts = this.accounts.filter(a => a.category === this.selectedCategory);

        // 1. Render Account Filters (Sidebar)
        const accFilters = document.getElementById('manager-acc-filters');
        if (accFilters) {
            accFilters.innerHTML = `
                <button class="filter-btn ${!filter.accountId && !filter.trainerId ? 'active' : ''}" onclick="app.renderManagerDashboard()">
                    <div class="filter-icon"><i data-lucide="layers"></i></div>
                    <span>All ${this.selectedCategory} Accounts</span>
                </button>
                ${filteredAccounts.map(acc => {
                const logo = this.getAccountLogo(acc);
                return `
                        <button class="filter-btn ${filter.accountId === acc.id ? 'active' : ''}" onclick="app.renderManagerDashboard({accountId: '${acc.id}'})">
                            ${logo ? `<img src="${logo}" class="filter-img" style="object-fit: contain; padding: 2px; background: white;" onerror="this.outerHTML='<div class=\'filter-icon\'><i data-lucide=\'building-2\'></i></div>'">`
                        : `<div class="filter-icon"><i data-lucide="building-2"></i></div>`}
                            <span>${acc.name}</span>
                        </button>
                    `;
            }).join('')}
            `;
        }

        // 2. Render Trainer Filters (Top Bar)
        const trainerFilters = document.getElementById('manager-trainer-filters');
        const searchContainer = document.getElementById('manager-trainer-search-container');

        if (trainerFilters) {
            const trainersInCategory = this.trainers.filter(t => {
                const mainAcc = this.accounts.find(a => a.id === t.accountId);
                return mainAcc && mainAcc.category === this.selectedCategory;
            });

            const filteredTrainers = filter.accountId
                ? trainersInCategory.filter(t => t.accountId === filter.accountId || (t.secondaryAccountIds && t.secondaryAccountIds.includes(filter.accountId)))
                : trainersInCategory;

            const searchTerm = (filter.search || '').toLowerCase();
            const searchedTrainers = searchTerm
                ? filteredTrainers.filter(t => t.name.toLowerCase().includes(searchTerm))
                : filteredTrainers;

            // Update Search Container
            if (searchContainer) {
                searchContainer.innerHTML = `
                    <div class="sidebar-search-wrap" style="min-width: 250px;">
                        <input type="text" id="trainer-search-input" placeholder="Search trainer..." value="${filter.search || ''}" 
                            style="width: 100%; padding: 0.6rem 0.8rem; border-radius: 10px; border: 1px solid rgba(0,0,0,0.1); background: rgba(255,255,255,0.5); font-size: 0.82rem;"
                            oninput="app.handleTrainerSearch(this.value, '${filter.accountId || ''}')">
                    </div>
                `;
            }

            // Update Trainer Row
            trainerFilters.innerHTML = `
                <button class="filter-btn ${!filter.accountId && !filter.trainerId ? 'active' : ''}" onclick="app.renderManagerDashboard()">
                    <div class="filter-icon"><i data-lucide="layers"></i></div>
                    <span>All Accounts</span>
                </button>
                <button class="filter-btn ${filter.accountId && !filter.trainerId ? 'active' : ''}" onclick="app.renderManagerDashboard({accountId: '${filter.accountId || ''}'})">
                    <div class="filter-icon"><i data-lucide="users"></i></div>
                    <span>All in Account ${filter.accountId ? `(${this.accounts.find(a => a.id === filter.accountId)?.name})` : ''}</span>
                </button>

                ${searchedTrainers.map(t => {
                const targetAccId = filter.accountId || t.accountId;
                return `
                    <button class="filter-btn ${filter.trainerId === t.id ? 'active' : ''}" 
                        onclick="app.renderManagerDashboard({trainerId: ${t.id}, accountId: '${targetAccId}', search: '${filter.search || ''}'})">
                        <img src="${this.getValidImg(t.img, 'https://placehold.co/100x100?text=👤')}" class="filter-img" onerror="this.src='https://placehold.co/100x100?text=👤'">
                        <span>${t.name}</span>
                    </button>
                    `;
            }).join('')}

            `;
            lucide.createIcons();

            // Store searched trainers for data aggregation
            this.lastSearchedTrainers = searchedTrainers;
        }

        // 3. Aggregate Data
        let targetTrainers = this.lastSearchedTrainers || this.trainers;
        if (filter.trainerId) {
            targetTrainers = this.trainers.filter(t => t.id === filter.trainerId);
        }

        const allPitches = targetTrainers.flatMap(t => t.pitchResults || []);
        const totalBatches = allPitches.length;
        const totalPass = allPitches.reduce((sum, p) => sum + (parseInt(p.pass) || 0), 0);
        const totalFail = allPitches.reduce((sum, p) => sum + (parseInt(p.fail) || 0), 0);
        const totalTrainees = allPitches.reduce((sum, p) => sum + (parseInt(p.total) || 0), 0);
        const avgPassRate = totalTrainees > 0 ? ((totalPass / totalTrainees) * 100).toFixed(1) : 0;

        // 3. Render Stats
        const statsGrid = document.getElementById('manager-stats-container');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card glass shadow-sm">
                    <i data-lucide="layers" class="icon-primary"></i>
                    <div class="stat-val">${totalBatches}</div>
                    <div class="stat-label">Total Batches</div>
                </div>
                <div class="stat-card glass shadow-sm">
                    <i data-lucide="trending-up" class="icon-secondary"></i>
                    <div class="stat-val">${avgPassRate}%</div>
                    <div class="stat-label">Avg. Pass Rate</div>
                </div>
                <div class="stat-card glass shadow-sm">
                    <i data-lucide="users" style="color: var(--primary);"></i>
                    <div class="stat-val">${totalTrainees}</div>
                    <div class="stat-label">Total Trainees</div>
                </div>
                <div class="stat-card glass shadow-sm">
                    <i data-lucide="user-check" style="color: #10b981;"></i>
                    <div class="stat-val">${totalPass}</div>
                    <div class="stat-label">Passed</div>
                </div>
                <div class="stat-card glass shadow-sm">
                    <i data-lucide="user-x" style="color: #ef4444;"></i>
                    <div class="stat-val">${totalFail}</div>
                    <div class="stat-label">Failed</div>
                </div>
            `;
        }
        lucide.createIcons();

        // 4. Render Charts
        this.renderManagerCharts(targetTrainers);
    },

    handleTrainerSearch(val, accountId) {
        // Use a small timeout to avoid too many renders
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.renderManagerDashboard({ accountId, search: val });
            // Put cursor back to input
            const input = document.getElementById('trainer-search-input');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }, 300);
    },

    renderManagerCharts(targetTrainers) {
        // Collect all pitches from target trainers and include metadata
        const allPitches = targetTrainers.flatMap(t => {
            const accName = this.accounts.find(a => a.id === t.accountId)?.name || 'N/A';
            return (t.pitchResults || []).map(p => ({
                ...p,
                trainerName: t.name,
                accountName: accName
            }));
        });

        // Bar Chart (Last 10 Batches)
        const last10 = allPitches.slice(-10);
        const labels = last10.map(p => `B-${p.batch}`);
        const passData = last10.map(p => p.pass || 0);
        const failData = last10.map(p => p.fail || 0);

        if (this.managerCharts.bar) this.managerCharts.bar.destroy();
        const barCtx = document.getElementById('managerBarChart');
        if (barCtx) {
            this.managerCharts.bar = new Chart(barCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Passed', data: passData, backgroundColor: '#10b981', borderRadius: 6 },
                        { label: 'Failed', data: failData, backgroundColor: '#ef4444', borderRadius: 6 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            bottom: 18,
                            top: 4,
                            left: 6,
                            right: 6
                        }
                    },
                    plugins: {
                        legend: { position: 'top', align: 'end', labels: { font: { family: 'Outfit', weight: '700' } } },
                        tooltip: {
                            callbacks: {
                                afterLabel: (context) => {
                                    const item = last10[context.dataIndex];
                                    return [
                                        `Trainer: ${item.trainerName}`,
                                        `Account: ${item.accountName}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { family: 'Outfit', weight: '600' } } },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#1e293b',
                                font: { family: 'Outfit', weight: '700', size: 11 },
                                padding: 4,
                                maxRotation: 0,
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        }

        // Doughnut Chart (Total Distribution)
        const totalPass = allPitches.reduce((sum, p) => sum + (parseInt(p.pass) || 0), 0);
        const totalFail = allPitches.reduce((sum, p) => sum + (parseInt(p.fail) || 0), 0);

        if (this.managerCharts.doughnut) this.managerCharts.doughnut.destroy();
        const doughCtx = document.getElementById('managerDoughnutChart');
        if (doughCtx) {
            this.managerCharts.doughnut = new Chart(doughCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Passed', 'Failed'],
                    datasets: [{
                        data: [totalPass, totalFail],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 18
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: 10
                    },
                    cutout: '52%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'var(--text-main)',
                                font: { family: 'Outfit', weight: '700', size: 14 },
                                padding: 18
                            }
                        }
                    }
                }
            });
        }
    }
};

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
