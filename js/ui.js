// ui.js - واجهة المستخدم

const UI = {
    // حالة التطبيق
    currentTab: 'dashboard',
    
    // إظهار مؤشر التحميل
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    },

    // إخفاء مؤشر التحميل
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    },

    // عرض رسالة تنبيه
    showAlert(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            alert(message);
            return;
        }

        let alertClass = 'alert-info';
        switch(type) {
            case 'success':
                alertClass = 'alert-success';
                break;
            case 'error':
                alertClass = 'alert-error';
                break;
            case 'warning':
                alertClass = 'alert-warning';
                break;
            case 'info':
                alertClass = 'alert-info';
                break;
        }
        
        alertContainer.innerHTML = `
            <div class="alert ${alertClass} fade-in">
                ${message}
                <button onclick="UI.closeAlert()" style="float: left; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
            </div>
        `;
        
        // مدة العرض حسب نوع الرسالة
        const duration = type === 'error' ? 8000 : 5000;
        
        setTimeout(() => {
            this.closeAlert();
        }, duration);
    },

    // إغلاق رسالة التنبيه
    closeAlert() {
        const alertContainer = document.getElementById('alertContainer');
        if (alertContainer) {
            alertContainer.innerHTML = '';
        }
    },

    // تبديل التبويبات
    async showTab(tabName, event) {
        console.log('تبديل إلى تبويب:', tabName);
        
        try {
            // إخفاء جميع التبويبات
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            
            // إخفاء جميع أزرار التبويبات
            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
            
            // إظهار التبويب المحدد
            const selectedTab = document.getElementById(tabName);
            if (selectedTab) {
                selectedTab.classList.add('active');
                this.currentTab = tabName;
            }
            
            // تفعيل زر التبويب الصحيح
            if (event && event.target) {
                event.target.classList.add('active');
            } else {
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(tabName)) {
                        tab.classList.add('active');
                    }
                });
            }
            
            // تحديث المحتوى
            switch (tabName) {
                case 'dashboard':
                    await this.updateDashboard();
                    break;
                case 'manage':
                    await SheepManager.loadSheepData();
                    break;
                case 'pens':
                    await PensManager.loadPens();
                    break;
                case 'weights':
                    await WeightManager.loadWeightsData();
                    break;
                case 'pregnancy':
                    await PregnancyManager.loadPregnancyData();
                    break;
                case 'production':
                    await ProductionManager.loadProductionData();
                    break;
                case 'events':
                    await EventsManager.loadEventsData();
                    break;
                case 'finance':
                    await FinanceManager.loadTransactions();
                    break;
                case 'reports':
                    await Reports.updateReports();
                    break;
                case 'add':
                    await SheepManager.populateMotherOptions();
                    break;
                case 'sheepCard':
                    await SheepCard.initialize();
                    break;    
            }
            
            // حفظ التبويب الحالي في localStorage
            localStorage.setItem('currentTab', tabName);
            
        } catch (error) {
            console.error('خطأ في تبديل التبويب:', error);
        }
    },

    // تحديث لوحة التحكم
    async updateDashboard() {
        try {
            const stats = await API.stats.get();
            const pregnancies = await API.pregnancies.getAll();
            const allSheep = await API.sheep.getAll();
            const pens = await API.pens.getAll();
            
            // حساب إحصائيات الحمل
            const pregnantCount = pregnancies.filter(p => !p.actual_birth_date).length;
            const today = new Date();
            const upcomingBirths = pregnancies.filter(p => {
                if (p.actual_birth_date) return false;
                const expectedDate = new Date(p.expected_birth_date);
                const daysUntil = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24));
                return daysUntil >= 0 && daysUntil <= 7;
            }).length;
            
            // حساب الأمهات والفحول
            const mothersCount = allSheep.filter(sheep => 
                sheep.gender === 'أنثى' && 
                sheep.status === 'موجود' &&
                Utils.determineStage(sheep.birth_date, sheep.gender) === 'كبير السن'
            ).length;
            
            const ramsCount = allSheep.filter(sheep => 
                sheep.gender === 'ذكر' && 
                sheep.status === 'موجود' &&
                Utils.determineStage(sheep.birth_date, sheep.gender) === 'كبير السن'
            ).length;
            
            const elements = {
                totalSheep: stats.total,
                aliveSheep: stats.alive,
                maleCount: stats.male,
                femaleCount: stats.female,
                deadCount: stats.dead,
                soldCount: stats.sold,
                mothersCount: mothersCount,
                ramsCount: ramsCount,
                pregnantCount: pregnantCount,
                upcomingBirths: upcomingBirths
            };
            
            for (const [id, value] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value || 0;
                }
            }
            
            // إضافة معلومات إضافية في لوحة التحكم
            await this.updateDashboardExtras(pens);
            
            console.log('تم تحديث لوحة التحكم');
        } catch (error) {
            console.error('خطأ في تحديث لوحة التحكم:', error);
        }
    },

    // تحديث المعلومات الإضافية في لوحة التحكم
    async updateDashboardExtras(pens) {
        try {
            // حساب إجمالي احتياجات العلف اليومية
            let totalDailyFeed = 0;
            
            for (const pen of pens) {
                if (pen.sheep_count > 0) {
                    try {
                        const feedCalc = await API.pens.getFeedCalculation(pen.id);
                        totalDailyFeed += feedCalc.total_daily_feed_kg;
                    } catch (error) {
                        console.error('خطأ في حساب العلف للحظيرة:', pen.id, error);
                    }
                }
            }
            
            // عرض إجمالي احتياجات العلف إذا وجد عنصر لذلك
            const feedElement = document.getElementById('totalDailyFeed');
            if (feedElement) {
                feedElement.textContent = totalDailyFeed.toFixed(2) + ' كجم';
            }
            
            // عرض عدد الحظائر
            const pensElement = document.getElementById('totalPens');
            if (pensElement) {
                pensElement.textContent = pens.length;
            }
            
        } catch (error) {
            console.error('خطأ في تحديث المعلومات الإضافية:', error);
        }
    },

    // إعداد أحداث النوافذ المنبثقة
    setupModalEvents() {
        window.onclick = function(event) {
            const modals = [
                { id: 'weightModal', closeFunc: () => WeightManager.closeModal() },
                { id: 'eventsModal', closeFunc: () => EventsManager.closeModal() },
                { id: 'pregnancyModal', closeFunc: () => PregnancyManager.closeModal() },
                { id: 'financeModal', closeFunc: () => FinanceManager.closeModal() },
                { id: 'penModal', closeFunc: () => PensManager.closeModal() },
                { id: 'penDetailsModal', closeFunc: () => PensManager.closePenDetailsModal() },
                { id: 'feedSettingsModal', closeFunc: () => PensManager.closeFeedSettingsModal() },
                { id: 'feedTypesModal', closeFunc: () => PensManager.closeFeedTypesModal() },
                { id: 'batchPenModal', closeFunc: () => BatchPenManager.closeBatchPenModal() },
                { id: 'quickTransferModal', closeFunc: () => QuickPenTransfer.closeModal() }
            ];
            
            modals.forEach(modal => {
                const element = document.getElementById(modal.id);
                if (event.target === element) {
                    modal.closeFunc();
                }
            });
        };
        
        // إضافة مستمع لإغلاق النوافذ بالضغط على Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // إغلاق أي نافذة مفتوحة
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    },

    // استعادة آخر تبويب محفوظ
    restoreLastTab() {
        const lastTab = localStorage.getItem('currentTab');
        if (lastTab && lastTab !== 'dashboard') {
            setTimeout(() => {
                this.showTab(lastTab);
            }, 500);
        }
    },

    // تصدير تقرير PDF (مستقبلي)
    async exportPDF(title, content) {
        // يمكن إضافة مكتبة PDF مستقبلاً
        console.log('ميزة تصدير PDF قيد التطوير');
        this.showAlert('ميزة تصدير PDF قيد التطوير حالياً', 'info');
    },

    // وظيفة مساعدة لتنسيق الأرقام
    formatNumber(number) {
        return new Intl.NumberFormat('ar-SA').format(number);
    },

    // وظيفة مساعدة لتنسيق العملة
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR'
        }).format(amount);
    }
};