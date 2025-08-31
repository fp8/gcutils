import { ValidatorOptions } from 'class-validator';
import { instanceToPlain } from 'class-transformer';
import {
    CollectionReference,
    DocumentData,
    DocumentReference,
    FieldPath,
    Filter,
    Firestore,
    Settings,
} from '@google-cloud/firestore';
import {
    createEntityAndValidate,
    validateModel,
    ValidateModelOptions,
} from '@fp8/simple-config';

import { createLogger, TCreateEntityCallback } from '../core';

const logger = createLogger('FirestoreService.base');

const NAMESPACE_ROOT_COLLECTION = 'ns';

/**
 * Default validation options that does not allow for extra entities not
 * defined in the model.  Default settings:
 *
 * - forbidUnknownValues: prevent unknown objects to pass validation
 *
 * Note: for some odd reason, in order for `forbidNonWhitelisted` to work, `whitelist` must
 * also be enabled.
 */
const DEFAULT_VALIDATION_OPTIONS: ValidatorOptions = {
    forbidUnknownValues: true,
};

/**
 * THe primary method used to create an entity from AbstractBaseFirebaseModel.  This method
 * should be private to the package but is exported to allow testing
 *
 * @param type
 * @param data
 * @param toSkipValidation
 * @param options
 * @param createEntityCallback
 *
 * @returns
 */
export function createEntity<T extends AbstractBaseFirebaseModel>(
    type: { new (): T },
    data: unknown,
    toSkipValidation = true,
    createEntityCallback?: TCreateEntityCallback,
    options?: ValidatorOptions,
): T {
    const optToUse: ValidateModelOptions =
        options || DEFAULT_VALIDATION_OPTIONS;

    if (toSkipValidation) {
        optToUse.disable = true;
        logger.debug(`Validation is disabled for type: ${type.name}`);
    }

    if (createEntityCallback) {
        logger.debug(`Using createEntityCallback for type: ${type.name}`);
        return createEntityCallback(type, data, optToUse);
    }

    return createEntityAndValidate(type, data, optToUse);
}

/**
 * Settings for the FirestoreService
 */
export interface FirestoreServiceSettings extends Settings {
    namespace?: string;
    createEntityCallback?: TCreateEntityCallback;
}

/**
 * A base model for all data structure to be saved in Firestore
 * The key is optional as it doesn't exists when creating a new document
 *
 */
export abstract class AbstractBaseFirebaseModel {
    key?: string;

    /**
     * Validate instance of this class using class-validator
     *
     * @param options
     */
    public validate(options?: ValidateModelOptions): void {
        validateModel(this, options);
    }

    /**
     * Convert instance of this class into a generic JS object to be saved to data store
     *
     * @returns
     */
    public toPlain(): unknown {
        return instanceToPlain(this);
    }

    /**
     * Convert instance of this class into a generic JS object to be return by RESTFul Service.
     * This method is created to support the concept of computed field, ie, a `get method` instead
     * of a variable.  In this case, this field is never saved to the data store but only returned
     * by the RESTFul service.
     *
     * To use this, a get method should be decorated with:
     *
     * ```typescript
     * @Expose({ groups: ['view'] })
     * public get uid(): string {
     *   return this.key;
     * }
     * ```
     *
     * @returns
     */
    public toView(): unknown {
        return instanceToPlain(this, { groups: ['view'] });
    }

    /**
     * Return collection name for this class.  Override this method to
     * return a different collection name than the class name.
     *
     * @returns
     */
    public getCollectionName(): string {
        return this.constructor.name;
    }
}

/**
 * A wrapper around Firestore to provide a class driven interface for data access
 *
 * ToDo: Add a .exists method to check if a document exists based on filters
 */
export abstract class AbstractFirestore {
    public readonly firestore: Firestore;
    protected _namespace: string | undefined = undefined;
    protected createEntityCallback: TCreateEntityCallback | undefined =
        undefined;

    constructor(setting?: FirestoreServiceSettings) {
        // Force ignoreUndefinedProperties flag to allow keys to be passed as undefined
        const settingToUse = setting ?? {};
        settingToUse.ignoreUndefinedProperties = true;

        // Set the namespace if it's provided and remove the `namespace` from settings
        this.setNamespace(settingToUse);
        this.firestore = new Firestore(settingToUse);
        this.createEntityCallback = settingToUse.createEntityCallback;
    }

    /**
     * Return the namespace
     */
    get namespace(): string | undefined {
        return this._namespace;
    }

