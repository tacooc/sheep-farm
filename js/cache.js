// cache.js - نظام التخزين المؤقت وإدارة الحالة المركزية

const CacheManager = {
    // مخزن البيانات المركزي
    store: {
        sheep: null,
        pens: null,
        weights: {},
        events: {},
        pregnancies: null,
        stats: null,
        feedSettings: null,
        feedTypes: null,
        transactions: null,
        lastUpdate: {}
    },

    // مدة صلاحية البيانات المخزنة (بالدقائق)
    TTL: {
        sheep: 5,
        pens: 10,
        weights: 5,
        events: 5,
        pregnancies: 5,
        stats: 2,
        feedSettings: 30,
        feedTypes: 30,
        transactions: 5
    },

    // التحقق من صلاحية البيانات المخزنة
    isValid(key) {
        if (!this.store.lastUpdate[key]) return false;
        
        const now = Date.now();
        const lastUpdate = this.store.lastUpdate[key];
        const ttl = this.TTL[key] * 60 * 1000; // تحويل إلى ميلي ثانية
        
        return (now - lastUpdate) < ttl;
    },

    // جلب البيانات مع التخزين المؤقت
    async get(key, fetchFunction, forceRefresh = false) {
        // إذا كانت البيانات صالحة وغير مطلوب التحديث القسري
        if (!forceRefresh && this.isValid(key) && this.store[key]) {
            console.log(`📦 استخدام البيانات المخزنة لـ: ${key}`);
            return this.store[key];
        }

        // جلب البيانات الجديدة
        console.log(`🔄 جلب بيانات جديدة لـ: ${key}`);
        try {
            const data = await fetchFunction();
            this.store[key] = data;
            this.store.lastUpdate[key] = Date.now();
            return data;
        } catch (error) {
            console.error(`خطأ في جلب ${key}:`, error);
            // إرجاع البيانات القديمة إن وجدت
            if (this.store[key]) {
                console.log(`⚠️ استخدام البيانات القديمة لـ: ${key}`);
                return this.store[key];
            }
            throw error;
        }
    },

    // جلب بيانات الأوزان لخروف معين
    async getWeights(sheepId, forceRefresh = false) {
        const cacheKey = `weights_${sheepId}`;
        
        if (!forceRefresh && this.store.weights[sheepId] && this.isValid(cacheKey)) {
            return this.store.weights[sheepId];
        }

        const weights = await API.weights.getHistory(sheepId);
        this.store.weights[sheepId] = weights;
        this.store.lastUpdate[cacheKey] = Date.now();
        return weights;
    },

    // جلب بيانات الأحداث لخروف معين
    async getEvents(sheepId, forceRefresh = false) {
        const cacheKey = `events_${sheepId}`;
        
        if (!forceRefresh && this.store.events[sheepId] && this.isValid(cacheKey)) {
            return this.store.events[sheepId];
        }

        const events = await API.events.getHistory(sheepId);
        this.store.events[sheepId] = events;
        this.store.lastUpdate[cacheKey] = Date.now();
        return events;
    },

    // تحديث عنصر واحد في المخزن
    updateItem(key, id, data) {
        if (!this.store[key]) return;

        if (Array.isArray(this.store[key])) {
            const index = this.store[key].findIndex(item => item.id === id);
            if (index !== -1) {
                this.store[key][index] = { ...this.store[key][index], ...data };
            }
        }
    },

    // إضافة عنصر جديد
    addItem(key, item) {
        if (!this.store[key] || !Array.isArray(this.store[key])) return;
        
        this.store[key].unshift(item);
    },

    // حذف عنصر
    removeItem(key, id) {
        if (!this.store[key] || !Array.isArray(this.store[key])) return;
        
        this.store[key] = this.store[key].filter(item => item.id !== id);
    },

    // مسح مخزن معين
    clear(key) {
        if (key) {
            this.store[key] = null;
            delete this.store.lastUpdate[key];
        } else {
            // مسح كل المخزن
            this.store = {
                sheep: null,
                pens: null,
                weights: {},
                events: {},
                pregnancies: null,
                stats: null,
                feedSettings: null,
                feedTypes: null,
                transactions: null,
                lastUpdate: {}
            };
        }
    },

    // جلب بيانات متعددة بشكل متوازي
    async getMultiple(requests) {
        const promises = requests.map(({ key, fetchFunction, forceRefresh }) => 
            this.get(key, fetchFunction, forceRefresh)
        );
        
        return await Promise.all(promises);
    },

    // التحميل المسبق للبيانات الأساسية
    async preloadEssentialData() {
        console.log('🚀 بدء التحميل المسبق للبيانات الأساسية...');
        
        try {
            await this.getMultiple([
                { key: 'sheep', fetchFunction: () => API.sheep.getAll() },
                { key: 'pens', fetchFunction: () => API.pens.getAll() },
                { key: 'stats', fetchFunction: () => API.stats.get() },
                { key: 'feedTypes', fetchFunction: () => API.feedTypes.getAll() }
            ]);
            
            console.log('✅ تم تحميل البيانات الأساسية');
        } catch (error) {
            console.error('خطأ في التحميل المسبق:', error);
        }
    }
};

