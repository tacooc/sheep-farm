// config.js - إعدادات نظام إدارة مزرعة الأغنام

const Config = {
    // إعدادات API - تحديد العنوان ديناميكياً بناءً على موقع الصفحة
    API_BASE_URL: (() => {
        // الحصول على العنوان الحالي للصفحة
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = 3000; // منفذ الخادم الثابت
        
        // إذا كنا على localhost، استخدم localhost
        // وإلا استخدم عنوان IP الفعلي
        return `${protocol}//${hostname}:${port}/api`;
    })(),
    
    // الرسائل
    MESSAGES: {
        success: {
            sheepAdded: 'تم إضافة الخروف بنجاح',
            sheepUpdated: 'تم تحديث بيانات الخروف بنجاح',
            sheepDeleted: 'تم حذف الخروف بنجاح',
            dataExported: 'تم تصدير البيانات بنجاح',
            dataCleared: 'تم حذف جميع البيانات بنجاح',
            sampleDataAdded: 'تم إضافة البيانات التجريبية بنجاح',
            formCleared: 'تم مسح النموذج بنجاح',
            motherUpdated: 'تم تحديث عدد الولادات للأم تلقائياً',
            weightAdded: 'تم إضافة الوزن بنجاح',
            weightDeleted: 'تم حذف سجل الوزن بنجاح',
            eventAdded: 'تم إضافة الحدث بنجاح',
            eventDeleted: 'تم حذف الحدث بنجاح',
            pregnancyAdded: 'تم تسجيل الحمل بنجاح',
            pregnancyUpdated: 'تم تحديث بيانات الحمل بنجاح',
            pregnancyDeleted: 'تم حذف سجل الحمل بنجاح',
            penAdded: 'تم إضافة الحظيرة بنجاح',
            penUpdated: 'تم تحديث الحظيرة بنجاح',
            penDeleted: 'تم حذف الحظيرة بنجاح',
            transactionAdded: 'تم إضافة المعاملة المالية بنجاح',
            transactionUpdated: 'تم تحديث المعاملة المالية بنجاح',
            transactionDeleted: 'تم حذف المعاملة المالية بنجاح'
        },
        error: {
            sheepAdd: 'حدث خطأ في إضافة الخروف',
            sheepUpdate: 'حدث خطأ في تحديث الخروف',
            sheepDelete: 'حدث خطأ في حذف الخروف',
            dataLoad: 'خطأ في تحميل البيانات',
            invalidMother: 'معرف الأم غير صحيح',
            weightAdd: 'حدث خطأ في إضافة الوزن',
            weightDelete: 'حدث خطأ في حذف الوزن',
            eventAdd: 'حدث خطأ في إضافة الحدث',
            eventDelete: 'حدث خطأ في حذف الحدث',
            serverConnection: 'تعذر الاتصال بالخادم. تأكد من أن الخادم يعمل وأنك على نفس الشبكة',
            networkError: 'خطأ في الشبكة. تحقق من اتصالك بالشبكة المحلية',
            penWithSheep: 'لا يمكن حذف حظيرة تحتوي على أغنام'
        },
        warnings: {
            deleteConfirm: 'هل أنت متأكد من حذف هذا الخروف؟',
            clearAllConfirm: 'هل أنت متأكد من حذف جميع البيانات؟',
            deleteWeightConfirm: 'هل أنت متأكد من حذف هذا السجل؟',
            deleteEventConfirm: 'هل أنت متأكد من حذف هذا الحدث؟',
            deletePregnancyConfirm: 'هل أنت متأكد من حذف هذا السجل؟',
            deletePenConfirm: 'هل أنت متأكد من حذف هذه الحظيرة؟',
            deleteTransactionConfirm: 'هل أنت متأكد من حذف هذه المعاملة؟'
        },
        info: {
            serverAddress: 'عنوان الخادم',
            localAccess: 'الوصول المحلي',
            networkAccess: 'الوصول من الشبكة',
            checkConnection: 'جاري فحص الاتصال بالخادم...',
            connectionSuccess: 'تم الاتصال بالخادم بنجاح',
            connectionFailed: 'فشل الاتصال بالخادم'
        }
    },
    
    // إعدادات الحمل
    PREGNANCY_DAYS: 149,
    
    // إعدادات المراحل
    STAGES: {
        NEWBORN: 'مولود',
        YOUNG_MALE: 'طلي',
        YOUNG_FEMALE: 'رخل',
        ADULT: 'بالغ',
        OLD: 'كبير السن',
        PREGNANT: 'حامل'
    },
    
    // حدود الأعمار (بالأيام)
    AGE_LIMITS: {
        NEWBORN_MAX: 90,
        YOUNG_MIN: 90,
        YOUNG_MAX: 240,
        ADULT_MIN: 240,
        ADULT_MAX: 365,
        OLD_MIN: 365
    },
    
    // إعدادات العلف الافتراضية (كجم/يوم)
    DEFAULT_FEED_SETTINGS: {
        'مولود': 0.5,
        'طلي': 1.0,
        'رخل': 1.0,
        'بالغ': 1.5,
        'كبير السن': 2.0,
        'حامل': 2.5
    },
    
    // أنواع العلف الافتراضية
    DEFAULT_FEED_TYPES: [
        'شعير', 'برسيم', 'بلوبنك', 'رودس', 'جت', 'حمص', 'فول', 'ذرة'
    ],
    
    // أنواع الأحداث
    EVENT_TYPES: {
        SHEARING: 'قص صوف',
        TREATMENT: 'علاج',
        VACCINATION: 'تطعيم',
        OTHER: 'أخرى'
    },
    
    // فئات المعاملات المالية
    TRANSACTION_CATEGORIES: {
        income: {
            SHEEP_SALE: 'بيع أغنام',
            WOOL_SALE: 'بيع صوف',
            MILK_SALE: 'بيع حليب',
            OTHER_INCOME: 'إيرادات أخرى'
        },
        expense: {
            SHEEP_PURCHASE: 'شراء أغنام',
            FEED: 'علف',
            VETERINARY: 'بيطري',
            LABOR: 'عمالة',
            EQUIPMENT: 'معدات',
            MAINTENANCE: 'صيانة',
            OTHER_EXPENSE: 'مصاريف أخرى'
        }
    },
    
    // إعدادات الطباعة
    PRINT_SETTINGS: {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: {
            top: '20mm',
            bottom: '20mm',
            left: '15mm',
            right: '15mm'
        }
    },
    
    // دالة لفحص الاتصال بالخادم
    async checkServerConnection() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/sheep`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            console.error('خطأ في فحص الاتصال:', error);
            return false;
        }
    },
    
    // دالة للحصول على معلومات الشبكة
    getNetworkInfo() {
        return {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            port: window.location.port || '80',
            apiUrl: this.API_BASE_URL,
            isLocalhost: window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1'
        };
    }
};

// تجميد الكائن لمنع التعديل العرضي
Object.freeze(Config.MESSAGES);
Object.freeze(Config.STAGES);
Object.freeze(Config.AGE_LIMITS);
Object.freeze(Config.DEFAULT_FEED_SETTINGS);
Object.freeze(Config.EVENT_TYPES);
Object.freeze(Config.TRANSACTION_CATEGORIES);
Object.freeze(Config.PRINT_SETTINGS);

// إظهار معلومات الاتصال في وحدة التحكم
console.log('🌐 معلومات الاتصال بالخادم:');
console.log(`   - عنوان API: ${Config.API_BASE_URL}`);
console.log(`   - الموقع الحالي: ${window.location.hostname}`);
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log('   ✅ أنت متصل من جهاز على الشبكة المحلية');
} else {
    console.log('   📍 أنت متصل محلياً من نفس الجهاز');
}