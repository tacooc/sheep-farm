// pregnancy.js - إدارة الحمل والولادة

const PregnancyManager = {
    // حالة النموذج
    editMode: false,
    currentPregnancyId: null,

    // تحميل بيانات الحمل
    async loadPregnancyData(filter) {
        try {
            const tbody = document.getElementById('pregnancyTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            let pregnancies = await API.pregnancies.getAll();
            
            if (filter) {
                pregnancies = pregnancies.filter(p => this.getPregnancyStatus(p) === filter);
            }
            
            if (pregnancies.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد بيانات للعرض
                        </td>
                    </tr>
                `;
                return;
            }
            
            pregnancies.sort((a, b) => new Date(b.expected_birth_date) - new Date(a.expected_birth_date));
            
            pregnancies.forEach(pregnancy => {
                const row = document.createElement('tr');
                const status = this.getPregnancyStatus(pregnancy);
                const statusClass = {
                    'حامل': 'status-alive',
                    'ولدت': 'status-sold',
                    'متوقع': 'status-dead'
                }[status] || '';
                
                row.innerHTML = `
                    <td>${pregnancy.sheep_id}</td>
                    <td>${Utils.formatDate(pregnancy.pregnancy_date)}</td>
                    <td>${Utils.formatDate(pregnancy.expected_birth_date)}</td>
                    <td>${pregnancy.actual_birth_date ? Utils.formatDate(pregnancy.actual_birth_date) : '-'}</td>
                    <td>${pregnancy.birth_count || '-'}</td>
                    <td><span class="${statusClass}">${status}</span></td>
                    <td>${this.getDaysText(pregnancy)}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="PregnancyManager.edit('${pregnancy.id}')" title="تعديل">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="PregnancyManager.deleteConfirm('${pregnancy.id}')" title="حذف">🗑️</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('خطأ في تحميل بيانات الحمل:', error);
        }
    },

    // حالة الحمل
    getPregnancyStatus(pregnancy) {
        if (pregnancy.actual_birth_date) {
            return 'ولدت';
        }
        
        const today = new Date();
        const expectedDate = new Date(pregnancy.expected_birth_date);
        const daysUntilBirth = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilBirth <= 7 && daysUntilBirth >= 0) {
            return 'متوقع';
        }
        
        return 'حامل';
    },

    // نص الأيام
    getDaysText(pregnancy) {
        const today = new Date();
        
        if (pregnancy.actual_birth_date) {
            const birthDate = new Date(pregnancy.actual_birth_date);
            const daysSinceBirth = Math.ceil((today - birthDate) / (1000 * 60 * 60 * 24));
            return `ولدت منذ ${daysSinceBirth} يوم`;
        }
        
        const expectedDate = new Date(pregnancy.expected_birth_date);
        const daysUntilBirth = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilBirth > 0) {
            return `باقي ${daysUntilBirth} يوم`;
        } else if (daysUntilBirth === 0) {
            return 'اليوم موعد الولادة';
        } else {
            return `متأخرة ${Math.abs(daysUntilBirth)} يوم`;
        }
    },

    // فتح نافذة تسجيل الحمل
    async openModal() {
        const modal = document.getElementById('pregnancyModal');
        const form = document.getElementById('pregnancyForm');
        
        form.reset();
        this.editMode = false;
        this.currentPregnancyId = null;
        
        const selectElement = document.getElementById('pregnantSheepId');
        
        // تدمير Select2 السابق إذا كان موجوداً
        if (typeof $ !== 'undefined' && $(selectElement).data('select2')) {
            $(selectElement).select2('destroy');
        }
        
        selectElement.innerHTML = '<option value="">اختر الأنثى</option>';
        
        const allSheep = await API.sheep.getAll();
        const females = allSheep.filter(sheep => 
            sheep.gender === 'أنثى' && 
            sheep.status === 'موجود' &&
            (Utils.determineStage(sheep.birth_date, sheep.gender) === 'بالغ' || 
             Utils.determineStage(sheep.birth_date, sheep.gender) === 'كبير السن')
        );
        
        females.forEach(female => {
            const option = document.createElement('option');
            option.value = female.id;
            option.textContent = `${female.id} - عدد الولادات: ${female.birth_count || 0}`;
            selectElement.appendChild(option);
        });
        
        document.getElementById('pregnancyModalTitle').textContent = 'تسجيل حمل جديد';
        document.getElementById('sheepInfoDiv').style.display = 'none';
        document.getElementById('birthCountGroup').style.display = 'none';
        
        modal.style.display = 'block';
        
        // تفعيل Select2 إذا كانت المكتبة متوفرة
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $(selectElement).select2({
                placeholder: 'ابحث عن الأنثى بالمعرف...',
                allowClear: true,
                dir: 'rtl',
                language: {
                    noResults: function() {
                        return "لم يتم العثور على نتائج";
                    },
                    searching: function() {
                        return "جاري البحث...";
                    },
                    removeAllItems: function() {
                        return "إزالة جميع العناصر";
                    }
                },
                dropdownParent: $(modal),
                width: '100%',
                minimumInputLength: 0,
                matcher: function(params, data) {
                    // البحث المخصص
                    if ($.trim(params.term) === '') {
                        return data;
                    }
                    
                    if (typeof data.text === 'undefined') {
                        return null;
                    }
                    
                    // البحث في النص
                    if (data.text.indexOf(params.term) > -1) {
                        return data;
                    }
                    
                    return null;
                }
            });
            
            // ربط حدث التغيير
            $(selectElement).on('change', () => {
                this.updateInfo();
            });
        }
    },

    // إغلاق النافذة
    closeModal() {
        // تدمير Select2 قبل إغلاق النافذة
        const selectElement = document.getElementById('pregnantSheepId');
        if (typeof $ !== 'undefined' && $(selectElement).data('select2')) {
            $(selectElement).select2('destroy');
        }
        
        const modal = document.getElementById('pregnancyModal');
        modal.style.display = 'none';
    },

    // حساب تاريخ الولادة المتوقع
    calculateExpectedBirthDate() {
        const pregnancyDate = document.getElementById('pregnancyDate').value;
        if (pregnancyDate) {
            const date = new Date(pregnancyDate);
            date.setDate(date.getDate() + Config.PREGNANCY_DAYS);
            document.getElementById('expectedBirthDate').value = date.toISOString().split('T')[0];
        }
    },

    // إظهار/إخفاء حقول الولادة
    toggleBirthFields() {
        const actualBirthDate = document.getElementById('actualBirthDate').value;
        const birthCountGroup = document.getElementById('birthCountGroup');
        
        if (actualBirthDate) {
            birthCountGroup.style.display = 'block';
            document.getElementById('birthCountPregnancy').required = true;
        } else {
            birthCountGroup.style.display = 'none';
            document.getElementById('birthCountPregnancy').required = false;
            document.getElementById('birthCountPregnancy').value = '1';
        }
    },

    // تحديث معلومات الأنثى
    async updateInfo() {
        const sheepId = document.getElementById('pregnantSheepId').value;
        const infoDiv = document.getElementById('sheepInfoDiv');
        const infoText = document.getElementById('sheepInfoText');
        
        if (sheepId) {
            const sheep = await API.sheep.getOne(sheepId);
            if (sheep) {
                // الحصول على آخر ولادة
                const pregnancies = await API.pregnancies.getBySheep(sheepId);
                const lastBirth = pregnancies
                    .filter(p => p.actual_birth_date)
                    .sort((a, b) => new Date(b.actual_birth_date) - new Date(a.actual_birth_date))[0];
                
                let lastBirthInfo = 'لم تلد من قبل';
                if (lastBirth) {
                    const daysSinceBirth = Math.ceil((new Date() - new Date(lastBirth.actual_birth_date)) / (1000 * 60 * 60 * 24));
                    lastBirthInfo = `${Utils.formatDate(lastBirth.actual_birth_date)} (منذ ${daysSinceBirth} يوم)`;
                }
                
                infoDiv.style.display = 'block';
                infoText.innerHTML = `
                    <strong>العمر:</strong> ${Utils.calculateAge(sheep.birth_date)}<br>
                    <strong>عدد الولادات السابقة:</strong> ${sheep.birth_count || 0}<br>
                    <strong>آخر ولادة:</strong> ${lastBirthInfo}<br>
                    <strong>المرحلة:</strong> ${Utils.determineStage(sheep.birth_date, sheep.gender) || '-'}
                `;
                
                // تحذير إذا كانت فترة الراحة قصيرة
                if (lastBirth) {
                    const daysSinceBirth = Math.ceil((new Date() - new Date(lastBirth.actual_birth_date)) / (1000 * 60 * 60 * 24));
                    if (daysSinceBirth < 45) {
                        infoText.innerHTML += `<br><span style="color: #e74c3c;">⚠️ تحذير: لم تمر 45 يوماً على آخر ولادة</span>`;
                    }
                }
            }
        } else {
            infoDiv.style.display = 'none';
        }
    },

    // حفظ بيانات الحمل
    async save(event) {
        event.preventDefault();
        
        try {
            const pregnancyData = {
                sheep_id: document.getElementById('pregnantSheepId').value,
                pregnancy_date: document.getElementById('pregnancyDate').value,
                expected_birth_date: document.getElementById('expectedBirthDate').value,
                actual_birth_date: document.getElementById('actualBirthDate').value || null,
                birth_count: document.getElementById('actualBirthDate').value ? 
                    parseInt(document.getElementById('birthCountPregnancy').value) : null,
                notes: document.getElementById('pregnancyNotes').value || ''
            };
            
            if (!pregnancyData.sheep_id || !pregnancyData.pregnancy_date) {
                throw new Error('يجب اختيار الأنثى وتاريخ الحمل');
            }
            
            if (this.editMode && this.currentPregnancyId) {
                await API.pregnancies.update(this.currentPregnancyId, pregnancyData);
                UI.showAlert(Config.MESSAGES.success.pregnancyUpdated, 'success');
            } else {
                await API.pregnancies.create(pregnancyData);
                UI.showAlert(Config.MESSAGES.success.pregnancyAdded, 'success');
            }
            
            // تحديث عدد الولادات للأم إذا تمت الولادة
            if (pregnancyData.actual_birth_date && pregnancyData.birth_count) {
                const sheep = await API.sheep.getOne(pregnancyData.sheep_id);
                if (sheep) {
                    const newBirthCount = (parseInt(sheep.birth_count) || 0) + 1;
                    await API.sheep.update(pregnancyData.sheep_id, { birth_count: newBirthCount });
                }
            }
            
            this.closeModal();
            await this.loadPregnancyData();
            await UI.updateDashboard();
            
        } catch (error) {
            console.error('خطأ في حفظ بيانات الحمل:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // تعديل بيانات الحمل
    async edit(pregnancyId) {
        const pregnancies = await API.pregnancies.getAll();
        const pregnancy = pregnancies.find(p => p.id == pregnancyId);
        
        if (!pregnancy) {
            UI.showAlert('لم يتم العثور على بيانات الحمل', 'error');
            return;
        }
        
        await this.openModal();
        
        // تعيين القيم
        if (typeof $ !== 'undefined' && $('#pregnantSheepId').data('select2')) {
            $('#pregnantSheepId').val(pregnancy.sheep_id).trigger('change');
        } else {
            document.getElementById('pregnantSheepId').value = pregnancy.sheep_id;
        }
        
        document.getElementById('pregnancyDate').value = pregnancy.pregnancy_date;
        document.getElementById('expectedBirthDate').value = pregnancy.expected_birth_date;
        document.getElementById('actualBirthDate').value = pregnancy.actual_birth_date || '';
        document.getElementById('birthCountPregnancy').value = pregnancy.birth_count || 1;
        document.getElementById('pregnancyNotes').value = pregnancy.notes || '';
        
        await this.updateInfo();
        this.toggleBirthFields();
        
        this.editMode = true;
        this.currentPregnancyId = pregnancyId;
        document.getElementById('pregnancyModalTitle').textContent = 'تعديل بيانات الحمل';
    },

    // حذف سجل الحمل
    async deleteConfirm(pregnancyId) {
        if (confirm(Config.MESSAGES.warnings.deletePregnancyConfirm)) {
            try {
                await API.pregnancies.delete(pregnancyId);
                UI.showAlert(Config.MESSAGES.success.pregnancyDeleted, 'success');
                await this.loadPregnancyData();
                await UI.updateDashboard();
            } catch (error) {
                console.error('خطأ في حذف سجل الحمل:', error);
                UI.showAlert('خطأ في حذف سجل الحمل', 'error');
            }
        }
    },

    // فلترة سجلات الحمل
    filterPregnancies() {
        const filter = document.getElementById('pregnancyStatusFilter').value;
        this.loadPregnancyData(filter);
    },

    // عرض تاريخ الأنثى
    async viewFemaleHistory(femaleId) {
        try {
            const pregnancies = await API.pregnancies.getBySheep(femaleId);
            const sheep = await API.sheep.getOne(femaleId);
            
            // إنشاء نافذة منبثقة أفضل
            let modal = document.getElementById('femaleHistoryModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'femaleHistoryModal';
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 700px;">
                        <div class="modal-header">
                            <h2 id="femaleHistoryTitle">تاريخ الأنثى</h2>
                            <button class="close" onclick="document.getElementById('femaleHistoryModal').style.display='none'">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div id="femaleHistoryContent"></div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            
            const sortedPregnancies = pregnancies.sort((a, b) => 
                new Date(b.pregnancy_date) - new Date(a.pregnancy_date)
            );
            
            let content = `
                <div style="margin-bottom: 20px;">
                    <h3>معلومات الأنثى ${femaleId}</h3>
                    <p><strong>العمر:</strong> ${Utils.calculateAge(sheep.birth_date)}</p>
                    <p><strong>المرحلة:</strong> ${Utils.determineStage(sheep.birth_date, sheep.gender)}</p>
                    <p><strong>إجمالي الولادات:</strong> ${sheep.birth_count || 0}</p>
                </div>
                
                <h4>سجل الحمل والولادة:</h4>
            `;
            
            if (sortedPregnancies.length === 0) {
                content += '<p style="text-align: center; color: #6c757d;">لا توجد سجلات حمل</p>';
            } else {
                content += `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>رقم الحمل</th>
                                <th>تاريخ الحمل</th>
                                <th>تاريخ الولادة المتوقع</th>
                                <th>تاريخ الولادة الفعلي</th>
                                <th>عدد المواليد</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                sortedPregnancies.forEach((p, index) => {
                    const status = this.getPregnancyStatus(p);
                    const statusClass = {
                        'حامل': 'status-alive',
                        'ولدت': 'status-sold',
                        'متوقع': 'status-dead'
                    }[status] || '';
                    
                    content += `
                        <tr>
                            <td>${sortedPregnancies.length - index}</td>
                            <td>${Utils.formatDate(p.pregnancy_date)}</td>
                            <td>${Utils.formatDate(p.expected_birth_date)}</td>
                            <td>${p.actual_birth_date ? Utils.formatDate(p.actual_birth_date) : '-'}</td>
                            <td>${p.birth_count || '-'}</td>
                            <td><span class="${statusClass}">${status}</span></td>
                        </tr>
                    `;
                });
                
                content += `
                        </tbody>
                    </table>
                `;
                
                // حساب معدل الدورة الإنتاجية
                const completedPregnancies = sortedPregnancies.filter(p => p.actual_birth_date);
                if (completedPregnancies.length >= 2) {
                    let totalCycleDays = 0;
                    let cycleCount = 0;
                    
                    for (let i = 1; i < completedPregnancies.length; i++) {
                        const prevBirth = new Date(completedPregnancies[i-1].actual_birth_date);
                        const currentBirth = new Date(completedPregnancies[i].actual_birth_date);
                        const cycleDays = Math.ceil((currentBirth - prevBirth) / (1000 * 60 * 60 * 24));
                        
                        if (cycleDays > 0 && cycleDays < 400) {
                            totalCycleDays += cycleDays;
                            cycleCount++;
                        }
                    }
                    
                    if (cycleCount > 0) {
                        const avgCycle = Math.round(totalCycleDays / cycleCount);
                        const birthsPerYear = (365 / avgCycle).toFixed(2);
                        
                        content += `
                            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                                <h4>تحليل الأداء الإنتاجي:</h4>
                                <p><strong>متوسط الدورة الإنتاجية:</strong> ${avgCycle} يوم</p>
                                <p><strong>معدل الولادات السنوي:</strong> ${birthsPerYear} ولادة/سنة</p>
                            </div>
                        `;
                    }
                }
            }
            
            document.getElementById('femaleHistoryContent').innerHTML = content;
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('خطأ في عرض تاريخ الأنثى:', error);
            UI.showAlert('خطأ في تحميل التاريخ', 'error');
        }
    },

    // إعداد النموذج
    setupForm() {
        const pregnancyForm = document.getElementById('pregnancyForm');
        if (pregnancyForm) {
            pregnancyForm.addEventListener('submit', (e) => this.save(e));
        }
    }
};