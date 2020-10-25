import mitt from 'mitt';
import {nanoid} from 'nanoid';
import DataSnapshot from './snapshot.js';

/**
 * @private _emitter
 * @private _data
 * @private _pendingWrites
 * @private _acks
 * @private _ids
 */
class Reference {
    /**
     * @param {string} name
     * @param {WebSocketClient} client
     */
    constructor(name, client) {
        this.name = name;
        this.client = client;
        this._emitter = mitt();
        this._data = new Map();
        this._pendingWrites = [];
        this._acks = {};
        this._ids = 0;

        this._attachListeners();
    }

    /**
     * @private
     */
    _attachListeners() {
        this.client.on('connection', () => {
            if (this.hasPendingWrites()) {
                while (this._pendingWrites.length) {
                    let {action, payload} = this._pendingWrites.shift();
                    this.client.emit(action, payload);
                }
            }
        });

        this._emitter.on('event:insert', snapshot => {
            this._data.set(snapshot.key, snapshot.getData());
            this._emitter.emit('child_added', snapshot);
        });

        this._emitter.on('event:update', snapshot => {
            this._data.set(snapshot.key, snapshot.getData());
            this._emitter.emit('child_changed', snapshot);
        });

        this._emitter.on('event:delete', snapshot => {
            this._data.delete(snapshot.key);
            this._emitter.emit('child_removed', snapshot);
        })
    }

    /* Data manipulation */
    push(doc, onComplete) {
        doc._id = doc._id || nanoid();
        if (this._data.has(doc._id)) {
            throw new Error(`Cannot overwrite existing document ${doc._id} with 'push' method. Call 'update' instead.`);
        }

        doc = {_id: doc._id, ...doc};
        this._data.set(doc._id, doc);
        this.wrapSync('collection:insert', {channel: this.name, child: doc}, onComplete);

        return new DataSnapshot(doc._id, doc);
    }

    remove(key, onComplete) {
        if (!this._data.has(key)) {
            throw new Error(`Cannot delete non existing document ${key}`);
        }

        let doc = this._data.get(key);
        this._data.delete(key);

        return this.wrapSync('collection:delete',  {channel: this.name, child: doc}, onComplete);
    }

    update(doc, onComplete) {
        if (!doc._id || !this._data.has(doc._id)) {
            throw new Error(`Cannot update non existing document ${doc._id}. Call 'push' instead.`);
        }

        this._data.set(doc._id, doc);
        return this.wrapSync('collection:update', {channel: this.name, child: doc}, onComplete);
    }

    /* Server sync */
    onAcknowledge(idx, {success, reason}) {
        let onComplete = this._acks[idx];
        delete this._acks[idx];

        if (onComplete && typeof onComplete === 'function') {
            console.info('Calling ack ' + idx);
            success ? onComplete() : onComplete(reason);
        }
    }

    /**
     * @private
     *
     * @param {string} action
     * @param {*} payload
     */
    sync(action, payload) {
        if (!this.client.isConnected()) {
            this._pendingWrites.push({action, payload});
            return;
        }

        this.client.emit(action, payload);
    }

    hasPendingWrites() {
        return this._pendingWrites.length !== 0;
    }

    /* Event handlers */
    /**
     * @private
     * @internal
     * @param event
     * @param payload
     */
    emit(event, payload) {
        this._emitter.emit(event, payload);
    }

    on(event, handler) {
        this._emitter.on(event, handler);
    }

    off(event, handler) {
        this._emitter.off(event, handler);
    }

    once(event, handler) {
        const wrapper = payload => {
            handler.call(handler, payload);
            this._emitter.off(event, wrapper);
        };

        this._emitter.on(event, wrapper);
    }

    /**
     * @private
     * @internal
     * @param {Array} data
     */
    setData(data) {
        data.forEach(child => this._data.set(child._id, child));
    }

    /**
     * @private
     * @param {string} action
     * @param {Object} payload
     * @param {function} onComplete
     */
    wrapSync(action, payload, onComplete) {
        if (onComplete) {
            let id = `${this.name}:${this._ids}`;
            payload.id = id;
            this._acks[id] = onComplete;
            this._ids++;

            console.info('Added ack ' + id);
        }

        this.sync(action, payload);
    }
}

export default Reference;