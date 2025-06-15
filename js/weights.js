// ===================================
// ثانياً: ملف weights.js المُصلح
// ===================================

// weights.js - إدارة الأوزان
const WeightManager = {
    // تحميل بيانات الأوزان
    async loadWeightsData(searchTerm) {
        try {
            // استخدام API مباشرة بدلاً من SheepManager.getAllSheep
            let sheep = await API.sheep.getAll();
            
            // فلترة حسب البحث إذا وجد
            if (searchTerm) {
                sheep = Utils.searchSheep(sheep, searchTerm);
            }
            
            const tbody = document.getElementById('weightsTableBody');
            
            if (!tbody) return;
            
            tbody.innerHTML = '';

            if (sheep.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد بيانات للعرض
                        </td>
                    </tr>
                `;
                return;
            }

            for (const s of sheep) {
                const weightHistory = await API.weights.getHistory(s.id);
                const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1] : null;
                const currentWeight = s.current_weight || s.weight || '-';
                const lastDate = latestWeight ? Utils.formatDate(latestWeight.date) : '-';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${s.id}</td>
                    <td>${s.gender}</td>
                    <td>${currentWeight} ${currentWeight !== '-' ? 'كجم' : ''}</td>
                    <td>${lastDate}</td>
                    <td>${weightHistory.length}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="WeightManager.openModal('${s.id}')" title="إدارة الأوزان">⚖️</button>
                    </td>
                `;
                tbody.appendChild(row);
            }
            
            console.log(`تم تحميل بيانات الوزن لـ ${sheep.length} خروف`);
        } catch (error) {
            console.error('خطأ في تحميل بيانات الأوزان:', error);
            UI.showAlert('خطأ في تحميل بيانات الأوزان', 'error');
        }
    },

    // فتح نافذة إدارة الأوزان
    async openModal(sheepId) {
        try {
            const sheep = await API.sheep.getOne(sheepId);
            if (!sheep) {
                UI.showAlert('لم يتم العثور على الخروف', 'error');
                return;
            }

            const weightHistory = await API.weights.getHistory(sheepId);

            const modal = document.getElementById('weightModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('weightModalContent');
            
            modalTitle.textContent = `إدارة أوزان الخروف ${sheepId}`;
            
            let html = `
                <div style="margin-bottom: 20px;">
                    <h3>معلومات الخروف</h3>
                    <p><strong>الجنس:</strong> ${sheep.gender}</p>
                    <p><strong>العمر:</strong> ${Utils.calculateAge(sheep.birth_date)}</p>
                    <p><strong>المرحلة:</strong> ${Utils.determineStage(sheep.birth_date, sheep.gender) || '-'}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h4>إضافة وزن جديد</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div class="form-group">
                            <label for="newWeight">الوزن (كيلو)</label>
                            <input type="number" id="newWeight" step="0.1" min="0" required>
                        </div>
                        <div class="form-group">
                            <label for="weightDate">التاريخ</label>
                            <input type="date" id="weightDate" value="${Utils.getCurrentDate()}" required>
                        </div>
                        <div class="form-group">
                            <label for="weightNotes">ملاحظات</label>
                            <input type="text" id="weightNotes" placeholder="ملاحظات اختيارية">
                        </div>
                    </div>
                    <button class="btn btn-success" onclick="WeightManager.addNewWeight('${sheepId}')">إضافة الوزن</button>
                </div>
                
                <h4>تاريخ الأوزان</h4>
            `;
            
            if (weightHistory.length > 0) {
                html += `
                    <table class="weight-history-table">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>الوزن (كيلو)</th>
                                <th>التغيير</th>
                                <th>الملاحظات</th>
                                <th>العمليات</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                weightHistory.forEach((record, index) => {
                    let changeHtml = '';
                    if (index > 0) {
                        const previousWeight = weightHistory[index - 1].weight;
                        const weightChange = Utils.calculateWeightChange(record.weight, previousWeight);
                        const changeClass = weightChange.change > 0 ? 'weight-increase' : 
                                          weightChange.change < 0 ? 'weight-decrease' : 'weight-same';
                        const sign = weightChange.change > 0 ? '+' : '';
                        changeHtml = `<span class="weight-change ${changeClass}">${sign}${weightChange.change} كيلو (${sign}${weightChange.percentage}%)</span>`;
                    } else {
                        changeHtml = '<span class="weight-change weight-same">وزن أولي</span>';
                    }
                    
                    html += `
                        <tr>
                            <td>${Utils.formatDate(record.date)}</td>
                            <td>${record.weight}</td>
                            <td>${changeHtml}</td>
                            <td>${record.notes || '-'}</td>
                            <td>
                                <button class="btn btn-danger btn-sm" onclick="WeightManager.deleteWeight(${record.id}, '${sheepId}')" title="حذف">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                `;
            } else {
                html += '<p style="text-align: center; color: #6c757d;">لا توجد سجلات وزن لهذا الخروف</p>';
            }
            
            modalContent.innerHTML = html;
            modal.style.display = 'block';
        } catch (error) {
            console.error('خطأ في فتح نافذة الأوزان:', error);
            UI.showAlert('خطأ في تحميل البيانات', 'error');
        }
    },

    // إغلاق النافذة
    closeModal() {
        const modal = document.getElementById('weightModal');
        modal.style.display = 'none';
    },

    // إضافة وزن جديد
    async addNewWeight(sheepId) {
        try {
            const weight = parseFloat(document.getElementById('newWeight').value);
            const date = document.getElementById('weightDate').value;
            const notes = document.getElementById('weightNotes').value;
            
            if (!weight || !date) {
                UI.showAlert('يرجى إدخال الوزن والتاريخ', 'error');
                return;
            }
            
            await API.weights.add(sheepId, { weight, date, notes });
            UI.showAlert('تم إضافة الوزن بنجاح', 'success');
            
            await this.openModal(sheepId);
            
            if (UI.currentTab === 'weights') {
                await this.loadWeightsData();
            } else if (UI.currentTab === 'manage') {
                await SheepManager.loadSheepData();
            }
            
            await Reports.updateReports();
        } catch (error) {
            console.error('خطأ في إضافة الوزن:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // حذف وزن
    async deleteWeight(weightId, sheepId) {
        if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
            try {
                await API.weights.delete(weightId);
                UI.showAlert('تم حذف الوزن بنجاح', 'success');
                
                await this.openModal(sheepId);
                
                if (UI.currentTab === 'weights') {
                    await this.loadWeightsData();
                } else if (UI.currentTab === 'manage') {
                    await SheepManager.loadSheepData();
                }
                
                await Reports.updateReports();
            } catch (error) {
                console.error('خطأ في حذف الوزن:', error);
                UI.showAlert(error.message, 'error');
            }
        }
    },

    // إعداد البحث
    setupSearch() {
        const weightSearchInput = document.getElementById('weightSearchInput');
        if (weightSearchInput) {
            let weightSearchTimeout;
            weightSearchInput.addEventListener('input', (e) => {
                clearTimeout(weightSearchTimeout);
                weightSearchTimeout = setTimeout(async () => {
                    const searchTerm = e.target.value;
                    await this.loadWeightsData(searchTerm);
                }, 300);
            });
        }
    }
};
