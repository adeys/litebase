const http = require('http');
const connect = require('connect')();
const WebSocketServer = require('./lib/ws/server');
const Database = require('./lib/database');

// Configure request handler
// Request logger
connect.use((req, res, next) => {
    res.addListener('finish', logResponse);
    next();

    function logResponse () {
        console.info('[%s] : %s %s - %i', new Date().toUTCString(), req.method, req.originalUrl, res.statusCode);
    }
});
// Headers emitter
connect.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');

    next();
});

// Route dispatcher
const Router = require('./router');
let router = new Router();
connect.use(router.dispatch);

router.get('/', (req, res) => res.end(JSON.stringify({message: 'Hello World'})));

// Error handler
connect.use((err, req, res, next) => {
    let error = {error: {code: err.code || 500, message: err.message}};

    res.statusCode = error.error.code;
    res.end(JSON.stringify(error));
    return next();
});

const server = http.createServer(connect);
server.listen(3000, () => {
    console.log('Server listening on port 3000');

    // Start web socket server
    const dbServer = new WebSocketServer(server, 'database');
    dbServer.listen(() => console.log('Database real time server started'));

    // Initialize database
    const db = new Database(dbServer);
});
