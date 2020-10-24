const mitt = require('mitt');

class WebSocketClient {
    constructor(url) {
        this.socket = new WebSocket(url, ['json']);
        this.isConnected = false;
        this.queue = [];
        this._emitter = mitt();

        this._configureSocket();
    }

    _configureSocket() {
        this.socket.addEventListener('open', ev => {
            this.isConnected = true;
            this._emitter.emit('connection');
            while (this.queue.length) {
                this.socket.send(this.queue.shift());
            }
        });
        this.socket.addEventListener('error', err => {
            throw err;
        });
        this.socket.addEventListener('close', () => {
            this.isConnected = false;
            this._emitter.emit('disconnect');
        });

        this.socket.addEventListener('message', ev => {
            let {action, payload} = JSON.parse(ev.data);

            this._emitter.emit(action, payload);
        });
    }

    emit(action, payload) {
        let message = JSON.stringify({action, payload});
        if (!this.isConnected) {
            this.queue.push(message);
            return;
        }

        this.socket.send(message);
    }

    on(event, handler) {
        this._emitter.on(event, handler);
    }

    disconnect() {
        this.socket.close();
    }
}

module.exports = WebSocketClient;