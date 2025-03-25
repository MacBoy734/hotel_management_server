const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require("socket.io");
const http = require("http");

require('dotenv').config();

const app = express();
const server = http.createServer(app); // Wrap Express inside HTTP server

app.set('trust proxy', 1);
const events = require('events');
events.EventEmitter.defaultMaxListeners = 20;

//RATE LIMITING MIDDLEWARE
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 150, 
    message: 'Too many requests from this IP, please try again after 10 minutes',
    statusCode: 429,
});

app.use(limiter);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB_URI)
    .then(() => console.log('Connected to database...'))
    .catch(error => console.error(error.message));

app.use(cookieParser());

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route Handlers
app.get('/', (req, res) => {
    res.send('This is the homepage!');
});


// **🔌 Setup Socket.IO**
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"]
    }
});

// Middleware to attach `io` to `req`
app.use((req, res, next) => {
    req.io = io;
    next();
  })

// **🌍 WebSocket Events**
io.on("connection", (socket) => {
    console.log("New client connected: " + socket.id);

    socket.on("disconnect", () => {
        console.log("User disconnected: " + socket.id);
    });
});
app.use('/users', require('./routes/users_route'));
app.use('/foods', require('./routes/foods_route'));
app.use('/orders', require('./routes/orders_route'));


// Start the server with `server.listen()`
const port = process.env.PORT || 5000;
server.listen(port, () => console.log('App started at port %s', port));
