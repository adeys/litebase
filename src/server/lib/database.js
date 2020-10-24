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

        this.$loki.on('loaded', () => {
            let list = this.$loki.listCollections();
            list.forEach(coll => {
               coll = this.$loki.getCollection(coll.name);
               let channel = this.server.addChannel(coll.name);
               let events = ['insert', 'update', 'delete'];

               events.forEach(event => {
                   coll.on(event, (item) => {
                       channel.broadcast(`collection:event`, {channel: coll.name, event, child: item});
                   })
               });

               coll.on(events, () => {
                   channel.broadcast(`collection:changes`, {channel: coll.name, children: coll.data});
               });
            });

            let coll = this.$loki.getCollection('users');
            setTimeout(() => {
                let user = coll.insert({_id: Math.random().toString(16), name: 'John Doe'});

                setTimeout(() => {
                    coll.remove(user);
                }, 5000);
            }, 5000);
        })
    }

    /**
     * @param name
     * @return {Collection<any>}
     */
    getCollection(name) {
        let coll = this.$loki.getCollection(name);
        if (!coll) {
            coll = this.$loki.addCollection(name, {indices: ['_id'], unique: ['_id'], asyncListeners: true})
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