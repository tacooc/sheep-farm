// api-optimized.js - نسخة محسنة من API مع دعم التخزين المؤقت والطلبات المجمعة


// تحديث جميع الطلبات لتضمين رمز المصادقة
const originalRequest = OptimizedAPI.request || API.request;

API.request = async function(endpoint, options = {}) {
    // إضافة رمز المصادقة تلقائياً
    if (AuthManager.token) {
        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = `Bearer ${AuthManager.token}`;
    }
    
    try {
        const response = await originalRequest.call(this, endpoint, options);
        return response;
    } catch (error) {
        // معالجة أخطاء المصادقة
        if (error.status === 401 || error.status === 403) {
            AuthManager.handleUnauthorized();
        }
        throw error;
    }
};

const OptimizedAPI = {
    // طلب عام محسّن مع إدارة أفضل للأخطاء
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // timeout 30 ثانية

        try {
            const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal,
                ...options
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'خطأ في الاتصال بالخادم');
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeout);
            
            if (error.name === 'AbortError') {
                throw new Error('انتهت مهلة الطلب - تحقق من اتصال الشبكة');
            }
            
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // وظائف الأغنام المحسنة
    sheep: {
        async getAll(useCache = true) {
            if (useCache) {
                return await CacheManager.get('sheep', async () => {
                    return await OptimizedAPI.request('/sheep');
                });
            }
            return await OptimizedAPI.request('/sheep');
        },
        
        async getOne(id) {
            // محاولة الحصول من المخزن أولاً
            const cachedSheep = CacheManager.store.sheep?.find(s => s.id === id);
            if (cachedSheep) {
                return cachedSheep;
            }
            
            return await OptimizedAPI.request(`/sheep/${id}`);
        },
        
        async create(data) {
            const result = await OptimizedAPI.request('/sheep', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            // تحديث المخزن
            if (result.id) {
                CacheManager.addItem('sheep', { ...data, id: result.id });
                CacheManager.clear('stats'); // مسح الإحصائيات لإعادة حسابها
            }
            
            return result;
        },
        
        async update(id, data) {
            const result = await OptimizedAPI.request(`/sheep/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            
            // تحديث المخزن
            CacheManager.updateItem('sheep', id, data);
            CacheManager.clear('stats');
            
            return result;
        },
        
        async delete(id) {
            const result = await OptimizedAPI.request(`/sheep/${id}`, {
                method: 'DELETE'
            });
            
            // تحديث المخزن
            CacheManager.removeItem('sheep', id);
            CacheManager.clear('stats');
            
            return result;
        }
    },
    
    // جلب بيانات متعددة للأوزان والأحداث
    batch: {
        async getWeightsForMultipleSheep(sheepIds) {
            // تجميع الطلبات في طلب واحد
            const promises = sheepIds.map(id => 
                new Promise(resolve => {
                    BatchManager.add('weights', id, resolve);
                })
            );
            
            return await Promise.all(promises);
        },
        
        async getEventsForMultipleSheep(sheepIds) {
            const promises = sheepIds.map(id => 
                new Promise(resolve => {
                    BatchManager.add('events', id, resolve);
                })
            );
            
            return await Promise.all(promises);
        }
    },
    
    // إحصائيات محسنة
    stats: {
        async get(useCache = true) {
            if (useCache) {
                return await CacheManager.get('stats', async () => {
                    return await OptimizedAPI.request('/stats');
                });
            }
            return await OptimizedAPI.request('/stats');
        }
    },
    
    // الحظائر المحسنة
    pens: {
        async getAll(useCache = true) {
            if (useCache) {
                return await CacheManager.get('pens', async () => {
                    return await OptimizedAPI.request('/pens');
                });
            }
            return await OptimizedAPI.request('/pens');
        },
        
        async getOne(id) {
            const cachedPen = CacheManager.store.pens?.find(p => p.id === id);
            if (cachedPen) {
                // جلب التفاصيل الإضافية إذا لزم الأمر
                const fullPen = await OptimizedAPI.request(`/pens/${id}`);
                return fullPen;
            }
            
            return await OptimizedAPI.request(`/pens/${id}`);
        }
    }
};

// استبدال API القديم بالمحسن
window.API = OptimizedAPI;