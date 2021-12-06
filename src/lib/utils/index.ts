import {Request} from 'express';
import {Database} from '../types';
import {UserEntity} from "../../database/entity";

export const authorize = async (
    db: Database, 
    req: Request
    ): Promise<UserEntity | null> => {
        const token = req.get("X-CSRF-TOKEN");
        const viewer = await db.users.findOne({
            id: req.signedCookies.viewer,
            token
        });

        if (!viewer) return null;

        return viewer;
}