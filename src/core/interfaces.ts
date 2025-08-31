import type { ValidateModelOptions } from '@fp8/simple-config';

/**
 * Callback to create an entity from a type and data.  This is used to allow
 * the user to provide a custom implementation of the entity creation.
 */
export type TCreateEntityCallback = <T extends object>(
    type: { new (): T },
    data: unknown,
    options?: ValidateModelOptions,
) => T;
