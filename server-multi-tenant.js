// server-multi-tenant.js - خادم نظام إدارة مزارع الأغنام متعدد المستخدمين
require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// مفتاح سري لـ JWT
const JWT_SECRET = process.env.JWT_SECRET || 'My$uper$ecret2024!Key@ForSheepFarm#App';

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

// إنشاء مجلد قواعد البيانات إذا لم يكن موجوداً
const dbDir = path.join(__dirname, 'databases');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

// قاعدة بيانات المستخدمين الرئيسية
const mainDb = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('خطأ في فتح قاعدة بيانات المستخدمين:', err);
    } else {
        console.log('✅ تم الاتصال بقاعدة بيانات المستخدمين');
        initMainDatabase();
    }
});

// تهيئة قاعدة بيانات المستخدمين
function initMainDatabase() {
    mainDb.serialize(() => {
        // جدول المستخدمين
        mainDb.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                farm_name TEXT NOT NULL,
                phone TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login TEXT,
                is_active BOOLEAN DEFAULT 1,
                subscription_type TEXT DEFAULT 'free',
                subscription_end_date TEXT
            )
        `, (err) => {
            if (err) {
                console.error('خطأ في إنشاء جدول المستخدمين:', err);
            } else {
                console.log('✅ تم إنشاء/التحقق من جدول المستخدمين');
            }
        });

        // جدول جلسات المستخدمين
        mainDb.run(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                device_info TEXT,
                ip_address TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('خطأ في إنشاء جدول الجلسات:', err);
            } else {
                console.log('✅ تم إنشاء/التحقق من جدول الجلسات');
            }
        });

        // جدول إحصائيات المزارع
        mainDb.run(`
            CREATE TABLE IF NOT EXISTS farm_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_sheep INTEGER DEFAULT 0,
                alive_sheep INTEGER DEFAULT 0,
                total_pens INTEGER DEFAULT 0,
                last_backup TEXT,
                storage_used_mb REAL DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('خطأ في إنشاء جدول الإحصائيات:', err);
            } else {
                console.log('✅ تم إنشاء/التحقق من جدول الإحصائيات');
            }
        });
    });
}

// دالة لإنشاء قاعدة بيانات مزرعة جديدة
function createFarmDatabase(userId, callback) {
    const dbPath = path.join(dbDir, `farm_${userId}.db`);
    const farmDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('خطأ في إنشاء قاعدة بيانات المزرعة:', err);
            callback(err);
        } else {
            console.log(`✅ تم إنشاء قاعدة بيانات للمستخدم ${userId}`);
            
            // إنشاء الجداول
            farmDb.serialize(() => {
                // جدول الأغنام
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS sheep (
                        id TEXT PRIMARY KEY,
                        gender TEXT NOT NULL,
                        mother TEXT,
                        weight REAL,
                        birth_date TEXT,
                        purchase_date TEXT,
                        death_date TEXT,
                        sale_date TEXT,
                        stage TEXT,
                        birth_count INTEGER DEFAULT 0,
                        pen TEXT,
                        status TEXT DEFAULT 'موجود',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // جدول تاريخ الأوزان
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS weight_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sheep_id TEXT NOT NULL,
                        weight REAL NOT NULL,
                        date TEXT NOT NULL,
                        notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (sheep_id) REFERENCES sheep(id) ON DELETE CASCADE
                    )
                `);

                // جدول الأحداث
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sheep_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        event_date TEXT NOT NULL,
                        notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (sheep_id) REFERENCES sheep(id) ON DELETE CASCADE
                    )
                `);

                // جدول الحمل والولادة
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS pregnancies (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sheep_id TEXT NOT NULL,
                        pregnancy_date TEXT NOT NULL,
                        expected_birth_date TEXT NOT NULL,
                        actual_birth_date TEXT,
                        birth_count INTEGER,
                        notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (sheep_id) REFERENCES sheep(id) ON DELETE CASCADE
                    )
                `);

                // جدول المعاملات المالية
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                        category TEXT NOT NULL,
                        amount REAL NOT NULL,
                        date TEXT NOT NULL,
                        description TEXT,
                        sheep_id TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (sheep_id) REFERENCES sheep(id) ON DELETE SET NULL
                    )
                `);

                // جدول الحظائر
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS pens (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        capacity INTEGER NOT NULL,
                        current_count INTEGER DEFAULT 0,
                        feed_per_head REAL DEFAULT 0,
                        meals_per_day INTEGER DEFAULT 2,
                        notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // جدول إعدادات العلف حسب المرحلة
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS feed_settings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        stage TEXT NOT NULL UNIQUE,
                        daily_feed_kg REAL NOT NULL,
                        notes TEXT
                    )
                `, (err) => {
                    if (!err) {
                        // إضافة الإعدادات الافتراضية للعلف
                        const defaultSettings = [
                            ['مولود', 0.5],
                            ['طلي', 1.0],
                            ['رخل', 1.0],
                            ['بالغ', 1.5],
                            ['كبير السن', 2.0],
                            ['حامل', 2.5]
                        ];
                        
                        defaultSettings.forEach(([stage, amount]) => {
                            farmDb.run(
                                'INSERT OR IGNORE INTO feed_settings (stage, daily_feed_kg) VALUES (?, ?)',
                                [stage, amount]
                            );
                        });
                    }
                });

                // جدول أنواع العلف
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS feed_types (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        unit TEXT DEFAULT 'كجم',
                        notes TEXT
                    )
                `, (err) => {
                    if (!err) {
                        // إضافة أنواع العلف الافتراضية
                        const defaultFeedTypes = [
                            'شعير', 'برسيم', 'بلوبنك', 'رودس', 'جت', 'حمص', 'فول', 'ذرة'
                        ];
                        
                        defaultFeedTypes.forEach(type => {
                            farmDb.run(
                                'INSERT OR IGNORE INTO feed_types (name) VALUES (?)',
                                [type]
                            );
                        });
                    }
                });

                // جدول الأحداث المجدولة
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS scheduled_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sheep_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        scheduled_date TEXT NOT NULL,
                        notes TEXT,
                        completed BOOLEAN DEFAULT 0,
                        completed_date TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (sheep_id) REFERENCES sheep(id) ON DELETE CASCADE
                    )
                `);

                // جدول خطط الوجبات للحظائر
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS pen_meal_plans (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        pen_id TEXT NOT NULL,
                        meal_number INTEGER NOT NULL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (pen_id) REFERENCES pens(id) ON DELETE CASCADE,
                        UNIQUE(pen_id, meal_number)
                    )
                `);

                // جدول تفاصيل أنواع العلف لكل وجبة
                farmDb.run(`
                    CREATE TABLE IF NOT EXISTS meal_feed_details (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        meal_plan_id INTEGER NOT NULL,
                        feed_type_id INTEGER NOT NULL,
                        percentage REAL NOT NULL CHECK(percentage > 0 AND percentage <= 100),
                        FOREIGN KEY (meal_plan_id) REFERENCES pen_meal_plans(id) ON DELETE CASCADE,
                        FOREIGN KEY (feed_type_id) REFERENCES feed_types(id)
                    )
                `);
            });

            farmDb.close((err) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    });
}

