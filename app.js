const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: 'c237-boss.mysql.database.azure.com',
    user: 'c237boss',
    password: 'c237boss!',
    database: 'c237_005_team1'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

//TO DO add middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};
//TO DO add middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/habitlist');
    }
};

const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
});

//TO DO define routes
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});
//Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role === 'user')
                res.redirect('/habitlist');
            else
                res.redirect('/habitadmin');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});
//registration route
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            console.error("Registration error:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                req.flash('error', 'Email is already registered.');
                req.flash('formData', req.body);
                return res.redirect('/register');
            }
            req.flash('error', 'Registration failed. Please try again.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/deleteHabit/:id', checkAuthenticated, (req, res) => {
    const habitId = req.params.id;
    const userId = req.session.user.userId;
    db.query('DELETE FROM habit WHERE habitId = ? AND userId = ?', [habitId, userId], (error, results) => {
        if (error) {
            console.error("Error deleting habit:", error);
            res.status(500).send('Error deleting habit');
        } else {
            // Send a success response
            res.redirect('/habitlist');
        }
    });
});

app.get('/habitlist/search', checkAuthenticated, (req, res) => {
    const searchTerm = req.query.q;
    const userId = req.session.user.userId;
    const sql = "SELECT * FROM habit WHERE name LIKE ? AND userId = ?";
    db.query(sql, [`%${searchTerm}%`, userId], (err, results) => {
        if (err) {
            console.error('Search query failed:', err);
            return res.status(500).send('Database error');
        }
        res.render('habitlist', { user: req.session.user, habits: results });
    });
});

// add habit route
app.get('/addHabit', (req, res) => {
    res.render('addHabit', {user: req.session.user } ); 
});

app.post('/addHabit', checkAuthenticated, upload.single('image'), (req, res) => {
    const { name, type, date, description, feelings } = req.body;
    const userId = req.session.user.userId;
    let image = req.file ? req.file.filename : null;
    const sql = 'INSERT INTO habit (name, type, date, description, feelings, image, userId) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, type, date, description, feelings, image, userId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding habit:", error);
            res.status(500).send('Error adding habit');
        } else {
            res.redirect('/habitlist');
        }
    });
});

app.get('/habit/:id', checkAuthenticated, (req, res) => {
  // Extract the habit ID from the request parameters
  const habitId = req.params.id;

  // Fetch data from MySQL based on the habit ID
  connection.query('SELECT * FROM products WHERE habitId = ?', [habitId], (error, results) => {
      if (error) throw error;

      // Check if any habit with the given ID was found
      if (results.length > 0) {
          // Render HTML page with the habit data
          res.render('product', { habit: results[0], user: req.session.user  });
      } else {
          // If no habit with the given ID was found, render a 404 page or handle it accordingly
          res.status(404).send('habit not found');
      }
  });
});
    
//update route
app.get('/updateHabit/:id', checkAuthenticated, (req, res) => {
    const habitId = req.params.id;
    const userId = req.session.user.userId; // Adjust if your user id field is different
    const sql = 'SELECT * FROM habit WHERE habitId = ? AND userId = ?';
    db.query(sql, [habitId, userId], (error, results) => {
        if (error) throw error;
        if (results.length > 0) {
            res.render('updateHabit', { habit: results[0] });
        } else {
            res.status(404).send('Habit not found');
        }
    });
});
    
app.post('/updateHabit/:id', checkAuthenticated, upload.single('image'), (req, res) => {
    const habitId = req.params.id;
    const userId = req.session.user.userId;
    const { name, type, date, description, feelings } = req.body;
    let image = req.body.currentImage;
    if (req.file) {
        image = req.file.filename;
    }

    const sql = 'UPDATE habit SET name = ?, type = ?, date = ?, description = ?, feelings = ?, image = ? WHERE habitId = ? AND userId = ?';
    db.query(sql, [name, type, date, description, feelings, image, habitId, userId], (error, results) => {
        if (error) {
            console.error("Error updating habit:", error);
            res.status(500).send('Error updating habit');
        } else {
            res.redirect('/habitlist');
        }
    });
});

