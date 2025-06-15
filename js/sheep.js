// sheep.js - إدارة الأغنام

const SheepManager = {
    // بيانات الأغنام المحملة
    sheepData: [],
    
    // إعداد النموذج
    setupForm() {
        const form = document.getElementById('sheepForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveSheep();
            });
        }
        
        // تحميل قائمة الحظائر عند تحميل الصفحة
        this.populatePenOptions();
    },
    
    // حفظ الخروف
    async saveSheep() {
        try {
            const sheepData = {
                id: document.getElementById('id').value.trim(),
                gender: document.getElementById('gender').value,
                mother: document.getElementById('mother').value || null,
                weight: parseFloat(document.getElementById('weight').value) || null,
                birth_date: document.getElementById('birthDate').value || null,
                purchase_date: document.getElementById('purchaseDate').value || null,
                death_date: document.getElementById('deathDate').value || null,
                sale_date: document.getElementById('saleDate').value || null,
                stage: document.getElementById('stage').value || null,
                birth_count: parseInt(document.getElementById('birthCount').value) || 0,
                pen: document.getElementById('pen').value || null,
                status: document.getElementById('status').value
            };
            
            // التحقق من البيانات المطلوبة
            if (!sheepData.id || !sheepData.gender) {
                UI.showAlert('الرجاء إدخال المعرف والجنس', 'error');
                return;
            }
            
            // تحديد المرحلة تلقائياً إذا لم تُحدد
            if (!sheepData.stage && sheepData.birth_date) {
                sheepData.stage = Utils.determineStage(sheepData.birth_date, sheepData.gender);
            }
            
            // إرسال البيانات للخادم
            await API.sheep.create(sheepData);
            
            UI.showAlert('تم إضافة الخروف بنجاح', 'success');
            this.clearForm();
            
            // إذا كان في صفحة الإدارة، أعد تحميل البيانات
            if (UI.currentTab === 'manage') {
                await this.loadSheepData();
            }
            
        } catch (error) {
            console.error('خطأ في حفظ الخروف:', error);
            UI.showAlert(error.message || 'خطأ في حفظ البيانات', 'error');
        }
    },
    
    // مسح النموذج
    clearForm() {
        document.getElementById('sheepForm').reset();
        document.getElementById('age').value = '';
    },
    
    // تحديث حقل العمر
    updateAgeField() {
        const birthDate = document.getElementById('birthDate').value;
        const ageField = document.getElementById('age');
        
        if (birthDate) {
            ageField.value = Utils.calculateAge(birthDate);
        } else {
            ageField.value = '';
        }
    },
    
    // تحديث الحالة بناءً على التواريخ
    updateStatusBasedOnDates() {
        const deathDate = document.getElementById('deathDate').value;
        const saleDate = document.getElementById('saleDate').value;
        const statusField = document.getElementById('status');
        
        if (deathDate) {
            statusField.value = 'متوفي';
        } else if (saleDate) {
            statusField.value = 'مباع';
        } else {
            statusField.value = 'موجود';
        }
    },
    
    // تحميل بيانات الأغنام
    async loadSheepData() {
        try {
            this.sheepData = await API.sheep.getAll();
            this.displaySheepTable(this.sheepData);
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            UI.showAlert('خطأ في تحميل بيانات الأغنام', 'error');
        }
    },
    
    // عرض جدول الأغنام
    displaySheepTable(sheep) {
        const tbody = document.getElementById('sheepTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (sheep.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" style="text-align: center; padding: 40px;">
                        لا توجد بيانات للعرض
                    </td>
                </tr>
            `;
            return;
        }
        
        sheep.forEach(s => {
            const age = s.birth_date ? Utils.calculateAgeShort(s.birth_date) : '-';
            const currentWeight = s.current_weight || s.weight || '-';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.id}</td>
                <td>${age}</td>
                <td>${s.gender}</td>
                <td>${s.mother || '-'}</td>
                <td>${currentWeight} ${currentWeight !== '-' ? 'كجم' : ''}</td>
                <td>${Utils.formatDate(s.birth_date)}</td>
                <td>${Utils.formatDate(s.purchase_date)}</td>
                <td>${s.stage || '-'}</td>
                <td>${s.birth_count || 0}</td>
                <td>${s.pen || '-'}</td>
                <td>${Utils.formatDate(s.death_date)}</td>
                <td>${Utils.formatDate(s.sale_date)}</td>
                <td>
                    <span class="status-${s.status === 'موجود' ? 'alive' : s.status === 'متوفي' ? 'dead' : 'sold'}">
                        ${s.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="SheepManager.editSheep('${s.id}')" title="تعديل">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="SheepManager.deleteSheep('${s.id}')" title="حذف">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // تهيئة الاختيار المتعدد
        BatchPenManager.initBatchSelection();
        
        // إضافة checkbox لكل صف
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            if (sheep[index]) {
                BatchPenManager.addCheckboxToRow(row, sheep[index].id);
            }
        });
    },
    
    // تعديل خروف
    async editSheep(id) {
        try {
            const sheep = await API.sheep.getOne(id);
            
            // التبديل إلى تبويب الإضافة
            await UI.showTab('add');
            
            // ملء النموذج بالبيانات
            document.getElementById('id').value = sheep.id;
            document.getElementById('gender').value = sheep.gender;
            document.getElementById('mother').value = sheep.mother || '';
            document.getElementById('weight').value = sheep.weight || '';
            document.getElementById('birthDate').value = sheep.birth_date || '';
            document.getElementById('purchaseDate').value = sheep.purchase_date || '';
            document.getElementById('deathDate').value = sheep.death_date || '';
            document.getElementById('saleDate').value = sheep.sale_date || '';
            document.getElementById('stage').value = sheep.stage || '';
            document.getElementById('birthCount').value = sheep.birth_count || 0;
            document.getElementById('pen').value = sheep.pen || '';
            document.getElementById('status').value = sheep.status;
            
            // تحديث حقل العمر
            this.updateAgeField();
            
            // تغيير زر الحفظ
            const submitBtn = document.querySelector('#sheepForm button[type="submit"]');
            submitBtn.textContent = 'تحديث البيانات';
            submitBtn.onclick = async (e) => {
                e.preventDefault();
                await this.updateSheep(id);
            };
            
        } catch (error) {
            console.error('خطأ في تحميل بيانات الخروف:', error);
            UI.showAlert('خطأ في تحميل البيانات', 'error');
        }
    },
    
    // تحديث بيانات خروف
    async updateSheep(id) {
        try {
            const sheepData = {
                gender: document.getElementById('gender').value,
                mother: document.getElementById('mother').value || null,
                weight: parseFloat(document.getElementById('weight').value) || null,
                birth_date: document.getElementById('birthDate').value || null,
                purchase_date: document.getElementById('purchaseDate').value || null,
                death_date: document.getElementById('deathDate').value || null,
                sale_date: document.getElementById('saleDate').value || null,
                stage: document.getElementById('stage').value || null,
                birth_count: parseInt(document.getElementById('birthCount').value) || 0,
                pen: document.getElementById('pen').value || null,
                status: document.getElementById('status').value
            };
            
            await API.sheep.update(id, sheepData);
            
            UI.showAlert('تم تحديث البيانات بنجاح', 'success');
            
            // العودة للوضع الطبيعي
            const submitBtn = document.querySelector('#sheepForm button[type="submit"]');
            submitBtn.textContent = 'إضافة الخروف';
            submitBtn.onclick = null;
            
            this.clearForm();
            
            // العودة لصفحة الإدارة
            await UI.showTab('manage');
            
        } catch (error) {
            console.error('خطأ في تحديث البيانات:', error);
            UI.showAlert(error.message || 'خطأ في تحديث البيانات', 'error');
        }
    },
    
    // حذف خروف
    async deleteSheep(id) {
        if (confirm(`هل أنت متأكد من حذف الخروف ${id}؟`)) {
            try {
                await API.sheep.delete(id);
                UI.showAlert('تم حذف الخروف بنجاح', 'success');
                await this.loadSheepData();
            } catch (error) {
                console.error('خطأ في حذف الخروف:', error);
                UI.showAlert('خطأ في حذف الخروف', 'error');
            }
        }
    },
    
    // إعداد البحث
    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value;
                const filteredSheep = Utils.searchSheep(this.sheepData, searchTerm);
                this.displaySheepTable(filteredSheep);
            });
        }
    },

    async populatePenOptions() {
        try {
            const pens = await API.pens.getAll();
            const penSelect = document.getElementById('pen');
            
            if (penSelect) {
                // الاحتفاظ بالقيمة الحالية إن وجدت
                const currentValue = penSelect.value;
                
                penSelect.innerHTML = '<option value="">اختر الحظيرة</option>';
                
                pens.forEach(pen => {
                    const available = pen.capacity - pen.sheep_count;
                    const option = document.createElement('option');
                    option.value = pen.id;
                    
                    // عرض معلومات الحظيرة مع المساحة المتاحة
                    if (available > 0) {
                        option.textContent = `${pen.name} (${pen.id}) - متاح: ${available} مكان`;
                    } else {
                        option.textContent = `${pen.name} (${pen.id}) - ممتلئة`;
                        option.disabled = true;
                    }
                    
                    // إضافة لون للخيارات حسب معدل الإشغال
                    const occupancyRate = pen.capacity > 0 ? Math.round((pen.sheep_count / pen.capacity) * 100) : 0;
                    if (occupancyRate >= 100) {
                        option.style.color = '#dc3545'; // أحمر للممتلئة
                    } else if (occupancyRate > 80) {
                        option.style.color = '#ffc107'; // أصفر للشبه ممتلئة
                    } else {
                        option.style.color = '#28a745'; // أخضر للمتاحة
                    }
                    
                    penSelect.appendChild(option);
                });
                
                // إعادة تحديد القيمة السابقة إن وجدت
                if (currentValue) {
                    penSelect.value = currentValue;
                }
            }
        } catch (error) {
            console.error('خطأ في تحميل قائمة الحظائر:', error);
            UI.showAlert('خطأ في تحميل قائمة الحظائر', 'error');
        }
    },
    
    // ملء خيارات الأمهات
    async populateMotherOptions() {
        try {
            const allSheep = await API.sheep.getAll();
            const mothers = allSheep.filter(s => s.gender === 'أنثى' && s.status === 'موجود');
            
            const motherSelect = document.getElementById('mother');
            if (motherSelect) {
                motherSelect.innerHTML = '<option value="">اختر الأم (اختياري)</option>';
                
                mothers.forEach(mother => {
                    const option = document.createElement('option');
                    option.value = mother.id;
                    option.textContent = `${mother.id} - عدد الولادات: ${mother.birth_count || 0}`;
                    motherSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('خطأ في تحميل قائمة الأمهات:', error);
        }
    }
};

// إضافة متغيرات للاختيار المتعدد
const BatchPenManager = {
    selectedSheep: new Set(),
    
    // تهيئة خاصية الاختيار المتعدد
    initBatchSelection() {
        // إضافة عمود الاختيار في جدول الأغنام
        const headerRow = document.querySelector('#sheepTable thead tr');
        if (headerRow && !document.getElementById('selectAllCheckbox')) {
            const selectHeader = document.createElement('th');
            selectHeader.innerHTML = '<input type="checkbox" id="selectAllCheckbox" onchange="BatchPenManager.toggleSelectAll()">';
            headerRow.insertBefore(selectHeader, headerRow.firstChild);
        }
        
        // إضافة أزرار التحكم الجماعي
        const manageTab = document.getElementById('manage');
        if (manageTab && !document.getElementById('batchControls')) {
            const batchControls = document.createElement('div');
            batchControls.id = 'batchControls';
            batchControls.style.cssText = 'margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; display: none;';
            batchControls.innerHTML = `
                <h4>العمليات الجماعية</h4>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <span id="selectedCount">0 خروف محدد</span>
                    <button class="btn btn-primary" onclick="BatchPenManager.openBatchPenModal()">
                        نقل إلى حظيرة
                    </button>
                    <button class="btn btn-warning" onclick="BatchPenManager.clearSelection()">
                        إلغاء التحديد
                    </button>
                </div>
            `;
            
            const searchBox = manageTab.querySelector('.search-box');
            searchBox.parentNode.insertBefore(batchControls, searchBox.nextSibling);
        }
    },
    
    // تبديل تحديد الكل
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllCheckbox');
        const checkboxes = document.querySelectorAll('.sheep-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
            const sheepId = checkbox.value;
            if (selectAll.checked) {
                this.selectedSheep.add(sheepId);
            } else {
                this.selectedSheep.delete(sheepId);
            }
        });
        
        this.updateSelectionUI();
    },
    
    // تحديد خروف واحد
    toggleSheepSelection(sheepId) {
        const checkbox = document.querySelector(`input[value="${sheepId}"]`);
        if (checkbox.checked) {
            this.selectedSheep.add(sheepId);
        } else {
            this.selectedSheep.delete(sheepId);
        }
        
        this.updateSelectionUI();
    },
    
    // تحديث واجهة المستخدم
    updateSelectionUI() {
        const count = this.selectedSheep.size;
        const selectedCountElement = document.getElementById('selectedCount');
        const batchControls = document.getElementById('batchControls');
        
        if (selectedCountElement) {
            selectedCountElement.textContent = `${count} خروف محدد`;
        }
        
        if (batchControls) {
            batchControls.style.display = count > 0 ? 'block' : 'none';
        }
        
        // تحديث حالة "تحديد الكل"
        const selectAll = document.getElementById('selectAllCheckbox');
        const allCheckboxes = document.querySelectorAll('.sheep-checkbox');
        if (selectAll && allCheckboxes.length > 0) {
            selectAll.checked = count === allCheckboxes.length;
        }
    },
    
    // مسح التحديد
    clearSelection() {
        this.selectedSheep.clear();
        const checkboxes = document.querySelectorAll('.sheep-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = false);
        
        const selectAll = document.getElementById('selectAllCheckbox');
        if (selectAll) selectAll.checked = false;
        
        this.updateSelectionUI();
    },
    
    // فتح نافذة النقل الجماعي
    async openBatchPenModal() {
        if (this.selectedSheep.size === 0) {
            UI.showAlert('الرجاء تحديد خروف واحد على الأقل', 'warning');
            return;
        }
        
        try {
            const pens = await API.pens.getAll();
            
            let modal = document.getElementById('batchPenModal');
            if (!modal) {
                // إنشاء النافذة إذا لم تكن موجودة
                this.createBatchPenModal();
                modal = document.getElementById('batchPenModal');
            }
            
            const content = document.getElementById('batchPenModalContent');
            content.innerHTML = `
                <form id="batchPenForm" onsubmit="BatchPenManager.saveBatchPenUpdate(event)">
                    <p>سيتم نقل <strong>${this.selectedSheep.size}</strong> خروف إلى الحظيرة المحددة</p>
                    
                    <div class="form-group">
                        <label for="targetPen">الحظيرة المستهدفة</label>
                        <select id="targetPen" class="form-control" required>
                            <option value="">اختر الحظيرة</option>
                            ${pens.map(pen => `
                                <option value="${pen.id}">
                                    ${pen.name} (${pen.id}) - الإشغال: ${pen.sheep_count}/${pen.capacity}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="alert alert-info">
                        <h5>الأغنام المحددة:</h5>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${Array.from(this.selectedSheep).join(', ')}
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-success">نقل الأغنام</button>
                        <button type="button" class="btn btn-warning" onclick="BatchPenManager.closeBatchPenModal()">إلغاء</button>
                    </div>
                </form>
            `;
            
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('خطأ في فتح نافذة النقل الجماعي:', error);
            UI.showAlert('خطأ في تحميل الحظائر', 'error');
        }
    },
    
    // إنشاء نافذة النقل الجماعي
    createBatchPenModal() {
        const modalHTML = `
            <div id="batchPenModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>نقل مجموعة أغنام إلى حظيرة</h2>
                        <button class="close" onclick="BatchPenManager.closeBatchPenModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="batchPenModalContent">
                            <!-- سيتم ملؤه ديناميكياً -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // إغلاق نافذة النقل الجماعي
    closeBatchPenModal() {
        const modal = document.getElementById('batchPenModal');
        if (modal) modal.style.display = 'none';
    },
    
    // حفظ النقل الجماعي
    async saveBatchPenUpdate(event) {
        event.preventDefault();
        
        const targetPen = document.getElementById('targetPen').value;
        if (!targetPen) {
            UI.showAlert('الرجاء اختيار الحظيرة المستهدفة', 'error');
            return;
        }
        
        try {
            UI.showLoading();
            let successCount = 0;
            let failCount = 0;
            const errors = [];
            
            // تحديث كل خروف
            for (const sheepId of this.selectedSheep) {
                try {
                    await API.sheep.update(sheepId, { pen: targetPen });
                    successCount++;
                } catch (error) {
                    failCount++;
                    errors.push(`${sheepId}: ${error.message}`);
                }
            }
            
            // عرض النتائج
            if (successCount > 0 && failCount === 0) {
                UI.showAlert(`تم نقل ${successCount} خروف بنجاح إلى الحظيرة ${targetPen}`, 'success');
            } else if (successCount > 0 && failCount > 0) {
                UI.showAlert(`تم نقل ${successCount} خروف بنجاح، فشل نقل ${failCount} خروف`, 'warning');
                console.error('أخطاء النقل:', errors);
            } else {
                UI.showAlert('فشل نقل جميع الأغنام', 'error');
                console.error('أخطاء النقل:', errors);
            }
            
            // تنظيف وإعادة تحميل
            this.clearSelection();
            this.closeBatchPenModal();
            await SheepManager.loadSheepData();
            
        } catch (error) {
            console.error('خطأ في النقل الجماعي:', error);
            UI.showAlert('حدث خطأ أثناء نقل الأغنام', 'error');
        } finally {
            UI.hideLoading();
        }
    },
    
    // إضافة checkbox لكل صف في الجدول
    addCheckboxToRow(row, sheepId) {
        const checkboxCell = document.createElement('td');
        checkboxCell.innerHTML = `
            <input type="checkbox" class="sheep-checkbox" value="${sheepId}" 
                   onchange="BatchPenManager.toggleSheepSelection('${sheepId}')">
        `;
        row.insertBefore(checkboxCell, row.firstChild);
    }
};
// دالة للحصول على جميع الأغنام
SheepManager.getAllSheep = async function(searchTerm) {
    try {
        let allSheep = await API.sheep.getAll();
        
        // فلترة حسب البحث إذا وجد
        if (searchTerm) {
            allSheep = Utils.searchSheep(allSheep, searchTerm);
        }
        
        return allSheep;
    } catch (error) {
        console.error('خطأ في جلب بيانات الأغنام:', error);
        return [];
    }
};

// دالة للحصول على خروف واحد
SheepManager.getSheep = async function(sheepId) {
    try {
        return await API.sheep.getOne(sheepId);
    } catch (error) {
        console.error('خطأ في جلب بيانات الخروف:', error);
        return null;
    }
};

// دالة للحصول على جميع الأغنام
SheepManager.getAllSheep = async function() {
    try {
        return await API.sheep.getAll();
    } catch (error) {
        console.error('خطأ في جلب بيانات الأغنام:', error);
        return [];
    }
};