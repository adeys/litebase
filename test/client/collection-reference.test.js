import mocha from 'mocha';
import chai from 'chai';

import client from "./mockWebSocket.js";
import CollectionReference from "../../src/client/database/collection-reference.js";
import DocumentReference from "../../src/client/database/doc-reference.js";
import ResultSet from "../../src/client/database/resultSet.js";

const {describe, it, beforeEach, afterEach} = mocha;
const {expect} = chai;

let collRef;

beforeEach(() => {
    collRef = new CollectionReference('users', client);
});

describe('CollectionReference', () => {
    describe('add', () => {
        it('should return a DocumentReference', () => {
            let ref = collRef.add({email: 'johndoe@email.com', name: 'John Doe', age: 25});
            expect(ref).to.be.instanceOf(DocumentReference);
        });

        it('should automatically add a key to document', () => {
            let ref = collRef.add({email: 'johndoe@email.com', name: 'John Doe', age: 25});

            expect(ref.key).to.exist;

            expect(ref.value.name).to.be.equal('John Doe');
            expect(ref.value._id).to.exist;

            expect(ref.key).to.be.equal(ref.value._id);
        });

        it('should add a document to the collection', () => {
            expect(collRef.collection.data.length).to.be.equal(0);

            let data = {email: 'johndoe@email.com', name: 'John Doe', age: 25};
            let ref = collRef.add(data, d => console.log(d));

            expect(collRef.collection.data.length).to.be.equal(1);

            let fetched = collRef.getRef(ref.key, false);
            expect(fetched.exists).to.be.true;
            expect(fetched.value).to.deep.include(data);
        });
    });

    describe('getRef', () => {
        it('should return a DocumentReference', () => {
            let ref = collRef.add({email: 'johndoe@email.com', name: 'John Doe', age: 25});
            expect(collRef.getRef(ref.key)).to.be.instanceOf(DocumentReference);
        });

        it('should create a document if falsy/empty key provided', () => {
            expect(collRef.collection.data.length).to.be.equal(0);

            let ref = collRef.getRef();
            expect(ref).to.be.instanceOf(DocumentReference);
            expect(collRef.collection.data.length).to.be.equal(1);
        });

        it('should create a document if not existing key is provided and createIfNotExists is true or default', () => {
            expect(collRef.collection.data.length).to.be.equal(0);

            let key = 'user.john';
            let ref = collRef.getRef(key);
            expect(collRef.collection.data.length).to.be.equal(1);
            expect(ref).to.be.instanceOf(DocumentReference);
            expect(ref.key).to.be.equal(key);
        });

        it('should return non existing reference if createIfNotExists is false', () => {
            expect(collRef.collection.data.length).to.be.equal(0);

            let key = 'user.john';
            let ref = collRef.getRef(key, false);
            expect(collRef.collection.data.length).to.be.equal(0);
            expect(ref).to.be.instanceOf(DocumentReference);
            expect(ref.exists).to.be.equal(false);
        });
    });

    describe('query', () => {
        it('should return a ResultSet instance', () => {
            expect(collRef.query()).to.be.instanceOf(ResultSet);
        });
    });

    describe('get', () => {
        it('should return all data', () => {
            [
                {name: 'John Doe', age: 35},
                {name: 'Jane Doe', age: 34},
                {name: 'Jack Doe', age: 19},
                {name: 'June Doe', age: 7}
            ].forEach(person => collRef.add(person));

            expect(collRef.get().length).to.be.equal(4);
        });
    });

    describe('findOne', () => {
        beforeEach(() => {
            [
                {name: 'John Doe', age: 35},
                {name: 'Jane Doe', age: 34},
                {name: 'Jack Doe', age: 19},
                {name: 'June Doe', age: 7}
            ].forEach(person => collRef.add(person));
        });

        afterEach(() => {
            collRef.setData([]);
        });

        it('should return null if a document reference does not exist (criteria not matched)', () => {
            let ref = collRef.findOne({name: 'Thief'});
            expect(ref).to.be.equal(null);
        });

        it('should return a document reference if criteria matches', () => {
            let ref = collRef.findOne({name: 'John Doe'});
            expect(ref).to.not.be.equal(null);
            expect(ref.getData().name).to.be.equal('John Doe');
            expect(ref.getData().age).to.be.equal(35);
        });
    });

    describe('ResultSet', () => {
        beforeEach(() => {
            [
                {name: 'Jane Doe', age: 34, child: false},
                {name: 'John Doe', age: 45},
                {name: 'June Doe', age: 7, child: true},
                {name: 'Jack Doe', age: 19},
            ].forEach(person => collRef.add(person));
        });

        afterEach(() => {
            collRef.setData([]);
        });

        describe('where', () => {
            it('should successfully filter data', () => {
                let data = collRef.query().where({name: 'June Doe'}).get();
                expect(data.length).to.be.equal(1);
                expect(data[0]).to.be.instanceOf(DocumentReference);
                expect(data[0].getData().name).to.be.equal('June Doe');
                expect(data[0].getData().age).to.be.equal(7);

                data = collRef.query().where({age: {$between: [18, 40]}}).get();
                expect(data.length).to.be.equal(2);
                expect(data[0]).to.be.instanceOf(DocumentReference);
                expect(data[1]).to.be.instanceOf(DocumentReference);
                expect(data[0].getData().name).to.be.equal('Jane Doe');
                expect(data[1].getData().name).to.be.equal('Jack Doe');
            });
        });

        describe('update', () => {
            it('should update filtered data', () => {
                collRef.query()
                    .where({age: {$gt: 40}})
                    .update(record => record.age = 40);

                expect(collRef.query().where({age: {$gt: 40}}).count()).to.be.equal(0);
                expect(collRef.query().where({age: 40}).count()).to.be.equal(1);
            });
        });

        describe('remove', () => {
            it('should remove filtered data', () => {
                expect(collRef.query().where({age: {$gt: 40}}).count()).to.be.equal(1);
                collRef.query()
                    .where({age: {$gt: 40}})
                    .remove();

                expect(collRef.get().length).to.be.equal(3);
            });
        });

        describe('filter', () => {
            it('should filter data with provided data', () => {
                let result = collRef.query()
                    .filter((record => record.child !== undefined))
                    .get();

                expect(result.length).to.be.equal(2);
                expect(result[1].getData().name).to.be.equal('June Doe');
            });
        });

        describe('orderBy', () => {
            it('should order result by provided key and provided order', () => {
                let result  = collRef.get();
                expect(result[3].getData().age).to.not.be.equal(7);

                result = collRef.query()
                    .orderBy('age', 'desc')
                    .get();

                expect(result.length).to.be.equal(4);
                expect(result[0].getData().age).to.be.equal(45);
                expect(result[3].getData().age).to.be.equal(7);
            });
        });

        describe('limitToFirst', () => {
            it('should limit result to provided limit', () => {
                let result = collRef.query()
                    .orderBy('age')
                    .limitToFirst(2)
                    .get();

                expect(result.length).to.be.equal(2);
                expect(result[0].getData().name).to.be.equal('John Doe');
                expect(result[1].getData().name).to.be.equal('Jane Doe');
            });
        });

        describe('limitToLast', () => {
            it('should limit result to provided limit', () => {
                let result = collRef.query()
                    .orderBy('age', 'asc')
                    .limitToFirst(2)
                    .get();

                expect(result.length).to.be.equal(2);
                expect(result[0].getData().name).to.be.equal('June Doe');
                expect(result[1].getData().name).to.be.equal('Jack Doe');
            });
        });
    });

    describe('DocumentReference', () => {
        describe('set', () => {
            it('should set fields on document reference', () => {
                let ref = collRef.getRef();

                expect(ref.key).to.exist;
                expect(ref.exists).to.be.equal(true);
                expect(Object.keys(ref.getData()).length).to.be.equal(0);

                ref.set({name: 'John Doe'});
                let content = ref.getData();
                expect(Object.keys(content).length).to.be.equal(1);
                expect(content.name).to.exist;
                expect(content.name).to.be.equal('John Doe');
                expect(collRef.getRef(ref.key).getData().name).to.be.equal(content.name);
            });

            it('should replace fields on document reference if merge is false', () => {
                let ref = collRef.getRef();
                ref.set({name: 'John Doe'});

                let content = ref.getData();
                expect(content.email).to.not.exist;
                expect(content.name).to.exist;
                expect(content.name).to.be.equal('John Doe');

                ref.set({email: 'johndoe@mail.io'}, false);
                content = ref.getData();

                expect(content.name).to.not.exist;
                expect(content.email).to.exist;
                expect(content.email).to.be.equal('johndoe@mail.io');
            });
        });

        describe('delete', () => {
            beforeEach(() => {
                [
                    {name: 'John Doe', age: 35},
                    {name: 'Jane Doe', age: 34},
                    {name: 'Jack Doe', age: 19},
                    {name: 'June Doe', age: 7}
                ].forEach(person => collRef.add(person));
            });

            it('should remove reference from collection', () => {
                expect(collRef.get().length).to.be.equal(4);

                let ref = collRef.findOne({name: 'John Doe'});
                ref.delete();

                expect(collRef.get().length).to.be.equal(3);
                expect(ref.exists).to.be.equal(false);
                expect(collRef.findOne({name: 'John Doe'})).to.be.equal(null);
            });
        })
    });
});