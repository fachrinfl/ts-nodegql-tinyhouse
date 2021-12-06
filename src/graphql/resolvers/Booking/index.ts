import crypto from "crypto";
import {IResolvers} from 'apollo-server-express';
import { Request } from 'express';
import { Stripe } from '../../../lib/api';
import { Booking, Database, BookingsIndex } from '../../../lib/types';
import { authorize } from '../../../lib/utils';
import { CreateBookingArgs } from './types';

const milisecondsPerDay = 86400000;

const resolveBookingsIndex = (
    bookingsIndex: BookingsIndex,
    checkInDate: string,
    checkOutDate: string 
): BookingsIndex => {
    let dateCursor = new Date(checkInDate);
    let checkOut = new Date(checkOutDate);

    const newBookingsIndex: BookingsIndex = { ...bookingsIndex };

    while (dateCursor <= checkOut) {
        const y = dateCursor.getUTCFullYear();
        const m = dateCursor.getUTCMonth();
        const d = dateCursor.getUTCDate();

        if (!newBookingsIndex[y]) {
            newBookingsIndex[y] = {}
        }

        if (!newBookingsIndex[y][m]) {
            newBookingsIndex[y][m] = {}
        }

        if (!newBookingsIndex[y][m][d]) {
            newBookingsIndex[y][m][d] = true;
        } else {
            throw new Error("selected dates can't overlap dates that have already been booked");
        }

        dateCursor = new Date(dateCursor.getTime() + 86400000);
        
    }

    return newBookingsIndex;
};

export const bookingResolvers: IResolvers = {
    Mutation: {
        createBooking: async (
            _root: undefined,
            { input }: CreateBookingArgs,
            { db, req }: {db: Database, req: Request}
        ): Promise<Booking> => {
            try {
                const { id, source, checkIn, checkOut } = input;

                let viewer = await authorize(db, req);
                if (!viewer) {
                    throw new Error("viewer cannot be found");
                }

                const listing = await db.listings.findOne({ id });    

                if (!listing) {
                    throw new Error("listing can't be found");
                }

                if (listing.host === viewer.id) {
                    throw new Error("viewer can't book own listing");
                }

                const today = new Date();
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);

                if (checkInDate.getTime() > today.getTime() + 90 * milisecondsPerDay) {
                    throw new Error("check in date can't be more than 90 days from today");
                }

                if (checkOutDate.getTime() > today.getTime() + 90 * milisecondsPerDay) {
                    throw new Error("check out date can't be more than 90 days from today");
                }

                if (checkOutDate < checkInDate) {
                    throw new Error("check out date can't be before check in date");
                }

                const bookingsIndex = resolveBookingsIndex(
                    listing.bookingsIndex,
                    checkIn,
                    checkOut
                );

                const totalPrice = listing.price * ((checkOutDate.getTime() - checkInDate.getTime()) / milisecondsPerDay + 1);

                const host = await db.users.findOne({ id: listing.host });

                if (!host || !host.walletId) {
                    throw new Error("the host either can't be found or is not connected with Stripe");
                }

                await Stripe.charge(totalPrice, source, host.walletId);

                const newBooking: Booking = {
                    id: crypto.randomBytes(16).toString("hex"),
                    listing: listing.id,
                    tenant: viewer.id,
                    checkIn,
                    checkOut
                };

                const insertedBooking = await db.bookings.create(newBooking).save();

                host.income = host.income + totalPrice;
                await host.save();

                viewer.bookings.push(insertedBooking.id);
                await viewer.save();

                listing.bookingsIndex = bookingsIndex;
                listing.bookings.push(insertedBooking.id);
                await listing.save();

                return insertedBooking;
            } catch (error) {
                throw new Error(`Failed to crate a booking: ${error}`);
            }
        }
    },
    Booking: {
        listing: (booking: Booking, _args: {}, {db}: {db: Database}) => {
            return db.listings.findOne({id: booking.listing});
        },
        tenant: (booking: Booking, _args: {}, {db}: {db: Database}) => {
            return db.users.findOne({ id: booking.tenant });
        }
    }
};