    /**
     * Return type from user
     *
     * @param type
     * @param doc
     * @param toSkipValidation
     * @returns
     */
    public async getDocumentRef<T extends AbstractBaseFirebaseModel>(
        doc: DocumentReference,
        type: { new (): T },
        toSkipValidation?: boolean,
        createEntityCallback?: TCreateEntityCallback,
    ): Promise<T | undefined> {
        logger.info(`[FirestoreService] get with document path: ${doc.path}`);
        const snap = await doc.get();
        if (!snap.exists) {
            logger.info(
                `[FirestoreService] document NOT FOUND in path: ${doc.path}`,
            );
            return undefined;
        }

        // Get the data from Firestore
        const data = snap.data();
        if (data === undefined) {
            return undefined;
        }
        data.key = snap.id;

        // Return type
        return createEntity(
            type,
            data,
            toSkipValidation,
            createEntityCallback ?? this.createEntityCallback,
        );
    }

    /**
     * Write a document to Firestore
     *
     * @param collection
     * @param instance
     * @returns
     */
    public async setDocumentRef<T extends AbstractBaseFirebaseModel>(
        collection: CollectionReference,
        instance: T,
    ): Promise<DocumentReference> {
        const data = instance.toPlain() as DocumentData;

        const key = instance.key;
        if (key) {
            logger.info(
                `[FirestoreService] set with document path: ${collection.path}/${key}`,
            );
            const doc = collection.doc(key);
            await doc.set(data);
            return doc;
        } else {
            logger.info(
                `[FirestoreService] set with collection path: ${collection.path}`,
            );
            return collection.add(data);
        }
    }

    /**
     * Set the namespace for the FirestoreService
     */
    protected setNamespace(settings?: FirestoreServiceSettings): void {
        if (settings && settings.namespace) {
            this._namespace = settings.namespace;
            settings.namespace = undefined;
        }
    }

    /**
     * Create a collection reference from collection name and add namespace if it's set
     *
     * @param collectionName
     * @returns
     */
    public createCollection(collectionName: string): CollectionReference {
        return createCollectionReference(
            this.firestore,
            collectionName,
            this._namespace,
        );
    }

    /**
     * Create a document reference from path and add namespace if it's set
     *
     * @param documentPath
     * @returns
     */
    public createDocument(documentPath?: string): DocumentReference {
        return createDocumentReference(
            this.firestore,
            documentPath,
            this._namespace,
        );
    }

    /**
     * Return a collection object from a AbstractBaseFirebaseModel type
     *
     * @param type
     * @returns
     */
    public getCollectionFromType<T extends AbstractBaseFirebaseModel>(type: {
        new (): T;
    }): CollectionReference {
        const instance = new type();
        return createCollectionReference(
            this.firestore,
            instance.getCollectionName(),
            this.namespace,
        );
    }
}

export interface IFirestorePromise {
    set<T extends AbstractBaseFirebaseModel>(
        instance: T,
    ): Promise<DocumentReference>;

    setByPath<T extends AbstractBaseFirebaseModel>(
        collectionPath: string,
        instance: T,
    ): Promise<DocumentReference>;

    get<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        key: string,
        toValidate?: boolean,
    ): Promise<T | undefined>;

    getByPath<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        documentPath: string,
        toValidate?: boolean,
    ): Promise<T | undefined>;

    query<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        filter?: Filter,
        fieldPaths?: Array<string | FieldPath>,
    ): AsyncGenerator<T>;

    listAllCollections(): Promise<CollectionReference[]>;

    delete<T extends AbstractBaseFirebaseModel>(
        type: { new (): T },
        key: string,
    ): Promise<void>;
}

/**
 * Create a collection from a collectionName optionally supporting a namespace
 *
 * @param firestore
 * @param collectionName
 * @param namespace
 * @returns
 */
export function createCollectionReference(
    firestore: Firestore,
    collectionName: string,
    namespace?: string,
): CollectionReference {
    if (namespace) {
        return firestore.collection(
            `${NAMESPACE_ROOT_COLLECTION}/${namespace}/${collectionName}`,
        );
    }
    return firestore.collection(collectionName);
}

/**
 * Create a document reference from a collection and key
 *
 * @param firestore
 * @param documentPath
 * @param namespace
 * @returns
 */
export function createDocumentReference(
    firestore: Firestore,
    documentPath?: string,
    namespace?: string,
): DocumentReference {
    // At least one of the documentPath or namespace must be set
    if (!documentPath === undefined && !namespace === undefined) {
        throw new Error(
            'Cannot create a DocumentReference if both documentPath and namespace are empty',
        );
    }

    if (documentPath === undefined) {
        // Namespace must not be undefined in this case
        return firestore.doc(`${NAMESPACE_ROOT_COLLECTION}/${namespace}`);
    } else {
        if (namespace) {
            return firestore.doc(
                `${NAMESPACE_ROOT_COLLECTION}/${namespace}/${documentPath}`,
            );
        }
        return firestore.doc(documentPath);
    }
}