// دالة للحصول على قاعدة بيانات المستخدم
function getUserDatabase(userId, callback) {
    const dbPath = path.join(dbDir, `farm_${userId}.db`);
    
    // التحقق من وجود قاعدة البيانات
    if (!fs.existsSync(dbPath)) {
        callback(new Error('قاعدة بيانات المستخدم غير موجودة'));
        return;
    }
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            callback(err);
        } else {
            callback(null, db);
        }
    });
}

// Middleware للتحقق من المصادقة
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'رمز غير صالح' });
        }
        
        // التحقق من صلاحية الجلسة في قاعدة البيانات
        mainDb.get(
            'SELECT * FROM user_sessions WHERE token = ? AND expires_at > datetime("now")',
            [token],
            (err, session) => {
                if (err || !session) {
                    return res.status(403).json({ error: 'جلسة منتهية' });
                }
                
                req.userId = decoded.userId;
                req.token = token;
                next();
            }
        );
    });
}

// =============================================================================
// نقاط نهاية المصادقة Authentication Endpoints
// =============================================================================

// تسجيل مستخدم جديد
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, farmName, phone } = req.body;
    
    // التحقق من البيانات المطلوبة
    if (!username || !email || !password || !farmName) {
        return res.status(400).json({ error: 'جميع الحقول المطلوبة يجب ملؤها' });
    }
    
    // التحقق من قوة كلمة المرور
    if (password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }
    
    try {
        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // إدراج المستخدم الجديد
        mainDb.run(
            `INSERT INTO users (username, email, password, farm_name, phone) 
             VALUES (?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, farmName, phone],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        if (err.message.includes('username')) {
                            return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
                        } else if (err.message.includes('email')) {
                            return res.status(400).json({ error: 'البريد الإلكتروني مستخدم مسبقاً' });
                        }
                    }
                    return res.status(500).json({ error: 'خطأ في إنشاء الحساب' });
                }
                
                const userId = this.lastID;
                
                // إنشاء قاعدة بيانات المزرعة
                createFarmDatabase(userId, (err) => {
                    if (err) {
                        // حذف المستخدم إذا فشل إنشاء قاعدة البيانات
                        mainDb.run('DELETE FROM users WHERE id = ?', [userId]);
                        return res.status(500).json({ error: 'خطأ في إنشاء المزرعة' });
                    }
                    
                    // إنشاء سجل إحصائيات
                    mainDb.run(
                        'INSERT INTO farm_stats (user_id) VALUES (?)',
                        [userId]
                    );
                    
                    res.json({ 
                        message: 'تم إنشاء الحساب بنجاح',
                        userId: userId
                    });
                });
            }
        );
    } catch (error) {
        console.error('خطأ في التسجيل:', error);
        res.status(500).json({ error: 'خطأ في إنشاء الحساب' });
    }
});

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
    const { username, password, deviceInfo } = req.body;
    const ipAddress = req.ip;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }
    
    // البحث عن المستخدم
    mainDb.get(
        'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
        [username, username],
        async (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
            }
            
            // التحقق من كلمة المرور
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
            }
            
            // إنشاء رمز JWT
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            // حفظ الجلسة
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            mainDb.run(
                `INSERT INTO user_sessions (user_id, token, device_info, ip_address, expires_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [user.id, token, deviceInfo || '', ipAddress, expiresAt.toISOString()],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'خطأ في إنشاء الجلسة' });
                    }
                    
                    // تحديث آخر دخول
                    mainDb.run(
                        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                        [user.id]
                    );
                    
                    res.json({
                        message: 'تم تسجيل الدخول بنجاح',
                        token: token,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            farmName: user.farm_name,
                            subscriptionType: user.subscription_type
                        }
                    });
                }
            );
        }
    );
});

// تسجيل الخروج
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // حذف الجلسة
    mainDb.run(
        'DELETE FROM user_sessions WHERE token = ?',
        [req.token],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في تسجيل الخروج' });
            }
            res.json({ message: 'تم تسجيل الخروج بنجاح' });
        }
    );
});

// الحصول على معلومات المستخدم الحالي
app.get('/api/auth/me', authenticateToken, (req, res) => {
    mainDb.get(
        `SELECT u.*, fs.total_sheep, fs.alive_sheep, fs.total_pens, fs.storage_used_mb
         FROM users u
         LEFT JOIN farm_stats fs ON u.id = fs.user_id
         WHERE u.id = ?`,
        [req.userId],
        (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'المستخدم غير موجود' });
            }
            
            // إزالة كلمة المرور من النتائج
            delete user.password;
            
            res.json(user);
        }
    );
});

// =============================================================================
// نقاط نهاية الأغنام (محمية بالمصادقة)
// =============================================================================

// الحصول على جميع الأغنام للمستخدم
app.get('/api/sheep', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = `
            SELECT s.*, 
                   COUNT(w.id) as weight_records_count,
                   (SELECT weight FROM weight_history WHERE sheep_id = s.id ORDER BY date DESC LIMIT 1) as current_weight
            FROM sheep s
            LEFT JOIN weight_history w ON s.id = w.sheep_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `;
        
        db.all(query, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// الحصول على خروف واحد
app.get('/api/sheep/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = 'SELECT * FROM sheep WHERE id = ?';
        
        db.get(query, [req.params.id], (err, row) => {
            if (err) {
                db.close();
                res.status(500).json({ error: err.message });
            } else if (!row) {
                db.close();
                res.status(404).json({ error: 'لم يتم العثور على الخروف' });
            } else {
                // الحصول على تاريخ الأوزان
                db.all(
                    'SELECT * FROM weight_history WHERE sheep_id = ? ORDER BY date ASC',
                    [req.params.id],
                    (err, weights) => {
                        db.close();
                        if (err) {
                            res.status(500).json({ error: err.message });
                        } else {
                            row.weight_history = weights;
                            res.json(row);
                        }
                    }
                );
            }
        });
    });
});

