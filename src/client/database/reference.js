import mitt from 'mitt';
import {nanoid} from 'nanoid';
import DataSnapshot from './snapshot.js';

/**
 * @private _emitter
 * @private _data
 */
class Reference {
    /**
     * @param {WebSocketClient} client
     */
    constructor(client) {
        this.client = client;
        this._emitter = mitt();
        this._data = new Map();

        this._attachListeners();
    }

    /**
     * @private
     */
    _attachListeners() {
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
    push(doc) {
        doc._id = doc._id || nanoid();
        if (this._data.has(doc._id)) {
            throw new Error(`Cannot overwrite existing document ${doc._id} with 'push' method. Call 'update' instead.`);
        }

        this._data.set(doc._id, doc);
        return new DataSnapshot(doc._id, doc);
    }

    remove(key) {
        if (!this._data.has(key)) {
            throw new Error(`Cannot delete non existing document ${key}`);
        }

        let doc = this._data.get(key);
        this._data.delete(key);
    }

    update(key, doc) {
        if (!this._data.has(key)) {
            throw new Error(`Cannot update non existing document ${key}`);
        }

        this._data.set(key, doc);
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
}

export default Reference;