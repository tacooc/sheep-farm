// ui-optimized.js - واجهة مستخدم محسنة مع تقليل التحديثات المتكررة

const OptimizedUI = {
    // حالة التطبيق
    currentTab: 'dashboard',
    loadingCount: 0,
    updateQueue: new Set(),
    updateTimer: null,
    
    // إظهار مؤشر التحميل مع عداد
    showLoading() {
        this.loadingCount++;
        if (this.loadingCount === 1) {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
            }
        }
    },

    // إخفاء مؤشر التحميل مع عداد
    hideLoading() {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
        if (this.loadingCount === 0) {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 300);
            }
        }
    },

    // تبديل التبويبات المحسن
    async showTab(tabName, event) {
        console.log('تبديل إلى تبويب:', tabName);
        
        // منع إعادة تحميل نفس التبويب
        if (this.currentTab === tabName) {
            console.log('التبويب محمل بالفعل');
            return;
        }
        
        try {
            // إخفاء جميع التبويبات
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
            
            // إظهار التبويب المحدد
            const selectedTab = document.getElementById(tabName);
            if (selectedTab) {
                selectedTab.classList.add('active');
                this.currentTab = tabName;
            }
            
            // تفعيل زر التبويب
            if (event && event.target) {
                event.target.classList.add('active');
            } else {
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(tabName)) {
                        tab.classList.add('active');
                    }
                });
            }
            
            // تحديث المحتوى بذكاء
            await this.loadTabContent(tabName);
            
            // حفظ التبويب الحالي
            localStorage.setItem('currentTab', tabName);
            
        } catch (error) {
            console.error('خطأ في تبديل التبويب:', error);
        }
    },

    // تحميل محتوى التبويب بذكاء
    async loadTabContent(tabName) {
        // استخدام SmartLoader لمنع التحميل المتكرر
        await SmartLoader.load(`tab_${tabName}`, async () => {
            switch (tabName) {
                case 'dashboard':
                    await this.updateDashboardOptimized();
                    break;
                case 'manage':
                    await this.loadSheepTableOptimized();
                    break;
                case 'pens':
                    await PensManager.loadPens();
                    break;
                case 'weights':
                    await this.loadWeightsOptimized();
                    break;
                case 'pregnancy':
                    await PregnancyManager.loadPregnancyData();
                    break;
                case 'production':
                    await ProductionManager.loadProductionData();
                    break;
                case 'events':
                    await this.loadEventsOptimized();
                    break;
                case 'finance':
                    await FinanceManager.loadTransactions();
                    break;
                case 'reports':
                    await Reports.updateReports();
                    break;
                case 'add':
                    await SheepManager.populateMotherOptions();
                    await SheepManager.populatePenOptions();
                    break;
                case 'sheepCard':
                    await SheepCard.initialize();
                    break;
            }
        });
    },

    // تحديث لوحة التحكم المحسن
    async updateDashboardOptimized() {
        try {
            this.showLoading();
            
            // جلب البيانات بشكل متوازي
            const [stats, pregnancies, sheep, pens] = await Promise.all([
                CacheManager.get('stats', () => API.stats.get()),
                CacheManager.get('pregnancies', () => API.pregnancies.getAll()),
                CacheManager.get('sheep', () => API.sheep.getAll()),
                CacheManager.get('pens', () => API.pens.getAll())
            ]);
            
            // حساب الإحصائيات
            const pregnantCount = pregnancies.filter(p => !p.actual_birth_date).length;
            const today = new Date();
            const upcomingBirths = pregnancies.filter(p => {
                if (p.actual_birth_date) return false;
                const expectedDate = new Date(p.expected_birth_date);
                const daysUntil = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24));
                return daysUntil >= 0 && daysUntil <= 7;
            }).length;
            
            const mothersCount = sheep.filter(s => 
                s.gender === 'أنثى' && 
                s.status === 'موجود' &&
                Utils.determineStage(s.birth_date, s.gender) === 'كبير السن'
            ).length;
            
            const ramsCount = sheep.filter(s => 
                s.gender === 'ذكر' && 
                s.status === 'موجود' &&
                Utils.determineStage(s.birth_date, s.gender) === 'كبير السن'
            ).length;
            
            // تحديث العناصر دفعة واحدة
            requestAnimationFrame(() => {
                this.updateElements({
                    totalSheep: stats.total,
                    aliveSheep: stats.alive,
                    maleCount: stats.male,
                    femaleCount: stats.female,
                    deadCount: stats.dead,
                    soldCount: stats.sold,
                    mothersCount: mothersCount,
                    ramsCount: ramsCount,
                    pregnantCount: pregnantCount,
                    upcomingBirths: upcomingBirths,
                    totalPens: pens.length
                });
            });
            
            // حساب العلف بشكل غير متزامن
            this.updateFeedCalculationAsync(pens);
            
        } catch (error) {
            console.error('خطأ في تحديث لوحة التحكم:', error);
        } finally {
            this.hideLoading();
        }
    },

    // تحديث العناصر دفعة واحدة
    updateElements(updates) {
        for (const [id, value] of Object.entries(updates)) {
            const element = document.getElementById(id);
            if (element && element.textContent !== String(value)) {
                element.textContent = value || 0;
            }
        }
    },

    // حساب العلف بشكل غير متزامن
    async updateFeedCalculationAsync(pens) {
        let totalDailyFeed = 0;
        
        // حساب العلف لكل حظيرة بشكل متوازي
        const feedCalculations = await Promise.all(
            pens.filter(pen => pen.sheep_count > 0).map(async pen => {
                try {
                    const feedCalc = await API.pens.getFeedCalculation(pen.id);
                    return feedCalc.total_daily_feed_kg;
                } catch (error) {
                    console.error(`خطأ في حساب العلف للحظيرة ${pen.id}:`, error);
                    return 0;
                }
            })
        );
        
        totalDailyFeed = feedCalculations.reduce((sum, feed) => sum + feed, 0);
        
        // تحديث العنصر
        requestAnimationFrame(() => {
            const feedElement = document.getElementById('totalDailyFeed');
            if (feedElement) {
                feedElement.textContent = totalDailyFeed.toFixed(2) + ' كجم';
            }
        });
    },

    // تحميل جدول الأغنام المحسن
    async loadSheepTableOptimized() {
        try {
            this.showLoading();
            
            const sheep = await CacheManager.get('sheep', () => API.sheep.getAll());
            
            const tbody = document.getElementById('sheepTableBody');
            if (!tbody) return;
            
            // استخدام DocumentFragment لتحسين الأداء
            const fragment = document.createDocumentFragment();
            
            if (sheep.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td colspan="14" style="text-align: center; padding: 40px;">
                        لا توجد بيانات للعرض
                    </td>
                `;
                fragment.appendChild(row);
            } else {
                // عرض أول 50 فقط ثم تحميل الباقي تدريجياً
                const firstBatch = sheep.slice(0, 50);
                firstBatch.forEach(s => {
                    const row = this.createSheepRow(s);
                    fragment.appendChild(row);
                });
            }
            
            tbody.innerHTML = '';
            tbody.appendChild(fragment);
            
            // تحميل الباقي بشكل غير متزامن
            if (sheep.length > 50) {
                this.loadRemainingRowsAsync(sheep.slice(50), tbody);
            }
            
        } catch (error) {
            console.error('خطأ في تحميل جدول الأغنام:', error);
        } finally {
            this.hideLoading();
        }
    },

    // إنشاء صف خروف
    createSheepRow(sheep) {
        const row = document.createElement('tr');
        const age = sheep.birth_date ? Utils.calculateAgeShort(sheep.birth_date) : '-';
        const currentWeight = sheep.current_weight || sheep.weight || '-';
        
        row.innerHTML = `
            <td>${sheep.id}</td>
            <td>${age}</td>
            <td>${sheep.gender}</td>
            <td>${sheep.mother || '-'}</td>
            <td>${currentWeight} ${currentWeight !== '-' ? 'كجم' : ''}</td>
            <td>${Utils.formatDate(sheep.birth_date)}</td>
            <td>${Utils.formatDate(sheep.purchase_date)}</td>
            <td>${sheep.stage || '-'}</td>
            <td>${sheep.birth_count || 0}</td>
            <td>${sheep.pen || '-'}</td>
            <td>${Utils.formatDate(sheep.death_date)}</td>
            <td>${Utils.formatDate(sheep.sale_date)}</td>
            <td>
                <span class="status-${sheep.status === 'موجود' ? 'alive' : sheep.status === 'متوفي' ? 'dead' : 'sold'}">
                    ${sheep.status}
                </span>
            </td>
            <td>
                <button class="btn btn-info btn-sm" onclick="SheepManager.editSheep('${sheep.id}')" title="تعديل">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="SheepManager.deleteSheep('${sheep.id}')" title="حذف">🗑️</button>
            </td>
        `;
        
        return row;
    },

    // تحميل الصفوف المتبقية بشكل غير متزامن
    async loadRemainingRowsAsync(remainingSheep, tbody) {
        const batchSize = 50;
        let currentIndex = 0;
        
        const loadBatch = () => {
            const batch = remainingSheep.slice(currentIndex, currentIndex + batchSize);
            const fragment = document.createDocumentFragment();
            
            batch.forEach(sheep => {
                const row = this.createSheepRow(sheep);
                fragment.appendChild(row);
            });
            
            tbody.appendChild(fragment);
            currentIndex += batchSize;
            
            if (currentIndex < remainingSheep.length) {
                requestAnimationFrame(loadBatch);
            }
        };
        
        requestAnimationFrame(loadBatch);
    },

    // تحميل الأوزان المحسن
    async loadWeightsOptimized() {
        try {
            this.showLoading();
            
            const sheep = await CacheManager.get('sheep', () => API.sheep.getAll());
            const tbody = document.getElementById('weightsTableBody');
            
            if (!tbody) return;
            
            const fragment = document.createDocumentFragment();
            
            // عرض الأغنام أولاً بدون الأوزان
            sheep.forEach(s => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${s.id}</td>
                    <td>${s.gender}</td>
                    <td>${s.current_weight || s.weight || '-'} ${s.weight ? 'كجم' : ''}</td>
                    <td>جاري التحميل...</td>
                    <td>جاري التحميل...</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="WeightManager.openModal('${s.id}')" title="إدارة الأوزان">⚖️</button>
                    </td>
                `;
                row.id = `weight-row-${s.id}`;
                fragment.appendChild(row);
            });
            
            tbody.innerHTML = '';
            tbody.appendChild(fragment);
            
            // تحميل تفاصيل الأوزان بشكل غير متزامن
            this.loadWeightDetailsAsync(sheep);
            
        } catch (error) {
            console.error('خطأ في تحميل الأوزان:', error);
        } finally {
            this.hideLoading();
        }
    },

    // تحميل تفاصيل الأوزان بشكل غير متزامن
    async loadWeightDetailsAsync(sheep) {
        for (const s of sheep) {
            try {
                const weights = await CacheManager.getWeights(s.id);
                const row = document.getElementById(`weight-row-${s.id}`);
                
                if (row) {
                    const lastWeight = weights.length > 0 ? weights[weights.length - 1] : null;
                    const lastDate = lastWeight ? Utils.formatDate(lastWeight.date) : '-';
                    
                    row.cells[3].textContent = lastDate;
                    row.cells[4].textContent = weights.length;
                }
            } catch (error) {
                console.error(`خطأ في تحميل أوزان ${s.id}:`, error);
            }
        }
    },

    // تحميل الأحداث المحسن
    async loadEventsOptimized() {
        try {
            this.showLoading();
            
            const sheep = await CacheManager.get('sheep', () => API.sheep.getAll());
            const tbody = document.getElementById('eventsTableBody');
            
            if (!tbody) return;
            
            // عرض الجدول الأساسي أولاً
            const fragment = document.createDocumentFragment();
            
            sheep.forEach(s => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${s.id}</td>
                    <td>${s.gender}</td>
                    <td>جاري التحميل...</td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="EventsManager.openModal('${s.id}')" title="إدارة الأحداث">📋</button>
                        <button class="btn btn-success btn-sm" onclick="EventsManager.scheduleEventForSheep('${s.id}')" title="جدولة حدث">📅</button>
                    </td>
                `;
                row.id = `event-row-${s.id}`;
                fragment.appendChild(row);
            });
            
            tbody.innerHTML = '';
            tbody.appendChild(fragment);
            
            // تحميل تفاصيل الأحداث بشكل غير متزامن
            this.loadEventDetailsAsync(sheep);
            
            // تحديث الجداول الأخرى بشكل منفصل
            Promise.all([
                EventsManager.updatePastEventsTable(),
                EventsManager.updateUpcomingEventsTable(),
                EventsManager.updateEventStats()
            ]);
            
        } catch (error) {
            console.error('خطأ في تحميل الأحداث:', error);
        } finally {
            this.hideLoading();
        }
    },

    // تحميل تفاصيل الأحداث بشكل غير متزامن
    async loadEventDetailsAsync(sheep) {
        for (const s of sheep) {
            try {
                const events = await CacheManager.getEvents(s.id);
                const row = document.getElementById(`event-row-${s.id}`);
                
                if (row) {
                    const latestEvent = events.length > 0 ? events[0] : null;
                    
                    row.cells[2].textContent = events.length;
                    row.cells[3].textContent = latestEvent ? latestEvent.event_type : '-';
                    row.cells[4].textContent = latestEvent ? Utils.formatDate(latestEvent.event_date) : '-';
                }
            } catch (error) {
                console.error(`خطأ في تحميل أحداث ${s.id}:`, error);
            }
        }
    }
};

// استبدال UI القديم بالمحسن
window.UI = OptimizedUI;