// إضافة خروف جديد
app.post('/api/sheep', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const {
            id, gender, mother, weight, birth_date, purchase_date,
            death_date, sale_date, stage, birth_count, pen, status
        } = req.body;

        if (!id || !gender) {
            db.close();
            return res.status(400).json({ error: 'المعرف والجنس مطلوبان' });
        }

        db.run(
            `INSERT INTO sheep (id, gender, mother, weight, birth_date, purchase_date, 
                               death_date, sale_date, stage, birth_count, pen, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, gender, mother, weight, birth_date, purchase_date, 
             death_date, sale_date, stage, birth_count || 0, pen, status || 'موجود'],
            function(err) {
                if (err) {
                    db.close();
                    if (err.message.includes('UNIQUE')) {
                        res.status(400).json({ error: 'رقم الخروف موجود مسبقاً' });
                    } else {
                        res.status(500).json({ error: err.message });
                    }
                } else {
                    // إضافة الوزن الابتدائي إلى تاريخ الأوزان
                    if (weight) {
                        db.run(
                            'INSERT INTO weight_history (sheep_id, weight, date, notes) VALUES (?, ?, ?, ?)',
                            [id, weight, birth_date || new Date().toISOString().split('T')[0], 'الوزن الابتدائي'],
                            (err) => {
                                if (err) console.error('خطأ في إضافة الوزن الابتدائي:', err);
                            }
                        );
                    }
                    
                    // تحديث عدد ولادات الأم
                    if (mother) {
                        updateMotherBirthCount(db, mother);
                    }
                    
                    updateFarmStats(req.userId);
                    db.close();
                    res.json({ id, message: 'تم إضافة الخروف بنجاح' });
                }
            }
        );
    });
});

// تحديث خروف
app.put('/api/sheep/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const sheepId = req.params.id;
        const updates = req.body;
        
        const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'weight_history');
        const values = fields.map(field => updates[field]);
        
        if (fields.length === 0) {
            db.close();
            return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
        }
        
        const query = `
            UPDATE sheep 
            SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        db.run(query, [...values, sheepId], function(err) {
            if (err) {
                db.close();
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                db.close();
                res.status(404).json({ error: 'لم يتم العثور على الخروف' });
            } else {
                // تحديث عدد ولادات الأم إذا تغيرت
                if (updates.mother !== undefined) {
                    db.get('SELECT mother FROM sheep WHERE id = ?', [sheepId], (err, row) => {
                        if (!err && row) {
                            if (row.mother) updateMotherBirthCount(db, row.mother);
                            if (updates.mother) updateMotherBirthCount(db, updates.mother);
                        }
                        updateFarmStats(req.userId);
                        db.close();
                        res.json({ message: 'تم تحديث البيانات بنجاح' });
                    });
                } else {
                    updateFarmStats(req.userId);
                    db.close();
                    res.json({ message: 'تم تحديث البيانات بنجاح' });
                }
            }
        });
    });
});

// حذف خروف
app.delete('/api/sheep/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const sheepId = req.params.id;
        
        // الحصول على معرف الأم قبل الحذف
        db.get('SELECT mother FROM sheep WHERE id = ?', [sheepId], (err, row) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            
            const mother = row ? row.mother : null;
            
            // حذف الخروف
            db.run('DELETE FROM sheep WHERE id = ?', [sheepId], function(err) {
                if (err) {
                    db.close();
                    res.status(500).json({ error: err.message });
                } else if (this.changes === 0) {
                    db.close();
                    res.status(404).json({ error: 'لم يتم العثور على الخروف' });
                } else {
                    // تحديث عدد ولادات الأم
                    if (mother) {
                        updateMotherBirthCount(db, mother);
                    }
                    
                    updateFarmStats(req.userId);
                    db.close();
                    res.json({ message: 'تم حذف الخروف بنجاح' });
                }
            });
        });
    });
});

// =============================================================================
// نقاط نهاية إدارة الأوزان
// =============================================================================

// إضافة وزن جديد
app.post('/api/sheep/:id/weight', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const sheepId = req.params.id;
        const { weight, date, notes } = req.body;
        
        if (!weight || !date) {
            db.close();
            return res.status(400).json({ error: 'الوزن والتاريخ مطلوبان' });
        }
        
        db.run(
            'INSERT INTO weight_history (sheep_id, weight, date, notes) VALUES (?, ?, ?, ?)',
            [sheepId, weight, date, notes || ''],
            function(err) {
                if (err) {
                    db.close();
                    res.status(500).json({ error: err.message });
                } else {
                    // تحديث الوزن الحالي في جدول الأغنام
                    db.run(
                        'UPDATE sheep SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [weight, sheepId],
                        (err) => {
                            if (err) console.error('خطأ في تحديث الوزن الحالي:', err);
                            db.close();
                            res.json({ id: this.lastID, message: 'تم إضافة الوزن بنجاح' });
                        }
                    );
                }
            }
        );
    });
});

// الحصول على تاريخ أوزان خروف
app.get('/api/sheep/:id/weights', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = 'SELECT * FROM weight_history WHERE sheep_id = ? ORDER BY date ASC';
        
        db.all(query, [req.params.id], (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// حذف سجل وزن
app.delete('/api/weights/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const weightId = req.params.id;
        
        // الحصول على معلومات السجل قبل الحذف
        db.get('SELECT sheep_id FROM weight_history WHERE id = ?', [weightId], (err, row) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
                db.close();
                return res.status(404).json({ error: 'لم يتم العثور على سجل الوزن' });
            }
            
            const sheepId = row.sheep_id;
            
            // حذف السجل
            db.run('DELETE FROM weight_history WHERE id = ?', [weightId], function(err) {
                if (err) {
                    db.close();
                    res.status(500).json({ error: err.message });
                } else {
                    // تحديث الوزن الحالي للخروف
                    db.get(
                        'SELECT weight FROM weight_history WHERE sheep_id = ? ORDER BY date DESC LIMIT 1',
                        [sheepId],
                        (err, row) => {
                            if (!err) {
                                const newWeight = row ? row.weight : null;
                                db.run(
                                    'UPDATE sheep SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                    [newWeight, sheepId],
                                    () => {
                                        db.close();
                                        res.json({ message: 'تم حذف سجل الوزن بنجاح' });
                                    }
                                );
                            } else {
                                db.close();
                                res.json({ message: 'تم حذف سجل الوزن بنجاح' });
                            }
                        }
                    );
                }
            });
        });
    });
});

// =============================================================================
// نقاط نهاية الأحداث
// =============================================================================

// إضافة حدث جديد
app.post('/api/sheep/:id/event', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const sheepId = req.params.id;
        const { event_type, event_date, notes } = req.body;
        
        if (!event_type || !event_date) {
            db.close();
            return res.status(400).json({ error: 'نوع الحدث والتاريخ مطلوبان' });
        }
        
        db.run(
            'INSERT INTO events (sheep_id, event_type, event_date, notes) VALUES (?, ?, ?, ?)',
            [sheepId, event_type, event_date, notes || ''],
            function(err) {
                db.close();
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ id: this.lastID, message: 'تم إضافة الحدث بنجاح' });
                }
            }
        );
    });
});

// الحصول على أحداث خروف
app.get('/api/sheep/:id/events', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = 'SELECT * FROM events WHERE sheep_id = ? ORDER BY event_date DESC';
        
        db.all(query, [req.params.id], (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// حذف حدث
app.delete('/api/events/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const eventId = req.params.id;
        
        db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على الحدث' });
            } else {
                res.json({ message: 'تم حذف الحدث بنجاح' });
            }
        });
    });
});

