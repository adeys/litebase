import mitt from 'mitt';
import DataSnapshot from './snapshot.js';
import Collection from './collection.js';

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
        this.collection = new Collection([]);
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
            this.collection.setFromSnapshot(snapshot);
            this._emitter.emit('child_added', snapshot);
        });

        this._emitter.on('event:update', snapshot => {
            this.collection.setFromSnapshot(snapshot);
            this._emitter.emit('child_changed', snapshot);
        });

        this._emitter.on('event:delete', snapshot => {
            this.collection.removeByKey(snapshot.key);
            this._emitter.emit('child_removed', snapshot);
        })
    }

    /* Data manipulation */
    add(doc, onComplete) {
        let snapshot = new DataSnapshot(this.collection.insert(doc));

        this.wrapSync('collection:insert', snapshot.getData(), onComplete);
        return snapshot;
    }

    remove(key, onComplete) {
        let snapshot = new DataSnapshot(this.collection.removeByKey(key));

        return this.wrapSync('collection:delete', snapshot.getData(), onComplete);
    }

    update(doc, onComplete) {
        let snapshot = new DataSnapshot(this.collection.update(doc));

        return this.wrapSync('collection:update', snapshot.getData(), onComplete);
    }

    query() {
        return this.collection.chain();
    }

    get() {
        return this.collection.find();
    }

    findOne(criteria) {
        return this.collection.findOne(criteria);
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
        this.collection.loadData(data);
    }

    /**
     * @private
     * @param {string} action
     * @param {Object} payload
     * @param {function} onComplete
     */
    wrapSync(action, payload, onComplete) {
        payload = {channel: this.name, child: payload};

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