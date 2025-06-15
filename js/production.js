// production.js - الدورة الإنتاجية

const ProductionManager = {
    // تحميل بيانات الدورة الإنتاجية
    async loadProductionData() {
        try {
            const tbody = document.getElementById('productionTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            const allSheep = await SheepManager.getAllSheep();
            const pregnancies = await API.pregnancies.getAll();
            
            const adultFemales = allSheep.filter(sheep => 
                sheep.gender === 'أنثى' && 
                sheep.status === 'موجود' &&
                (Utils.determineStage(sheep.birth_date, sheep.gender) === 'بالغ' || 
                 Utils.determineStage(sheep.birth_date, sheep.gender) === 'كبير السن')
            );
            
            if (adultFemales.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد إناث بالغة في القطيع
                        </td>
                    </tr>
                `;
                this.updateStats([]);
                return;
            }
            
            const productionData = [];
            
            for (const female of adultFemales) {
                const femalePregnancies = pregnancies
                    .filter(p => p.sheep_id === female.id)
                    .sort((a, b) => new Date(b.pregnancy_date) - new Date(a.pregnancy_date));
                
                const lastPregnancy = femalePregnancies[0];
                const lastBirth = femalePregnancies.find(p => p.actual_birth_date);
                
                const cycleData = await this.calculateCycles(female.id, femalePregnancies);
                const status = await this.getProductionStatus(female.id, pregnancies);
                
                const daysSinceLastBirth = lastBirth ? 
                    Math.ceil((new Date() - new Date(lastBirth.actual_birth_date)) / (1000 * 60 * 60 * 24)) : '-';
                
                const statusClass = {
                    'حامل': 'status-alive',
                    'جاهزة للتزاوج': 'status-sold',
                    'فترة نفاس': 'status-dead',
                    'متأخرة': 'weight-decrease',
                    'طال انقطاعها': 'weight-decrease',
                    'لم تحمل بعد': ''
                }[status] || '';
                
                const rowData = {
                    female: female,
                    lastPregnancy: lastPregnancy,
                    lastBirth: lastBirth,
                    daysSinceLastBirth: daysSinceLastBirth,
                    status: status,
                    cycleData: cycleData
                };
                
                productionData.push(rowData);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${female.id}</td>
                    <td>${Utils.calculateAgeShort(female.birth_date)}</td>
                    <td>${lastPregnancy ? Utils.formatDate(lastPregnancy.pregnancy_date) : '-'}</td>
                    <td>${lastBirth ? Utils.formatDate(lastBirth.actual_birth_date) : '-'}</td>
                    <td>${daysSinceLastBirth}</td>
                    <td><span class="${statusClass}">${status}</span></td>
                    <td>${cycleData.cycles}</td>
                    <td>${cycleData.avgCycleDays || '-'}</td>
                    <td>${cycleData.birthsPerYear || '-'}</td>
                    <td>${cycleData.totalBirths}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="PregnancyManager.viewFemaleHistory('${female.id}')" title="عرض التفاصيل">📊</button>
                    </td>
                `;
                tbody.appendChild(row);
            }
            
            this.updateStats(productionData);
            
        } catch (error) {
            console.error('خطأ في تحميل بيانات الدورة الإنتاجية:', error);
        }
    },

    // حساب الدورات الإنتاجية
    async calculateCycles(femaleId, pregnancies) {
        try {
            const completedPregnancies = pregnancies
                .filter(p => p.actual_birth_date)
                .sort((a, b) => new Date(a.actual_birth_date) - new Date(b.actual_birth_date));
            
            if (completedPregnancies.length < 2) {
                return {
                    cycles: 0,
                    avgCycleDays: 0,
                    birthsPerYear: 0,
                    totalBirths: completedPregnancies.reduce((sum, p) => sum + (p.birth_count || 0), 0)
                };
            }
            
            let totalCycleDays = 0;
            let cycleCount = 0;
            
            for (let i = 1; i < completedPregnancies.length; i++) {
                const prevBirth = new Date(completedPregnancies[i-1].actual_birth_date);
                const currentBirth = new Date(completedPregnancies[i].actual_birth_date);
                const cycleDays = Math.ceil((currentBirth - prevBirth) / (1000 * 60 * 60 * 24));
                
                if (cycleDays > 0 && cycleDays < 400) {
                    totalCycleDays += cycleDays;
                    cycleCount++;
                }
            }
            
            const avgCycleDays = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;
            const birthsPerYear = avgCycleDays > 0 ? (365 / avgCycleDays).toFixed(2) : 0;
            const totalBirths = completedPregnancies.reduce((sum, p) => sum + (p.birth_count || 0), 0);
            
            return {
                cycles: cycleCount,
                avgCycleDays: avgCycleDays,
                birthsPerYear: birthsPerYear,
                totalBirths: totalBirths
            };
        } catch (error) {
            console.error('خطأ في حساب الدورات الإنتاجية:', error);
            return {
                cycles: 0,
                avgCycleDays: 0,
                birthsPerYear: 0,
                totalBirths: 0
            };
        }
    },

    // حالة الإنتاج
    async getProductionStatus(femaleId, pregnancies) {
        const lastPregnancy = pregnancies
            .filter(p => p.sheep_id === femaleId && p.actual_birth_date)
            .sort((a, b) => new Date(b.actual_birth_date) - new Date(a.actual_birth_date))[0];
        
        const currentPregnancy = pregnancies
            .find(p => p.sheep_id === femaleId && !p.actual_birth_date);
        
        if (currentPregnancy) {
            return 'حامل';
        }
        
        if (!lastPregnancy) {
            return 'لم تحمل بعد';
        }
        
        const daysSinceBirth = Math.ceil((new Date() - new Date(lastPregnancy.actual_birth_date)) / (1000 * 60 * 60 * 24));
        
        if (daysSinceBirth < 45) {
            return 'فترة نفاس';
        } else if (daysSinceBirth >= 45 && daysSinceBirth <= 90) {
            return 'جاهزة للتزاوج';
        } else if (daysSinceBirth > 90 && daysSinceBirth <= 150) {
            return 'متأخرة';
        } else {
            return 'طال انقطاعها';
        }
    },

    // تحديث الإحصائيات
    updateStats(productionData) {
        let totalAvgDays = 0;
        let validCycleCount = 0;
        let readyForMating = 0;
        let productiveFemales = 0;
        let totalBirthsPerYear = 0;
        
        productionData.forEach(data => {
            if (data.cycleData.avgCycleDays > 0) {
                totalAvgDays += data.cycleData.avgCycleDays;
                validCycleCount++;
                totalBirthsPerYear += parseFloat(data.cycleData.birthsPerYear);
            }
            
            if (data.status === 'جاهزة للتزاوج') {
                readyForMating++;
            }
            
            if (data.cycleData.totalBirths > 0) {
                productiveFemales++;
            }
        });
        
        const avgProductionCycle = validCycleCount > 0 ? 
            Math.round(totalAvgDays / validCycleCount) : 0;
        const avgBirthsPerYear = validCycleCount > 0 ? 
            (totalBirthsPerYear / validCycleCount).toFixed(2) : 0;
        
        document.getElementById('avgProductionCycle').textContent = avgProductionCycle || '-';
        document.getElementById('avgBirthsPerYear').textContent = avgBirthsPerYear || '-';
        document.getElementById('readyForMating').textContent = readyForMating;
        document.getElementById('productiveFemales').textContent = productiveFemales;
    }
};