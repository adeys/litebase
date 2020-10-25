const EventEmitter = require('events').EventEmitter;
const WebSocket = require('ws');
const { nanoid } = require('nanoid');
const Client = require('./client');

/**
 * @property {Set<string>} clients
 */
class Channel {
    constructor(name, server) {
        this.name = name;
        this.server = server;
        this.clients = new Set();
    }

    broadcast(action, payload) {
        this.clients.forEach(clientId => {
            let client = this.server.clients.get(clientId);

            if (client.isConnected()) {
                client.trigger(action, payload);
            }
        })
    }

    /**
     * @param {Client} client
     */
    addClient(client) {
        this.clients.add(client.id);
    }

    /**
     * @param {Client} client
     */
    removeClient(client) {
        if (this.clients.has(client.id)) {
            this.clients.delete(client.id);
        }
    }
}

/**
 * @property {Map<string, Channel>} channels
 * @property {Map<string, Client>} clients
 * @property {WebSocket.Server} wss
 */
class WebSocketServer extends EventEmitter {
    /**
     * @param {Server} server
     * @param {string} resource
     */
    constructor(server, resource) {
        super();

        this.server = server;
        this.res = resource;
        this.clients = new Map();
        this.channels = new Map();
        this.wss = null;
    }

    listen(callback) {
        this.wss = new WebSocket.Server({server: this.server, path: `/ws/${this.res}`});
        callback();

        this.wss.on('connection', socket => {
            console.log('A new client joined');
            let id = nanoid();
            let client = new Client(id, socket);

            this.clients.set(id, client);

            client.on('channel:subscribe', ({channel}) => {
                if (this.channels.has(channel)) {
                    channel = this.channels.get(channel);
                    channel.addClient(client);
                    client.on('disconnect', () => channel.removeClient(client));
                }
            });

            client.on('channel:unsubscribe', ({channel}) => {
                if (this.channels.has(channel)) {
                    this.channels.get(channel).removeClient(client);
                }
            });

            this.emit('connection', client);
        });
    }

    addChannel(channel) {
        channel = new Channel(channel, this);
        this.channels.set(channel.name, channel);

        return channel;
    }
}

module.exports = WebSocketServer;