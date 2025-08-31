import {
    ITestUser,
    testStore,
    testStoreSettings,
    TestUser,
    TestUserOnlyName,
} from '../testlib';

import {
    DocumentData,
    Filter,
    Firestore,
    Settings,
} from '@google-cloud/firestore';
import {
    AbstractBaseFirebaseModel,
    FirestoreService,
} from '@fp8proj/firestore';

import {
    createCollectionReference,
    createDocumentReference,
} from '@fp8proj/firestore/base';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const DEFAULT_TIMEOUT = 5_000;

class TestUserNs extends TestUser {
    public static create(input: ITestUser): TestUserNs {
        const user = new TestUserNs();
        user.name = input.name;
        user.email = input.email;
        user.updatedAt = input.updatedAt ?? new Date();
        user.createdAt = input.createdAt ?? new Date();
        if (input.key) {
            user.key = input.key;
        }
        return user;
    }
}

describe('services.fstore', () => {
    describe('simple - no namespace', () => {
        const userKey = 'user-z3p7ow48jq';
        const userKey2 = 'user-uOjiUPGIqX';

        const data: ITestUser = {
            name: 'Mario Rossi',
            email: 'mario.rossi@example.com',
            createdAt: new Date('2024-03-08T13:36:35.163Z'),
            updatedAt: new Date('2024-03-08T14:40:40.678Z'),
        };

        it(
            'Set a document with key',
            async () => {
                const user = TestUser.create(data);
                user.key = userKey;
                const resp = await testStore.set(user);

                expect(resp).toBeDefined();
                expect(resp.path).toEqual(`TestUser/${userKey}`);
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Get a document with key',
            async () => {
                const user = await testStore.get(TestUser, userKey);
                // console.log('### user', user);
                expect(user).toBeDefined();
                expect(user).toBeInstanceOf(TestUser);
                expect(user?.key).toEqual(userKey);
                expect(user).toEqual(expect.objectContaining(data));
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Set and get a document by path',
            async () => {
                const user2Path = `TestUser/${userKey2}`;
                /*
      Notice how the user needs to be created using the key
      */
                const user2 = TestUser.create({
                    key: userKey2,
                    name: 'John Rossi',
                    email: 'john.rossi@fakemail.com',
                });

                /*
      .setByPath requires a collection path and therfore key
      must be passed inside the instance
      */
                const resp = await testStore.setByPath('TestUser', user2);
                expect(resp).toBeDefined();

                // Get user
                const user = await testStore.getByPath(TestUser, user2Path);
                expect(user).toBeDefined();
                expect(user).toBeInstanceOf(TestUser);
                expect(user?.key).toEqual(userKey2);
                expect(user?.name).toEqual('John Rossi');
                expect(user?.email).toEqual('john.rossi@fakemail.com');
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Set a document without key',
            async () => {
                const userData = {
                    name: 'John Doe',
                    email: 'john.doe@example.co',
                };

                // Write a document without key
                const user = TestUser.create(userData);
                const resp = await testStore.set(user);
                expect(resp).toBeDefined();

                // Get the generated key
                const key = resp.id;
                expect(key).not.toEqual(userKey);
                // console.log('### generated key: ', resp.id);

                // Get the document by key
                const result = await testStore.get(TestUser, key);
                expect(result).toBeDefined();

                // console.log('### result', Object.keys(result!));
                expect(result).toBeInstanceOf(TestUser);
                expect(Object.keys(result!)).toEqual(
                    expect.arrayContaining([
                        'key',
                        'name',
                        'email',
                        'createdAt',
                        'updatedAt',
                    ]),
                );
                expect(result?.key).toEqual(key);
                expect(result).toEqual(expect.objectContaining(userData));
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'query',
            async () => {
                const filter = Filter.where(
                    'email',
                    '==',
                    'john.doe@example.co',
                );
                const users = testStore.query(TestUser, filter);
                const result: TestUser[] = [];

                for await (const user of users) {
                    // console.log('### user', user);
                    expect(Object.keys(user)).toEqual(
                        expect.arrayContaining([
                            'key',
                            'name',
                            'email',
                            'createdAt',
                            'updatedAt',
                        ]),
                    );
                    expect(user.email).toEqual('john.doe@example.co');
                    result.push(user);
                }

                expect(result.length).toBeGreaterThan(0);
            },
            DEFAULT_TIMEOUT,
        );

        /**
         * In order to return a partial result, pass the `fieldPaths` params to .query method
         * but remember to create a model to receive that partial result.  The partial result
         * object needs to override the getCollectionName to access the correct collection.
         */
        it(
            'query with select',
            async () => {
                const filter = Filter.where(
                    'email',
                    '==',
                    'john.doe@example.co',
                );
                const users = testStore.query(TestUserOnlyName, filter, [
                    'name',
                ]);
                const result: TestUserOnlyName[] = [];

                for await (const user of users) {
                    // console.log('### user', user);
                    expect(Object.keys(user)).toEqual(
                        expect.arrayContaining(['name']),
                    );
                    expect(user.name).toEqual('John Doe');
                    result.push(user);

                    expect(result.length).toBeGreaterThan(0);
                }
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Get collections',
            async () => {
                const collections = await testStore.listAllCollections();
                expect(collections).toBeDefined();
                // console.log('### collections', collections);

                const collectionNames = collections.map((c) => c.path);
                // console.log('### collectionNames', collectionNames);

                expect(collectionNames).toEqual(
                    expect.arrayContaining(['TestUser']),
                );
            },
            DEFAULT_TIMEOUT,
        );
    });

    describe('namespace', () => {
        const settings: Settings = {
            host: '127.0.0.1',
            port: 9901,
            ssl: false,
            namespace: 'utest',
        };
        const store = new FirestoreService(settings);

        const userKey = 'user-IpoZtvyBKO';

        const data: ITestUser = {
            name: 'Charles White',
            email: 'charles.white@example.com',
            createdAt: new Date('2024-03-08T13:36:35.163Z'),
            updatedAt: new Date('2024-03-08T14:40:40.678Z'),
        };

        it(
            'should set namespace',
            () => {
                expect(store).toBeDefined();
                expect(store.namespace).toEqual('utest');
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'createCollectionReference',
            () => {
                const fstore = new Firestore();
                const ref = createCollectionReference(
                    fstore,
                    'TestUser',
                    'utest',
                );
                expect(ref).toBeDefined();
                expect(ref.path).toEqual('ns/utest/TestUser');
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'createDocumentReference',
            () => {
                const fstore = new Firestore();
                const ref = createDocumentReference(
                    fstore,
                    'TestUser/yHUyVz1smn',
                    'utest',
                );
                expect(ref).toBeDefined();
                expect(ref.path).toEqual('ns/utest/TestUser/yHUyVz1smn');
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Set a document with key - ns',
            async () => {
                const user = TestUserNs.create(data);
                user.key = userKey;
                const resp = await store.set(user);

                expect(resp).toBeDefined();
                expect(resp.path).toEqual(`ns/utest/TestUserNs/${userKey}`);
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Get a document with key - ns',
            async () => {
                const user = await store.get(TestUserNs, userKey);
                // console.log('### user', user);
                expect(user).toBeDefined();
                expect(user).toBeInstanceOf(TestUserNs);
                expect(user?.key).toEqual(userKey);
                expect(user).toEqual(expect.objectContaining(data));
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'Get collections - ns',
            async () => {
                const collections = await store.listAllCollections();
                expect(collections).toBeDefined();
                // console.log('### collections', collections);

                const collectionNames = collections.map((c) => c.path);
                // console.log('### collectionNames', collectionNames);

                expect(collectionNames).toEqual(
                    expect.arrayContaining(['ns/utest/TestUserNs']),
                );
            },
            DEFAULT_TIMEOUT,
        );

        it(
            'query - ns',
            async () => {
                const filter = Filter.where(
                    'email',
                    '==',
                    'charles.white@example.com',
                );
                const users = store.query(TestUserNs, filter);
                const result: TestUserNs[] = [];

                for await (const user of users) {
                    // console.log('### user', user);
                    expect(Object.keys(user)).toEqual(
                        expect.arrayContaining([
                            'key',
                            'name',
                            'email',
                            'createdAt',
                            'updatedAt',
                        ]),
                    );
                    expect(user.email).toEqual('charles.white@example.com');
                    result.push(user);
                }

                expect(result.length).toBeGreaterThan(0);
            },
            DEFAULT_TIMEOUT,
        );
    });

    it(
        'Delete a document by key',
        async () => {
            const key = 'user-to-delete';
            const user = TestUser.create({
                key,
                name: 'Temp User',
                email: 'temp.user@example.com',
            });

            const setResult = await testStore.set(user);
            expect(setResult).toBeDefined();

            const found = await testStore.get(TestUser, key);
            expect(found).toBeDefined();
            expect(found?.key).toEqual(key);

            await testStore.delete(TestUser, key);

            const deleted = await testStore.get(TestUser, key);
            expect(deleted).toBeUndefined();
        },
        DEFAULT_TIMEOUT,
    );

    it(
        'should use createEntityCallback',
        async () => {
            const key = 'user-get-doc-ref-clean';

            class Address {
                @IsString()
                city!: string;
            }

            class UserWithAddress extends AbstractBaseFirebaseModel {
                @IsString()
                name!: string;

                @ValidateNested()
                @Type(() => Address)
                address!: Address;
            }

            // Create a custom FirestoreService using createEntityCallback
            const customStore = new FirestoreService({
                ...testStoreSettings,
                createEntityCallback: (type, data) => {
                    const instance = new type();
                    Object.assign(instance, data);

                    if (instance instanceof UserWithAddress) {
                        instance.address = Object.assign(
                            new Address(),
                            (data as any).address,
                        );
                    }

                    return instance;
                },
            });

            // Write the document
            const instance = Object.assign(new UserWithAddress(), {
                key,
                name: 'callback user',
                address: { city: 'Rome' },
            });

            const collection = customStore.createCollection('UserWithAddress');
            const ref = collection.doc(key);
            const data: DocumentData = instance.toPlain() as DocumentData;
            await ref.set(data);

            // Read it back using getDocumentRef
            const result = await customStore.getDocumentRef(
                ref,
                UserWithAddress,
            );
            // console.log('result', result);
            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(UserWithAddress);
            expect(result?.name).toBe('callback user');
            expect(result?.address).toBeInstanceOf(Address);
            expect(result?.address.city).toBe('Rome');
        },
        DEFAULT_TIMEOUT,
    );

    describe('createEntityCallback coverage', () => {
        const key = 'user-callback-coverage';
        class Address {
            @IsString()
            city!: string;
        }
        class UserWithAddress extends AbstractBaseFirebaseModel {
            @IsString()
            name!: string;

            @ValidateNested()
            @Type(() => Address)
            address!: Address;
        }
        const userData = {
            key,
            name: 'callback coverage',
            address: { city: 'Milan' },
        };
        const customCallback = (type: any, data: any) => {
            const instance = new type();
            Object.assign(instance, data);
            if (instance instanceof UserWithAddress) {
                instance.address = Object.assign(new Address(), data.address);
            }
            // Add a marker to verify callback was used
            (instance as any)._callbackUsed = true;
            return instance;
        };
        const customStore = new FirestoreService({
            ...testStoreSettings,
            createEntityCallback: customCallback,
        });
        it('get() uses createEntityCallback', async () => {
            // Write the document
            const collection = customStore.createCollection('UserWithAddress');
            const ref = collection.doc(key);
            await ref.set(userData);
            // Read using get()
            const result = await customStore.get(UserWithAddress, key);
            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(UserWithAddress);
            expect((result as any)?._callbackUsed).toBe(true);
            expect(result?.address).toBeInstanceOf(Address);
            expect(result?.address.city).toBe('Milan');
        });
        it('getByPath() uses createEntityCallback', async () => {
            const path = `UserWithAddress/${key}`;
            const result = await customStore.getByPath(UserWithAddress, path);
            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(UserWithAddress);
            expect((result as any)?._callbackUsed).toBe(true);
            expect(result?.address).toBeInstanceOf(Address);
            expect(result?.address.city).toBe('Milan');
        });
        it('query() uses createEntityCallback', async () => {
            const filter = Filter.where('name', '==', 'callback coverage');
            const users = customStore.query(UserWithAddress, filter);
            let found = false;
            for await (const user of users) {
                expect(user).toBeInstanceOf(UserWithAddress);
                expect((user as any)._callbackUsed).toBe(true);
                expect(user.address).toBeInstanceOf(Address);
                expect(user.address.city).toBe('Milan');
                found = true;
            }
            expect(found).toBe(true);
        });
        it('setByPath() + getByPath() uses createEntityCallback', async () => {
            const key2 = 'user-callback-coverage-2';
            const user2 = Object.assign(new UserWithAddress(), {
                key: key2,
                name: 'callback coverage 2',
                address: { city: 'Venice' },
            });
            await customStore.setByPath('UserWithAddress', user2);
            const path = `UserWithAddress/${key2}`;
            const result = await customStore.getByPath(UserWithAddress, path);
            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(UserWithAddress);
            expect((result as any)?._callbackUsed).toBe(true);
            expect(result?.address).toBeInstanceOf(Address);
            expect(result?.address.city).toBe('Venice');
        });
    });
});
