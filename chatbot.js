/**
 * ISON AI Chatbot Module
 * Handles interaction with OpenRouter AI and provides context-aware support.
 */

const chatbot = {
    // API Configuration
    API_KEY: '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',
    MODEL: 'openrouter/free',
    
    // State
    history: [],
    isVisible: false,

    init() {
        this.history = [
            { 
                role: 'system', 
                content: `You are a smart assistant for the ISON Training Management System.
                - You are a highly professional smart assistant and an expert on every project (account) within the ISON Training System.
                - Help managers with trainer data, batches, and project-specific statistics.
                - You have full access to knowing which trainers are assigned to which accounts (like Watch IT, B-Tech, etc.).
                - If asked about a specific batch result for a trainer, provide the text summary (Pass, Fail, Total).
                - IMPORTANT: When providing batch results, also append this EXACT tag at the end of your message: [CHART:{"pass":PASS_COUNT, "fail":FAIL_COUNT, "total":TOTAL_COUNT, "batch":"BATCH_NAME"}]
                - Answer in the user's language. Be concise, professional, and helpful.
`
            }
        ];
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    toggle() {
        const win = document.getElementById('chatbot-window');
        if (win) {
            win.classList.toggle('hidden');
            this.isVisible = !win.classList.contains('hidden');
            if (this.isVisible) {
                const input = document.getElementById('chatbot-input');
                if (input) input.focus();
            }
        }
    },

    clear() {
        const modal = document.getElementById('chatbot-modal');
        if (modal) modal.classList.add('active');
    },

    closeModal() {
        const modal = document.getElementById('chatbot-modal');
        if (modal) modal.classList.remove('active');
    },

    confirmClear() {
        this.closeModal();
        this.init(); // Reset history
        const container = document.getElementById('chatbot-messages');
        if (container) {
            container.innerHTML = `
                <div class="message bot">
                    <div class="msg-bubble">
                        Welcome! I am your smart assistant. How can I help you today regarding the training data?
                    </div>
                </div>
            `;
        }
    },

    show() {
        const container = document.getElementById('ai-chatbot-container');
        if (container) container.classList.remove('hidden');
    },

    hide() {
        const container = document.getElementById('ai-chatbot-container');
        if (container) {
            container.classList.add('hidden');
            const win = document.getElementById('chatbot-window');
            if (win) win.classList.add('hidden');
            this.isVisible = false;
        }
    },

    getContext() {
        const appGlobal = window.app || (typeof app !== 'undefined' ? app : null);
        if (!appGlobal || !appGlobal.accounts || !appGlobal.trainers) {
            return "بيانات النظام غير متوفرة حالياً.";
        }

        const totalAccounts = appGlobal.accounts.length;
        const totalTrainers = appGlobal.trainers.length;
        
        const allPitches = appGlobal.trainers.flatMap(t => t.pitchResults || []);
        const totalBatches = allPitches.length;
        const totalTrainees = allPitches.reduce((sum, p) => sum + (parseInt(p.total) || 0), 0);
        const totalPass = allPitches.reduce((sum, p) => sum + (parseInt(p.pass) || 0), 0);
        
        // Group trainers by Account for clear project mapping
        const projectsSummary = appGlobal.accounts.map(acc => {
            const assignedTrainers = appGlobal.trainers.filter(t => 
                t.accountId === acc.id || (t.secondaryAccountIds && t.secondaryAccountIds.includes(acc.id))
            );
            const names = assignedTrainers.map(t => t.name).join(', ');
            return `- المشروع/الحساب: ${acc.name}. المدربون المخصصون لهذا المشروع هم: [${names || 'لا يوجد مدربون مخصصون حالياً'}]`;
        }).join('\n');

        const trainersDetails = appGlobal.trainers.map(t => {
            const primaryAcc = appGlobal.accounts.find(a => a.id === t.accountId)?.name || 'N/A';
            const secondaryAccs = (t.secondaryAccountIds || []).map(id => appGlobal.accounts.find(a => a.id === id)?.name).filter(Boolean).join(', ');
            const pitches = t.pitchResults || [];
            const pitchHistory = pitches.map(p => `Batch ${p.batch}: (Total:${p.total}, Pass:${p.pass}, Fail:${p.fail})`).join(' | ');
            return `- المدرب: ${t.name}. الحساب الرئيسي: ${primaryAcc}. حسابات إضافية: ${secondaryAccs || 'لا يوجد'}. السجل التدريبي: ${pitchHistory || 'لا يوجد سجل حالياً'}`;
        }).join('\n');

        return `
            سياق النظام الحالي (ISON System Data):
            - إجمالي الحسابات (المشاريع): ${totalAccounts} | إجمالي المدربين: ${totalTrainers}
            - إجمالي الباتشات: ${totalBatches} | إجمالي المتدربين: ${totalTrainees} | إجمالي الناجحين: ${totalPass}
            
            1. خريطة توزيع المدربين على المشاريع (Who is where):
            ${projectsSummary}

            2. تفاصيل السجل التدريبي لكل مدرب:
            ${trainersDetails}
        `;
    },

    async handleSend() {
        const input = document.getElementById('chatbot-input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage('user', text);
        input.value = '';

        const typing = document.getElementById('chatbot-typing');
        if (typing) typing.classList.remove('hidden');

        try {
            const response = await this.sendMessageToAI(text);
            if (typing) typing.classList.add('hidden');
            this.addMessage('bot', response);
        } catch (err) {
            if (typing) typing.classList.add('hidden');
            this.addMessage('bot', 'عذراً، حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.');
            console.error("Chatbot Error:", err);
        }
    },

    addMessage(role, text) {
        const container = document.getElementById('chatbot-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        // Detect and parse Chart Tag
        let cleanText = text;
        let chartData = null;
        const chartMatch = text.match(/\[CHART:(\{.*?\})\]/);
        
        if (chartMatch) {
            try {
                chartData = JSON.parse(chartMatch[1]);
                cleanText = text.replace(chartMatch[0], '').trim();
            } catch (e) {
                console.error("Chart data parsing error:", e);
            }
        }

        msgDiv.innerHTML = `<div class="msg-bubble">${cleanText}</div>`;
        container.appendChild(msgDiv);

        if (chartData && typeof Chart !== 'undefined') {
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'chat-chart-wrapper';
            canvasWrapper.style.marginTop = '10px';
            canvasWrapper.style.width = '100%';
            canvasWrapper.style.height = '180px';
            
            const canvas = document.createElement('canvas');
            canvasWrapper.appendChild(canvas);
            msgDiv.querySelector('.msg-bubble').appendChild(canvasWrapper);
            
            this.renderChart(canvas, chartData);
        }
        
        container.scrollTop = container.scrollHeight;
        this.history.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
    },

    renderChart(canvas, data) {
        new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    label: `Results (Total: ${data.total})`,
                    data: [data.pass, data.fail],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, title: { display: true, text: `Batch ${data.batch} Results`, font: { size: 12 } } },
                scales: { 
                    y: { beginAtZero: true, grid: { display: false }, ticks: { precision: 0 } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    async sendMessageToAI(userMessage) {
        const context = this.getContext();
        const payload = {
            model: this.MODEL,
            messages: [
                this.history[0], 
                { role: 'system', content: `Current System Data Context: ${context}` },
                ...this.history.slice(1).slice(-6)
            ]
        };

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.API_KEY}`,
                'HTTP-Referer': 'https://ison-training.com',
                'X-Title': 'ISON Training System'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    chatbot.init();
});
