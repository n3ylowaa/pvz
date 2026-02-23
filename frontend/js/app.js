// --- РАБОТА С ИМЕНЕМ ПОЛЬЗОВАТЕЛЯ ---
function getUserName() {
    return localStorage.getItem('userName') || 'друг';
}

function saveUserName(name) {
    localStorage.setItem('userName', name);
}

function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Доброе утро';
    if (hour >= 12 && hour < 18) return 'Добрый день';
    if (hour >= 18 && hour < 23) return 'Добрый вечер';
    return 'Доброй ночи';
}

function updateGreeting() {
    const greetingEl = document.getElementById('greetingText');
    const nameEl = document.getElementById('userNameDisplay');
    if (greetingEl) greetingEl.textContent = getTimeBasedGreeting();
    if (nameEl) nameEl.textContent = getUserName();
}

// --- УПРАВЛЕНИЕ ШАПКОЙ ---
function showMainHeader() {
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('simpleHeader').style.display = 'none';
}

function hideMainHeader() {
    document.getElementById('mainHeader').style.display = 'none';
    document.getElementById('simpleHeader').style.display = 'none';
}

// --- ОПРЕДЕЛЕНИЕ СТАТУСА СМЕНЫ ---
function getShiftStatus(shift) {
    const now = new Date();
    const shiftDate = new Date(shift.date);
    const shiftEndTime = new Date(`${shift.date}T${shift.end}:00`);
    
    if (shiftDate < new Date(now.setHours(0,0,0,0))) {
        return { class: 'status-completed', text: 'ЗАВЕРШЕНО' };
    }
    
    if (shiftDate.toDateString() === now.toDateString() && shiftEndTime < now) {
        return { class: 'status-completed', text: 'ЗАВЕРШЕНО' };
    }
    
    if (shiftDate.toDateString() === now.toDateString()) {
        return { class: 'status-pending', text: 'В ПРОЦЕССЕ' };
    }
    
    if (shiftDate > now) {
        return { class: 'status-pending', text: 'ОЖИДАНИЕ' };
    }
    
    return { class: 'status-pending', text: 'ОЖИДАНИЕ' };
}

