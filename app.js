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