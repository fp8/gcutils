import { Type, Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

import { AbstractBaseFirebaseModel } from '@fp8proj/firestore/base';
import { convertToDate } from '@fp8proj/core/helper';

export interface ITestUser {
    key?: string;
    name: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class TestUser extends AbstractBaseFirebaseModel implements ITestUser {
    @IsOptional()
    @IsString()
    @MinLength(5)
    declare key?: string;

    @IsString()
    @MinLength(5)
    declare name: string;

    @IsEmail()
    @MinLength(5)
    declare email: string;

    @Type(() => Object)
    @Transform(({ value }) => value && convertToDate(value), {
        toClassOnly: true,
    })
    declare createdAt: Date;

    @Type(() => Object)
    @Transform(({ value }) => value && convertToDate(value), {
        toClassOnly: true,
    })
    declare updatedAt: Date;

    public static create(input: ITestUser): TestUser {
        const user = new TestUser();
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

export class TestUserOnlyName extends AbstractBaseFirebaseModel {
    @IsString()
    @MinLength(5)
    declare name: string;

    override getCollectionName(): string {
        return 'TestUser';
    }
}
