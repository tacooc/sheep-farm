// events.js - إدارة الأحداث

const EventsManager = {
    // تحميل بيانات الأحداث
    async loadEventsData(searchTerm) {
        try {
            console.log('📅 جاري تحميل بيانات الأحداث...');
            
            // التحقق من وجود رمز المصادقة
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.error('❌ لا يوجد رمز مصادقة');
                UI.showAlert('يجب تسجيل الدخول أولاً', 'error');
                return;
            }
            
            // استخدام API مباشرة
            let sheep = await API.sheep.getAll();
            console.log(`✅ تم جلب ${sheep.length} خروف`);
            
            // فلترة حسب البحث إذا وجد
            if (searchTerm) {
                sheep = Utils.searchSheep(sheep, searchTerm);
                console.log(`🔍 تم فلترة إلى ${sheep.length} خروف`);
            }
            
            const tbody = document.getElementById('eventsTableBody');
            
            if (!tbody) {
                console.error('❌ جدول الأحداث غير موجود');
                return;
            }
            
            tbody.innerHTML = '';

            if (!sheep || sheep.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px; color: #6c757d;">
                            ${searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد أغنام في النظام'}
                        </td>
                    </tr>
                `;
                console.log('⚠️ لا توجد أغنام لعرضها');
                return;
            }

            console.log('⏳ جاري تحميل أحداث كل خروف...');
            let loadedCount = 0;

            for (const s of sheep) {
                try {
                    const events = await API.events.getHistory(s.id);
                    const latestEvent = events.length > 0 ? events[0] : null;
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${s.id}</td>
                        <td>${s.gender}</td>
                        <td>${events.length}</td>
                        <td>${latestEvent ? latestEvent.event_type : '-'}</td>
                        <td>${latestEvent ? Utils.formatDate(latestEvent.event_date) : '-'}</td>
                        <td>
                            <button class="btn btn-info btn-sm" onclick="EventsManager.openModal('${s.id}')" title="إدارة الأحداث">📋</button>
                            <button class="btn btn-success btn-sm" onclick="EventsManager.scheduleEventForSheep('${s.id}')" title="جدولة حدث">📅</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                    loadedCount++;
                } catch (error) {
                    console.error(`❌ خطأ في تحميل أحداث الخروف ${s.id}:`, error);
                }
            }
            
            console.log(`✅ تم تحميل أحداث ${loadedCount} خروف`);
            
            // تحديث جداول الأحداث السابقة والقادمة
            await this.updatePastEventsTable();
            await this.updateUpcomingEventsTable();
            
            // تحديث الإحصائيات
            await this.updateEventStats();
            
        } catch (error) {
            console.error('❌ خطأ في تحميل بيانات الأحداث:', error);
            UI.showAlert('خطأ في تحميل بيانات الأحداث: ' + error.message, 'error');
            
            const tbody = document.getElementById('eventsTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px; color: #dc3545;">
                            خطأ في تحميل البيانات: ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    },

    // تحديث جدول الأحداث السابقة
    async updatePastEventsTable() {
        try {
            const tbody = document.getElementById('pastEventsTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            // جلب جميع الأحداث
            const allEvents = await API.events.getAll();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // فلترة الأحداث السابقة
            const pastEvents = allEvents.filter(event => {
                const eventDate = new Date(event.event_date);
                return eventDate < today;
            });
            
            // ترتيب حسب التاريخ (الأحدث أولاً)
            pastEvents.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
            
            if (pastEvents.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد أحداث سابقة
                        </td>
                    </tr>
                `;
                return;
            }
            
            // عرض أحدث 20 حدث فقط
            pastEvents.slice(0, 20).forEach(event => {
                const daysSince = Math.ceil((today - new Date(event.event_date)) / (1000 * 60 * 60 * 24));
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${event.sheep_id}</td>
                    <td><span class="weight-change ${this.getEventTypeClass(event.event_type)}">${event.event_type}</span></td>
                    <td>${Utils.formatDate(event.event_date)}</td>
                    <td>${daysSince} يوم</td>
                    <td>${event.notes || '-'}</td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('خطأ في تحديث جدول الأحداث السابقة:', error);
        }
    },

    // تحديث جدول الأحداث القادمة
    async updateUpcomingEventsTable() {
        try {
            const tbody = document.getElementById('upcomingEventsTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // جلب الأحداث المجدولة من قاعدة البيانات
            const scheduledEvents = await API.scheduledEvents.getAll({ completed: false });
            
            // إضافة أحداث تلقائية مقترحة (مثل قص الصوف الدوري)
            const suggestedEvents = await this.generateSuggestedEvents();
            const allUpcoming = [...scheduledEvents, ...suggestedEvents];
            
            // ترتيب حسب التاريخ
            allUpcoming.sort((a, b) => new Date(a.scheduled_date || a.date) - new Date(b.scheduled_date || b.date));
            
            if (allUpcoming.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد أحداث قادمة مجدولة
                        </td>
                    </tr>
                `;
                return;
            }
            
            allUpcoming.forEach(event => {
                const eventDate = new Date(event.scheduled_date || event.date);
                const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                
                let rowClass = '';
                let daysText = '';
                let daysClass = '';
                
                if (daysUntil < 0) {
                    rowClass = 'overdue-event';
                    daysText = `متأخر ${Math.abs(daysUntil)} يوم`;
                    daysClass = 'days-negative';
                } else if (daysUntil === 0) {
                    rowClass = 'today-event';
                    daysText = 'اليوم';
                    daysClass = 'days-today';
                } else if (daysUntil <= 7) {
                    rowClass = 'upcoming-event';
                    daysText = `بعد ${daysUntil} يوم`;
                    daysClass = 'days-positive';
                } else {
                    daysText = `بعد ${daysUntil} يوم`;
                    daysClass = 'days-positive';
                }
                
                const row = document.createElement('tr');
                row.className = rowClass;
                row.innerHTML = `
                    <td>${event.sheep_id || event.sheepId}</td>
                    <td><span class="weight-change ${this.getEventTypeClass(event.event_type || event.type)}">${event.event_type || event.type}</span></td>
                    <td>${Utils.formatDate(event.scheduled_date || event.date)}</td>
                    <td><span class="event-days-badge ${daysClass}">${daysText}</span></td>
                    <td>${event.notes || '-'}</td>
                    <td>
                        ${event.suggested ? 
                            `<button class="btn btn-success btn-sm" onclick="EventsManager.confirmSuggestedEvent('${event.id}')" title="تأكيد">✅</button>` :
                            `<button class="btn btn-info btn-sm" onclick="EventsManager.markAsCompleted('${event.id}')" title="تم">✓</button>`
                        }
                        <button class="btn btn-danger btn-sm" onclick="EventsManager.cancelScheduledEvent('${event.id}')" title="إلغاء">×</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('خطأ في تحديث جدول الأحداث القادمة:', error);
        }
    },

    // توليد الأحداث المقترحة
    async generateSuggestedEvents() {
        const suggested = [];
        const today = new Date();
        
        try {
            // جلب جميع الأغنام الحية
            const sheep = await API.sheep.getAll();
            const aliveSheep = sheep.filter(s => s.status === 'موجود');
            
            for (const s of aliveSheep) {
                const events = await API.events.getHistory(s.id);
                
                // اقتراح قص الصوف (كل 6 أشهر)
                const lastShearing = events
                    .filter(e => e.event_type === 'قص صوف')
                    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0];
                
                if (lastShearing) {
                    const daysSinceShearing = Math.ceil((today - new Date(lastShearing.event_date)) / (1000 * 60 * 60 * 24));
                    if (daysSinceShearing > 150) { // أكثر من 5 أشهر
                        const nextDate = new Date(lastShearing.event_date);
                        nextDate.setDate(nextDate.getDate() + 180); // 6 أشهر
                        
                        suggested.push({
                            id: `suggest_shear_${s.id}`,
                            sheepId: s.id,
                            type: 'قص صوف',
                            date: nextDate.toISOString().split('T')[0],
                            notes: 'موعد مقترح لقص الصوف (كل 6 أشهر)',
                            suggested: true
                        });
                    }
                }
                
                // اقتراح التطعيم السنوي
                const lastVaccination = events
                    .filter(e => e.event_type === 'تطعيم')
                    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0];
                
                if (lastVaccination) {
                    const daysSinceVaccination = Math.ceil((today - new Date(lastVaccination.event_date)) / (1000 * 60 * 60 * 24));
                    if (daysSinceVaccination > 330) { // أكثر من 11 شهر
                        const nextDate = new Date(lastVaccination.event_date);
                        nextDate.setDate(nextDate.getDate() + 365); // سنة
                        
                        suggested.push({
                            id: `suggest_vaccine_${s.id}`,
                            sheepId: s.id,
                            type: 'تطعيم',
                            date: nextDate.toISOString().split('T')[0],
                            notes: 'موعد مقترح للتطعيم السنوي',
                            suggested: true
                        });
                    }
                }
            }
        } catch (error) {
            console.error('خطأ في توليد الأحداث المقترحة:', error);
        }
        
        return suggested;
    },

    // تحديث الإحصائيات
    async updateEventStats() {
        try {
            const allEvents = await API.events.getAll();
            const scheduledEvents = await API.scheduledEvents.getAll({ completed: false });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // إجمالي الأحداث
            document.getElementById('totalEventsCount').textContent = allEvents.length;
            
            // أحداث اليوم
            const todayEvents = allEvents.filter(event => {
                const eventDate = new Date(event.event_date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate.getTime() === today.getTime();
            });
            document.getElementById('todayEventsCount').textContent = todayEvents.length;
            
            // الأحداث القادمة (7 أيام)
            const upcomingEvents = scheduledEvents.filter(event => {
                const eventDate = new Date(event.scheduled_date);
                const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                return daysUntil >= 0 && daysUntil <= 7;
            });
            document.getElementById('upcomingEventsCount').textContent = upcomingEvents.length;
            
            // الأحداث المتأخرة
            const overdueEvents = scheduledEvents.filter(event => {
                const eventDate = new Date(event.scheduled_date);
                return eventDate < today;
            });
            document.getElementById('overdueEventsCount').textContent = overdueEvents.length;
            
        } catch (error) {
            console.error('خطأ في تحديث الإحصائيات:', error);
        }
    },

    // فتح نافذة إدارة الأحداث
    async openModal(sheepId) {
        try {
            const sheep = await API.sheep.getOne(sheepId);
            if (!sheep) {
                UI.showAlert('لم يتم العثور على الخروف', 'error');
                return;
            }

            const events = await API.events.getHistory(sheepId);

            const modal = document.getElementById('eventsModal');
            const modalTitle = document.getElementById('eventsModalTitle');
            const modalContent = document.getElementById('eventsModalContent');
            
            modalTitle.textContent = `إدارة أحداث الخروف ${sheepId}`;
            
            let html = `
                <div style="margin-bottom: 20px;">
                    <h3>معلومات الخروف</h3>
                    <p><strong>الجنس:</strong> ${sheep.gender}</p>
                    <p><strong>العمر:</strong> ${Utils.calculateAge(sheep.birth_date)}</p>
                    <p><strong>المرحلة:</strong> ${Utils.determineStage(sheep.birth_date, sheep.gender) || '-'}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h4>إضافة حدث جديد</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div class="form-group">
                            <label for="eventType">نوع الحدث</label>
                            <select id="eventType" required>
                                <option value="">اختر نوع الحدث</option>
                                <option value="قص صوف">قص صوف</option>
                                <option value="علاج">علاج</option>
                                <option value="تطعيم">تطعيم</option>
                                <option value="أخرى">أخرى</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="eventDate">التاريخ</label>
                            <input type="date" id="eventDate" value="${Utils.getCurrentDate()}" required>
                        </div>
                        <div class="form-group">
                            <label for="eventNotes">ملاحظات</label>
                            <input type="text" id="eventNotes" placeholder="ملاحظات اختيارية">
                        </div>
                    </div>
                    <button class="btn btn-success" onclick="EventsManager.addNewEvent('${sheepId}')">إضافة الحدث</button>
                </div>
                
                <h4>تاريخ الأحداث</h4>
            `;
            
            if (events.length > 0) {
                html += `
                    <table class="weight-history-table">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>نوع الحدث</th>
                                <th>الملاحظات</th>
                                <th>العمليات</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                events.forEach((event) => {
                    html += `
                        <tr>
                            <td>${Utils.formatDate(event.event_date)}</td>
                            <td><span class="weight-change ${this.getEventTypeClass(event.event_type)}">${event.event_type}</span></td>
                            <td>${event.notes || '-'}</td>
                            <td>
                                <button class="btn btn-danger btn-sm" onclick="EventsManager.deleteEvent(${event.id}, '${sheepId}')" title="حذف">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                `;
            } else {
                html += '<p style="text-align: center; color: #6c757d;">لا توجد أحداث مسجلة لهذا الخروف</p>';
            }
            
            modalContent.innerHTML = html;
            modal.style.display = 'block';
        } catch (error) {
            console.error('خطأ في فتح نافذة الأحداث:', error);
            UI.showAlert('خطأ في تحميل البيانات', 'error');
        }
    },

    // الحصول على كلاس نوع الحدث
    getEventTypeClass(eventType) {
        const classMap = {
            'قص صوف': 'weight-same',
            'علاج': 'weight-decrease',
            'تطعيم': 'weight-increase',
            'أخرى': ''
        };
        return classMap[eventType] || '';
    },

    // إغلاق النافذة
    closeModal() {
        const modal = document.getElementById('eventsModal');
        modal.style.display = 'none';
    },

    // إضافة حدث جديد
    async addNewEvent(sheepId) {
        try {
            const eventType = document.getElementById('eventType').value;
            const eventDate = document.getElementById('eventDate').value;
            const eventNotes = document.getElementById('eventNotes').value;
            
            if (!eventType || !eventDate) {
                UI.showAlert('يرجى اختيار نوع الحدث والتاريخ', 'error');
                return;
            }
            
            await API.events.add(sheepId, { 
                event_type: eventType, 
                event_date: eventDate, 
                notes: eventNotes 
            });
            
            UI.showAlert('تم إضافة الحدث بنجاح', 'success');
            
            await this.openModal(sheepId);
            
            if (UI.currentTab === 'events') {
                await this.loadEventsData();
            }
            
            await UI.updateDashboard();
        } catch (error) {
            console.error('خطأ في إضافة الحدث:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // حذف حدث
    async deleteEvent(eventId, sheepId) {
        if (confirm('هل أنت متأكد من حذف هذا الحدث؟')) {
            try {
                await API.events.delete(eventId);
                UI.showAlert('تم حذف الحدث بنجاح', 'success');
                
                await this.openModal(sheepId);
                
                if (UI.currentTab === 'events') {
                    await this.loadEventsData();
                }
                
                await UI.updateDashboard();
            } catch (error) {
                console.error('خطأ في حذف الحدث:', error);
                UI.showAlert(error.message, 'error');
            }
        }
    },

    // جدولة حدث لخروف معين
    async scheduleEventForSheep(sheepId) {
        const modal = document.getElementById('scheduleEventModal');
        const selectElement = document.getElementById('scheduleSheepId');
        
        // ملء قائمة الأغنام
        const sheep = await API.sheep.getAll();
        selectElement.innerHTML = '<option value="">اختر الخروف</option>';
        
        sheep.filter(s => s.status === 'موجود').forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = `${s.id} - ${s.gender}`;
            selectElement.appendChild(option);
        });
        
        // تحديد الخروف الحالي
        selectElement.value = sheepId;
        
        modal.style.display = 'block';
    },

    // إغلاق نافذة الجدولة
    closeScheduleModal() {
        const modal = document.getElementById('scheduleEventModal');
        modal.style.display = 'none';
        document.getElementById('scheduleEventForm').reset();
    },

    // حفظ الحدث المجدول
    async saveScheduledEvent(event) {
        event.preventDefault();
        
        try {
            const eventData = {
                sheep_id: document.getElementById('scheduleSheepId').value,
                event_type: document.getElementById('scheduleEventType').value,
                scheduled_date: document.getElementById('scheduleEventDate').value,
                notes: document.getElementById('scheduleEventNotes').value
            };
            
            if (!eventData.sheep_id || !eventData.event_type || !eventData.scheduled_date) {
                UI.showAlert('يرجى ملء جميع الحقول المطلوبة', 'error');
                return;
            }
            
            await API.scheduledEvents.create(eventData);
            
            UI.showAlert('تم جدولة الحدث بنجاح', 'success');
            this.closeScheduleModal();
            
            if (UI.currentTab === 'events') {
                await this.loadEventsData();
            }
        } catch (error) {
            console.error('خطأ في جدولة الحدث:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // وضع علامة تم على حدث مجدول
    async markAsCompleted(eventId) {
        try {
            await API.scheduledEvents.complete(eventId);
            
            UI.showAlert('تم تسجيل الحدث بنجاح', 'success');
            await this.loadEventsData();
        } catch (error) {
            console.error('خطأ في تسجيل الحدث:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // إلغاء حدث مجدول
    async cancelScheduledEvent(eventId) {
        if (confirm('هل أنت متأكد من إلغاء هذا الحدث المجدول؟')) {
            try {
                await API.scheduledEvents.delete(eventId);
                
                UI.showAlert('تم إلغاء الحدث المجدول', 'success');
                await this.loadEventsData();
            } catch (error) {
                console.error('خطأ في إلغاء الحدث:', error);
                UI.showAlert(error.message, 'error');
            }
        }
    },

    // تأكيد حدث مقترح
    async confirmSuggestedEvent(eventId) {
        // استخراج معلومات الحدث المقترح
        const parts = eventId.split('_');
        const type = parts[1]; // shear أو vaccine
        const sheepId = parts[2];
        
        try {
            // حساب التاريخ المقترح
            const today = new Date();
            let scheduledDate;
            
            if (type === 'shear') {
                scheduledDate = new Date();
                scheduledDate.setDate(today.getDate() + 30); // بعد شهر
            } else if (type === 'vaccine') {
                scheduledDate = new Date();
                scheduledDate.setDate(today.getDate() + 30); // بعد شهر
            }
            
            const eventData = {
                sheep_id: sheepId,
                event_type: type === 'shear' ? 'قص صوف' : 'تطعيم',
                scheduled_date: scheduledDate.toISOString().split('T')[0],
                notes: 'حدث مجدول من اقتراح النظام'
            };
            
            await API.scheduledEvents.create(eventData);
            
            UI.showAlert('تم جدولة الحدث المقترح بنجاح', 'success');
            await this.loadEventsData();
        } catch (error) {
            console.error('خطأ في تأكيد الحدث المقترح:', error);
            UI.showAlert('خطأ في جدولة الحدث', 'error');
        }
    },

    // فلترة الأحداث
    async filterEvents() {
        const eventType = document.getElementById('eventTypeFilter').value;
        const searchTerm = document.getElementById('eventSearchInput').value;
        
        if (searchTerm) {
            await this.loadEventsData(searchTerm);
        } else {
            await this.loadEventsData();
        }
    },

    // إعداد البحث
    setupSearch() {
        const eventSearchInput = document.getElementById('eventSearchInput');
        if (eventSearchInput) {
            let eventSearchTimeout;
            eventSearchInput.addEventListener('input', (e) => {
                clearTimeout(eventSearchTimeout);
                eventSearchTimeout = setTimeout(async () => {
                    const searchTerm = e.target.value;
                    await this.loadEventsData(searchTerm);
                }, 300);
            });
        }
    },

    // إعداد النماذج
    setupForms() {
        const scheduleForm = document.getElementById('scheduleEventForm');
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', (e) => this.saveScheduledEvent(e));
        }
    },

    // تهيئة المكون
    async initialize() {
        console.log('📅 تهيئة مكون الأحداث...');
        this.setupSearch();
        this.setupForms();
        
        // إضافة زر جدولة عائم
        const floatingButton = document.createElement('button');
        floatingButton.className = 'btn btn-success schedule-button';
        floatingButton.innerHTML = '📅 جدولة حدث جديد';
        floatingButton.onclick = () => this.scheduleEventForSheep('');
        
        // إضافة الزر فقط في صفحة الأحداث
        if (UI.currentTab === 'events') {
            const existingButton = document.querySelector('.schedule-button');
            if (!existingButton) {
                document.body.appendChild(floatingButton);
            }
        }
        
        console.log('✅ تم تهيئة مكون الأحداث');
    }
};