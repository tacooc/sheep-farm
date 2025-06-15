// reports.js - التقارير

const Reports = {
    // تحديث التقارير
    async updateReports() {
        try {
            const stats = await API.stats.get();
            
            const elements = {
                avgAge: stats.avgAge || 0,
                avgWeight: stats.avgWeight ? parseFloat(stats.avgWeight).toFixed(1) : 0,
                totalBirths: stats.totalBirths || 0,
                mothersCountReport: stats.mothers || 0,
                totalWeightRecords: stats.totalWeightRecords || 0,
                totalEvents: stats.totalEvents || 0
            };
            
            for (const [id, value] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                }
            }
            
            console.log('تم تحديث التقارير');
        } catch (error) {
            console.error('خطأ في تحديث التقارير:', error);
        }
    },

    // تصدير البيانات
    async exportData() {
        try {
            const data = await API.sheep.getAll();
            if (data.length === 0) {
                UI.showAlert('لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            Utils.exportToJSON(data, 'sheep_data');
            UI.showAlert(Config.MESSAGES.success.dataExported, 'success');
        } catch (error) {
            console.error('خطأ في تصدير البيانات:', error);
        }
    },

    // مسح جميع البيانات
    async clearAllData() {
        if (confirm(Config.MESSAGES.warnings.clearAllConfirm)) {
            try {
                await API.clearAll();
                
                UI.showAlert(Config.MESSAGES.success.dataCleared, 'success');
                
                // تحديث جميع الجداول
                await UI.updateDashboard();
                await this.updateReports();
                
                switch (UI.currentTab) {
                    case 'manage':
                        await SheepManager.loadSheepData();
                        break;
                    case 'weights':
                        await WeightManager.loadWeightsData();
                        break;
                    case 'pregnancy':
                        await PregnancyManager.loadPregnancyData();
                        break;
                    case 'production':
                        await ProductionManager.loadProductionData();
                        break;
                    case 'events':
                        await EventsManager.loadEventsData();
                        break;
                }
                
                await SheepManager.populateMotherOptions();
            } catch (error) {
                console.error('خطأ في مسح البيانات:', error);
                UI.showAlert('خطأ في مسح البيانات', 'error');
            }
        }
    },

    // إضافة بيانات تجريبية
    async addSampleData() {
        try {
            UI.showAlert('جاري إضافة البيانات التجريبية...', 'success');
            
            const sampleData = [
                {
                    id: 'SH001',
                    gender: 'أنثى',
                    weight: 45.5,
                    birth_date: '2021-01-15',
                    stage: 'كبير السن',
                    birth_count: 2,
                    pen: 'A1',
                    status: 'موجود'
                },
                {
                    id: 'SH002', 
                    gender: 'ذكر',
                    mother: 'SH001',
                    weight: 55.2,
                    birth_date: '2023-07-10',
                    stage: 'بالغ',
                    birth_count: 0,
                    pen: 'A1',
                    status: 'موجود'
                },
                {
                    id: 'SH003',
                    gender: 'أنثى',
                    weight: 50.8,
                    birth_date: '2020-01-20',
                    stage: 'كبير السن',
                    birth_count: 3,
                    pen: 'B2',
                    status: 'موجود'
                }
            ];

            let added = 0;
            for (const sheep of sampleData) {
                try {
                    await API.sheep.create(sheep);
                    added++;
                    
                    // إضافة بعض الأوزان
                    if (sheep.id === 'SH001') {
                        await API.weights.add(sheep.id, { weight: 35.2, date: '2021-06-15', notes: 'وزن بعد 6 أشهر' });
                        await API.weights.add(sheep.id, { weight: 40.8, date: '2021-12-15', notes: 'وزن بعد سنة' });
                        await API.weights.add(sheep.id, { weight: 45.5, date: '2022-06-15', notes: 'الوزن الحالي' });
                    } else if (sheep.id === 'SH002') {
                        await API.weights.add(sheep.id, { weight: 25.0, date: '2023-10-10', notes: 'وزن بعد 3 أشهر' });
                        await API.weights.add(sheep.id, { weight: 40.5, date: '2024-01-10', notes: 'وزن بعد 6 أشهر' });
                        await API.weights.add(sheep.id, { weight: 55.2, date: '2024-07-10', notes: 'الوزن الحالي' });
                    }
                } catch (error) {
                    console.log('تخطي خروف موجود:', sheep.id);
                }
            }
            
            // إضافة بيانات حمل تجريبية
            const samplePregnancies = [
                {
                    sheep_id: 'SH001',
                    pregnancy_date: '2023-01-15',
                    expected_birth_date: '2023-06-13',
                    actual_birth_date: '2023-06-10',
                    birth_count: 2,
                    notes: 'ولادة طبيعية'
                },
                {
                    sheep_id: 'SH001',
                    pregnancy_date: '2023-12-01',
                    expected_birth_date: '2024-04-29',
                    actual_birth_date: null,
                    birth_count: null,
                    notes: 'حمل حالي'
                },
                {
                    sheep_id: 'SH003',
                    pregnancy_date: '2022-03-20',
                    expected_birth_date: '2022-08-16',
                    actual_birth_date: '2022-08-15',
                    birth_count: 1,
                    notes: 'ولادة طبيعية'
                }
            ];
            
            for (const pregnancy of samplePregnancies) {
                try {
                    await API.pregnancies.create(pregnancy);
                } catch (error) {
                    console.log('تجاهل خطأ الحمل المكرر:', error);
                }
            }
            
            if (added > 0) {
                UI.showAlert(`تم إضافة ${added} خروف تجريبي مع بيانات الحمل والأوزان`, 'success');
            } else {
                UI.showAlert('البيانات التجريبية موجودة مسبقاً', 'error');
            }
            
            // تحديث جميع العروض
            await UI.updateDashboard();
            await this.updateReports();
            
            switch (UI.currentTab) {
                case 'manage':
                    await SheepManager.loadSheepData();
                    break;
                case 'weights':
                    await WeightManager.loadWeightsData();
                    break;
                case 'pregnancy':
                    await PregnancyManager.loadPregnancyData();
                    break;
                case 'production':
                    await ProductionManager.loadProductionData();
                    break;
                case 'events':
                    await EventsManager.loadEventsData();
                    break;
            }
            
            await SheepManager.populateMotherOptions();
            
        } catch (error) {
            console.error('خطأ في إضافة البيانات التجريبية:', error);
            UI.showAlert('خطأ في إضافة البيانات التجريبية', 'error');
        }
    },

    // تحديث المراحل يدوياً
    async updateStagesManually() {
        try {
            UI.showAlert('جاري تحديث مراحل الأغنام...', 'success');
            
            const allSheep = await API.sheep.getAll();
            let updatedCount = 0;
            
            for (const sheep of allSheep) {
                if (sheep.birth_date && sheep.gender) {
                    const currentStage = Utils.determineStage(sheep.birth_date, sheep.gender);
                    
                    if (currentStage && currentStage !== sheep.stage) {
                        sheep.stage = currentStage;
                        await API.sheep.update(sheep.id, { stage: currentStage });
                        updatedCount++;
                    }
                }
            }
            
            if (updatedCount > 0) {
                UI.showAlert(`تم تحديث مراحل ${updatedCount} خروف`, 'success');
                if (UI.currentTab === 'manage') {
                    await SheepManager.loadSheepData();
                }
                await UI.updateDashboard();
                await this.updateReports();
            } else {
                UI.showAlert('لا توجد تغييرات في المراحل', 'success');
            }
        } catch (error) {
            console.error('خطأ في تحديث المراحل:', error);
            UI.showAlert('خطأ في تحديث المراحل', 'error');
        }
    }
};