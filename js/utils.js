// utils.js - الوظائف المساعدة

const Utils = {
    // حساب العمر
    calculateAge(birthDate) {
        if (!birthDate) return '';

        const birth = new Date(birthDate);
        const today = new Date();
        
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        let days = today.getDate() - birth.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonth.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        let ageText = '';
        if (years > 0) ageText += `${years} سنة `;
        if (months > 0) ageText += `${months} شهر `;
        if (days > 0) ageText += `${days} يوم`;
        
        if (ageText === '') ageText = 'مولود اليوم';
        return ageText.trim();
    },

    // حساب العمر بالأيام
    calculateAgeInDays(birthDate) {
        if (!birthDate) return 0;
        const birth = new Date(birthDate);
        const today = new Date();
        const diffTime = Math.abs(today - birth);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    // تحديد المرحلة
    determineStage(birthDate, gender) {
        if (!birthDate) return '';
        
        const ageInDays = this.calculateAgeInDays(birthDate);
        const ageInMonths = ageInDays / 30;
        
        if (ageInDays < Config.AGE_LIMITS.NEWBORN_MAX) {
            return Config.STAGES.NEWBORN;
        } else if (ageInMonths >= 3 && ageInMonths <= 8) {
            return gender === 'ذكر' ? Config.STAGES.YOUNG_MALE : Config.STAGES.YOUNG_FEMALE;
        } else if (ageInMonths > 8 && ageInMonths <= 12) {
            return Config.STAGES.ADULT;
        } else if (ageInMonths > 12) {
            return Config.STAGES.OLD;
        }
        
        return '';
    },

    // حساب العمر المختصر
    calculateAgeShort(birthDate) {
        if (!birthDate) return '-';

        const birth = new Date(birthDate);
        const today = new Date();
        
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        let days = today.getDate() - birth.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonth.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        let ageText = '';
        if (years > 0) ageText += `${years}ع `;
        if (months > 0) ageText += `${months}ش `;
        if (days > 0) ageText += `${days}ي`;
        
        if (ageText === '') ageText = 'حديث';
        return ageText.trim();
    },

    // الحصول على التاريخ الحالي
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    },

    // تنسيق التاريخ
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    },

    // تنسيق التاريخ بالعربي
    formatDateArabic(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        
        return date.toLocaleDateString('ar-SA', options);
    },

    // حساب تغيير الوزن
    calculateWeightChange(currentWeight, previousWeight) {
        if (!previousWeight) return { change: 0, percentage: 0 };
        
        const change = currentWeight - previousWeight;
        const percentage = ((change / previousWeight) * 100).toFixed(1);
        
        return { change: change.toFixed(1), percentage };
    },

    // البحث في مصفوفة الأغنام
    searchSheep(sheep, searchTerm) {
        if (!searchTerm || !searchTerm.trim()) {
            return sheep;
        }
        
        const term = searchTerm.toLowerCase();
        return sheep.filter(s => {
            return (
                (s.id && s.id.toLowerCase().includes(term)) ||
                (s.gender && s.gender.toLowerCase().includes(term)) ||
                (s.stage && s.stage.toLowerCase().includes(term)) ||
                (s.status && s.status.toLowerCase().includes(term)) ||
                (s.pen && s.pen.toLowerCase().includes(term)) ||
                (s.mother && s.mother.toLowerCase().includes(term))
            );
        });
    },

    // تصدير البيانات
    exportToJSON(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${filename}_${this.getCurrentDate()}.json`;
        link.click();
    },

    // تصدير إلى CSV
    exportToCSV(data, filename, headers) {
        let csv = '\uFEFF'; // BOM for UTF-8
        
        // إضافة العناوين
        if (headers) {
            csv += headers.join(',') + '\n';
        }
        
        // إضافة البيانات
        data.forEach(row => {
            const values = headers ? 
                headers.map(header => {
                    const value = row[header] || '';
                    return `"${value.toString().replace(/"/g, '""')}"`;
                }) :
                Object.values(row).map(value => {
                    return `"${(value || '').toString().replace(/"/g, '""')}"`;
                });
            csv += values.join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${this.getCurrentDate()}.csv`;
        link.click();
    },

    // حساب معدل الإشغال
    calculateOccupancyRate(current, capacity) {
        if (!capacity || capacity === 0) return 0;
        return Math.round((current / capacity) * 100);
    },

    // الحصول على لون حسب معدل الإشغال
    getOccupancyColor(rate) {
        if (rate > 90) return '#dc3545'; // أحمر
        if (rate > 70) return '#ffc107'; // أصفر
        return '#28a745'; // أخضر
    },

    // تحويل النسبة المئوية إلى كمية
    percentageToAmount(total, percentage) {
        return (total * percentage / 100).toFixed(2);
    },

    // التحقق من صحة النسب المئوية
    validatePercentages(percentages) {
        const total = percentages.reduce((sum, p) => sum + parseFloat(p), 0);
        return Math.abs(total - 100) < 0.01;
    },

    // حساب الفرق بين تاريخين بالأيام
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    // إضافة أيام لتاريخ
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    },

    // تنسيق الرقم
    formatNumber(number) {
        return new Intl.NumberFormat('ar-SA').format(number);
    },

    // تنسيق العملة
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR'
        }).format(amount);
    },

    // توليد معرف عشوائي
    generateId(prefix = '') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
    },

    // التحقق من صحة البريد الإلكتروني
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // التحقق من صحة رقم الهاتف
    isValidPhone(phone) {
        const re = /^05\d{8}$/;
        return re.test(phone);
    },

    // تجميع البيانات حسب خاصية
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },

    // حساب المجموع
    sum(array, key) {
        return array.reduce((total, item) => total + (parseFloat(item[key]) || 0), 0);
    },

    // حساب المتوسط
    average(array, key) {
        if (array.length === 0) return 0;
        const total = this.sum(array, key);
        return total / array.length;
    },

    // ترتيب حسب خاصية
    sortBy(array, key, ascending = true) {
        return [...array].sort((a, b) => {
            if (ascending) {
                return a[key] > b[key] ? 1 : -1;
            } else {
                return a[key] < b[key] ? 1 : -1;
            }
        });
    },

    // تحديد فترة اليوم
    getDayPeriod() {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباحاً';
        if (hour < 17) return 'ظهراً';
        if (hour < 20) return 'مساءً';
        return 'ليلاً';
    },

    // رسالة ترحيب حسب الوقت
    getGreeting() {
        const period = this.getDayPeriod();
        const greetings = {
            'صباحاً': 'صباح الخير',
            'ظهراً': 'مساء الخير',
            'مساءً': 'مساء الخير',
            'ليلاً': 'مساء الخير'
        };
        return greetings[period];
    }
};