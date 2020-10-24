const WebSocketClient = require('../ws-client');
const Reference = require('./reference');
const DataSnapshot = require('./snapshot');

/**
 * @private refs
 */
class Database {
    constructor() {
        this.client = new WebSocketClient('ws://localhost:3000/ws/database');
        this.refs = new Map();

        this._attachListeners();
    }

    /**
     * @private
     */
    _attachListeners() {
        this.client.on('collection:changes', ({channel: name, children}) => {
            if (this.refs.has(name)) {
                let ref = this.refs.get(name);
                ref.setData(children);
                ref.emit('value', new DataSnapshot(null, children.map(child => new DataSnapshot(child._id, child))));
            }
        });

        this.client.on('collection:event', ({channel: coll, event, child}) => {
            if (this.refs.has(coll)) {
                this.refs.get(coll).emit(`event:${event}`, new DataSnapshot(child._id, child));
            }
        });
    }

    /**
     * @param {string} name
     * @return {Reference}
     */
    getRef(name) {
        if (!this.refs.has(name)) {
            this.refs.set(name, new Reference(this.client));
            this.client.emit('channel:subscribe', {channel: name});
        }

        return this.refs.get(name);
    }
}

module.exports = Database;