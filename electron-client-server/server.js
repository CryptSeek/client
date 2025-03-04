const express = require("express");

const app = express();
const PORT = 3000;

// Allow JSON parsing
app.use(express.json());

app.post("/message", (req, res) => {
    console.log("Received:", req.body);
    res.json({ reply: `Received your message: ${req.body.message}` });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
