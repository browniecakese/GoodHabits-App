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

const connection = mysql.createConnection({
    host: 'zwicym.h.filess.io',
    user: 'C237T1_rockthemto',
    password: '2ea3773010b897360db0a290675f29be40bffbba',
    database: 'C237T1'
  });

connection.connect((err) => {
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
        res.redirect('/');
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

//TO DO define routes
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role == 'user')
                res.redirect('/shopping');
            else
                res.redirect('/inventory');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/deleteHabit/:id', (req, res) => {
    const habitId = req.params.id;

    connection.query('DELETE FROM products WHERE habitId = ?', [habitId], (error, results) => {
        if (error) {
            console.error("Error deleting habit:", error);
            res.status(500).send('Error deleting habit');
        } else {
            // Send a success response
            res.redirect('/habitlist');
        }
    });
});

app.get('/habits/search', (req, res) => {
    const searchTerm = req.query.q;

    const sql = "SELECT * FROM habits WHERE name LIKE ?";
    const values = [`%${searchTerm}%`];

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Search query failed:', err);
            return res.status(500).send('Database error');
        }
        res.render('habits', { habits: results });
    });
});

// route to add habit
app.get('/addHabit', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addHabit', {user: req.session.user } ); 
});

app.post('/addHabit', upload.single('image'),  (req, res) => {
    // Extract product data from the request body
    const { name, quantity, price} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
    // Insert the new product into the database
    connection.query(sql , [name, quantity, price, image], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding habit:", error);
            res.status(500).send('Error adding habit');
        } else {
            // Send a success response
            res.redirect('/habitList');
        }
    });
});

//update route
app.get('/updateHabit/:id',checkAuthenticated, checkAdmin, (req,res) => {
    const habitId = req.params.id;
    const sql = 'SELECT * FROM habit WHERE habitId = ?';
    connection.query(sql , [habitId], (error, results) => {
        if (error) throw error;
        if (results.length > 0) {
            res.render('updateHabit', { habit: results[0] });
        } else {
            res.status(404).send('Habit not found');
        }
    });
});
    
app.post('/updateHabit/:id', upload.single('image'), (req, res) => {
    const habitId = req.params.id;
    const { name, type, date, description, feeling } = req.body;
    let image  = req.body.currentImage; 
    if (req.file) { 
        image = req.file.filename; 
    } 

    const sql = 'UPDATE habit SET name = ? , type = ?, date =?, description = ?, feeling = ?, image =? WHERE habitId = ?';
    connection.query(sql, [name, type, date, description, feeling, image, habitId], (error, results) => {
        if (error) {
            console.error("Error updating habit:", error);
            res.status(500).send('Error updating habit');
        } else {
            res.redirect('/inventory');
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

