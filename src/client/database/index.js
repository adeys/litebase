import WebSocketClient from '../ws-client.js';
import CollectionReference from './collection-reference.js';
import DataSnapshot from './snapshot.js';

/**
 * @property {Map<string, CollectionReference>} refs
 * @private refs
 */
class Database {
    /**
     * @param {string} host
     */
    constructor(host) {
        this.client = new WebSocketClient( `${host.replace('http', 'ws')}/ws/database`);
        this.refs = new Map();

        this.connect();
    }

    connect() {
        this.client.connect();
        this._attachListeners();
    }

    /**
     * @private
     */
    _attachListeners() {
        this.client.on('collection:changes', ({channel: coll, children}) => {
            if (this.refs.has(coll)) {
                let ref = this.refs.get(coll);
                ref.setData(children);
                ref.emit('value', new DataSnapshot(null, children.map(child => new DataSnapshot(child._id, child))));
            }
        });

        this.client.on('collection:event', ({channel: coll, event, child}) => {
            if (this.refs.has(coll)) {
                this.refs.get(coll).emit(`event:${event}`, new DataSnapshot(child._id, child));
            }
        });

        this.client.on('ack', ({id, success, reason}) => {
            let coll = id.split(':')[0];

            if (this.refs.has(coll)) {
                this.refs.get(coll).onAcknowledge(id, {success, reason});
            }
        });
    }

    /**
     * @param {string} name
     * @return {CollectionReference}
     */
    getRef(name) {
        if (!this.refs.has(name)) {
            this.refs.set(name, new CollectionReference(name, this.client));
            this.client.emit('channel:subscribe', {channel: name});
        }

        return this.refs.get(name);
    }
}

export default Database;