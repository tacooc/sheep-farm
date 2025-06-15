// sheepCard.js - إدارة بطاقة الخروف الشاملة

const SheepCard = {
    currentSheepId: null,
    
    // تهيئة صفحة البطاقة
    async initialize() {
        const selectElement = document.getElementById('sheepCardSearch');
        if (!selectElement) return;
        
        // تدمير Select2 السابق إذا كان موجوداً
        if (typeof $ !== 'undefined' && $(selectElement).data('select2')) {
            $(selectElement).select2('destroy');
        }
        
        // تحميل قائمة الأغنام
        selectElement.innerHTML = '<option value="">اختر الخروف...</option>';
        
        try {
            const sheep = await API.sheep.getAll();
            
            sheep.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = `${s.id} - ${s.gender} - ${s.status}`;
                selectElement.appendChild(option);
            });
            
            // تفعيل Select2 إذا كانت المكتبة متوفرة
            if (typeof $ !== 'undefined' && $.fn.select2) {
                $(selectElement).select2({
                    placeholder: 'ابحث عن الخروف بالمعرف...',
                    allowClear: true,
                    dir: 'rtl',
                    language: {
                        noResults: function() {
                            return "لم يتم العثور على نتائج";
                        },
                        searching: function() {
                            return "جاري البحث...";
                        }
                    },
                    width: '100%'
                });
            }
        } catch (error) {
            console.error('خطأ في تحميل قائمة الأغنام:', error);
        }
    },
    
    // تحميل تفاصيل الخروف
    async loadSheepDetails() {
        const sheepId = document.getElementById('sheepCardSearch').value;
        if (!sheepId) {
            UI.showAlert('الرجاء اختيار خروف', 'warning');
            return;
        }
        
        this.currentSheepId = sheepId;
        
        try {
            UI.showLoading();
            
            // جلب جميع البيانات
            const sheep = await API.sheep.getOne(sheepId);
            const weights = await API.weights.getHistory(sheepId);
            const events = await API.events.getHistory(sheepId);
            const pregnancies = await API.pregnancies.getBySheep(sheepId);
            const children = await this.getChildren(sheepId);
            const siblings = await this.getSiblings(sheep);
            
            // بناء محتوى البطاقة
            const cardContent = document.getElementById('sheepCardContent');
            cardContent.innerHTML = this.buildCardHTML(sheep, weights, events, pregnancies, children, siblings);
            cardContent.style.display = 'block';
            
            // رسم مخطط الوزن إذا كان هناك بيانات
            if (weights.length > 1) {
                this.drawWeightChart(weights);
            }
            
            // إضافة زر الطباعة
            this.addPrintButton();
            
        } catch (error) {
            console.error('خطأ في تحميل بيانات الخروف:', error);
            UI.showAlert('خطأ في تحميل البيانات', 'error');
        } finally {
            UI.hideLoading();
        }
    },
    
    // بناء HTML البطاقة
    buildCardHTML(sheep, weights, events, pregnancies, children, siblings) {
        const age = sheep.birth_date ? Utils.calculateAge(sheep.birth_date) : 'غير محدد';
        const stage = Utils.determineStage(sheep.birth_date, sheep.gender) || sheep.stage || 'غير محدد';
        const currentWeight = weights.length > 0 ? weights[weights.length - 1].weight : (sheep.weight || 'غير محدد');
        
        let html = `
            <!-- رأس البطاقة -->
            <div class="sheep-card-header">
                <h3>بطاقة الخروف: ${sheep.id}</h3>
                <p>${sheep.gender} - ${stage} - ${sheep.status}</p>
            </div>
            
            <!-- المعلومات الأساسية -->
            <div class="sheep-info-grid">
                <div class="info-section">
                    <h4>معلومات أساسية</h4>
                    <div class="info-row">
                        <span>المعرف:</span>
                        <strong>${sheep.id}</strong>
                    </div>
                    <div class="info-row">
                        <span>الجنس:</span>
                        <strong>${sheep.gender}</strong>
                    </div>
                    <div class="info-row">
                        <span>العمر:</span>
                        <strong>${age}</strong>
                    </div>
                    <div class="info-row">
                        <span>تاريخ الولادة:</span>
                        <strong>${sheep.birth_date ? Utils.formatDate(sheep.birth_date) : 'غير محدد'}</strong>
                    </div>
                    <div class="info-row">
                        <span>المرحلة:</span>
                        <strong>${stage}</strong>
                    </div>
                    <div class="info-row">
                        <span>الحالة:</span>
                        <strong class="status-${sheep.status === 'موجود' ? 'alive' : sheep.status === 'متوفي' ? 'dead' : 'sold'}">${sheep.status}</strong>
                    </div>
                    ${sheep.pen ? `
                    <div class="info-row">
                        <span>الحظيرة:</span>
                        <strong>${sheep.pen}</strong>
                    </div>
                    ` : ''}
                </div>
                
                <div class="info-section">
                    <h4>معلومات إضافية</h4>
                    <div class="info-row">
                        <span>الوزن الحالي:</span>
                        <strong>${currentWeight} ${currentWeight !== 'غير محدد' ? 'كجم' : ''}</strong>
                    </div>
                    <div class="info-row">
                        <span>عدد سجلات الوزن:</span>
                        <strong>${weights.length}</strong>
                    </div>
                    ${sheep.purchase_date ? `
                    <div class="info-row">
                        <span>تاريخ الشراء:</span>
                        <strong>${Utils.formatDate(sheep.purchase_date)}</strong>
                    </div>
                    ` : ''}
                    ${sheep.sale_date ? `
                    <div class="info-row">
                        <span>تاريخ البيع:</span>
                        <strong>${Utils.formatDate(sheep.sale_date)}</strong>
                    </div>
                    ` : ''}
                    ${sheep.death_date ? `
                    <div class="info-row">
                        <span>تاريخ الوفاة:</span>
                        <strong>${Utils.formatDate(sheep.death_date)}</strong>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // شجرة العائلة
        html += this.buildFamilyTreeHTML(sheep, children, siblings);
        
        // معلومات الإنتاج (للإناث)
        if (sheep.gender === 'أنثى') {
            html += this.buildProductionHTML(sheep, pregnancies);
        }
        
        // مخطط الوزن
        if (weights.length > 1) {
            html += `
                <div class="chart-container">
                    <h4>تطور الوزن</h4>
                    <canvas id="weightChart" width="400" height="200"></canvas>
                </div>
            `;
        }
        
        // تاريخ الأوزان
        html += this.buildWeightHistoryHTML(weights);
        
        // تاريخ الأحداث
        html += this.buildEventsHistoryHTML(events);
        
        // الخط الزمني الشامل
        html += this.buildTimelineHTML(sheep, weights, events, pregnancies);
        
        return html;
    },
    
    // بناء شجرة العائلة
    buildFamilyTreeHTML(sheep, children, siblings) {
        let html = '<div class="family-tree">';
        html += '<h4>شجرة العائلة</h4>';
        
        // الأم
        if (sheep.mother) {
            html += `
                <div class="tree-section">
                    <h5>الأم</h5>
                    <div class="tree-node mother-info">
                        ${sheep.mother}
                    </div>
                </div>
            `;
        }
        
        // الإخوة
        if (siblings.length > 0) {
            html += `
                <div class="tree-section">
                    <h5>الإخوة (${siblings.length})</h5>
                    <div class="children-list">
            `;
            siblings.forEach(sibling => {
                html += `<div class="tree-node">${sibling.id} (${sibling.gender})</div>`;
            });
            html += '</div></div>';
        }
        
        // الأولاد
        if (children.length > 0) {
            html += `
                <div class="tree-section">
                    <h5>الأولاد (${children.length})</h5>
                    <div class="children-list">
            `;
            children.forEach(child => {
                html += `<div class="tree-node">${child.id} (${child.gender})</div>`;
            });
            html += '</div></div>';
        }
        
        html += '</div>';
        return html;
    },
    
    // بناء معلومات الإنتاج
    buildProductionHTML(sheep, pregnancies) {
        if (pregnancies.length === 0) {
            return '';
        }
        
        let html = '<div class="info-section" style="margin: 20px;">';
        html += '<h4>سجل الإنتاج والحمل</h4>';
        
        // حساب الإحصائيات
        const completedPregnancies = pregnancies.filter(p => p.actual_birth_date);
        const totalBirths = completedPregnancies.reduce((sum, p) => sum + (p.birth_count || 0), 0);
        const currentPregnancy = pregnancies.find(p => !p.actual_birth_date);
        
        html += `
            <div class="info-row">
                <span>عدد مرات الحمل:</span>
                <strong>${pregnancies.length}</strong>
            </div>
            <div class="info-row">
                <span>عدد الولادات:</span>
                <strong>${completedPregnancies.length}</strong>
            </div>
            <div class="info-row">
                <span>إجمالي المواليد:</span>
                <strong>${totalBirths}</strong>
            </div>
        `;
        
        if (currentPregnancy) {
            const daysLeft = Math.ceil((new Date(currentPregnancy.expected_birth_date) - new Date()) / (1000 * 60 * 60 * 24));
            html += `
                <div class="info-row" style="background: #fff3cd; padding: 10px; border-radius: 5px;">
                    <span>حالة الحمل:</span>
                    <strong>حامل - متبقي ${daysLeft} يوم</strong>
                </div>
            `;
        }
        
        // جدول الحمل والولادة
        html += `
            <table class="data-table" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th>رقم</th>
                        <th>تاريخ الحمل</th>
                        <th>تاريخ الولادة المتوقع</th>
                        <th>تاريخ الولادة الفعلي</th>
                        <th>عدد المواليد</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        pregnancies.forEach((p, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${Utils.formatDate(p.pregnancy_date)}</td>
                    <td>${Utils.formatDate(p.expected_birth_date)}</td>
                    <td>${p.actual_birth_date ? Utils.formatDate(p.actual_birth_date) : '-'}</td>
                    <td>${p.birth_count || '-'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        return html;
    },
    
    // بناء تاريخ الأوزان
    buildWeightHistoryHTML(weights) {
        if (weights.length === 0) {
            return '';
        }
        
        let html = '<div class="info-section" style="margin: 20px;">';
        html += '<h4>تاريخ الأوزان</h4>';
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>الوزن (كجم)</th>
                        <th>التغيير</th>
                        <th>الملاحظات</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        weights.forEach((weight, index) => {
            let changeHtml = '';
            if (index > 0) {
                const change = weight.weight - weights[index - 1].weight;
                const changeClass = change > 0 ? 'weight-increase' : change < 0 ? 'weight-decrease' : 'weight-same';
                const sign = change > 0 ? '+' : '';
                changeHtml = `<span class="weight-change ${changeClass}">${sign}${change.toFixed(1)} كجم</span>`;
            }
            
            html += `
                <tr>
                    <td>${Utils.formatDate(weight.date)}</td>
                    <td>${weight.weight}</td>
                    <td>${changeHtml}</td>
                    <td>${weight.notes || '-'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        return html;
    },
    
    // بناء تاريخ الأحداث
    buildEventsHistoryHTML(events) {
        if (events.length === 0) {
            return '';
        }
        
        let html = '<div class="info-section" style="margin: 20px;">';
        html += '<h4>سجل الأحداث</h4>';
        
        // تجميع الأحداث حسب النوع
        const eventsByType = {};
        events.forEach(event => {
            if (!eventsByType[event.event_type]) {
                eventsByType[event.event_type] = [];
            }
            eventsByType[event.event_type].push(event);
        });
        
        // عرض ملخص
        html += '<div style="margin-bottom: 15px;">';
        Object.keys(eventsByType).forEach(type => {
            html += `<span style="margin-left: 15px;"><strong>${type}:</strong> ${eventsByType[type].length} مرة</span>`;
        });
        html += '</div>';
        
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>نوع الحدث</th>
                        <th>الملاحظات</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        events.forEach(event => {
            const eventClass = {
                'قص صوف': 'weight-same',
                'علاج': 'weight-decrease',
                'تطعيم': 'weight-increase',
                'أخرى': ''
            }[event.event_type] || '';
            
            html += `
                <tr>
                    <td>${Utils.formatDate(event.event_date)}</td>
                    <td><span class="weight-change ${eventClass}">${event.event_type}</span></td>
                    <td>${event.notes || '-'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        return html;
    },
    
    // بناء الخط الزمني الشامل
    buildTimelineHTML(sheep, weights, events, pregnancies) {
        // دمج جميع الأحداث في خط زمني واحد
        const timeline = [];
        
        // إضافة الولادة
        if (sheep.birth_date) {
            timeline.push({
                date: sheep.birth_date,
                type: 'birth',
                content: 'الولادة'
            });
        }
        
        // إضافة الشراء
        if (sheep.purchase_date) {
            timeline.push({
                date: sheep.purchase_date,
                type: 'purchase',
                content: 'الشراء'
            });
        }
        
        // إضافة الأوزان
        weights.forEach(weight => {
            timeline.push({
                date: weight.date,
                type: 'weight',
                content: `وزن: ${weight.weight} كجم`
            });
        });
        
        // إضافة الأحداث
        events.forEach(event => {
            timeline.push({
                date: event.event_date,
                type: 'event',
                content: event.event_type
            });
        });
        
        // إضافة الحمل والولادة
        pregnancies.forEach(p => {
            timeline.push({
                date: p.pregnancy_date,
                type: 'pregnancy',
                content: 'بداية الحمل'
            });
            
            if (p.actual_birth_date) {
                timeline.push({
                    date: p.actual_birth_date,
                    type: 'birth-given',
                    content: `ولادة ${p.birth_count} مولود`
                });
            }
        });
        
        // إضافة البيع أو الوفاة
        if (sheep.sale_date) {
            timeline.push({
                date: sheep.sale_date,
                type: 'sale',
                content: 'البيع'
            });
        }
        
        if (sheep.death_date) {
            timeline.push({
                date: sheep.death_date,
                type: 'death',
                content: 'الوفاة'
            });
        }
        
        // ترتيب الخط الزمني
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let html = '<div class="timeline-section">';
        html += '<h4>الخط الزمني الشامل</h4>';
        
        if (timeline.length === 0) {
            html += '<p class="no-data">لا توجد أحداث مسجلة</p>';
        } else {
            timeline.forEach(item => {
                const iconMap = {
                    'birth': '👶',
                    'purchase': '💰',
                    'weight': '⚖️',
                    'event': '📋',
                    'pregnancy': '🤰',
                    'birth-given': '👨‍👩‍👧‍👦',
                    'sale': '💵',
                    'death': '💀'
                };
                
                html += `
                    <div class="timeline-item">
                        <div class="timeline-date">
                            ${iconMap[item.type] || '📅'} ${Utils.formatDate(item.date)}
                        </div>
                        <div class="timeline-content">
                            ${item.content}
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        return html;
    },
    
    // رسم مخطط الوزن
    drawWeightChart(weights) {
        const canvas = document.getElementById('weightChart');
        if (!canvas || weights.length < 2) return;
        
        const ctx = canvas.getContext('2d');
        const labels = weights.map(w => Utils.formatDate(w.date));
        const data = weights.map(w => w.weight);
        
        // رسم بسيط للمخطط
        const padding = 40;
        const width = canvas.width - (padding * 2);
        const height = canvas.height - (padding * 2);
        
        const maxWeight = Math.max(...data);
        const minWeight = Math.min(...data);
        const range = maxWeight - minWeight || 1;
        
        // مسح اللوحة
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // رسم المحاور
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // رسم البيانات
        ctx.beginPath();
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        
        data.forEach((weight, index) => {
            const x = padding + (index / (data.length - 1)) * width;
            const y = canvas.height - padding - ((weight - minWeight) / range) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            // رسم النقاط
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // كتابة القيم
            ctx.fillStyle = '#333';
            ctx.fillText(weight, x - 10, y - 10);
        });
        
        ctx.stroke();
    },
    
    // الحصول على الأولاد
    async getChildren(parentId) {
        const allSheep = await API.sheep.getAll();
        return allSheep.filter(s => s.mother === parentId);
    },
    
    // الحصول على الإخوة
    async getSiblings(sheep) {
        if (!sheep.mother) return [];
        
        const allSheep = await API.sheep.getAll();
        return allSheep.filter(s => 
            s.mother === sheep.mother && 
            s.id !== sheep.id
        );
    },
    
    // إضافة زر الطباعة
    addPrintButton() {
        const existingButton = document.querySelector('.print-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const printButton = document.createElement('button');
        printButton.className = 'btn btn-primary print-button';
        printButton.innerHTML = '🖨️ طباعة البطاقة';
        printButton.onclick = () => window.print();
        
        document.body.appendChild(printButton);
    }
};