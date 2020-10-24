import mitt from 'mitt';

class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.queue = [];
        this._emitter = mitt();
        this.ttl = 5; // Time to wait before reconnect
        this.connectionTimer = null;
    }

    connect() {
        this._scheduleConnect(0);
    }

    /**
     * @private
     */
    _connectServer() {
        this.socket = new WebSocket(this.url, ['json']);
        this._configureSocket();
    }

    /**
     * @param delay
     * @private
     */
    _scheduleConnect(delay) {
        if (this.socket !== null) {
            console.info('Connection already established');
            return;
        }

        clearTimeout(this.connectionTimer);

        // Reconnect after 'this.ttl' seconds
        this.connectionTimer = setTimeout(() => {
            this._connectServer();
        }, delay * 1000);
    }

    _configureSocket() {
        this.socket.addEventListener('open', ev => {
            this._emitter.emit('connection');
            while (this.queue.length) {
                this.socket.send(this.queue.shift());
            }
        });

        this.socket.addEventListener('error', err => {
            this.socket && this.socket.close(); // Close connection on error
            throw err;
        });

        this.socket.addEventListener('close', () => {
            this._emitter.emit('disconnect');
            this.socket = null;
            this._scheduleConnect(this.ttl);
            this.ttl *= 2;
        });

        this.socket.addEventListener('message', ev => {
            let {action, payload} = JSON.parse(ev.data);

            this._emitter.emit(action, payload);
        });
    }

    emit(action, payload) {
        let message = JSON.stringify({action, payload});
        if (!this.isConnected()) {
            this.queue.push(message);
            return;
        }

        this.socket.send(message);
    }

    on(event, handler) {
        this._emitter.on(event, handler);
    }

    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }

    disconnect() {
        this.socket.close();
    }
}

export default WebSocketClient;