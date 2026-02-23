const API_URL = 'https://pvz-1.onrender.com/api';

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    return await response.json();
}

async function getWorkplaces() {
    return await apiRequest('/workplaces');
}

async function addWorkplace(name) {
    return await apiRequest('/workplaces', 'POST', { name });
}

async function getTemplates() {
    return await apiRequest('/templates');
}

async function addShift(shiftData) {
    return await apiRequest('/shifts', 'POST', shiftData);
}

async function getShifts(startDate = null, endDate = null) {
    let url = '/shifts';
    if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    return await apiRequest(url);
}

async function getReport(startDate, endDate) {
    return await apiRequest(`/report?start_date=${startDate}&end_date=${endDate}`);
}