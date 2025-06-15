// app.js - الملف الرئيسي للتطبيق مع دعم المصادقة

const App = {
    // تهيئة التطبيق
    async initialize() {
        try {
            console.log('🚀 تهيئة نظام إدارة مزرعة الأغنام...');
            
            // التحقق من المصادقة أولاً
            if (!AuthManager.init()) {
                console.log('❌ المستخدم غير مسجل الدخول');
                window.location.href = '/login.html';
                return;
            }
            
            // التحقق من صلاحية الرمز
            const isValid = await AuthManager.verifyToken();
            if (!isValid) {
                console.log('❌ رمز المصادقة غير صالح');
                await AuthManager.logout();
                return;
            }
            
            // عرض معلومات المستخدم
            await this.displayUserInfo();
            
            // التحميل المسبق للبيانات الأساسية
            await CacheManager.preloadEssentialData();
            
            // التحقق من الاتصال بالخادم
            try {
                await API.sheep.getAll();
            } catch (error) {
                console.error('⚠️ تعذر الاتصال بالخادم:', error);
                UI.showAlert('تحذير: تعذر الاتصال بالخادم. تأكد من أن الخادم يعمل', 'error');
                return;
            }
            
            // إعداد المكونات
            this.setupEventListeners();
            this.setupUserMenu();
            SheepManager.setupForm();
            SheepManager.setupSearch();
            await PensManager.initialize();
            WeightManager.setupSearch();
            PregnancyManager.setupForm();
            await FinanceManager.initialize();
            UI.setupModalEvents();
            
            // تهيئة EventsManager
            if (typeof EventsManager !== 'undefined') {
                await EventsManager.initialize();
            }
            
            // إعداد بطاقة الخروف
            if (typeof SheepCard !== 'undefined') {
                console.log('✅ تم تحميل مكون بطاقة الخروف');
            }
            
            // تحميل أنواع العلف
            try {
                await API.feedTypes.getAll();
                console.log('✅ تم تحميل أنواع العلف');
            } catch (error) {
                console.warn('⚠️ لم يتم تحميل أنواع العلف:', error);
            }
            
            // تحميل البيانات الأولية
            await UI.updateDashboard();
            await Reports.updateReports();
            await SheepManager.populateMotherOptions();
            
            // تحديث المراحل كل 24 ساعة
            setInterval(async () => {
                console.log('🔄 تحديث مراحل الأغنام...');
                await Reports.updateStagesManually();
            }, 24 * 60 * 60 * 1000);
            
            // رسالة ترحيب شخصية
            setTimeout(async () => {
                const user = AuthManager.currentUser;
                const stats = await API.stats.get();
                let message = `مرحباً ${user.username} في مزرعة ${user.farmName}! `;
                
                if (stats.total > 0) {
                    message += `لديك ${stats.total} خروف في المزرعة.`;
                } else {
                    message += 'يمكنك البدء بإضافة الأغنام إلى النظام.';
                    
                    setTimeout(() => {
                        if (confirm('قاعدة البيانات فارغة. هل تريد إضافة بيانات تجريبية؟')) {
                            Reports.addSampleData();
                        }
                    }, 1000);
                }
                
                UI.showAlert(message, 'success');
            }, 500);
            
            console.log('✅ تم تشغيل النظام بنجاح!');
            
        } catch (error) {
            console.error('❌ خطأ في تشغيل التطبيق:', error);
            alert('خطأ في تشغيل النظام: ' + error.message);
        }
    },

    // عرض معلومات المستخدم
    async displayUserInfo() {
        try {
            const user = await AuthManager.getCurrentUser();
            
            // إضافة عنصر معلومات المستخدم إذا لم يكن موجوداً
            if (!document.getElementById('user-info')) {
                const header = document.querySelector('.header');
                const userInfoDiv = document.createElement('div');
                userInfoDiv.id = 'user-info';
                userInfoDiv.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 20px;
                    background: rgba(255,255,255,0.2);
                    padding: 10px 20px;
                    border-radius: 20px;
                    color: white;
                    font-size: 14px;
                `;
                userInfoDiv.innerHTML = `
                    <span>👤 ${user.username}</span>
                    <span style="margin: 0 10px;">|</span>
                    <span>🏠 ${user.farm_name}</span>
                    <span style="margin: 0 10px;">|</span>
                    <span style="cursor: pointer;" onclick="App.showUserMenu()">⚙️</span>
                `;
                header.appendChild(userInfoDiv);
            }
            
            // عرض إحصائيات المزرعة في لوحة التحكم
            if (user.total_sheep !== undefined) {
                const farmStatsDiv = document.createElement('div');
                farmStatsDiv.className = 'farm-stats-banner';
                farmStatsDiv.style.cssText = `
                    background: linear-gradient(135deg, #3498db, #2980b9);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    text-align: center;
                `;
                farmStatsDiv.innerHTML = `
                    <h3>إحصائيات مزرعة ${user.farm_name}</h3>
                    <div style="display: flex; justify-content: space-around; margin-top: 15px;">
                        <div>
                            <div style="font-size: 24px; font-weight: bold;">${user.total_sheep || 0}</div>
                            <div>إجمالي الأغنام</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold;">${user.alive_sheep || 0}</div>
                            <div>أغنام حية</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold;">${user.total_pens || 0}</div>
                            <div>حظائر</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold;">${(user.storage_used_mb || 0).toFixed(2)} MB</div>
                            <div>مساحة مستخدمة</div>
                        </div>
                    </div>
                `;
                
                const dashboardTab = document.getElementById('dashboard');
                if (dashboardTab && !document.querySelector('.farm-stats-banner')) {
                    dashboardTab.insertBefore(farmStatsDiv, dashboardTab.firstChild);
                }
            }
            
        } catch (error) {
            console.error('خطأ في عرض معلومات المستخدم:', error);
        }
    },

    // إعداد قائمة المستخدم
    setupUserMenu() {
        // إنشاء قائمة منسدلة للمستخدم
        const userMenuHTML = `
            <div id="user-menu" style="display: none; position: fixed; top: 60px; left: 20px; 
                 background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); 
                 padding: 20px; min-width: 200px; z-index: 1000;">
                <h4 style="margin: 0 0 15px 0; color: #2c3e50;">إعدادات الحساب</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="btn btn-sm" onclick="App.showProfile()">📋 الملف الشخصي</button>
                    <button class="btn btn-sm" onclick="App.changePassword()">🔐 تغيير كلمة المرور</button>
                    <button class="btn btn-sm" onclick="App.exportFarmData()">💾 تصدير البيانات</button>
                    <button class="btn btn-sm" onclick="App.showSubscription()">💳 الاشتراك</button>
                    <hr style="margin: 10px 0;">
                    <button class="btn btn-danger btn-sm" onclick="App.logout()">🚪 تسجيل الخروج</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', userMenuHTML);
    },

    // إظهار قائمة المستخدم
    showUserMenu() {
        const menu = document.getElementById('user-menu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    },

    // تسجيل الخروج
    async logout() {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            await AuthManager.logout();
        }
    },

    // إعداد مستمعي الأحداث
    setupEventListeners() {
        // إضافة مستمع لأحداث لوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + P لطباعة تقرير سريع
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.printQuickReport();
            }
            
            // Ctrl/Cmd + Shift + L لتسجيل الخروج
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.logout();
            }
            
            // باقي الاختصارات...
        });
        
        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('user-menu');
            const userInfo = document.getElementById('user-info');
            
            if (menu && !menu.contains(e.target) && !userInfo.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
        
        // مستمع لحالة الاتصال بالإنترنت
        window.addEventListener('online', () => {
            console.log('✅ تم استعادة الاتصال بالإنترنت');
            UI.showAlert('تم استعادة الاتصال بالإنترنت', 'success');
        });
        
        window.addEventListener('offline', () => {
            console.log('❌ فقد الاتصال بالإنترنت');
            UI.showAlert('تم فقد الاتصال بالإنترنت - تعمل على البيانات المحلية', 'warning');
        });
    },
    
    // عرض الملف الشخصي
    async showProfile() {
        const user = await AuthManager.getCurrentUser();
        
        const profileHTML = `
            <div style="padding: 20px;">
                <h3>الملف الشخصي</h3>
                <div class="form-group">
                    <label>اسم المستخدم:</label>
                    <p>${user.username}</p>
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني:</label>
                    <p>${user.email}</p>
                </div>
                <div class="form-group">
                    <label>اسم المزرعة:</label>
                    <p>${user.farm_name}</p>
                </div>
                <div class="form-group">
                    <label>رقم الهاتف:</label>
                    <p>${user.phone || 'غير محدد'}</p>
                </div>
                <div class="form-group">
                    <label>تاريخ التسجيل:</label>
                    <p>${new Date(user.created_at).toLocaleDateString('ar-SA')}</p>
                </div>
                <div class="form-group">
                    <label>آخر دخول:</label>
                    <p>${user.last_login ? new Date(user.last_login).toLocaleString('ar-SA') : '-'}</p>
                </div>
            </div>
        `;
        
        UI.showModal('الملف الشخصي', profileHTML);
        document.getElementById('user-menu').style.display = 'none';
    },
    
    // تغيير كلمة المرور
    changePassword() {
        const changePasswordHTML = `
            <div style="padding: 20px;">
                <h3>تغيير كلمة المرور</h3>
                <form onsubmit="App.handlePasswordChange(event)">
                    <div class="form-group">
                        <label>كلمة المرور الحالية</label>
                        <input type="password" id="current-password" required>
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور الجديدة</label>
                        <input type="password" id="new-password" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label>تأكيد كلمة المرور الجديدة</label>
                        <input type="password" id="confirm-password" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-success">تغيير كلمة المرور</button>
                        <button type="button" class="btn btn-warning" onclick="UI.closeModal()">إلغاء</button>
                    </div>
                </form>
            </div>
        `;
        
        UI.showModal('تغيير كلمة المرور', changePasswordHTML);
        document.getElementById('user-menu').style.display = 'none';
    },
    
    // معالج تغيير كلمة المرور
    async handlePasswordChange(event) {
        event.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            UI.showAlert('كلمتا المرور غير متطابقتين', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            UI.showAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AuthManager.token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'فشل تغيير كلمة المرور');
            }
            
            UI.showAlert('تم تغيير كلمة المرور بنجاح', 'success');
            UI.closeModal();
            
        } catch (error) {
            UI.showAlert(error.message, 'error');
        }
    },
    
    // تصدير بيانات المزرعة
    async exportFarmData() {
        try {
            UI.showLoading();
            
            const response = await fetch('/api/farm/export', {
                headers: {
                    'Authorization': `Bearer ${AuthManager.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('فشل تصدير البيانات');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `farm_${AuthManager.currentUser.username}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            UI.showAlert('تم تصدير البيانات بنجاح', 'success');
            
        } catch (error) {
            UI.showAlert(error.message, 'error');
        } finally {
            UI.hideLoading();
            document.getElementById('user-menu').style.display = 'none';
        }
    },
    
    // عرض معلومات الاشتراك
    showSubscription() {
        const user = AuthManager.currentUser;
        
        const subscriptionHTML = `
            <div style="padding: 20px;">
                <h3>معلومات الاشتراك</h3>
                <div class="subscription-info">
                    <div class="form-group">
                        <label>نوع الاشتراك:</label>
                        <p><strong>${user.subscriptionType === 'free' ? 'مجاني' : 'مدفوع'}</strong></p>
                    </div>
                    ${user.subscription_end_date ? `
                        <div class="form-group">
                            <label>ينتهي في:</label>
                            <p>${new Date(user.subscription_end_date).toLocaleDateString('ar-SA')}</p>
                        </div>
                    ` : ''}
                    <div class="features-list">
                        <h4>المميزات المتاحة:</h4>
                        <ul>
                            <li>✓ عدد غير محدود من الأغنام</li>
                            <li>✓ تقارير مفصلة</li>
                            <li>✓ نسخ احتياطي يومي</li>
                            <li>✓ الوصول من أجهزة متعددة</li>
                            ${user.subscriptionType !== 'free' ? `
                                <li>✓ دعم فني مباشر</li>
                                <li>✓ تصدير البيانات لـ Excel</li>
                                <li>✓ تطبيق الهاتف</li>
                            ` : ''}
                        </ul>
                    </div>
                    ${user.subscriptionType === 'free' ? `
                        <div style="margin-top: 20px; text-align: center;">
                            <button class="btn btn-primary" onclick="App.upgradePlan()">
                                ترقية الاشتراك 🚀
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        UI.showModal('معلومات الاشتراك', subscriptionHTML);
        document.getElementById('user-menu').style.display = 'none';
    },
    
    // ترقية الخطة
    upgradePlan() {
        UI.showAlert('ميزة الترقية قيد التطوير', 'info');
    },
    
    // تحديث البيانات مع التخزين المؤقت
    async refreshDataWithCache() {
        console.log('🔄 تحديث البيانات من الخادم...');
        UI.showAlert('جاري تحديث البيانات...', 'info');
        
        try {
            // مسح التخزين المؤقت
            CacheManager.clear();
            
            // إعادة تحميل البيانات الأساسية
            await CacheManager.preloadEssentialData();
            
            // تحديث معلومات المستخدم
            await AuthManager.getCurrentUser();
            await this.displayUserInfo();
            
            // تحديث الصفحة الحالية
            await App.refreshData();
            
            UI.showAlert('تم تحديث البيانات بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في تحديث البيانات:', error);
            UI.showAlert('خطأ في تحديث البيانات', 'error');
        }
    },
    
    // طباعة تقرير سريع (محدث مع معلومات المستخدم)
    async printQuickReport() {
        try {
            const user = AuthManager.currentUser;
            const stats = await API.stats.get();
            const pens = await API.pens.getAll();
            const pregnancies = await API.pregnancies.getAll();
            
            // حساب الحوامل الحالية
            const currentPregnancies = pregnancies.filter(p => !p.actual_birth_date);
            const upcomingBirths = currentPregnancies.filter(p => {
                const daysLeft = Math.ceil((new Date(p.expected_birth_date) - new Date()) / (1000 * 60 * 60 * 24));
                return daysLeft >= 0 && daysLeft <= 7;
            });
            
            let reportContent = `
                <html dir="rtl">
                <head>
                    <title>تقرير ${user.farm_name} - ${new Date().toLocaleDateString('ar-SA')}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            padding: 20px;
                            direction: rtl;
                        }
                        h1, h2 { text-align: center; }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin: 20px 0; 
                        }
                        th, td { 
                            border: 1px solid #ddd; 
                            padding: 8px; 
                            text-align: center; 
                        }
                        th { 
                            background-color: #f2f2f2; 
                            font-weight: bold;
                        }
                        .header-info {
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 10px;
                            margin-bottom: 20px;
                        }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header-info">
                        <h1>تقرير مزرعة ${user.farm_name}</h1>
                        <p><strong>المالك:</strong> ${user.username}</p>
                        <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')} - 
                           <strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-SA')}</p>
                    </div>
            `;
            
            // باقي التقرير كما هو...
            
            const printWindow = window.open('', '', 'height=800,width=1000');
            printWindow.document.write(reportContent);
            printWindow.document.close();
            
            printWindow.onload = function() {
                printWindow.print();
            };
            
        } catch (error) {
            console.error('خطأ في طباعة التقرير السريع:', error);
            UI.showAlert('خطأ في طباعة التقرير', 'error');
        }
    },
    
    // باقي الدوال كما هي...
};

// معالج الأخطاء العام مع دعم المصادقة
window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Promise rejection:', event.reason);
    
    // التحقق من أخطاء المصادقة
    if (event.reason && (event.reason.status === 401 || event.reason.status === 403)) {
        AuthManager.handleUnauthorized();
    }
});

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 تم تحميل DOM');
    
    // بدء التطبيق
    App.initialize().then(() => {
        // فحص صحة النظام بعد التهيئة
        setTimeout(() => {
            App.checkSystemHealth();
        }, 2000);
    });
});

console.log('✅ تم تحميل نظام إدارة مزرعة الأغنام متعدد المستخدمين');