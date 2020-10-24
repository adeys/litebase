const WebSocket = require('ws');
const EventEmitter = require('events').EventEmitter;

class Client extends EventEmitter {
    /**
     * @param {string} id
     * @param {WebSocket} socket
     */
    constructor(id, socket) {
        super();
        this.id = id;
        this.socket = socket;

        this.attachListeners();
    }

    attachListeners() {
        this.socket.on('close', () => {
            this.emit('disconnect');
        });

        this.socket.on('message', message => {
            let {action, payload} = JSON.parse(message);

            this.emit(action, payload);
        });
    }

    isConnected() {
        return this.socket.readyState === WebSocket.OPEN;
    }

    trigger(action, payload) {
        this.socket.send(JSON.stringify(JSON.stringify({action, payload})), {}, (err) => {
            if (err) console.error(`[WebSocket.emit] ${err}`);
        });
    }
}

module.exports = Client;