// الحصول على جميع الأحداث
app.get('/api/events', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { type, from_date, to_date } = req.query;
        let query = `
            SELECT e.*, s.id as sheep_id, s.gender, s.stage 
            FROM events e 
            JOIN sheep s ON e.sheep_id = s.id 
            WHERE 1=1
        `;
        const params = [];
        
        if (type) {
            query += ' AND e.event_type = ?';
            params.push(type);
        }
        
        if (from_date) {
            query += ' AND e.event_date >= ?';
            params.push(from_date);
        }
        
        if (to_date) {
            query += ' AND e.event_date <= ?';
            params.push(to_date);
        }
        
        query += ' ORDER BY e.event_date DESC';
        
        db.all(query, params, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// =============================================================================
// نقاط نهاية الأحداث المجدولة
// =============================================================================

// الحصول على جميع الأحداث المجدولة
app.get('/api/scheduled-events', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { sheep_id, completed, from_date, to_date } = req.query;
        let query = `
            SELECT se.*, s.gender, s.stage 
            FROM scheduled_events se
            JOIN sheep s ON se.sheep_id = s.id
            WHERE 1=1
        `;
        const params = [];
        
        if (sheep_id) {
            query += ' AND se.sheep_id = ?';
            params.push(sheep_id);
        }
        
        if (completed !== undefined) {
            query += ' AND se.completed = ?';
            params.push(completed === 'true' ? 1 : 0);
        }
        
        if (from_date) {
            query += ' AND se.scheduled_date >= ?';
            params.push(from_date);
        }
        
        if (to_date) {
            query += ' AND se.scheduled_date <= ?';
            params.push(to_date);
        }
        
        query += ' ORDER BY se.scheduled_date ASC';
        
        db.all(query, params, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// إضافة حدث مجدول جديد
app.post('/api/scheduled-events', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { sheep_id, event_type, scheduled_date, notes } = req.body;
        
        if (!sheep_id || !event_type || !scheduled_date) {
            db.close();
            return res.status(400).json({ error: 'معرف الخروف ونوع الحدث والتاريخ المجدول مطلوبة' });
        }
        
        db.run(
            `INSERT INTO scheduled_events (sheep_id, event_type, scheduled_date, notes)
             VALUES (?, ?, ?, ?)`,
            [sheep_id, event_type, scheduled_date, notes || ''],
            function(err) {
                db.close();
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ id: this.lastID, message: 'تم جدولة الحدث بنجاح' });
                }
            }
        );
    });
});

// تحديث حدث مجدول
app.put('/api/scheduled-events/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const eventId = req.params.id;
        const updates = req.body;
        
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const values = fields.map(field => updates[field]);
        
        if (fields.length === 0) {
            db.close();
            return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
        }
        
        const query = `
            UPDATE scheduled_events 
            SET ${fields.map(f => `${f} = ?`).join(', ')}
            WHERE id = ?
        `;
        
        db.run(query, [...values, eventId], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على الحدث المجدول' });
            } else {
                res.json({ message: 'تم تحديث الحدث المجدول بنجاح' });
            }
        });
    });
});

// حذف حدث مجدول
app.delete('/api/scheduled-events/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        db.run('DELETE FROM scheduled_events WHERE id = ?', [req.params.id], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على الحدث المجدول' });
            } else {
                res.json({ message: 'تم حذف الحدث المجدول بنجاح' });
            }
        });
    });
});

// وضع علامة تم على حدث مجدول
app.post('/api/scheduled-events/:id/complete', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const eventId = req.params.id;
        
        // الحصول على معلومات الحدث المجدول
        db.get('SELECT * FROM scheduled_events WHERE id = ?', [eventId], (err, scheduledEvent) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            if (!scheduledEvent) {
                db.close();
                return res.status(404).json({ error: 'لم يتم العثور على الحدث المجدول' });
            }
            
            // إضافة الحدث إلى جدول الأحداث العادية
            db.run(
                'INSERT INTO events (sheep_id, event_type, event_date, notes) VALUES (?, ?, ?, ?)',
                [scheduledEvent.sheep_id, scheduledEvent.event_type, scheduledEvent.scheduled_date, 
                 scheduledEvent.notes || 'حدث مجدول تم تنفيذه'],
                function(err) {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // تحديث الحدث المجدول كمكتمل
                    db.run(
                        'UPDATE scheduled_events SET completed = 1, completed_date = CURRENT_TIMESTAMP WHERE id = ?',
                        [eventId],
                        function(err) {
                            db.close();
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            res.json({ message: 'تم تسجيل الحدث بنجاح' });
                        }
                    );
                }
            );
        });
    });
});

// =============================================================================
// نقاط نهاية الحمل والولادة
// =============================================================================

// الحصول على جميع سجلات الحمل
app.get('/api/pregnancies', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = `
            SELECT p.*, s.gender, s.stage 
            FROM pregnancies p
            JOIN sheep s ON p.sheep_id = s.id
            ORDER BY p.pregnancy_date DESC
        `;
        
        db.all(query, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// الحصول على سجلات حمل خروف معين
app.get('/api/sheep/:id/pregnancies', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = 'SELECT * FROM pregnancies WHERE sheep_id = ? ORDER BY pregnancy_date DESC';
        
        db.all(query, [req.params.id], (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// إضافة سجل حمل جديد
app.post('/api/pregnancies', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { sheep_id, pregnancy_date, expected_birth_date, actual_birth_date, birth_count, notes } = req.body;
        
        if (!sheep_id || !pregnancy_date || !expected_birth_date) {
            db.close();
            return res.status(400).json({ error: 'معرف الأنثى وتاريخ الحمل وتاريخ الولادة المتوقع مطلوبة' });
        }
        
        db.run(
            `INSERT INTO pregnancies (sheep_id, pregnancy_date, expected_birth_date, actual_birth_date, birth_count, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [sheep_id, pregnancy_date, expected_birth_date, actual_birth_date, birth_count, notes || ''],
            function(err) {
                db.close();
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ id: this.lastID, message: 'تم تسجيل الحمل بنجاح' });
                }
            }
        );
    });
});

// تحديث سجل حمل
app.put('/api/pregnancies/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const pregnancyId = req.params.id;
        const updates = req.body;
        
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const values = fields.map(field => updates[field]);
        
        if (fields.length === 0) {
            db.close();
            return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
        }
        
        const query = `
            UPDATE pregnancies 
            SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        db.run(query, [...values, pregnancyId], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على سجل الحمل' });
            } else {
                res.json({ message: 'تم تحديث بيانات الحمل بنجاح' });
            }
        });
    });
});

// حذف سجل حمل
app.delete('/api/pregnancies/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        db.run('DELETE FROM pregnancies WHERE id = ?', [req.params.id], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على سجل الحمل' });
            } else {
                res.json({ message: 'تم حذف سجل الحمل بنجاح' });
            }
        });
    });
});

// =============================================================================
// نقاط نهاية الإحصائيات
// =============================================================================