// Habit List route
app.get('/habitlist', checkAuthenticated, (req, res) => {
    const userId = req.session.user.userId;
    db.query('SELECT * FROM habit WHERE userId = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching habits:', err);
            return res.status(500).send('Database error');
        }
        res.render('habitlist', { user: req.session.user, habits: results });
    });
});

// Habit Admin route
app.get('/habitadmin', checkAuthenticated, checkAdmin, (req, res) => {
    // Get all users
    db.query('SELECT * FROM users', (userErr, users) => {
        if (userErr) {
            console.error('Error fetching users:', userErr);
            return res.status(500).send('Database error');
        }
        // Get all habits with user info
        const sql = `
            SELECT habit.*, users.username, users.email, users.userId
            FROM habit
            JOIN users ON habit.userId = users.userId
        `;
        db.query(sql, (habitErr, habits) => {
            if (habitErr) {
                console.error('Error fetching all habits:', habitErr);
                return res.status(500).send('Database error');
            }
            res.render('habitadmin', { user: req.session.user, users, habits });
        });
    });
    
});
    
app.get('/deleteHabit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const habitId = req.params.id;
    const userId = req.session.user.userId;
    db.query('DELETE FROM habit WHERE habitId = ? AND userId = ?', [habitId, userId], (error, results) => {
        if (error) {
            console.error("Error deleting habit:", error);
            res.status(500).send('Error deleting habit');
        } else {
            // Send a success response
            res.redirect('/habitlist');
        }
    });
});

// Edit any habit (GET)
app.get('/admin/updateHabit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const habitId = req.params.id;
    db.query('SELECT * FROM habit WHERE habitId = ?', [habitId], (error, results) => {
        if (error) throw error;
        if (results.length > 0) {
            res.render('updateHabit', { habit: results[0] });
        } else {
            res.status(404).send('Habit not found');
        }
    });
});

// Edit any habit (POST)
app.post('/admin/updateHabit/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const habitId = req.params.id;
    const { name, type, date, description, feelings } = req.body;
    let image = req.body.currentImage;
    if (req.file) {
        image = req.file.filename;
    }
    const sql = 'UPDATE habit SET name = ?, type = ?, date = ?, description = ?, feelings = ?, image = ? WHERE habitId = ?';
    db.query(sql, [name, type, date, description, feelings, image, habitId], (error, results) => {
        if (error) {
            console.error("Error updating habit:", error);
            res.status(500).send('Error updating habit');
        } else {
            res.redirect('/habitadmin');
        }
    });
});

// Delete any habit for admin side
app.get('/admin/deleteHabit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const habitId = req.params.id;
    db.query('DELETE FROM habit WHERE habitId = ?', [habitId], (error, results) => {
        if (error) {
            console.error("Error deleting habit:", error);
            res.status(500).send('Error deleting habit');
        } else {
            res.redirect('/habitadmin');
        }
    });
});

// Delete any user
app.get('/admin/deleteUser/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const userId = req.params.id;
    db.query('DELETE FROM users WHERE userId = ?', [userId], (error, results) => {
        if (error) {
            console.error("Error deleting user:", error);
            res.status(500).send('Error deleting user');
        } else {
            res.redirect('/habitadmin');
        }
    });
});

// Show edit user form
app.get('/admin/editUser/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const userId = req.params.id;
    db.query('SELECT * FROM users WHERE userId = ?', [userId], (err, results) => {
        if (err) {
            console.error("Error fetching user:", err);
            return res.status(500).send('Database error');
        }
        if (results.length === 0) {
            return res.status(404).send('User not found');
        }
        res.render('editUser', { userToEdit: results[0], user: req.session.user });
    });
});

// Handle edit user form submission
app.post('/admin/editUser/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const userId = req.params.id;
    const { username, email, address, contact, role } = req.body;
    const sql = 'UPDATE users SET username = ?, email = ?, address = ?, contact = ?, role = ? WHERE userId = ?';
    db.query(sql, [username, email, address, contact, role, userId], (err, results) => {
        if (err) {
            console.error("Error updating user:", err);
            return res.status(500).send('Database error');
        }
        res.redirect('/habitadmin');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

