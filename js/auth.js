// auth.js - مدير المصادقة والجلسات

const AuthManager = {
    // معلومات المستخدم الحالي
    currentUser: null,
    token: null,
    
    // تهيئة المصادقة
    init() {
        // استرجاع الرمز من التخزين المحلي
        this.token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('currentUser');
        
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
            } catch (e) {
                console.error('خطأ في قراءة بيانات المستخدم');
            }
        }
        
        // تحديث رؤوس الطلبات الافتراضية
        if (this.token) {
            this.setAuthHeader();
        }
        
        return this.isAuthenticated();
    },
    
    // التحقق من المصادقة
    isAuthenticated() {
        return !!(this.token && this.currentUser);
    },
    
    // تسجيل الدخول
    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    deviceInfo: navigator.userAgent
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'فشل تسجيل الدخول');
            }
            
            const data = await response.json();
            
            // حفظ البيانات
            this.token = data.token;
            this.currentUser = data.user;
            
            localStorage.setItem('authToken', this.token);
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            // تحديث رؤوس الطلبات
            this.setAuthHeader();
            
            return data;
            
        } catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            throw error;
        }
    },
    
    // تسجيل مستخدم جديد
    async register(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'فشل إنشاء الحساب');
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('خطأ في التسجيل:', error);
            throw error;
        }
    },
    
    // تسجيل الخروج
    async logout() {
        try {
            if (this.token) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('خطأ في تسجيل الخروج:', error);
        } finally {
            // مسح البيانات المحلية
            this.token = null;
            this.currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            
            // مسح التخزين المؤقت
            if (typeof CacheManager !== 'undefined') {
                CacheManager.clear();
            }
            
            // الانتقال لصفحة تسجيل الدخول
            window.location.href = '/login.html';
        }
    },
    
    // الحصول على معلومات المستخدم الحالي
    async getCurrentUser() {
        if (!this.token) return null;
        
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // الرمز منتهي الصلاحية
                    await this.logout();
                }
                throw new Error('فشل جلب بيانات المستخدم');
            }
            
            const user = await response.json();
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            return user;
            
        } catch (error) {
            console.error('خطأ في جلب بيانات المستخدم:', error);
            throw error;
        }
    },
    
    // تعيين رأس المصادقة للطلبات
    setAuthHeader() {
        // تحديث fetch الافتراضي
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            if (AuthManager.token && args[0].startsWith('/api/')) {
                // إضافة رأس المصادقة
                if (!args[1]) args[1] = {};
                if (!args[1].headers) args[1].headers = {};
                args[1].headers['Authorization'] = `Bearer ${AuthManager.token}`;
            }
            return originalFetch.apply(this, args);
        };
    },
    
    // التحقق من صلاحية الرمز
    async verifyToken() {
        if (!this.token) return false;
        
        try {
            const response = await fetch('/api/auth/me');
            return response.ok;
        } catch (error) {
            return false;
        }
    },
    
    // معالج للطلبات غير المصرحة
    handleUnauthorized() {
        this.logout();
    }
};