// الحصول على الإحصائيات
app.get('/api/stats', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const stats = {};
        
        // إحصائيات أساسية
        db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'موجود' THEN 1 ELSE 0 END) as alive,
                SUM(CASE WHEN gender = 'ذكر' THEN 1 ELSE 0 END) as male,
                SUM(CASE WHEN gender = 'أنثى' THEN 1 ELSE 0 END) as female,
                SUM(CASE WHEN status = 'متوفي' THEN 1 ELSE 0 END) as dead,
                SUM(CASE WHEN status = 'مباع' THEN 1 ELSE 0 END) as sold,
                AVG(weight) as avgWeight,
                SUM(birth_count) as totalBirths,
                COUNT(CASE WHEN birth_count > 0 THEN 1 END) as mothers
            FROM sheep
        `, (err, row) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            
            Object.assign(stats, row);
            
            // متوسط العمر
            db.get(`
                SELECT AVG(julianday('now') - julianday(birth_date)) as avgAge
                FROM sheep
                WHERE birth_date IS NOT NULL
            `, (err, row) => {
                if (!err && row) {
                    stats.avgAge = Math.round(row.avgAge || 0);
                }
                
                // إحصائيات الوزن
                db.get(`
                    SELECT COUNT(*) as totalWeightRecords
                    FROM weight_history
                `, (err, row) => {
                    if (!err && row) {
                        stats.totalWeightRecords = row.totalWeightRecords;
                    }
                    
                    // إحصائيات الأحداث
                    db.get(`
                        SELECT 
                            COUNT(*) as totalEvents,
                            COUNT(CASE WHEN event_type = 'قص صوف' THEN 1 END) as shearingEvents,
                            COUNT(CASE WHEN event_type = 'علاج' THEN 1 END) as treatmentEvents,
                            COUNT(CASE WHEN event_type = 'تطعيم' THEN 1 END) as vaccinationEvents,
                            COUNT(CASE WHEN event_type = 'أخرى' THEN 1 END) as otherEvents
                        FROM events
                    `, (err, row) => {
                        if (!err && row) {
                            stats.totalEvents = row.totalEvents;
                            stats.eventsByType = {
                                shearing: row.shearingEvents,
                                treatment: row.treatmentEvents,
                                vaccination: row.vaccinationEvents,
                                other: row.otherEvents
                            };
                        }
                        
                        // إحصائيات الحمل
                        db.get(`
                            SELECT 
                                COUNT(*) as totalPregnancies,
                                COUNT(CASE WHEN actual_birth_date IS NULL THEN 1 END) as currentPregnancies,
                                COUNT(CASE WHEN actual_birth_date IS NOT NULL THEN 1 END) as completedPregnancies,
                                SUM(birth_count) as totalNewborns
                            FROM pregnancies
                        `, (err, row) => {
                            if (!err && row) {
                                stats.pregnancies = row;
                            }
                            
                            db.close();
                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

// إحصائيات الدورة الإنتاجية
app.get('/api/production-stats', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = `
            SELECT 
                sheep_id,
                COUNT(*) as pregnancy_count,
                MIN(pregnancy_date) as first_pregnancy,
                MAX(actual_birth_date) as last_birth,
                SUM(birth_count) as total_births
            FROM pregnancies
            WHERE actual_birth_date IS NOT NULL
            GROUP BY sheep_id
        `;
        
        db.all(query, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// =============================================================================
// نقاط نهاية المعاملات المالية
// =============================================================================

// الحصول على جميع المعاملات
app.get('/api/transactions', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { type, category, from_date, to_date, sheep_id } = req.query;
        let query = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        if (from_date) {
            query += ' AND date >= ?';
            params.push(from_date);
        }
        
        if (to_date) {
            query += ' AND date <= ?';
            params.push(to_date);
        }
        
        if (sheep_id) {
            query += ' AND sheep_id = ?';
            params.push(sheep_id);
        }
        
        query += ' ORDER BY date DESC, created_at DESC';
        
        db.all(query, params, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// إضافة معاملة جديدة
app.post('/api/transactions', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { type, category, amount, date, description, sheep_id } = req.body;
        
        if (!type || !category || !amount || !date) {
            db.close();
            return res.status(400).json({ error: 'النوع والفئة والمبلغ والتاريخ مطلوبة' });
        }
        
        if (type !== 'income' && type !== 'expense') {
            db.close();
            return res.status(400).json({ error: 'النوع يجب أن يكون income أو expense' });
        }
        
        db.run(
            `INSERT INTO transactions (type, category, amount, date, description, sheep_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [type, category, amount, date, description || '', sheep_id || null],
            function(err) {
                db.close();
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ id: this.lastID, message: 'تم إضافة المعاملة بنجاح' });
                }
            }
        );
    });
});

// تحديث معاملة
app.put('/api/transactions/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const transactionId = req.params.id;
        const updates = req.body;
        
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const values = fields.map(field => updates[field]);
        
        if (fields.length === 0) {
            db.close();
            return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
        }
        
        const query = `
            UPDATE transactions 
            SET ${fields.map(f => `${f} = ?`).join(', ')}
            WHERE id = ?
        `;
        
        db.run(query, [...values, transactionId], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على المعاملة' });
            } else {
                res.json({ message: 'تم تحديث المعاملة بنجاح' });
            }
        });
    });
});

// حذف معاملة
app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        db.run('DELETE FROM transactions WHERE id = ?', [req.params.id], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على المعاملة' });
            } else {
                res.json({ message: 'تم حذف المعاملة بنجاح' });
            }
        });
    });
});

// الحصول على ملخص المعاملات
app.get('/api/transactions/summary', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { from_date, to_date } = req.query;
        let dateCondition = '';
        const params = [];
        
        if (from_date && to_date) {
            dateCondition = ' WHERE date BETWEEN ? AND ?';
            params.push(from_date, to_date);
        } else if (from_date) {
            dateCondition = ' WHERE date >= ?';
            params.push(from_date);
        } else if (to_date) {
            dateCondition = ' WHERE date <= ?';
            params.push(to_date);
        }
        
        db.get(`
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
                SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance,
                COUNT(*) as total_transactions,
                COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
                COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
            FROM transactions${dateCondition}
        `, params, (err, summary) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            
            // الحصول على المعاملات حسب الفئة
            db.all(`
                SELECT 
                    category,
                    type,
                    SUM(amount) as total,
                    COUNT(*) as count
                FROM transactions${dateCondition}
                GROUP BY category, type
                ORDER BY total DESC
            `, params, (err, categories) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    summary: summary || {
                        total_income: 0,
                        total_expense: 0,
                        balance: 0,
                        total_transactions: 0,
                        income_count: 0,
                        expense_count: 0
                    },
                    categories: categories || []
                });
            });
        });
    });
});

// =============================================================================
// نقاط نهاية الحظائر
// =============================================================================

// الحصول على جميع الحظائر
app.get('/api/pens', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const query = `
            SELECT p.*, 
                   COUNT(s.id) as sheep_count,
                   GROUP_CONCAT(s.id) as sheep_ids
            FROM pens p
            LEFT JOIN sheep s ON s.pen = p.id AND s.status = 'موجود'
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        
        db.all(query, (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// الحصول على حظيرة واحدة مع تفاصيل الأغنام
app.get('/api/pens/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        
        // الحصول على معلومات الحظيرة
        db.get('SELECT * FROM pens WHERE id = ?', [penId], (err, pen) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            if (!pen) {
                db.close();
                return res.status(404).json({ error: 'لم يتم العثور على الحظيرة' });
            }
            
            // الحصول على الأغنام في الحظيرة
            db.all(
                'SELECT * FROM sheep WHERE pen = ? AND status = "موجود" ORDER BY id',
                [penId],
                (err, sheep) => {
                    db.close();
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    pen.sheep = sheep;
                    res.json(pen);
                }
            );
        });
    });
});

// إضافة حظيرة جديدة
app.post('/api/pens', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { id, name, capacity, feed_per_head, meals_per_day, notes } = req.body;
        
        if (!id || !name || !capacity) {
            db.close();
            return res.status(400).json({ error: 'المعرف والاسم والسعة مطلوبة' });
        }
        
        db.run(
            `INSERT INTO pens (id, name, capacity, feed_per_head, meals_per_day, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, capacity, feed_per_head || 0, meals_per_day || 2, notes || ''],
            function(err) {
                if (err) {
                    db.close();
                    if (err.message.includes('UNIQUE')) {
                        res.status(400).json({ error: 'رقم الحظيرة موجود مسبقاً' });
                    } else {
                        res.status(500).json({ error: err.message });
                    }
                } else {
                    updateFarmStats(req.userId);
                    db.close();
                    res.json({ id, message: 'تم إضافة الحظيرة بنجاح' });
                }
            }
        );
    });
});

