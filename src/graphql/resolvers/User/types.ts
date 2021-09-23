import {Booking, Listing} from '../../../lib/types';

export interface UserArgs {
    id: string;
}

export interface UserBookingsArgs {
    limit: number;
    page: number;
}

export interface UserBookingsData {
    total: number;
    result: Booking[];
}

export interface UserListingArgs {
    limit: number;
    page: number;
}

export interface UserListingData {
    total: number;
    result: Listing[]
}