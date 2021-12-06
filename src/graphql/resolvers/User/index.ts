import {Request} from 'express';
import {IResolvers} from 'apollo-server-express';
import {Database, User} from '../../../lib/types';
import { authorize } from '../../../lib/utils';
import { 
    UserArgs, 
    UserBookingsArgs, 
    UserBookingsData,
    UserListingArgs,
    UserListingData
} from './types';

export const userResolvers: IResolvers = {
    Query: {
        user: async (
            _root: undefined,
            {id}: UserArgs,
            {db, req}: {db: Database, req: Request}
        ): Promise<User> => {
            try {
                const user = (await db.users.findOne({id})) as User;

                if (!user) {
                    throw new Error("user can't be found");
                }

                const viewer = await authorize(db, req);

                if (viewer && viewer.id === user.id) {
                    user.authorized = true;
                }

                return user;
            } catch (error) {
                throw new Error(`Failed to query user: ${error}`);
            }
        }
    },
    User: {
        hasWallet: (user: User): boolean => Boolean(user.walletId),
        income: (user: User): number | null => {
            return user.authorized ? user.income : null
        },
        bookings: async (
            user: User,
            {limit, page}: UserBookingsArgs,
            {db}: {db: Database}
        ): Promise<UserBookingsData | null> => {
            try {
                if (!user.authorized) {
                    return null;
                }

                const data: UserBookingsData = {
                    total: 0,
                    result: []
                }

                const bookings = await db.bookings.findByIds(user.bookings, {
                    skip: page > 0 ? (page - 1) * limit : 0,
                    take: limit
                });

                data.total = user.bookings.length;
                data.result = bookings;

                return data;

            } catch (error) {
                throw new Error(`Failed to query user bookings: ${error}`);
            }
        },
        listings: async (
            user: User,
            {limit, page}: UserListingArgs,
            {db}: {db: Database}
        ): Promise<UserListingData | null> => {
            try {
                const data: UserListingData = {
                    total: 0,
                    result: []
                }

                const listings = await db.listings.findByIds(user.listings, {
                    skip: page > 0 ? (page - 1) * limit : 0,
                    take: limit
                });

                data.total = user.listings.length;
                data.result = listings;

                return data;

            } catch (error) {
                throw new Error(`Failed to query user listings: ${error}`);
            }
        }
    }
}