// تحديث حظيرة
app.put('/api/pens/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        const updates = req.body;
        
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const values = fields.map(field => updates[field]);
        
        if (fields.length === 0) {
            db.close();
            return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
        }
        
        const query = `
            UPDATE pens 
            SET ${fields.map(f => `${f} = ?`).join(', ')}
            WHERE id = ?
        `;
        
        db.run(query, [...values, penId], function(err) {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'لم يتم العثور على الحظيرة' });
            } else {
                res.json({ message: 'تم تحديث الحظيرة بنجاح' });
            }
        });
    });
});

// حذف حظيرة
app.delete('/api/pens/:id', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        
        // التحقق من عدم وجود أغنام في الحظيرة
        db.get(
            'SELECT COUNT(*) as count FROM sheep WHERE pen = ? AND status = "موجود"',
            [penId],
            (err, row) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                
                if (row.count > 0) {
                    db.close();
                    return res.status(400).json({ error: 'لا يمكن حذف حظيرة تحتوي على أغنام' });
                }
                
                db.run('DELETE FROM pens WHERE id = ?', [penId], function(err) {
                    if (err) {
                        db.close();
                        res.status(500).json({ error: err.message });
                    } else if (this.changes === 0) {
                        db.close();
                        res.status(404).json({ error: 'لم يتم العثور على الحظيرة' });
                    } else {
                        updateFarmStats(req.userId);
                        db.close();
                        res.json({ message: 'تم حذف الحظيرة بنجاح' });
                    }
                });
            }
        );
    });
});

// الحصول على إعدادات العلف
app.get('/api/feed-settings', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        db.all('SELECT * FROM feed_settings ORDER BY stage', (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// تحديث إعدادات العلف
app.put('/api/feed-settings/:stage', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { stage } = req.params;
        const { daily_feed_kg, notes } = req.body;
        
        if (!daily_feed_kg) {
            db.close();
            return res.status(400).json({ error: 'كمية العلف اليومية مطلوبة' });
        }
        
        db.run(
            'UPDATE feed_settings SET daily_feed_kg = ?, notes = ? WHERE stage = ?',
            [daily_feed_kg, notes || '', stage],
            function(err) {
                if (err) {
                    db.close();
                    res.status(500).json({ error: err.message });
                } else if (this.changes === 0) {
                    // إذا لم يكن موجوداً، أضفه
                    db.run(
                        'INSERT INTO feed_settings (stage, daily_feed_kg, notes) VALUES (?, ?, ?)',
                        [stage, daily_feed_kg, notes || ''],
                        function(err) {
                            db.close();
                            if (err) {
                                res.status(500).json({ error: err.message });
                            } else {
                                res.json({ message: 'تم حفظ إعدادات العلف' });
                            }
                        }
                    );
                } else {
                    db.close();
                    res.json({ message: 'تم تحديث إعدادات العلف' });
                }
            }
        );
    });
});

// حساب احتياجات العلف لحظيرة معينة
app.get('/api/pens/:id/feed-calculation', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        
        // الحصول على معلومات الحظيرة والأغنام فيها
        db.get('SELECT * FROM pens WHERE id = ?', [penId], (err, pen) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            if (!pen) {
                db.close();
                return res.status(404).json({ error: 'لم يتم العثور على الحظيرة' });
            }
            
            // الحصول على الأغنام مع مراحلهم
            const query = `
                SELECT 
                    s.id,
                    s.gender,
                    s.birth_date,
                    s.stage,
                    CASE 
                        WHEN p.sheep_id IS NOT NULL AND p.actual_birth_date IS NULL THEN 'حامل'
                        ELSE s.stage
                    END as effective_stage
                FROM sheep s
                LEFT JOIN (
                    SELECT sheep_id, actual_birth_date 
                    FROM pregnancies 
                    WHERE actual_birth_date IS NULL
                ) p ON s.id = p.sheep_id
                WHERE s.pen = ? AND s.status = 'موجود'
            `;
            
            db.all(query, [penId], (err, sheep) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                
                // الحصول على إعدادات العلف
                db.all('SELECT * FROM feed_settings', (err, feedSettings) => {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // إنشاء خريطة لإعدادات العلف
                    const feedMap = {};
                    feedSettings.forEach(fs => {
                        feedMap[fs.stage] = fs.daily_feed_kg;
                    });
                    
                    // حساب احتياجات العلف
                    let totalDailyFeed = 0;
                    const sheepDetails = [];
                    const stageSummary = {};
                    
                    sheep.forEach(s => {
                        // تحديد المرحلة الفعلية
                        let stage = s.effective_stage;
                        if (!stage && s.birth_date && s.gender) {
                            // حساب المرحلة من تاريخ الولادة
                            const ageInDays = Math.ceil((new Date() - new Date(s.birth_date)) / (1000 * 60 * 60 * 24));
                            const ageInMonths = ageInDays / 30;
                            
                            if (ageInDays < 90) {
                                stage = 'مولود';
                            } else if (ageInMonths >= 3 && ageInMonths <= 8) {
                                stage = s.gender === 'ذكر' ? 'طلي' : 'رخل';
                            } else if (ageInMonths > 8 && ageInMonths <= 12) {
                                stage = 'بالغ';
                            } else {
                                stage = 'كبير السن';
                            }
                        }
                        
                        const dailyFeed = feedMap[stage] || 1.5; // افتراضي 1.5 كجم
                        totalDailyFeed += dailyFeed;
                        
                        sheepDetails.push({
                            id: s.id,
                            stage: stage,
                            daily_feed_kg: dailyFeed
                        });
                        
                        // ملخص حسب المرحلة
                        if (!stageSummary[stage]) {
                            stageSummary[stage] = { count: 0, total_feed: 0, feed_per_head: dailyFeed };
                        }
                        stageSummary[stage].count++;
                        stageSummary[stage].total_feed += dailyFeed;
                    });
                    
                    // حساب الوجبات
                    const feedPerMeal = totalDailyFeed / pen.meals_per_day;
                    
                    db.close();
                    res.json({
                        pen_id: penId,
                        pen_name: pen.name,
                        sheep_count: sheep.length,
                        meals_per_day: pen.meals_per_day,
                        total_daily_feed_kg: totalDailyFeed,
                        feed_per_meal_kg: feedPerMeal,
                        stage_summary: stageSummary,
                        sheep_details: sheepDetails
                    });
                });
            });
        });
    });
});

