import WebSocketClient from '../ws-client.js';
import Reference from './reference.js';
import DataSnapshot from './snapshot.js';

/**
 * @property {Map<string, Reference>} refs
 * @private refs
 */
class Database {
    /**
     * @param {string} host
     */
    constructor(host) {
        this.client = new WebSocketClient( `${host.replace('http', 'ws')}/ws/database`);
        this.refs = new Map();

        this.client.connect();
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
            this.refs.set(name, new Reference(name, this.client));
            this.client.emit('channel:subscribe', {channel: name});
        }

        return this.refs.get(name);
    }
}

export default Database;