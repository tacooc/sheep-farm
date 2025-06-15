// finance.js - إدارة المعاملات المالية

const FinanceManager = {
    // حالة النموذج
    editMode: false,
    currentTransactionId: null,
    currentType: '',

    // فئات المعاملات
    categories: {
        income: [
            'بيع أغنام',
            'بيع صوف',
            'بيع حليب',
            'بيع سماد',
            'إيرادات أخرى'
        ],
        expense: [
            'شراء أغنام',
            'أعلاف',
            'أدوية وعلاج',
            'رواتب',
            'صيانة',
            'كهرباء ومياه',
            'نقل',
            'معدات',
            'مصروفات أخرى'
        ]
    },

    // تحميل المعاملات
    async loadTransactions(filters = {}) {
        try {
            const transactions = await API.transactions.getAll(filters);
            const tbody = document.getElementById('financeTableBody');
            
            if (!tbody) return;
            
            tbody.innerHTML = '';

            if (transactions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد معاملات للعرض
                        </td>
                    </tr>
                `;
                return;
            }

            transactions.forEach(transaction => {
                const row = document.createElement('tr');
                const typeClass = transaction.type === 'income' ? 'status-alive' : 'status-dead';
                const amountColor = transaction.type === 'income' ? 'color: #27ae60;' : 'color: #e74c3c;';
                const sign = transaction.type === 'income' ? '+' : '-';
                
                row.innerHTML = `
                    <td>${Utils.formatDate(transaction.date)}</td>
                    <td><span class="${typeClass}">${transaction.type === 'income' ? 'مدخول' : 'مصروف'}</span></td>
                    <td>${transaction.category}</td>
                    <td style="${amountColor} font-weight: bold;">${sign} ${transaction.amount.toFixed(2)}</td>
                    <td>${transaction.description || '-'}</td>
                    <td>${transaction.sheep_id || '-'}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="FinanceManager.editTransaction(${transaction.id})" title="تعديل">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="FinanceManager.deleteTransaction(${transaction.id})" title="حذف">🗑️</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // تحديث الملخص
            await this.updateSummary(filters);
            
        } catch (error) {
            console.error('خطأ في تحميل المعاملات:', error);
        }
    },

    // تحديث الملخص المالي
    async updateSummary(filters = {}) {
        try {
            const summary = await API.transactions.getSummary(filters);
            
            // تحديث البطاقات
            document.getElementById('totalIncome').textContent = summary.summary.total_income.toFixed(2);
            document.getElementById('totalExpense').textContent = summary.summary.total_expense.toFixed(2);
            document.getElementById('netBalance').textContent = summary.summary.balance.toFixed(2);
            document.getElementById('transactionCount').textContent = summary.summary.total_transactions;
            
            // تحديد لون الرصيد
            const balanceElement = document.getElementById('netBalance');
            if (summary.summary.balance > 0) {
                balanceElement.style.color = 'var(--success-color)';
            } else if (summary.summary.balance < 0) {
                balanceElement.style.color = 'var(--danger-color)';
            } else {
                balanceElement.style.color = 'var(--primary-color)';
            }
            
            // تحديث ملخص الفئات
            this.updateCategorySummary(summary.categories);
            
        } catch (error) {
            console.error('خطأ في تحديث الملخص:', error);
        }
    },

    // تحديث ملخص الفئات
    updateCategorySummary(categories) {
        const container = document.getElementById('categorySummary');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (categories.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6c757d;">لا توجد معاملات</p>';
            return;
        }
        
        categories.forEach(cat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            const color = cat.type === 'income' ? 'color: #27ae60;' : 'color: #e74c3c;';
            
            card.innerHTML = `
                <div class="stat-number" style="${color}">${cat.total.toFixed(2)}</div>
                <div class="stat-label">${cat.category} (${cat.count})</div>
            `;
            container.appendChild(card);
        });
    },

    // فتح نافذة إضافة/تعديل
    async openModal(type = '') {
        const modal = document.getElementById('financeModal');
        const form = document.getElementById('financeForm');
        
        form.reset();
        this.editMode = false;
        this.currentTransactionId = null;
        this.currentType = type;
        
        if (type) {
            document.getElementById('transactionType').value = type;
            await this.updateCategories();
        }
        
        document.getElementById('financeModalTitle').textContent = 
            this.editMode ? 'تعديل معاملة مالية' : 'إضافة معاملة مالية';
        
        // ملء قائمة الأغنام
        await this.populateSheepList();
        
        // تعيين التاريخ الحالي
        document.getElementById('transactionDate').value = Utils.getCurrentDate();
        
        modal.style.display = 'block';
    },

    // إغلاق النافذة
    closeModal() {
        const modal = document.getElementById('financeModal');
        modal.style.display = 'none';
    },

    // تحديث قائمة الفئات
    async updateCategories() {
        const type = document.getElementById('transactionType').value;
        const categorySelect = document.getElementById('transactionCategory');
        
        categorySelect.innerHTML = '<option value="">اختر الفئة</option>';
        
        if (type && this.categories[type]) {
            this.categories[type].forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    },

    // ملء قائمة الأغنام
    async populateSheepList() {
        try {
            const sheepSelect = document.getElementById('transactionSheep');
            sheepSelect.innerHTML = '<option value="">بدون ربط</option>';
            
            const sheep = await API.sheep.getAll();
            sheep.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = `${s.id} - ${s.gender}`;
                sheepSelect.appendChild(option);
            });
        } catch (error) {
            console.error('خطأ في تحميل قائمة الأغنام:', error);
        }
    },

    // حفظ المعاملة
    async saveTransaction(event) {
        event.preventDefault();
        
        try {
            const transactionData = {
                type: document.getElementById('transactionType').value,
                category: document.getElementById('transactionCategory').value,
                amount: parseFloat(document.getElementById('transactionAmount').value),
                date: document.getElementById('transactionDate').value,
                description: document.getElementById('transactionDescription').value || '',
                sheep_id: document.getElementById('transactionSheep').value || null
            };
            
            if (!transactionData.type || !transactionData.category || !transactionData.amount || !transactionData.date) {
                throw new Error('جميع الحقول المطلوبة يجب ملؤها');
            }
            
            if (this.editMode && this.currentTransactionId) {
                await API.transactions.update(this.currentTransactionId, transactionData);
                UI.showAlert('تم تحديث المعاملة بنجاح', 'success');
            } else {
                await API.transactions.create(transactionData);
                UI.showAlert('تم إضافة المعاملة بنجاح', 'success');
            }
            
            this.closeModal();
            await this.loadTransactions();
            
        } catch (error) {
            console.error('خطأ في حفظ المعاملة:', error);
            UI.showAlert(error.message, 'error');
        }
    },

    // تعديل معاملة
    async editTransaction(id) {
        try {
            const transactions = await API.transactions.getAll();
            const transaction = transactions.find(t => t.id === id);
            
            if (!transaction) {
                UI.showAlert('لم يتم العثور على المعاملة', 'error');
                return;
            }
            
            this.editMode = true;
            this.currentTransactionId = id;
            
            await this.openModal();
            
            // ملء البيانات
            document.getElementById('transactionType').value = transaction.type;
            await this.updateCategories();
            document.getElementById('transactionCategory').value = transaction.category;
            document.getElementById('transactionAmount').value = transaction.amount;
            document.getElementById('transactionDate').value = transaction.date;
            document.getElementById('transactionDescription').value = transaction.description || '';
            document.getElementById('transactionSheep').value = transaction.sheep_id || '';
            
            document.getElementById('financeModalTitle').textContent = 'تعديل معاملة مالية';
            
        } catch (error) {
            console.error('خطأ في تحميل المعاملة:', error);
            UI.showAlert('خطأ في تحميل بيانات المعاملة', 'error');
        }
    },

    // حذف معاملة
    async deleteTransaction(id) {
        if (confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
            try {
                await API.transactions.delete(id);
                UI.showAlert('تم حذف المعاملة بنجاح', 'success');
                await this.loadTransactions();
            } catch (error) {
                console.error('خطأ في حذف المعاملة:', error);
                UI.showAlert('خطأ في حذف المعاملة', 'error');
            }
        }
    },

    // فلترة المعاملات
    async filterTransactions() {
        const filters = {
            type: document.getElementById('financeTypeFilter').value,
            category: document.getElementById('financeCategoryFilter').value,
            from_date: document.getElementById('financeFromDate').value,
            to_date: document.getElementById('financeToDate').value
        };
        
        // إزالة الفلاتر الفارغة
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });
        
        await this.loadTransactions(filters);
    },

    // تحديث فلتر الفئات
    async updateCategoryFilter() {
        const categoryFilter = document.getElementById('financeCategoryFilter');
        if (!categoryFilter) return;
        
        const currentValue = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">جميع الفئات</option>';
        
        // دمج جميع الفئات
        const allCategories = [...this.categories.income, ...this.categories.expense];
        const uniqueCategories = [...new Set(allCategories)];
        
        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        categoryFilter.value = currentValue;
    },

    // إعداد النموذج
    setupForm() {
        const financeForm = document.getElementById('financeForm');
        if (financeForm) {
            financeForm.addEventListener('submit', (e) => this.saveTransaction(e));
        }
    },

    // تهيئة المكون
    async initialize() {
        this.setupForm();
        await this.updateCategoryFilter();
    }
};