// =============================================================================
// نقاط نهاية أنواع العلف
// =============================================================================

// الحصول على جميع أنواع العلف
app.get('/api/feed-types', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        db.all('SELECT * FROM feed_types ORDER BY name', (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    });
});

// إضافة نوع علف جديد
app.post('/api/feed-types', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const { name, unit, notes } = req.body;
        
        if (!name) {
            db.close();
            return res.status(400).json({ error: 'اسم نوع العلف مطلوب' });
        }
        
        db.run(
            'INSERT INTO feed_types (name, unit, notes) VALUES (?, ?, ?)',
            [name, unit || 'كجم', notes || ''],
            function(err) {
                db.close();
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        res.status(400).json({ error: 'نوع العلف موجود مسبقاً' });
                    } else {
                        res.status(500).json({ error: err.message });
                    }
                } else {
                    res.json({ id: this.lastID, message: 'تم إضافة نوع العلف بنجاح' });
                }
            }
        );
    });
});

// الحصول على خطة وجبات حظيرة
app.get('/api/pens/:id/meal-plans', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        
        const query = `
            SELECT 
                pmp.id,
                pmp.meal_number,
                mfd.percentage,
                ft.id as feed_type_id,
                ft.name as feed_type_name,
                ft.unit
            FROM pen_meal_plans pmp
            LEFT JOIN meal_feed_details mfd ON pmp.id = mfd.meal_plan_id
            LEFT JOIN feed_types ft ON mfd.feed_type_id = ft.id
            WHERE pmp.pen_id = ?
            ORDER BY pmp.meal_number, ft.name
        `;
        
        db.all(query, [penId], (err, rows) => {
            db.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                // تنظيم البيانات حسب رقم الوجبة
                const mealPlans = {};
                rows.forEach(row => {
                    if (!mealPlans[row.meal_number]) {
                        mealPlans[row.meal_number] = {
                            meal_number: row.meal_number,
                            feed_types: []
                        };
                    }
                    if (row.feed_type_id) {
                        mealPlans[row.meal_number].feed_types.push({
                            id: row.feed_type_id,
                            name: row.feed_type_name,
                            percentage: row.percentage,
                            unit: row.unit
                        });
                    }
                });
                
                res.json(Object.values(mealPlans));
            }
        });
    });
});

// حفظ خطة وجبة للحظيرة
app.post('/api/pens/:id/meal-plans', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        const { meal_number, feed_types } = req.body;
        
        if (!meal_number || !feed_types || feed_types.length === 0) {
            db.close();
            return res.status(400).json({ error: 'رقم الوجبة وأنواع العلف مطلوبة' });
        }
        
        // التحقق من أن مجموع النسب = 100%
        const totalPercentage = feed_types.reduce((sum, ft) => sum + ft.percentage, 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
            db.close();
            return res.status(400).json({ error: 'مجموع نسب العلف يجب أن يساوي 100%' });
        }
        
        db.serialize(() => {
            // البدء بمعاملة
            db.run('BEGIN TRANSACTION');
            
            // إضافة أو تحديث خطة الوجبة
            db.run(
                `INSERT OR REPLACE INTO pen_meal_plans (pen_id, meal_number) 
                 VALUES (?, ?)`,
                [penId, meal_number],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        db.close();
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const mealPlanId = this.lastID;
                    
                    // حذف التفاصيل القديمة
                    db.run(
                        'DELETE FROM meal_feed_details WHERE meal_plan_id = ?',
                        [mealPlanId],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                db.close();
                                return res.status(500).json({ error: err.message });
                            }
                            
                            // إضافة التفاصيل الجديدة
                            let completed = 0;
                            let hasError = false;
                            
                            feed_types.forEach(ft => {
                                db.run(
                                    `INSERT INTO meal_feed_details (meal_plan_id, feed_type_id, percentage)
                                     VALUES (?, ?, ?)`,
                                    [mealPlanId, ft.feed_type_id, ft.percentage],
                                    (err) => {
                                        if (err && !hasError) {
                                            hasError = true;
                                            db.run('ROLLBACK');
                                            db.close();
                                            return res.status(500).json({ error: err.message });
                                        }
                                        
                                        completed++;
                                        if (completed === feed_types.length && !hasError) {
                                            db.run('COMMIT');
                                            db.close();
                                            res.json({ message: 'تم حفظ خطة الوجبة بنجاح' });
                                        }
                                    }
                                );
                            });
                        }
                    );
                }
            );
        });
    });
});

// حساب احتياجات العلف المفصلة للحظيرة
app.get('/api/pens/:id/detailed-feed-calculation', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        const penId = req.params.id;
        
        // الحصول على حساب العلف الأساسي أولاً
        db.get('SELECT * FROM pens WHERE id = ?', [penId], (err, pen) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: err.message });
            }
            if (!pen) {
                db.close();
                return res.status(404).json({ error: 'لم يتم العثور على الحظيرة' });
            }
            
            // حساب إجمالي العلف المطلوب (نفس الكود السابق)
            const query = `
                SELECT 
                    s.id,
                    s.gender,
                    s.birth_date,
                    s.stage,
                    CASE 
                        WHEN p.sheep_id IS NOT NULL AND p.actual_birth_date IS NULL THEN 'حامل'
                        ELSE s.stage
                    END as effective_stage
                FROM sheep s
                LEFT JOIN (
                    SELECT sheep_id, actual_birth_date 
                    FROM pregnancies 
                    WHERE actual_birth_date IS NULL
                ) p ON s.id = p.sheep_id
                WHERE s.pen = ? AND s.status = 'موجود'
            `;
            
            db.all(query, [penId], (err, sheep) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                
                db.all('SELECT * FROM feed_settings', (err, feedSettings) => {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const feedMap = {};
                    feedSettings.forEach(fs => {
                        feedMap[fs.stage] = fs.daily_feed_kg;
                    });
                    
                    let totalDailyFeed = 0;
                    sheep.forEach(s => {
                        let stage = s.effective_stage;
                        if (!stage && s.birth_date && s.gender) {
                            const ageInDays = Math.ceil((new Date() - new Date(s.birth_date)) / (1000 * 60 * 60 * 24));
                            const ageInMonths = ageInDays / 30;
                            
                            if (ageInDays < 90) {
                                stage = 'مولود';
                            } else if (ageInMonths >= 3 && ageInMonths <= 8) {
                                stage = s.gender === 'ذكر' ? 'طلي' : 'رخل';
                            } else if (ageInMonths > 8 && ageInMonths <= 12) {
                                stage = 'بالغ';
                            } else {
                                stage = 'كبير السن';
                            }
                        }
                        
                        const dailyFeed = feedMap[stage] || 1.5;
                        totalDailyFeed += dailyFeed;
                    });
                    
                    const feedPerMeal = totalDailyFeed / pen.meals_per_day;
                    
                    // الحصول على خطط الوجبات
                    const mealPlansQuery = `
                        SELECT 
                            pmp.meal_number,
                            mfd.percentage,
                            ft.id as feed_type_id,
                            ft.name as feed_type_name
                        FROM pen_meal_plans pmp
                        LEFT JOIN meal_feed_details mfd ON pmp.id = mfd.meal_plan_id
                        LEFT JOIN feed_types ft ON mfd.feed_type_id = ft.id
                        WHERE pmp.pen_id = ?
                        ORDER BY pmp.meal_number, ft.name
                    `;
                    
                    db.all(mealPlansQuery, [penId], (err, mealPlans) => {
                        db.close();
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        
                        // تنظيم البيانات
                        const detailedMeals = {};
                        
                        for (let i = 1; i <= pen.meals_per_day; i++) {
                            detailedMeals[i] = {
                                meal_number: i,
                                total_feed_kg: feedPerMeal,
                                feed_types: []
                            };
                        }
                        
                        mealPlans.forEach(plan => {
                            if (plan.feed_type_id) {
                                const amount = (feedPerMeal * plan.percentage / 100).toFixed(2);
                                detailedMeals[plan.meal_number].feed_types.push({
                                    name: plan.feed_type_name,
                                    percentage: plan.percentage,
                                    amount_kg: parseFloat(amount)
                                });
                            }
                        });
                        
                        res.json({
                            pen_id: penId,
                            pen_name: pen.name,
                            sheep_count: sheep.length,
                            total_daily_feed_kg: totalDailyFeed,
                            meals: Object.values(detailedMeals)
                        });
                    });
                });
            });
        });
    });
});

