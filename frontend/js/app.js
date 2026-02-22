document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadPage(btn.dataset.page);
        });
    });
    
    loadPage('add');
});

async function loadPage(page) {
    const content = document.getElementById('content');
    
    switch(page) {
        case 'add':
            content.innerHTML = await getAddPageHTML();
            initAddPage();
            break;
        case 'list':
            content.innerHTML = await getListPageHTML();
            initListPage();
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

async function getAddPageHTML() {
    const workplaces = await getWorkplaces();
    const templates = await getTemplates();
    
    let workplacesHTML = workplaces.map(w => 
        `<option value="${w.id}">${w.name}</option>`
    ).join('');
    
    let templatesHTML = templates.map(t => 
        `<option value="${t.id}" data-start="${t.start_time}" data-end="${t.end_time}" data-rate-type="${t.rate_type}" data-rate-value="${t.rate_value}">${t.name}</option>`
    ).join('');
    
    return `
        <form id="shiftForm">
            <div class="form-group">
                <label>Точка</label>
                <select id="workplace" required>
                    <option value="">Выбери точку</option>
                    ${workplacesHTML}
                    <option value="new">Добавить новую точку</option>
                </select>
            </div>
            
            <div id="newWorkplaceField" style="display: none;">
                <div class="form-group">
                    <label>Новая точка</label>
                    <input type="text" id="newWorkplaceName" placeholder="Например: Ленина, 15">
                </div>
            </div>
            
            <div class="form-group">
                <label>Дата</label>
                <input type="date" id="shiftDate" required value="${new Date().toISOString().split('T')[0]}">
            </div>
            
            <div class="form-group">
                <label>Шаблон смены</label>
                <select id="shiftTemplate">
                    <option value="">Свое время</option>
                    ${templatesHTML}
                </select>
            </div>
            
            <div class="form-group">
                <label>Время начала</label>
                <input type="time" id="startTime" required>
            </div>
            
            <div class="form-group">
                <label>Время конца</label>
                <input type="time" id="endTime" required>
            </div>
            
            <div class="form-group">
                <label>Тип оплаты</label>
                <select id="rateType">
                    <option value="hourly">Почасовая</option>
                    <option value="fixed">Фиксированная за смену</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Ставка</label>
                <input type="number" id="rateValue" step="0.01" required>
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
    const newWorkplaceField = document.getElementById('newWorkplaceField');
    const templateSelect = document.getElementById('shiftTemplate');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const rateType = document.getElementById('rateType');
    const rateValue = document.getElementById('rateValue');
    const earningsDiv = document.getElementById('calculatedEarnings');
    
    workplaceSelect.addEventListener('change', () => {
        newWorkplaceField.style.display = workplaceSelect.value === 'new' ? 'block' : 'none';
    });
    
    templateSelect.addEventListener('change', () => {
        const option = templateSelect.selectedOptions[0];
        if (option.value) {
            startTime.value = option.dataset.start;
            endTime.value = option.dataset.end;
            rateType.value = option.dataset.rateType;
            rateValue.value = option.dataset.rateValue;
        }
        calculateEarnings();
    });
    
    function calculateEarnings() {
        if (startTime.value && endTime.value && rateValue.value) {
            const start = new Date(`2000-01-01T${startTime.value}`);
            const end = new Date(`2000-01-01T${endTime.value}`);
            const hours = (end - start) / (1000 * 60 * 60);
            
            let earnings;
            if (rateType.value === 'hourly') {
                earnings = hours * parseFloat(rateValue.value);
            } else {
                earnings = parseFloat(rateValue.value);
            }
            
            earningsDiv.innerHTML = `${earnings.toFixed(2)} ₽`;
        }
    }
    
    startTime.addEventListener('input', calculateEarnings);
    endTime.addEventListener('input', calculateEarnings);
    rateType.addEventListener('change', calculateEarnings);
    rateValue.addEventListener('input', calculateEarnings);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let workplaceId = workplaceSelect.value;
        if (workplaceId === 'new') {
            const newName = document.getElementById('newWorkplaceName').value;
            if (!newName) {
                alert('Введи название новой точки');
                return;
            }
            const result = await addWorkplace(newName);
            workplaceId = result.id;
        }
        
        const shiftData = {
            workplace_id: parseInt(workplaceId),
            shift_date: document.getElementById('shiftDate').value,
            start_time: startTime.value,
            end_time: endTime.value,
            rate_type: rateType.value,
            rate_value: parseFloat(rateValue.value),
            notes: document.getElementById('notes').value
        };
        
        await addShift(shiftData);
        alert('Смена добавлена!');
        
        form.reset();
        document.getElementById('shiftDate').value = new Date().toISOString().split('T')[0];
        earningsDiv.innerHTML = '0 ₽';
    });
}

async function getListPageHTML() {
    const shifts = await getShifts();
    
    if (shifts.length === 0) {
        return '<p style="text-align: center; color: #666; padding: 40px;">Пока нет ни одной смены</p>';
    }
    
    let shiftsHTML = '';
    shifts.forEach(s => {
        shiftsHTML += `
            <div class="shift-card">
                <div class="date">${s.date}</div>
                <div class="place">${s.workplace}</div>
                <div class="time">${s.start} — ${s.end} (${s.hours} ч.)</div>
                <div class="earnings">${s.earnings} ₽</div>
                ${s.notes ? `<div style="font-size: 14px; color: #666; margin-top: 8px;">${s.notes}</div>` : ''}
            </div>
        `;
    });
    
    return shiftsHTML;
}

function initListPage() {}

async function getReportPageHTML() {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    return `
        <div class="date-picker">
            <input type="date" id="startDate" value="${formatDate(weekAgo)}">
            <input type="date" id="endDate" value="${formatDate(today)}">
            <button class="btn" id="generateReport" style="width: auto;">Показать</button>
        </div>
        <div id="reportResult"></div>
    `;
}

async function initReportPage() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const generateBtn = document.getElementById('generateReport');
    const resultDiv = document.getElementById('reportResult');
    
    async function loadReport() {
        const report = await getReport(startDate.value, endDate.value);
        
        let html = `
            <div class="report-card">
                <div style="font-size: 18px; margin-bottom: 16px;">${report.period}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <div class="big-number">${report.total_shifts}</div>
                        <div>смен</div>
                    </div>
                    <div>
                        <div class="big-number">${report.total_hours}</div>
                        <div>часов</div>
                    </div>
                </div>
                <div style="margin-top: 16px;">
                    <div class="big-number">${report.total_earnings} ₽</div>
                    <div>всего заработано</div>
                </div>
                <div style="margin-top: 8px; color: #666;">
                    В среднем ${report.avg_per_shift} ₽ за смену
                </div>
            </div>
        `;
        
        if (report.by_workplace.length > 0) {
            html += '<h3 style="margin: 20px 0 12px;">По точкам:</h3>';
            report.by_workplace.forEach(w => {
                html += `
                    <div class="shift-card" style="border-left-color: #4CAF50;">
                        <div style="font-weight: bold;">${w.name}</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                            <span>${w.shifts} смен, ${w.hours} ч.</span>
                            <span style="font-weight: bold; color: #2e7d32;">${w.earnings} ₽</span>
                        </div>
                    </div>
                `;
            });
        }
        
        resultDiv.innerHTML = html;
    }
    
    generateBtn.addEventListener('click', loadReport);
    await loadReport();
}

async function getSettingsPageHTML() {
    const workplaces = await getWorkplaces();
    
    let workplacesHTML = workplaces.map(w => 
        `<li style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f5f5f5; border-radius: 12px; margin-bottom: 8px;">
            <span>${w.name}</span>
            <span style="color: #999;">ID: ${w.id}</span>
        </li>`
    ).join('');
    
    return `
        <h3 style="margin-bottom: 16px;">Мои точки</h3>
        <ul style="list-style: none; margin-bottom: 20px;">
            ${workplacesHTML || '<p style="color: #666;">Пока нет точек</p>'}
        </ul>
        
        <div class="form-group">
            <label>Добавить новую точку</label>
            <input type="text" id="newWorkplaceSetting" placeholder="Название точки">
        </div>
        <button class="btn" id="addWorkplaceBtn">Добавить</button>
    `;
}

function initSettingsPage() {
    const addBtn = document.getElementById('addWorkplaceBtn');
    const input = document.getElementById('newWorkplaceSetting');
    
    addBtn.addEventListener('click', async () => {
        if (input.value.trim()) {
            await addWorkplace(input.value.trim());
            alert('Точка добавлена!');
            input.value = '';
            loadPage('settings');
        }
    });
}