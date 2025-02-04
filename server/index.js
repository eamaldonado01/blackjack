const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON, if needed:
app.use(express.json());

// Simple test route:
app.get('/', (req, res) => {
  res.send('Hello from the Blackjack server!');
});

// Start the server:
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