// --- ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ ---
function showMessage(text, isError = false) {
    const old = document.getElementById('customMessage');
    if (old) old.remove();

    const msg = document.createElement('div');
    msg.id = 'customMessage';
    msg.textContent = text;
    msg.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#f44336' : '#6B8E23'};
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
        opacity: 0.95;
        transition: opacity 0.3s;
        max-width: 80%;
        text-align: center;
    `;

    document.body.appendChild(msg);

    setTimeout(() => {
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 300);
    }, 2000);
}

// --- НАВИГАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadPage(item.dataset.page);
        });
    });

    loadPage('feed');
});

async function loadPage(page) {
    const content = document.getElementById('content');

    // Показываем шапку ТОЛЬКО на главной
    if (page === 'feed') {
        showMainHeader();
    } else {
        hideMainHeader();
    }

    switch (page) {
        case 'feed':
            content.innerHTML = await getFeedPageHTML();
            initFeedPage();
            break;
        case 'pvz':
            content.innerHTML = await getPVZPageHTML();
            break;
        case 'add':
            content.innerHTML = await getAddPageHTML();
            initAddPage();
            break;
        case 'list':
            content.innerHTML = await getListPageHTML();
            break;
        case 'report':
            content.innerHTML = await getReportPageHTML();
            initReportPage();
            break;
        case 'settings':
            content.innerHTML = await getSettingsPageHTML();
            initSettingsPage();
            break;
    }
}

// --- ГЛАВНАЯ ЛЕНТА СО СМЕНАМИ ---
async function getFeedPageHTML() {
    const shifts = await getShifts();
    const sortedShifts = [...shifts].sort((a, b) => b.earnings - a.earnings);

    if (sortedShifts.length === 0) {
        return `
            <p style="text-align: center; color: #666; padding: 40px;">
                Пока нет смен<br>
                <small>Нажми "Добавить" чтобы создать первую смену</small>
            </p>
        `;
    }

    return `
        <div class="shifts-section">
            <h3 class="section-title">Рекомендуем</h3>
            ${sortedShifts.slice(0, 2).map(s => renderShiftCard(s, 'tempting')).join('')}
        </div>

        <div class="shifts-section">
            <h3 class="section-title">Все смены</h3>
            ${sortedShifts.map(s => renderShiftCard(s, getShiftStatus(s))).join('')}
        </div>
    `;
}

function renderShiftCard(shift, statusData) {
    if (typeof statusData === 'string') {
        const statusMap = {
            tempting: { class: 'status-tempting', text: 'ЗАМАНЧИВО' }
        };
        statusData = statusMap[statusData] || statusMap.tempting;
    }

    return `
        <div class="shift-card">
            <div class="shift-header">
                <span class="shift-status ${statusData.class}">${statusData.text}</span>
                <span class="shift-amount">${shift.earnings} ₽</span>
            </div>
            <div class="shift-title">${shift.workplace}</div>
            <div class="shift-details">
                <div class="shift-detail">
                    <span class="shift-detail-icon">📅</span>
                    <span>${formatDate(shift.date)}</span>
                </div>
                <div class="shift-detail">
                    <span class="shift-detail-icon">⏰</span>
                    <span>${shift.start} — ${shift.end}</span>
                </div>
                <div class="shift-detail">
                    <span class="shift-detail-icon">📍</span>
                    <span>${shift.workplace}</span>
                </div>
            </div>
        </div>
    `;
}

function initFeedPage() {
    updateGreeting();
    setInterval(() => {
        loadPage('feed');
    }, 60000);
}

// --- СТРАНИЦА ДОБАВЛЕНИЯ ---
async function getAddPageHTML() {
    const workplaces = await getWorkplaces();
    const templates = await getTemplates();

    return `
        <h3 class="section-title">Добавить смену</h3>
        <form id="shiftForm">
            <div class="form-group">
                <label>Точка</label>
                <select id="workplace" required>
                    <option value="">Выбери точку</option>
                    ${workplaces.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    <option value="new">➕ Добавить новую точку</option>
                </select>
            </div>

            <div id="newWorkplaceField" style="display: none;">
                <div class="form-group">
                    <label>Новая точка</label>
                    <input type="text" id="newWorkplaceName" placeholder="Название">
                </div>
            </div>

            <div class="form-group">
                <label>Дата</label>
                <input type="date" id="shiftDate" required value="${new Date().toISOString().split('T')[0]}">
            </div>

            <div class="form-group">
                <label>Шаблон</label>
                <select id="shiftTemplate">
                    <option value="">Своё время</option>
                    ${templates.map(t => `
                        <option value="${t.id}"
                            data-start="${t.start_time}"
                            data-end="${t.end_time}">
                            ${t.name}
                        </option>
                    `).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>Начало</label>
                <input type="time" id="startTime" required>
            </div>

            <div class="form-group">
                <label>Конец</label>
                <input type="time" id="endTime" required>
            </div>

            <div class="form-group">
                <label>Тип оплаты</label>
                <select id="rateType">
                    <option value="hourly">Почасовая</option>
                    <option value="fixed">За смену</option>
                </select>
            </div>

            <div class="form-group">
                <label>Ставка</label>
                <input type="number" id="rateValue" step="0.01" required placeholder="Сумма">
            </div>

            <div id="calculatedEarnings" style="font-size: 24px; text-align: center; margin: 16px 0; color: #6B8E23;">
                0 ₽
            </div>

            <button type="submit" class="btn">Сохранить</button>
        </form>
    `;
}

function initAddPage() {
    const form = document.getElementById('shiftForm');
    const workplaceSelect = document.getElementById('workplace');
    const newField = document.getElementById('newWorkplaceField');
    const templateSelect = document.getElementById('shiftTemplate');
    const start = document.getElementById('startTime');
    const end = document.getElementById('endTime');
    const rateType = document.getElementById('rateType');
    const rateValue = document.getElementById('rateValue');
    const earningsDiv = document.getElementById('calculatedEarnings');

    workplaceSelect.addEventListener('change', () => {
        newField.style.display = workplaceSelect.value === 'new' ? 'block' : 'none';
    });

    templateSelect.addEventListener('change', () => {
        const opt = templateSelect.selectedOptions[0];
        if (opt.value) {
            start.value = opt.dataset.start;
            end.value = opt.dataset.end;
        }
        calculateEarnings();
    });

    function calculateEarnings() {
        if (start.value && end.value && rateValue.value) {
            const startDate = new Date(`2000-01-01T${start.value}`);
            const endDate = new Date(`2000-01-01T${end.value}`);
            const hours = (endDate - startDate) / 3600000;
            
            const earnings = rateType.value === 'hourly' 
                ? hours * parseFloat(rateValue.value) 
                : parseFloat(rateValue.value);
            
            earningsDiv.innerHTML = `${earnings.toFixed(2)} ₽`;
        }
    }

    start.addEventListener('input', calculateEarnings);
    end.addEventListener('input', calculateEarnings);
    rateType.addEventListener('change', calculateEarnings);
    rateValue.addEventListener('input', calculateEarnings);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let workplaceId = workplaceSelect.value;
        if (workplaceId === 'new') {
            const name = document.getElementById('newWorkplaceName').value;
            if (!name) {
                showMessage('Введи название точки', true);
                return;
            }
            const res = await addWorkplace(name);
            workplaceId = res.id;
        }

        if (!rateValue.value) {
            showMessage('Введи ставку', true);
            return;
        }

        await addShift({
            workplace_id: parseInt(workplaceId),
            shift_date: document.getElementById('shiftDate').value,
            start_time: start.value,
            end_time: end.value,
            rate_type: rateType.value,
            rate_value: parseFloat(rateValue.value)
        });

        showMessage('Смена добавлена');
        form.reset();
        document.getElementById('shiftDate').value = new Date().toISOString().split('T')[0];
        earningsDiv.innerHTML = '0 ₽';
    });
}

// --- СПИСОК ВСЕХ СМЕН ---
async function getListPageHTML() {
    const shifts = await getShifts();
    if (!shifts.length) return '<p style="text-align:center;color:#666;padding:40px;">Пока нет смен</p>';

    return shifts.map(s => renderShiftCard(s, getShiftStatus(s))).join('');
}

// --- ОТЧЕТ ---
async function getReportPageHTML() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    return `
        <h3 class="section-title">Отчет</h3>
        <div class="date-picker">
            <input type="date" id="startDate" value="${weekAgo.toISOString().split('T')[0]}">
            <input type="date" id="endDate" value="${today.toISOString().split('T')[0]}">
            <button class="btn" id="generateReport" style="margin-top: 10px;">Показать</button>
        </div>
        <div id="reportResult"></div>
    `;
}

async function initReportPage() {
    const start = document.getElementById('startDate');
    const end = document.getElementById('endDate');
    const btn = document.getElementById('generateReport');
    const out = document.getElementById('reportResult');

    async function load() {
        const r = await getReport(start.value, end.value);
        const detailedShifts = await getShifts(start.value, end.value);
        
        out.innerHTML = `
            <div class="report-summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-value">${r.total_shifts}</div>
                        <div class="summary-label">смен</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${r.total_hours}</div>
                        <div class="summary-label">часов</div>
                    </div>
                </div>
                <div class="summary-total">
                    <div class="summary-value">${r.total_earnings} ₽</div>
                    <div class="summary-label">всего заработано</div>
                </div>
            </div>

            <h4 style="margin: 20px 0 12px;">Детали по сменам</h4>
            <div class="report-detail-list">
                <div class="report-detail-header">
                    <span>Дата</span>
                    <span>Точка</span>
                    <span>Часы</span>
                    <span>Сумма</span>
                </div>
                ${detailedShifts.map(s => `
                    <div class="report-detail-row">
                        <span>${s.date}</span>
                        <span>${s.workplace}</span>
                        <span>${s.hours}</span>
                        <span>${s.earnings} ₽</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    btn.addEventListener('click', load);
    await load();
}

// --- НАСТРОЙКИ (ТОЧКИ + ИМЯ) ---
async function getSettingsPageHTML() {
    const places = await getWorkplaces();
    const currentName = getUserName();

    return `
        <h3 class="section-title">Профиль</h3>
        <div class="form-group">
            <label>Твоё имя</label>
            <input type="text" id="userNameInput" value="${currentName}" placeholder="Как тебя зовут?">
        </div>
        <button class="btn" id="saveUserNameBtn" style="margin-bottom: 24px;">Сохранить имя</button>

        <h3 class="section-title">Мои точки</h3>
        <ul class="place-list">
            ${places.map(p => `
                <li class="place-item">
                    <span class="place-icon">📍</span>
                    <span class="place-name">${p.name}</span>
                </li>
            `).join('') || '<p style="color:#666;">Пока нет точек</p>'}
        </ul>
        
        <div class="form-group">
            <label>Новая точка</label>
            <input type="text" id="newWorkplaceSetting" placeholder="Название">
        </div>
        <button class="btn" id="addWorkplaceBtn">Добавить точку</button>
    `;
}

function initSettingsPage() {
    const nameInput = document.getElementById('userNameInput');
    const saveNameBtn = document.getElementById('saveUserNameBtn');
    
    saveNameBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            saveUserName(name);
            showMessage('Имя сохранено');
            updateGreeting();
        } else {
            showMessage('Введи имя', true);
        }
    });

    const addBtn = document.getElementById('addWorkplaceBtn');
    const input = document.getElementById('newWorkplaceSetting');

    addBtn.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) {
            showMessage('Введи название', true);
            return;
        }
        await addWorkplace(name);
        showMessage('Точка добавлена');
        input.value = '';
        loadPage('settings');
    });
}