// pens.js - إدارة الحظائر وأنواع العلف

const PensManager = {
    // حالة النموذج
    editMode: false,
    currentPenId: null,
    feedSettings: {},
    feedTypes: [],
    currentMealPlans: {},

    // تحميل قائمة الحظائر
    async loadPens() {
        try {
            const pens = await API.pens.getAll();
            const grid = document.getElementById('pensGrid');
            
            if (!grid) return;
            
            grid.innerHTML = '';

            if (pens.length === 0) {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>لا توجد حظائر مضافة</p>
                        <button class="btn btn-success" onclick="PensManager.openModal()">+ إضافة أول حظيرة</button>
                    </div>
                `;
                return;
            }

            for (const pen of pens) {
                // حساب احتياجات العلف للحظيرة
                let feedCalculation = null;
                if (pen.sheep_count > 0) {
                    try {
                        feedCalculation = await API.pens.getFeedCalculation(pen.id);
                    } catch (error) {
                        console.error('خطأ في حساب العلف:', error);
                    }
                }

                const occupancyRate = pen.capacity > 0 ? Math.round((pen.sheep_count / pen.capacity) * 100) : 0;
                const occupancyClass = occupancyRate > 90 ? 'status-dead' : 
                                     occupancyRate > 70 ? 'status-sold' : 'status-alive';

                const penCard = document.createElement('div');
                penCard.className = 'pen-card';
                penCard.innerHTML = `
                    <div class="pen-header">
                        <h3>${pen.name} (${pen.id})</h3>
                        <span class="${occupancyClass}">${pen.sheep_count}/${pen.capacity}</span>
                    </div>
                    <div class="pen-body">
                        <div class="pen-info-row">
                            <span>معدل الإشغال:</span>
                            <span>${occupancyRate}%</span>
                        </div>
                        <div class="pen-info-row">
                            <span>الوجبات اليومية:</span>
                            <span>${pen.meals_per_day} وجبة</span>
                        </div>
                        ${feedCalculation ? `
                            <div class="pen-feed-info">
                                <h4>احتياجات العلف:</h4>
                                <div class="pen-info-row">
                                    <span>المجموع اليومي:</span>
                                    <span>${feedCalculation.total_daily_feed_kg.toFixed(2)} كجم</span>
                                </div>
                                <div class="pen-info-row">
                                    <span>لكل وجبة:</span>
                                    <span>${feedCalculation.feed_per_meal_kg.toFixed(2)} كجم</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="pen-actions">
                        <button class="btn btn-info btn-sm" onclick="PensManager.viewPenDetails('${pen.id}')" title="التفاصيل">📊</button>
                        <button class="btn btn-primary btn-sm" onclick="PensManager.manageFeedTypes('${pen.id}')" title="أنواع العلف">🌾</button>
                        <button class="btn btn-success btn-sm" onclick="PensManager.manageSheepInPen('${pen.id}')" title="إدارة الأغنام">🐑</button>
                        <button class="btn btn-warning btn-sm" onclick="PensManager.editPen('${pen.id}')" title="تعديل">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="PensManager.deletePen('${pen.id}')" title="حذف">🗑️</button>
                    </div>
                `;
                grid.appendChild(penCard);
            }
            
        } catch (error) {
            console.error('خطأ في تحميل الحظائر:', error);
        }
    },

    // فتح نافذة إضافة/تعديل حظيرة
    async openModal() {
        const modal = document.getElementById('penModal');
        const form = document.getElementById('penForm');
        
        form.reset();
        this.editMode = false;
        this.currentPenId = null;
        
        document.getElementById('penModalTitle').textContent = 'إضافة حظيرة جديدة';
        document.getElementById('penId').readOnly = false;
        
        modal.style.display = 'block';
    },

    // إغلاق النافذة
    closeModal() {
        const modal = document.getElementById('penModal');
        modal.style.display = 'none';
    },

    // حفظ الحظيرة
    async savePen(event) {
        event.preventDefault();
        
        try {
            const penData = {
                id: document.getElementById('penId').value.trim(),
                name: document.getElementById('penName').value.trim(),
                capacity: parseInt(document.getElementById('penCapacity').value),
                meals_per_day: parseInt(document.getElementById('penMeals').value),
                notes: document.getElementById('penNotes').value || ''
            };
            
            if (!penData.id || !penData.name || !penData.capacity) {
                throw new Error('جميع الحقول المطلوبة يجب ملؤها');
            }
            
            if (this.editMode && this.currentPenId) {
                await API.pens.update(this.currentPenId, penData);
                UI.showAlert('تم تحديث الحظيرة بنجاح', 'success');
            } else {
                await API.pens.create(penData);
                UI.showAlert('تم إضافة الحظيرة بنجاح', 'success');
            }
            
            this.closeModal();
            await this.loadPens();
            
        } catch (error) {
            console.error('خطأ في حفظ الحظيرة:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // تعديل حظيرة
    async editPen(penId) {
        try {
            const pens = await API.pens.getAll();
            const pen = pens.find(p => p.id === penId);
            
            if (!pen) {
                UI.showAlert('لم يتم العثور على الحظيرة', 'error');
                return;
            }
            
            this.editMode = true;
            this.currentPenId = penId;
            
            await this.openModal();
            
            document.getElementById('penId').value = pen.id;
            document.getElementById('penId').readOnly = true;
            document.getElementById('penName').value = pen.name;
            document.getElementById('penCapacity').value = pen.capacity;
            document.getElementById('penMeals').value = pen.meals_per_day;
            document.getElementById('penNotes').value = pen.notes || '';
            
            document.getElementById('penModalTitle').textContent = 'تعديل الحظيرة';
            
        } catch (error) {
            console.error('خطأ في تحميل بيانات الحظيرة:', error);
            UI.showAlert('خطأ في تحميل بيانات الحظيرة', 'error');
        }
    },

    // حذف حظيرة
    async deletePen(penId) {
        if (confirm('هل أنت متأكد من حذف هذه الحظيرة؟')) {
            try {
                await API.pens.delete(penId);
                UI.showAlert('تم حذف الحظيرة بنجاح', 'success');
                await this.loadPens();
            } catch (error) {
                console.error('خطأ في حذف الحظيرة:', error);
                UI.showAlert(error.message, 'error');
            }
        }
    },

    // إدارة أنواع العلف للحظيرة
    async manageFeedTypes(penId) {
        console.log('فتح إدارة أنواع العلف للحظيرة:', penId);
        
        try {
            // التحقق من وجود النافذة
            const modal = document.getElementById('feedTypesModal');
            if (!modal) {
                console.error('لم يتم العثور على نافذة أنواع العلف');
                UI.showAlert('خطأ: لم يتم العثور على نافذة أنواع العلف', 'error');
                return;
            }
            
            const pen = await API.pens.getOne(penId);
            const feedTypes = await API.feedTypes.getAll();
            const mealPlans = await API.mealPlans.getByPen(penId);
            
            this.feedTypes = feedTypes;
            this.currentPenId = penId;
            this.currentMealPlans = {};
            
            // تنظيم خطط الوجبات الموجودة
            mealPlans.forEach(plan => {
                this.currentMealPlans[plan.meal_number] = plan.feed_types;
            });
            
            const title = document.getElementById('feedTypesModalTitle');
            const content = document.getElementById('feedTypesModalContent');
            
            if (!title || !content) {
                console.error('عناصر النافذة غير موجودة');
                return;
            }
            
            title.textContent = `إدارة أنواع العلف - ${pen.name}`;
            
            let html = `
                <div class="feed-types-management">
                    <div class="meal-plans-section">
                        <h3>خطط الوجبات</h3>
                        <p>حدد أنواع العلف ونسبها لكل وجبة (يجب أن يكون مجموع النسب 100%)</p>
            `;
            
            for (let i = 1; i <= pen.meals_per_day; i++) {
                html += `
                    <div class="meal-plan-card">
                        <h4>الوجبة ${i}</h4>
                        <div id="meal-${i}-feeds" class="feed-types-list">
                `;
                
                if (this.currentMealPlans[i] && this.currentMealPlans[i].length > 0) {
                    this.currentMealPlans[i].forEach((ft, index) => {
                        html += this.createFeedTypeRow(i, index, ft.id, ft.percentage);
                    });
                } else {
                    html += this.createFeedTypeRow(i, 0);
                }
                
                html += `
                        </div>
                        <button class="btn btn-sm btn-info" onclick="PensManager.addFeedTypeRow(${i})">+ إضافة نوع علف</button>
                        <div class="meal-total">
                            <span>المجموع: </span>
                            <span id="meal-${i}-total">0%</span>
                        </div>
                    </div>
                `;
            }
            
            html += `
                    </div>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="btn btn-success" onclick="PensManager.saveFeedTypes()">حفظ التغييرات</button>
                        <button class="btn btn-warning" onclick="PensManager.closeFeedTypesModal()">إلغاء</button>
                    </div>
                </div>
            `;
            
            content.innerHTML = html;
            modal.style.display = 'block';
            
            // تحديث المجاميع
            for (let i = 1; i <= pen.meals_per_day; i++) {
                this.updateMealTotal(i);
            }
            
            console.log('تم فتح نافذة أنواع العلف بنجاح');
            
        } catch (error) {
            console.error('خطأ في فتح إدارة أنواع العلف:', error);
            UI.showAlert('خطأ في تحميل البيانات: ' + error.message, 'error');
        }
    },

    // إنشاء صف نوع علف
    createFeedTypeRow(mealNumber, index, selectedTypeId = '', percentage = '') {
        let optionsHtml = '<option value="">اختر نوع العلف</option>';
        this.feedTypes.forEach(ft => {
            const selected = ft.id == selectedTypeId ? 'selected' : '';
            optionsHtml += `<option value="${ft.id}" ${selected}>${ft.name}</option>`;
        });
        
        return `
            <div class="feed-type-row" data-meal="${mealNumber}" data-index="${index}">
                <select class="feed-type-select" onchange="PensManager.updateMealTotal(${mealNumber})">
                    ${optionsHtml}
                </select>
                <input type="number" class="feed-percentage" placeholder="النسبة %" 
                       value="${percentage}" min="0" max="100" step="0.1"
                       onchange="PensManager.updateMealTotal(${mealNumber})">
                <button class="btn btn-sm btn-danger" onclick="PensManager.removeFeedTypeRow(${mealNumber}, ${index})">×</button>
            </div>
        `;
    },

    // إضافة صف نوع علف جديد
    addFeedTypeRow(mealNumber) {
        const container = document.getElementById(`meal-${mealNumber}-feeds`);
        const newIndex = container.querySelectorAll('.feed-type-row').length;
        const newRow = document.createElement('div');
        newRow.innerHTML = this.createFeedTypeRow(mealNumber, newIndex);
        container.appendChild(newRow.firstElementChild);
    },

    // حذف صف نوع علف
    removeFeedTypeRow(mealNumber, index) {
        const container = document.getElementById(`meal-${mealNumber}-feeds`);
        const rows = container.querySelectorAll('.feed-type-row');
        if (rows.length > 1) {
            rows[index].remove();
            this.updateMealTotal(mealNumber);
        } else {
            UI.showAlert('يجب الاحتفاظ بنوع علف واحد على الأقل', 'error');
        }
    },

    // تحديث مجموع النسب للوجبة
    updateMealTotal(mealNumber) {
        const container = document.getElementById(`meal-${mealNumber}-feeds`);
        const rows = container.querySelectorAll('.feed-type-row');
        let total = 0;
        
        rows.forEach(row => {
            const percentage = parseFloat(row.querySelector('.feed-percentage').value) || 0;
            total += percentage;
        });
        
        const totalElement = document.getElementById(`meal-${mealNumber}-total`);
        totalElement.textContent = total.toFixed(1) + '%';
        totalElement.style.color = Math.abs(total - 100) < 0.01 ? 'green' : 'red';
    },

    // حفظ أنواع العلف
    async saveFeedTypes() {
        try {
            const pen = await API.pens.getOne(this.currentPenId);
            
            for (let i = 1; i <= pen.meals_per_day; i++) {
                const container = document.getElementById(`meal-${i}-feeds`);
                const rows = container.querySelectorAll('.feed-type-row');
                const feedTypes = [];
                let total = 0;
                
                rows.forEach(row => {
                    const typeId = row.querySelector('.feed-type-select').value;
                    const percentage = parseFloat(row.querySelector('.feed-percentage').value) || 0;
                    
                    if (typeId && percentage > 0) {
                        feedTypes.push({
                            feed_type_id: parseInt(typeId),
                            percentage: percentage
                        });
                        total += percentage;
                    }
                });
                
                if (feedTypes.length === 0) {
                    throw new Error(`الوجبة ${i} لا تحتوي على أنواع علف`);
                }
                
                if (Math.abs(total - 100) > 0.01) {
                    throw new Error(`مجموع نسب الوجبة ${i} يجب أن يساوي 100% (الحالي: ${total.toFixed(1)}%)`);
                }
                
                await API.mealPlans.save(this.currentPenId, {
                    meal_number: i,
                    feed_types: feedTypes
                });
            }
            
            UI.showAlert('تم حفظ خطط الوجبات بنجاح', 'success');
            this.closeFeedTypesModal();
            await this.loadPens();
            
        } catch (error) {
            console.error('خطأ في حفظ أنواع العلف:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // إغلاق نافذة أنواع العلف
    closeFeedTypesModal() {
        const modal = document.getElementById('feedTypesModal');
        modal.style.display = 'none';
    },

    // عرض تفاصيل الحظيرة المحدثة
    async viewPenDetails(penId) {
        try {
            const pen = await API.pens.getOne(penId);
            const feedCalc = await API.pens.getFeedCalculation(penId);
            const detailedCalc = await API.mealPlans.getDetailedCalculation(penId);
            
            const modal = document.getElementById('penDetailsModal');
            const title = document.getElementById('penDetailsTitle');
            const content = document.getElementById('penDetailsContent');
            
            title.textContent = `تفاصيل ${pen.name} (${pen.id})`;
            
            let html = `
                <div class="pen-details-header">
                    <div class="stats-grid" style="margin-bottom: 20px;">
                        <div class="stat-card">
                            <div class="stat-number">${pen.sheep?.length || 0}/${pen.capacity}</div>
                            <div class="stat-label">الإشغال</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${pen.meals_per_day}</div>
                            <div class="stat-label">وجبات يومياً</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${feedCalc.total_daily_feed_kg.toFixed(2)}</div>
                            <div class="stat-label">علف يومي (كجم)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${feedCalc.feed_per_meal_kg.toFixed(2)}</div>
                            <div class="stat-label">علف/وجبة (كجم)</div>
                        </div>
                    </div>
                </div>
                
                <h3>توزيع العلف حسب المرحلة:</h3>
                <div class="feed-summary">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>المرحلة</th>
                                <th>العدد</th>
                                <th>علف/رأس (كجم)</th>
                                <th>المجموع (كجم)</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const [stage, data] of Object.entries(feedCalc.stage_summary)) {
                html += `
                    <tr>
                        <td>${stage}</td>
                        <td>${data.count}</td>
                        <td>${data.feed_per_head}</td>
                        <td>${data.total_feed.toFixed(2)}</td>
                    </tr>
                `;
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
                
                <h3>تفاصيل الوجبات وأنواع العلف:</h3>
                <div class="meals-details">
            `;
            
            if (detailedCalc.meals && detailedCalc.meals.length > 0) {
                detailedCalc.meals.forEach(meal => {
                    const mealTimes = ['7:00 ص', '12:00 م', '5:00 م', '9:00 م', '12:00 ص'];
                    html += `
                        <div class="meal-detail-card">
                            <h4>الوجبة ${meal.meal_number} - ${mealTimes[meal.meal_number - 1] || ''}</h4>
                            <p>الكمية الإجمالية: ${meal.total_feed_kg.toFixed(2)} كجم</p>
                    `;
                    
                    if (meal.feed_types && meal.feed_types.length > 0) {
                        html += `
                            <table class="data-table" style="margin-top: 10px;">
                                <thead>
                                    <tr>
                                        <th>نوع العلف</th>
                                        <th>النسبة</th>
                                        <th>الكمية (كجم)</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;
                        
                        meal.feed_types.forEach(ft => {
                            html += `
                                <tr>
                                    <td>${ft.name}</td>
                                    <td>${ft.percentage}%</td>
                                    <td>${ft.amount_kg}</td>
                                </tr>
                            `;
                        });
                        
                        html += `
                                </tbody>
                            </table>
                        `;
                    } else {
                        html += `<p style="color: #6c757d;">لم يتم تحديد أنواع العلف لهذه الوجبة</p>`;
                    }
                    
                    html += `</div>`;
                });
            }
            
            html += `
                </div>
                
                <h3>قائمة الأغنام في الحظيرة:</h3>
                <div class="table-container" style="max-height: 300px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>المعرف</th>
                                <th>الجنس</th>
                                <th>المرحلة</th>
                                <th>العلف اليومي (كجم)</th>
                                <th>العمليات</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            if (feedCalc.sheep_details && feedCalc.sheep_details.length > 0) {
                feedCalc.sheep_details.forEach(sheep => {
                    const sheepInfo = pen.sheep.find(s => s.id === sheep.id);
                    html += `
                        <tr>
                            <td>${sheep.id}</td>
                            <td>${sheepInfo?.gender || '-'}</td>
                            <td>${sheep.stage}</td>
                            <td>${sheep.daily_feed_kg}</td>
                            <td>
                                <button class="btn btn-info btn-sm" onclick="SheepManager.editSheep('${sheep.id}')" title="عرض">👁️</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                html += `
                    <tr>
                        <td colspan="5" style="text-align: center; color: #6c757d;">لا توجد أغنام في هذه الحظيرة</td>
                    </tr>
                `;
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
                
                <div class="form-actions" style="margin-top: 20px;">
                    <button class="btn btn-info" onclick="QuickPenTransfer.openQuickTransferModal('${penId}')">نقل أغنام</button>
                    <button class="btn btn-primary" onclick="PensManager.printDetailedFeedReport('${penId}')">طباعة تقرير مفصل</button>
                    <button class="btn btn-warning" onclick="PensManager.closePenDetailsModal()">إغلاق</button>
                </div>
            `;
            
            content.innerHTML = html;
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('خطأ في عرض تفاصيل الحظيرة:', error);
            UI.showAlert('خطأ في تحميل تفاصيل الحظيرة', 'error');
        }
    },

    // إغلاق نافذة التفاصيل
    closePenDetailsModal() {
        const modal = document.getElementById('penDetailsModal');
        modal.style.display = 'none';
    },

    // إدارة الأغنام في الحظيرة
    async manageSheepInPen(penId) {
        await UI.showTab('manage');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = penId;
            searchInput.dispatchEvent(new Event('input'));
        }
    },

    // فتح نافذة إعدادات العلف
    async openFeedSettingsModal() {
        try {
            const feedSettings = await API.feedSettings.getAll();
            const feedTypes = await API.feedTypes.getAll();
            this.feedSettings = feedSettings;
            this.feedTypes = feedTypes;
            
            const modal = document.getElementById('feedSettingsModal');
            const content = document.getElementById('feedSettingsContent');
            
            let html = `
                <div class="feed-settings-tabs">
                    <button class="tab-btn active" onclick="PensManager.switchFeedSettingsTab('amounts')">كميات العلف</button>
                    <button class="tab-btn" onclick="PensManager.switchFeedSettingsTab('types')">أنواع العلف</button>
                </div>
                
                <div id="amounts-tab" class="feed-settings-tab active">
                    <h3>كميات العلف حسب المرحلة</h3>
            `;
            
            const stages = ['مولود', 'طلي', 'رخل', 'بالغ', 'كبير السن', 'حامل'];
            
            stages.forEach(stage => {
                const setting = feedSettings.find(fs => fs.stage === stage);
                const currentValue = setting ? setting.daily_feed_kg : 1.5;
                
                html += `
                    <div class="form-group">
                        <label for="feed_${stage}">${stage}</label>
                        <input type="number" id="feed_${stage}" step="0.1" min="0" value="${currentValue}" required>
                        <div class="help-text">الكمية اليومية بالكيلوجرام</div>
                    </div>
                `;
            });
            
            html += `
                </div>
                
                <div id="types-tab" class="feed-settings-tab" style="display: none;">
                    <h3>أنواع العلف المتاحة</h3>
                    <div style="margin-bottom: 20px;">
                        <input type="text" id="newFeedTypeName" placeholder="اسم نوع العلف الجديد" style="width: 200px;">
                        <button class="btn btn-sm btn-success" onclick="PensManager.addNewFeedType()">+ إضافة</button>
                    </div>
                    <div class="feed-types-list">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>النوع</th>
                                    <th>الوحدة</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            feedTypes.forEach(ft => {
                html += `
                    <tr>
                        <td>${ft.name}</td>
                        <td>${ft.unit}</td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            content.innerHTML = html;
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('خطأ في تحميل إعدادات العلف:', error);
            UI.showAlert('خطأ في تحميل إعدادات العلف', 'error');
        }
    },

    // تبديل تبويبات إعدادات العلف
    switchFeedSettingsTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.feed-settings-tab').forEach(t => t.style.display = 'none');
        
        if (tab === 'amounts') {
            document.querySelector('.tab-btn:first-child').classList.add('active');
            document.getElementById('amounts-tab').style.display = 'block';
        } else {
            document.querySelector('.tab-btn:last-child').classList.add('active');
            document.getElementById('types-tab').style.display = 'block';
        }
    },

    // إضافة نوع علف جديد
    async addNewFeedType() {
        const nameInput = document.getElementById('newFeedTypeName');
        const name = nameInput.value.trim();
        
        if (!name) {
            UI.showAlert('الرجاء إدخال اسم نوع العلف', 'error');
            return;
        }
        
        try {
            await API.feedTypes.create({ name: name });
            UI.showAlert('تم إضافة نوع العلف بنجاح', 'success');
            nameInput.value = '';
            await this.openFeedSettingsModal();
        } catch (error) {
            console.error('خطأ في إضافة نوع العلف:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // إغلاق نافذة إعدادات العلف
    closeFeedSettingsModal() {
        const modal = document.getElementById('feedSettingsModal');
        modal.style.display = 'none';
    },

    // حفظ إعدادات العلف
    async saveFeedSettings(event) {
        event.preventDefault();
        
        try {
            const stages = ['مولود', 'طلي', 'رخل', 'بالغ', 'كبير السن', 'حامل'];
            
            for (const stage of stages) {
                const value = parseFloat(document.getElementById(`feed_${stage}`).value);
                if (value >= 0) {
                    await API.feedSettings.update(stage, { daily_feed_kg: value });
                }
            }
            
            UI.showAlert('تم حفظ إعدادات العلف بنجاح', 'success');
            this.closeFeedSettingsModal();
            await this.loadPens();
            
        } catch (error) {
            console.error('خطأ في حفظ إعدادات العلف:', error);
            UI.showAlert('خطأ في حفظ إعدادات العلف', 'error');
        }
    },

    // طباعة تقرير العلف المفصل
    async printDetailedFeedReport(penId) {
        try {
            const pen = await API.pens.getOne(penId);
            const feedCalc = await API.pens.getFeedCalculation(penId);
            const detailedCalc = await API.mealPlans.getDetailedCalculation(penId);
            
            let printContent = `
                <html dir="rtl">
                <head>
                    <title>تقرير العلف المفصل - ${pen.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1, h2, h3 { text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                        th { background-color: #f2f2f2; }
                        .header-info { margin-bottom: 20px; }
                        .header-info p { margin: 5px 0; }
                        .meal-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
                    </style>
                </head>
                <body>
                    <h1>تقرير العلف المفصل</h1>
                    <h2>${pen.name} (${pen.id})</h2>
                    <div class="header-info">
                        <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
                        <p><strong>عدد الأغنام:</strong> ${feedCalc.sheep_count}</p>
                        <p><strong>عدد الوجبات:</strong> ${pen.meals_per_day}</p>
                        <p><strong>إجمالي العلف اليومي:</strong> ${feedCalc.total_daily_feed_kg.toFixed(2)} كجم</p>
                    </div>
            `;
            
            // تفاصيل الوجبات
            const mealTimes = ['7:00 ص', '12:00 م', '5:00 م', '9:00 م', '12:00 ص'];
            
            if (detailedCalc.meals && detailedCalc.meals.length > 0) {
                detailedCalc.meals.forEach(meal => {
                    printContent += `
                        <div class="meal-section">
                            <h3>الوجبة ${meal.meal_number} - ${mealTimes[meal.meal_number - 1] || ''}</h3>
                            <p><strong>الكمية الإجمالية:</strong> ${meal.total_feed_kg.toFixed(2)} كجم</p>
                    `;
                    
                    if (meal.feed_types && meal.feed_types.length > 0) {
                        printContent += `
                            <table>
                                <thead>
                                    <tr>
                                        <th>نوع العلف</th>
                                        <th>النسبة</th>
                                        <th>الكمية (كجم)</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;
                        
                        meal.feed_types.forEach(ft => {
                            printContent += `
                                <tr>
                                    <td>${ft.name}</td>
                                    <td>${ft.percentage}%</td>
                                    <td>${ft.amount_kg}</td>
                                </tr>
                            `;
                        });
                        
                        printContent += `
                                </tbody>
                            </table>
                        `;
                    }
                    
                    printContent += `</div>`;
                });
            }
            
            // ملخص يومي لأنواع العلف
            printContent += `
                <h3>الملخص اليومي لأنواع العلف</h3>
                <table>
                    <thead>
                        <tr>
                            <th>نوع العلف</th>
                            <th>الكمية الإجمالية (كجم)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // حساب المجموع لكل نوع علف
            const feedTypeTotals = {};
            if (detailedCalc.meals) {
                detailedCalc.meals.forEach(meal => {
                    if (meal.feed_types) {
                        meal.feed_types.forEach(ft => {
                            if (!feedTypeTotals[ft.name]) {
                                feedTypeTotals[ft.name] = 0;
                            }
                            feedTypeTotals[ft.name] += ft.amount_kg;
                        });
                    }
                });
            }
            
            for (const [type, total] of Object.entries(feedTypeTotals)) {
                printContent += `
                    <tr>
                        <td>${type}</td>
                        <td>${total.toFixed(2)}</td>
                    </tr>
                `;
            }
            
            printContent += `
                        </tbody>
                    </table>
                </body>
                </html>
            `;
            
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
            
        } catch (error) {
            console.error('خطأ في طباعة التقرير:', error);
            UI.showAlert('خطأ في طباعة التقرير', 'error');
        }
    },

    // إعداد النماذج
    setupForms() {
        const penForm = document.getElementById('penForm');
        if (penForm) {
            penForm.addEventListener('submit', (e) => this.savePen(e));
        }
        
        const feedSettingsForm = document.getElementById('feedSettingsForm');
        if (feedSettingsForm) {
            feedSettingsForm.addEventListener('submit', (e) => this.saveFeedSettings(e));
        }
    },

    // تهيئة المكون
    async initialize() {
        this.setupForms();
    }
};

// نقل سريع للأغنام بين الحظائر
const QuickPenTransfer = {
    // فتح نافذة النقل السريع
    async openQuickTransferModal(currentPenId) {
        try {
            const pen = await API.pens.getOne(currentPenId);
            const allPens = await API.pens.getAll();
            
            // إنشاء النافذة إذا لم تكن موجودة
            if (!document.getElementById('quickTransferModal')) {
                this.createQuickTransferModal();
            }
            
            const content = document.getElementById('quickTransferContent');
            content.innerHTML = `
                <h4>نقل أغنام من حظيرة: ${pen.name} (${pen.id})</h4>
                
                <div class="transfer-sections">
                    <!-- قسم اختيار الأغنام -->
                    <div class="transfer-section">
                        <h5>1. اختر الأغنام للنقل:</h5>
                        <div class="sheep-selection-list">
                            <div class="select-all-row">
                                <label>
                                    <input type="checkbox" id="selectAllTransfer" 
                                           onchange="QuickPenTransfer.toggleSelectAll()">
                                    تحديد الكل (${pen.sheep.length} خروف)
                                </label>
                            </div>
                            <div class="sheep-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                                ${pen.sheep.map(sheep => `
                                    <label class="sheep-item">
                                        <input type="checkbox" class="transfer-sheep" value="${sheep.id}" 
                                               onchange="QuickPenTransfer.updateCount()">
                                        <span>${sheep.id} - ${sheep.gender} - ${sheep.stage || 'غير محدد'}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <p class="selected-count">عدد المحدد: <span id="transferCount">0</span></p>
                    </div>
                    
                    <!-- قسم اختيار الحظيرة المستهدفة -->
                    <div class="transfer-section">
                        <h5>2. اختر الحظيرة المستهدفة:</h5>
                        <select id="targetPenQuick" class="form-control" required onchange="QuickPenTransfer.checkCapacity()">
                            <option value="">اختر الحظيرة</option>
                            ${allPens.filter(p => p.id !== currentPenId).map(p => {
                                const available = p.capacity - p.sheep_count;
                                const color = available > 10 ? 'green' : available > 0 ? 'orange' : 'red';
                                return `
                                    <option value="${p.id}" data-capacity="${p.capacity}" data-current="${p.sheep_count}">
                                        ${p.name} (${p.id}) - متاح: ${available} مكان
                                    </option>
                                `;
                            }).join('')}
                        </select>
                        <div id="capacityWarning" class="alert alert-warning" style="display: none; margin-top: 10px;"></div>
                    </div>
                    
                    <!-- خيارات إضافية -->
                    <div class="transfer-section">
                        <h5>3. خيارات النقل:</h5>
                        <label>
                            <input type="checkbox" id="groupByStage" checked>
                            نقل حسب المرحلة (مواليد مع مواليد، إلخ)
                        </label>
                        <label>
                            <input type="checkbox" id="keepFamilies">
                            الحفاظ على العائلات معاً (الأم مع أولادها)
                        </label>
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: 20px;">
                    <button class="btn btn-success" onclick="QuickPenTransfer.executeTransfer('${currentPenId}')">
                        تنفيذ النقل
                    </button>
                    <button class="btn btn-info" onclick="QuickPenTransfer.previewTransfer()">
                        معاينة
                    </button>
                    <button class="btn btn-warning" onclick="QuickPenTransfer.closeModal()">
                        إلغاء
                    </button>
                </div>
            `;
            
            document.getElementById('quickTransferModal').style.display = 'block';
            
        } catch (error) {
            console.error('خطأ في فتح نافذة النقل السريع:', error);
            UI.showAlert('خطأ في تحميل البيانات', 'error');
        }
    },
    
    // إنشاء نافذة النقل السريع
    createQuickTransferModal() {
        const modalHTML = `
            <div id="quickTransferModal" class="modal">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>نقل الأغنام بين الحظائر</h2>
                        <button class="close" onclick="QuickPenTransfer.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="quickTransferContent">
                            <!-- سيتم ملؤه ديناميكياً -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // تبديل تحديد الكل
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllTransfer');
        const checkboxes = document.querySelectorAll('.transfer-sheep');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
        });
        
        this.updateCount();
    },
    
    // تحديث العدد المحدد
    updateCount() {
        const checked = document.querySelectorAll('.transfer-sheep:checked').length;
        document.getElementById('transferCount').textContent = checked;
        this.checkCapacity();
    },
    
    // التحقق من السعة
    checkCapacity() {
        const targetSelect = document.getElementById('targetPenQuick');
        const selectedOption = targetSelect.options[targetSelect.selectedIndex];
        const warning = document.getElementById('capacityWarning');
        
        if (!selectedOption || !selectedOption.value) {
            warning.style.display = 'none';
            return;
        }
        
        const capacity = parseInt(selectedOption.dataset.capacity);
        const current = parseInt(selectedOption.dataset.current);
        const available = capacity - current;
        const selectedCount = document.querySelectorAll('.transfer-sheep:checked').length;
        
        if (selectedCount > available) {
            warning.innerHTML = `⚠️ تحذير: الحظيرة المختارة لا تتسع إلا لـ ${available} خروف، وأنت محدد ${selectedCount} خروف`;
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    },
    
    // معاينة النقل
    async previewTransfer() {
        const selected = Array.from(document.querySelectorAll('.transfer-sheep:checked')).map(cb => cb.value);
        const targetPen = document.getElementById('targetPenQuick').value;
        
        if (selected.length === 0) {
            UI.showAlert('الرجاء تحديد أغنام للنقل', 'warning');
            return;
        }
        
        if (!targetPen) {
            UI.showAlert('الرجاء اختيار الحظيرة المستهدفة', 'warning');
            return;
        }
        
        const preview = `
            <h4>معاينة النقل:</h4>
            <ul>
                <li>عدد الأغنام: ${selected.length}</li>
                <li>المعرفات: ${selected.join(', ')}</li>
                <li>إلى الحظيرة: ${targetPen}</li>
            </ul>
        `;
        
        UI.showAlert(preview, 'info');
    },
    
    // تنفيذ النقل
    async executeTransfer(currentPenId) {
        const selected = Array.from(document.querySelectorAll('.transfer-sheep:checked')).map(cb => cb.value);
        const targetPen = document.getElementById('targetPenQuick').value;
        
        if (selected.length === 0) {
            UI.showAlert('الرجاء تحديد أغنام للنقل', 'warning');
            return;
        }
        
        if (!targetPen) {
            UI.showAlert('الرجاء اختيار الحظيرة المستهدفة', 'warning');
            return;
        }
        
        if (confirm(`هل أنت متأكد من نقل ${selected.length} خروف إلى الحظيرة ${targetPen}؟`)) {
            try {
                UI.showLoading();
                let successCount = 0;
                
                for (const sheepId of selected) {
                    try {
                        await API.sheep.update(sheepId, { pen: targetPen });
                        successCount++;
                    } catch (error) {
                        console.error(`خطأ في نقل ${sheepId}:`, error);
                    }
                }
                
                UI.showAlert(`تم نقل ${successCount} من ${selected.length} خروف بنجاح`, 'success');
                
                this.closeModal();
                
                // إعادة تحميل البيانات
                await PensManager.loadPens();
                if (document.getElementById('penDetailsModal').style.display === 'block') {
                    await PensManager.viewPenDetails(currentPenId);
                }
                
            } catch (error) {
                console.error('خطأ في تنفيذ النقل:', error);
                UI.showAlert('حدث خطأ أثناء النقل', 'error');
            } finally {
                UI.hideLoading();
            }
        }
    },
    
    // إغلاق النافذة
    closeModal() {
        const modal = document.getElementById('quickTransferModal');
        if (modal) modal.style.display = 'none';
    }
};