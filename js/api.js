// api.js - API بدعم المصادقة

const API = {
    // Helper function للطلبات مع المصادقة
    async request(endpoint, options = {}) {
        try {
            // إضافة رمز المصادقة إذا كان موجوداً
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            // إضافة رمز المصادقة من AuthManager
            if (typeof AuthManager !== 'undefined' && AuthManager.token) {
                headers['Authorization'] = `Bearer ${AuthManager.token}`;
            }
            
            const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                // معالجة أخطاء المصادقة
                if (response.status === 401 || response.status === 403) {
                    if (typeof AuthManager !== 'undefined') {
                        AuthManager.handleUnauthorized();
                    }
                }
                
                const error = await response.json().catch(() => ({ error: 'خطأ في الخادم' }));
                throw new Error(error.error || `خطأ: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // API للأغنام
    sheep: {
        async getAll() {
            return await API.request('/sheep');
        },

        async getOne(id) {
            return await API.request(`/sheep/${id}`);
        },

        async create(data) {
            return await API.request('/sheep', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async update(id, data) {
            return await API.request(`/sheep/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/sheep/${id}`, {
                method: 'DELETE'
            });
        }
    },

    // API للحظائر
    pens: {
        async getAll() {
            return await API.request('/pens');
        },

        async getOne(id) {
            return await API.request(`/pens/${id}`);
        },

        async create(data) {
            return await API.request('/pens', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async update(id, data) {
            return await API.request(`/pens/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/pens/${id}`, {
                method: 'DELETE'
            });
        },

        async getFeedCalculation(id) {
            return await API.request(`/pens/${id}/feed-calculation`);
        }
    },

    // API للأوزان
    weights: {
        async getHistory(sheepId) {
            return await API.request(`/sheep/${sheepId}/weights`);
        },

        async add(sheepId, data) {
            return await API.request(`/sheep/${sheepId}/weight`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/weights/${id}`, {
                method: 'DELETE'
            });
        }
    },

    // API للأحداث
    events: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return await API.request(`/events${queryString ? '?' + queryString : ''}`);
        },

        async getBySheep(sheepId) {
            return await API.request(`/sheep/${sheepId}/events`);
        },

        async add(sheepId, data) {
            return await API.request(`/sheep/${sheepId}/event`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/events/${id}`, {
                method: 'DELETE'
            });
        }
    },

    // API للأحداث المجدولة
    scheduledEvents: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return await API.request(`/scheduled-events${queryString ? '?' + queryString : ''}`);
        },

        async create(data) {
            return await API.request('/scheduled-events', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async update(id, data) {
            return await API.request(`/scheduled-events/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/scheduled-events/${id}`, {
                method: 'DELETE'
            });
        },

        async complete(id) {
            return await API.request(`/scheduled-events/${id}/complete`, {
                method: 'POST'
            });
        }
    },

    // API للحمل
    pregnancies: {
        async getAll() {
            return await API.request('/pregnancies');
        },

        async getBySheep(sheepId) {
            return await API.request(`/sheep/${sheepId}/pregnancies`);
        },

        async create(data) {
            return await API.request('/pregnancies', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async update(id, data) {
            return await API.request(`/pregnancies/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/pregnancies/${id}`, {
                method: 'DELETE'
            });
        }
    },

    // API للإحصائيات
    stats: {
        async get() {
            return await API.request('/stats');
        },

        async getProduction() {
            return await API.request('/production-stats');
        }
    },

    // API للمعاملات المالية
    transactions: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return await API.request(`/transactions${queryString ? '?' + queryString : ''}`);
        },

        async create(data) {
            return await API.request('/transactions', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async update(id, data) {
            return await API.request(`/transactions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(id) {
            return await API.request(`/transactions/${id}`, {
                method: 'DELETE'
            });
        },

        async getSummary(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return await API.request(`/transactions/summary${queryString ? '?' + queryString : ''}`);
        }
    },

    // API لإعدادات العلف
    feedSettings: {
        async getAll() {
            return await API.request('/feed-settings');
        },

        async update(stage, data) {
            return await API.request(`/feed-settings/${stage}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }
    },

    // API لأنواع العلف
    feedTypes: {
        async getAll() {
            return await API.request('/feed-types');
        },

        async create(data) {
            return await API.request('/feed-types', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    },

    // API لخطط الوجبات
    mealPlans: {
        async getByPen(penId) {
            return await API.request(`/pens/${penId}/meal-plans`);
        },

        async save(penId, data) {
            return await API.request(`/pens/${penId}/meal-plans`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async getDetailedCalculation(penId) {
            return await API.request(`/pens/${penId}/detailed-feed-calculation`);
        }
    },

    // API لمسح البيانات
    data: {
        async clearAll() {
            return await API.request('/clear-all', {
                method: 'DELETE'
            });
        },

        async getInitialData() {
            return await API.request('/initial-data');
        }
    }
};