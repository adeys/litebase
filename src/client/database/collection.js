import {nanoid} from "nanoid";
import ResultSet from "./resultSet.js";

/**
 * @private idMap
 * @private lastKey
 * @private _ref
 */
export default class Collection {
    /**
     * @param {CollectionReference} ref
     * @param {Array?} data
     */
    constructor(ref, data) {
        this.data = [];
        this.idMap = new Map();
        this.lastKey = 0;

        this.loadData(data);
        this._ref = ref;
    }

    get ref() {
        return this._ref;
    }

    loadData(data) {
        if (data && Array.isArray(data) && data.length !== 0) {
            data.forEach((child, idx) => {
                this.data.push(child);
                this.idMap.set(child._id, idx);
                if (child.meta.$key > this.lastKey) {
                    this.lastKey = child.meta.$key;
                }
            });
        }
    }

    /**
     * @param doc
     * @return {{meta: {created: number, $key: number}, _id: string}}
     */
    insert(doc) {
        doc._id = doc._id || nanoid();
        if (this.idMap.has(doc._id)) {
            throw new Error(`Cannot overwrite existing document ${doc._id} with 'push' method. Call 'update' instead.`);
        }

        let child = this.insertMeta({_id: doc._id, ...doc});

        this.data.push(child);

        let idx = this.data.length - 1;
        this.idMap.set(doc._id, idx);
        this.lastKey++;

        return child;
    }

    /**
     * @internal
     * @private
     * @param doc
     * @return {*}
     */
    insertMeta(doc) {
        if (doc.meta) return;

        doc.meta = {$key: this.lastKey, created: (new Date()).getTime()};
        return doc;
    }

    /**
     * @param doc
     * @return {*}
     */
    update(doc) {
        if (!doc._id || !this.idMap.has(doc._id)) {
            throw new Error(`Cannot update non existing document ${doc._id}. Call 'insert' instead.`);
        }

        let key = this.idMap.get(doc._id);
        let old = this.data[key];
        let newChild = {...old, ...doc, meta: old.meta};

        this.data[key] = newChild;
        return newChild;
    }

    /**
     * @param doc
     * @return {*}
     */
    remove(doc) {
        if (typeof doc !== 'object') {
            throw new TypeError(`Document must be of type object. ${typeof doc} received.`);
        }

        return this.removeByKey(doc._id);
    }

    /**
     * @param key
     * @return {*}
     */
    removeByKey(key) {
        if (!key || !this.idMap.has(key)) {
            throw new Error(`Cannot delete non existing document ${key}`);
        }

        let child = this.data[this.idMap.get(key)];
        this.data = this.data.filter(child => child._id !== key);
        this.idMap.delete(key);

        return child;
    }

    /**
     * @return {ResultSet}
     */
    chain() {
        return (new ResultSet(this));
    }


    /**
     * @param criteria
     * @return {Array}
     */
    find(criteria) {
        return criteria ? this.where(criteria).get() : this.get();
    }

    /**
     * @param criteria
     * @return {{_id: string, meta: {$key: int, created: number}}|null}
     */
    findOne(criteria) {
        let result = (new ResultSet(this)).where(criteria, true).get();

        return result.length === 0 ? null : result[0];
    }

    /**
     * @param query
     * @return {ResultSet|*}
     */
    where(query) {
        return (new ResultSet(this)).where(query);
    }

    /**
     * @return {E[] | []}
     */
    get() {
        return (new ResultSet(this)).get();
    }

    count() {
        return this.data.length;
    }

    /**
     * @param {DataSnapshot} snapshot
     */
    setFromSnapshot(snapshot) {
        let key = snapshot.key;
        this.idMap.has(key)
            ? this.update(snapshot.fullData)
            : this.insert(snapshot.fullData);
    }
}