// =============================================================================
// نقاط نهاية إضافية
// =============================================================================

// حذف جميع البيانات
app.delete('/api/clear-all', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        db.serialize(() => {
            db.run('DELETE FROM scheduled_events');
            db.run('DELETE FROM events');
            db.run('DELETE FROM pregnancies');
            db.run('DELETE FROM weight_history');
            db.run('DELETE FROM sheep', (err) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                
                updateFarmStats(req.userId);
                db.close();
                res.json({ message: 'تم حذف جميع البيانات بنجاح' });
            });
        });
    });
});

// الحصول على جميع البيانات الأساسية للتطبيق
app.get('/api/initial-data', authenticateToken, (req, res) => {
    getUserDatabase(req.userId, (err, db) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الوصول لقاعدة البيانات' });
        }
        
        // استخدام Promise.all لجلب البيانات بشكل متوازي
        Promise.all([
            // الأغنام مع آخر وزن
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT s.*, 
                           (SELECT weight FROM weight_history WHERE sheep_id = s.id ORDER BY date DESC LIMIT 1) as current_weight,
                           (SELECT COUNT(*) FROM weight_history WHERE sheep_id = s.id) as weight_count,
                           (SELECT COUNT(*) FROM events WHERE sheep_id = s.id) as event_count
                    FROM sheep s
                    ORDER BY s.created_at DESC
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }),
            
            // الحظائر مع عدد الأغنام
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT p.*, 
                           COUNT(s.id) as sheep_count
                    FROM pens p
                    LEFT JOIN sheep s ON s.pen = p.id AND s.status = 'موجود'
                    GROUP BY p.id
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }),
            
            // الإحصائيات
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'موجود' THEN 1 ELSE 0 END) as alive,
                        SUM(CASE WHEN gender = 'ذكر' THEN 1 ELSE 0 END) as male,
                        SUM(CASE WHEN gender = 'أنثى' THEN 1 ELSE 0 END) as female,
                        SUM(CASE WHEN status = 'متوفي' THEN 1 ELSE 0 END) as dead,
                        SUM(CASE WHEN status = 'مباع' THEN 1 ELSE 0 END) as sold,
                        AVG(weight) as avgWeight
                    FROM sheep
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            })
        ]).then(([sheep, pens, stats]) => {
            db.close();
            res.json({
                sheep,
                pens,
                stats,
                timestamp: Date.now()
            });
        }).catch(error => {
            console.error('خطأ في جلب البيانات الأولية:', error);
            db.close();
            res.status(500).json({ error: 'خطأ في جلب البيانات الأولية' });
        });
    });
});

// =============================================================================
// وظائف مساعدة
// =============================================================================

// تحديث إحصائيات المزرعة
function updateFarmStats(userId) {
    getUserDatabase(userId, (err, db) => {
        if (err) return;
        
        db.get(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'موجود' THEN 1 ELSE 0 END) as alive,
                (SELECT COUNT(*) FROM pens) as pens
             FROM sheep`,
            (err, stats) => {
                db.close();
                
                if (!err && stats) {
                    mainDb.run(
                        `UPDATE farm_stats 
                         SET total_sheep = ?, alive_sheep = ?, total_pens = ?, updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = ?`,
                        [stats.total, stats.alive, stats.pens, userId]
                    );
                }
            }
        );
    });
}

// تحديث عدد ولادات الأم
function updateMotherBirthCount(db, motherId) {
    if (!motherId) return;
    
    db.get(
        'SELECT COUNT(*) as count FROM sheep WHERE mother = ?',
        [motherId],
        (err, row) => {
            if (!err && row) {
                db.run(
                    'UPDATE sheep SET birth_count = ? WHERE id = ?',
                    [row.count, motherId],
                    (err) => {
                        if (err) console.error('خطأ في تحديث عدد الولادات:', err);
                    }
                );
            }
        }
    );
}

// دالة للحصول على عناوين IP
function getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                addresses.push(interface.address);
            }
        }
    }
    
    return addresses;
}

// =============================================================================
// نقاط نهاية إدارية
// =============================================================================

// الحصول على إحصائيات جميع المزارع (للمدير)
app.get('/api/admin/farms-stats', authenticateToken, (req, res) => {
    // التحقق من صلاحيات المدير
    mainDb.get('SELECT subscription_type FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err || !user || user.subscription_type !== 'admin') {
            return res.status(403).json({ error: 'غير مصرح' });
        }
        
        mainDb.all(
            `SELECT u.id, u.username, u.farm_name, u.created_at, u.last_login,
                    fs.total_sheep, fs.alive_sheep, fs.total_pens, fs.storage_used_mb
             FROM users u
             LEFT JOIN farm_stats fs ON u.id = fs.user_id
             ORDER BY u.created_at DESC`,
            (err, farms) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json(farms);
                }
            }
        );
    });
});

// بدء الخادم
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 خادم المزارع المتعددة يعمل على:`);
    console.log(`   - المحلي: http://localhost:${PORT}`);
    
    const networkIPs = getNetworkIPs();
    networkIPs.forEach(ip => {
        console.log(`   - الشبكة: http://${ip}:${PORT}`);
    });
    
    console.log('\n📱 يمكن الوصول للنظام من أي جهاز على نفس الشبكة باستخدام عنوان الشبكة أعلاه');
});

// إغلاق قواعد البيانات عند إيقاف الخادم
process.on('SIGINT', () => {
    console.log('\n🛑 إيقاف الخادم...');
    mainDb.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('✅ تم إغلاق قواعد البيانات');
        process.exit(0);
    });
});