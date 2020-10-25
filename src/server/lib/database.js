const Loki = require('lokijs');
const FSAdapter = require('lokijs/src/loki-fs-structured-adapter');

class Database {
    /**
     * @param {WebSocketServer} server
     * @param {string} path
     */
    constructor(server, path = `${__dirname}/../data/database.db`) {
        this.path = path;
        this.$loki = new Loki(this.path, {
            adapter: new FSAdapter(),
            autoload: true,
            autoloadCallback: this._initDatabase.bind(this),
            autosave: true,
            autosaveInterval: 4000
        });
        this.server = server;

        this.$loki.on('loaded', this._onDatabaseLoaded.bind(this));
    }

    /**
     * @private
     */
    _onDatabaseLoaded() {
        let list = this.$loki.listCollections();
        list.forEach(coll => {
            coll = this.$loki.getCollection(coll.name);
            this._addCollectionChannel(coll);
        });
        
        this.server.on('connection', this._onClientConnection.bind(this));
    }

    /**
     * @param {Collection} collection
     * @private
     */
    _addCollectionChannel(collection) {
        let channel = this.server.addChannel(collection.name);
        let events = ['insert', 'update', 'delete'];

        events.forEach(event => {
            collection.on(event, (item) => {
                channel.broadcast('collection:event', {
                    channel: collection.name,
                    event, child: this._formatDoc(item)
                });
            })
        });

        collection.on(events, () => {
            channel.broadcast('collection:changes', {
                channel: collection.name,
                children: collection.data.map(this._formatDoc)
            });
        });
    }

    /**
     * @param {Client} client
     * @private
     */
    _onClientConnection(client) {
        client.on('channel:subscribe', ({channel: name}) => {
            let coll = this.getCollection(name);
            this.server.channels.get(name)
                .broadcast('collection:changes', {
                    channel: coll.name,
                    children: coll.data.map(this._formatDoc)
                });
        });

        client.on('collection:insert', this._wrapAction(({channel, child}) => {
            this.getCollection(channel)
                .insert(child);
        }, client));

        client.on('collection:update', this._wrapAction(({channel, child}) => {
            this.getCollection(channel)
                .updateWhere(item => item._id === child._id, () => child);
        }, client));

        client.on('collection:delete', this._wrapAction(({channel, child}) => {
            this.getCollection(channel)
                .removeWhere(item => item._id === child._id);
        }, client));
    }

    /**
     * @param {{...fields, meta: Object, $loki: number}} doc
     * @return {{meta: {created: *, $key: int}}}
     * @private
     */
    _formatDoc(doc) {
        let {meta, $loki, ...fields} = doc;

        return {...fields, meta: {$key: $loki, created: meta.created}};
    }

    /**
     * @param {function({channel: string, child: object})} action
     * @param {Client} client
     * @return {function(...[*]=)}
     * @private
     */
    _wrapAction(action, client) {
        return (payload) => {
            let err = null;

            try {
                action(payload);
            } catch (e) {
                err = e;
            }

            if (payload.id) {
                client.trigger('ack', {
                    id: payload.id,
                    success: !!err,
                    reason: err ? err.toString().replace(/^*:/, '') : null
                });
            }
        }
    }

    /**
     * @param name
     * @return {Collection<any>}
     */
    getCollection(name) {
        let coll = this.$loki.getCollection(name);
        if (!coll) {
            coll = this.$loki.addCollection(name, {indices: ['_id'], unique: ['_id'], asyncListeners: true});
            this._addCollectionChannel(coll);
        }

        return coll;
    }

    /**
     * @private
     */
    _initDatabase() {
        this.getCollection('users');
    }
}

module.exports = Database;