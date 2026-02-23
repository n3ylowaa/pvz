// --- РАБОТА С ПВЗ ---
async function getPVZPoints() {
    return await apiRequest('/pvz');
}

async function getPVZPoint(id) {
    return await apiRequest(`/pvz/${id}`);
}

// --- РАБОТА С ОТЗЫВАМИ ---
async function getPVZReviews(pvzId) {
    return await apiRequest(`/pvz/${pvzId}/reviews`);
}

async function createReview(reviewData) {
    return await apiRequest('/reviews', 'POST', reviewData);
}

// --- СТРАНИЦА КАТАЛОГА ПВЗ ---
async function getPVZPageHTML() {
    const points = await getPVZPoints();
    
    if (points.length === 0) {
        return `
            <p style="text-align: center; color: #666; padding: 40px;">
                Пока нет добавленных ПВЗ<br>
                <small>Админ может добавить точки в панели управления</small>
            </p>
        `;
    }
    
    return `
        <h3 class="section-title">Все пункты ПВЗ</h3>
        <div class="pvz-grid">
            ${points.map(p => renderPVZCard(p)).join('')}
        </div>
    `;
}

function renderPVZCard(point) {
    const marketplaceNames = {
        'WB': 'Wildberries',
        'OZON': 'OZON',
        'YANDEX': 'Яндекс Маркет'
    };
    
    const marketplaceTags = (point.marketplaces || []).map(m => 
        `<span class="marketplace-tag">${marketplaceNames[m] || m}</span>`
    ).join('');
    
    const rating = point.average_rating ? point.average_rating.toFixed(1) : 'Нет оценок';
    const reviewsText = point.reviews_count ? `${point.reviews_count} отзывов` : '';
    
    return `
        <div class="pvz-card" onclick="loadPVZDetail(${point.id})">
            <div class="pvz-photo" style="background-image: url('${point.photo_url || 'https://via.placeholder.com/300x200'}')"></div>
            <div class="pvz-info">
                <h4 class="pvz-name">${point.name}</h4>
                <div class="pvz-address">📍 ${point.address}</div>
                <div class="pvz-rating">
                    <span class="stars">${'★'.repeat(Math.round(point.average_rating || 0))}${'☆'.repeat(5 - Math.round(point.average_rating || 0))}</span>
                    <span class="rating-value">${rating}</span>
                    ${reviewsText ? `<span class="reviews-count">• ${reviewsText}</span>` : ''}
                </div>
                <div class="pvz-marketplaces">${marketplaceTags}</div>
                <div class="pvz-hours">⏰ ${point.working_hours_start.slice(0,5)} — ${point.working_hours_end.slice(0,5)}</div>
                <div class="pvz-rate">💰 ${point.rate_hourly ? point.rate_hourly + ' ₽/час' : ''} ${point.rate_fixed ? point.rate_fixed + ' ₽/смена' : ''}</div>
            </div>
        </div>
    `;
}

async function loadPVZDetail(id) {
    const content = document.getElementById('content');
    content.innerHTML = await getPVZDetailPageHTML(id);
}

// --- ДЕТАЛЬНАЯ СТРАНИЦА ПВЗ ---
async function getPVZDetailPageHTML(pvzId) {
    const point = await getPVZPoint(pvzId);
    const reviews = await getPVZReviews(pvzId);
    
    const marketplaceNames = {
        'WB': 'Wildberries',
        'OZON': 'OZON',
        'YANDEX': 'Яндекс Маркет'
    };
    
    return `
        <div class="pvz-detail">
            <button class="back-btn" onclick="loadPage('pvz')">← Назад к списку</button>
            
            <div class="pvz-detail-photo" style="background-image: url('${point.photo_url || 'https://via.placeholder.com/300x200'}')"></div>
            
            <h2 class="pvz-detail-name">${point.name}</h2>
            <div class="pvz-detail-address">📍 ${point.address}</div>
            
            <div class="pvz-detail-section">
                <h4>О точке</h4>
                <p>${point.description || 'Нет описания'}</p>
            </div>
            
            <div class="pvz-detail-section">
                <h4>Режим работы</h4>
                <div>⏰ ${point.working_hours_start.slice(0,5)} — ${point.working_hours_end.slice(0,5)}</div>
            </div>
            
            <div class="pvz-detail-section">
                <h4>Ставка</h4>
                <div>💰 ${point.rate_hourly ? point.rate_hourly + ' ₽/час' : ''} ${point.rate_fixed ? point.rate_fixed + ' ₽/смена' : ''}</div>
            </div>
            
            <div class="pvz-detail-section">
                <h4>Маркетплейсы</h4>
                <div class="marketplace-list">
                    ${(point.marketplaces || []).map(m => 
                        `<span class="marketplace-tag">${marketplaceNames[m] || m}</span>`
                    ).join('')}
                </div>
            </div>
            
            <div class="pvz-detail-section">
                <h4>Отзывы сотрудников</h4>
                ${reviews.length === 0 ? '<p>Пока нет отзывов</p>' : ''}
                ${reviews.map(r => `
                    <div class="review-card">
                        <div class="review-header">
                            <span class="review-author">Сотрудник</span>
                            <span class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                            <span class="review-date">${new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="review-comment">${r.comment || ''}</div>
                    </div>
                `).join('')}
                
                <button class="btn" onclick="showReviewForm(${pvzId})" style="margin-top: 20px;">Оставить отзыв</button>
            </div>
        </div>
    `;
}

// --- ФОРМА ОТЗЫВА ---
function showReviewForm(pvzId) {
    const oldForm = document.querySelector('.review-form-modal');
    if (oldForm) oldForm.remove();
    
    const form = document.createElement('div');
    form.className = 'review-form-modal';
    form.innerHTML = `
        <div class="review-form-content">
            <h3>Оставить отзыв о точке</h3>
            <div class="rating-select">
                <span class="rating-star" data-rating="1">★</span>
                <span class="rating-star" data-rating="2">★</span>
                <span class="rating-star" data-rating="3">★</span>
                <span class="rating-star" data-rating="4">★</span>
                <span class="rating-star" data-rating="5">★</span>
            </div>
            <textarea id="reviewComment" placeholder="Ваш отзыв..." rows="4"></textarea>
            <div class="form-actions">
                <button class="btn" onclick="submitReview(${pvzId})">Отправить</button>
                <button class="btn cancel" onclick="this.closest('.review-form-modal').remove()">Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(form);
    
    const stars = form.querySelectorAll('.rating-star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            stars.forEach((s, i) => {
                s.style.color = i < rating ? '#FFB800' : '#ccc';
            });
            form.dataset.selectedRating = rating;
        });
    });
}

async function submitReview(pvzId) {
    const form = document.querySelector('.review-form-modal');
    const rating = form.dataset.selectedRating;
    const comment = document.getElementById('reviewComment').value;
    
    if (!rating) {
        alert('Пожалуйста, поставьте оценку');
        return;
    }
    
    await createReview({
        pvz_id: pvzId,
        rating: parseInt(rating),
        comment: comment
    });
    
    form.remove();
    alert('Отзыв отправлен на модерацию');
    loadPVZDetail(pvzId);
}