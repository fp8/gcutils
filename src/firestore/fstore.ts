import { Loggable } from 'jlog-facade';
import {
    CollectionReference,
    DocumentReference,
    FieldPath,
    Filter,
    Query,
} from '@google-cloud/firestore';

import { createLogger, TCreateEntityCallback } from '../core';
import {
    AbstractBaseFirebaseModel,
    AbstractFirestore,
    createEntity,
    IFirestorePromise,
} from './base';

const logger = createLogger('FirestoreService');

const GET_TO_VALIDATE = false;

/**
 * A wrapper around Firestore to provide a class driven interface for data access
 *
 * ToDo: Add a .exists method to check if a document exists based on filters
 */
export class FirestoreService
    extends AbstractFirestore
    implements IFirestorePromise
{
    static readonly PROVIDER_NAME = FirestoreService.name;

    /**
     * Set an instance of document to Firebase.  The instance must be a subclass of AbstractBaseFirebaseModel
     * and therefore the collection name is retried from the instance's .getCollectionName() method.  If .key
     * attribute is set, it will be used as document id.  Otherwise, a new id will be generated.
     *
     * @param instance
     * @returns
     */
    public async set<T extends AbstractBaseFirebaseModel>(
        instance: T,
    ): Promise<DocumentReference> {
        const collection = this.createCollection(instance.getCollectionName());
        return this.setDocumentRef(collection, instance);
    }

    /**
     * Set an instance of document to Firebase by document path.  The path is a collection
     * so must never contains a document id.  The document id must be passed as a `key` attribute
     * of the instance.
     *
     * @param collectionPath
     * @param instance
     * @returns
     */
    public async setByPath<T extends AbstractBaseFirebaseModel>(
        collectionPath: string,
        instance: T,
    ): Promise<DocumentReference> {
        const collection = this.createCollection(collectionPath);
        return this.setDocumentRef(collection, instance);
    }

    /**
     * Retrieve a document from Firestore by key
     *
     * @param type
     * @param key
     * @returns
     */
    public async get<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        key: string,
        toSkipValidation?: boolean,
        createEntityCallback?: TCreateEntityCallback,
    ): Promise<T | undefined> {
        // Create an instance just to get the collection name
        const collection = this.getCollectionFromType(type);
        const doc = collection.doc(key);
        return this.getDocumentRef(
            doc,
            type,
            toSkipValidation,
            createEntityCallback,
        );
    }

    /**
     * Get the document by a document path.
     *
     * @param type
     * @param documentPath
     * @param toValidate
     * @returns
     */
    public async getByPath<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        documentPath: string,
        toValidate?: boolean,
        createEntityCallback?: TCreateEntityCallback,
    ): Promise<T | undefined> {
        // Create an instance just to get the collection name
        const doc = this.createDocument(documentPath);
        return this.getDocumentRef(doc, type, toValidate, createEntityCallback);
    }

    /**
     * Query a collection from Firestore by providing a model
     *
     * @param type
     * @param filter instance of Filter
     * @param fieldPaths subset of fields to return
     */
    public async *query<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        filter?: Filter,
        fieldPaths?: Array<string | FieldPath>,
        createEntityCallback?: TCreateEntityCallback,
    ): AsyncGenerator<T> {
        let query: Query = this.getCollectionFromType(type);

        if (filter) {
            logger.info(
                '[FirestoreService] query with filter',
                Loggable.of('filter', filter),
            );
            query = query.where(filter);
        }

        if (fieldPaths) {
            logger.info(
                '[FirestoreService] query with fieldPaths',
                Loggable.of('fieldPaths', fieldPaths),
            );
            query = query.select(...fieldPaths);
        }

        const snap = await query.get();
        for (const doc of snap.docs) {
            const data = doc.data();
            data.key = doc.id;
            yield createEntity(
                type,
                data,
                GET_TO_VALIDATE,
                createEntityCallback ?? this.createEntityCallback,
            );
        }
    }

    /**
     * Return all collections from Firestore
     *
     * @returns
     */
    public async listAllCollections(): Promise<CollectionReference[]> {
        // If namespace is set, return only collections under the namespace
        if (this.namespace) {
            const doc = this.createDocument();
            return doc.listCollections();
        } else {
            return this.firestore.listCollections();
        }
    }

    /**
     *  Delete a document from Firestore by key
     *
     * @param type
     * @param key
     */
    public async delete<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        key: string,
    ): Promise<void> {
        const collection = this.getCollectionFromType(type);
        const docRef = collection.doc(key);
        logger.info(`[FirestoreService] Deleting document: ${docRef.path}`);
        await docRef.delete();
    }
}