// نظام تجميع الطلبات (Request Batching)
const BatchManager = {
    queues: {},
    timers: {},
    batchDelay: 50, // ميلي ثانية

    // إضافة طلب إلى قائمة الانتظار
    add(type, id, resolver) {
        if (!this.queues[type]) {
            this.queues[type] = new Map();
        }

        this.queues[type].set(id, resolver);

        // إلغاء المؤقت السابق وبدء جديد
        clearTimeout(this.timers[type]);
        this.timers[type] = setTimeout(() => this.process(type), this.batchDelay);
    },

    // معالجة قائمة الانتظار
    async process(type) {
        const queue = this.queues[type];
        if (!queue || queue.size === 0) return;

        const ids = Array.from(queue.keys());
        console.log(`🔄 معالجة ${ids.length} طلب من نوع ${type}`);

        try {
            let results;
            
            switch (type) {
                case 'weights':
                    results = await this.batchFetchWeights(ids);
                    break;
                case 'events':
                    results = await this.batchFetchEvents(ids);
                    break;
                default:
                    throw new Error(`نوع غير مدعوم: ${type}`);
            }

            // توزيع النتائج
            ids.forEach((id, index) => {
                const resolver = queue.get(id);
                if (resolver) {
                    resolver(results[index]);
                }
            });

        } catch (error) {
            // في حالة الخطأ، رفض جميع الطلبات
            queue.forEach(resolver => resolver(Promise.reject(error)));
        }

        // تنظيف قائمة الانتظار
        this.queues[type].clear();
    },

    // جلب أوزان متعددة دفعة واحدة
    async batchFetchWeights(sheepIds) {
        // هنا يمكن إضافة endpoint في الخادم لجلب أوزان متعددة
        // حالياً سنستخدم Promise.all للتوضيح
        const promises = sheepIds.map(id => API.weights.getHistory(id));
        return await Promise.all(promises);
    },

    // جلب أحداث متعددة دفعة واحدة
    async batchFetchEvents(sheepIds) {
        const promises = sheepIds.map(id => API.events.getHistory(id));
        return await Promise.all(promises);
    }
};

// مدير التحميل الذكي
const SmartLoader = {
    loadingStates: new Set(),
    
    // بدء تحميل مع منع التكرار
    async load(key, loadFunction) {
        if (this.loadingStates.has(key)) {
            console.log(`⏳ ${key} قيد التحميل بالفعل`);
            return;
        }

        this.loadingStates.add(key);
        
        try {
            await loadFunction();
        } finally {
            this.loadingStates.delete(key);
        }
    },

    // التحقق من حالة التحميل
    isLoading(key) {
        return this.loadingStates.has(key);
    }
};

// تحسين أداء الجداول باستخدام Virtual Scrolling
const VirtualTable = {
    renderChunk(data, startIndex, endIndex) {
        return data.slice(startIndex, endIndex);
    },

    // حساب العناصر المرئية
    calculateVisibleRange(scrollTop, containerHeight, itemHeight) {
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
        return { startIndex, endIndex };
    }
};