class DataSnapshot {
    constructor(key, value) {
        this.key = key;
        this._value = value;

    }

    getData() {
        return this._value;
    }
}

export default DataSnapshot;