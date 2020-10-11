import { NextFunction, Request, Response } from 'express';
import { isEmpty } from 'ramda';
import createHttpError from 'http-errors';
import HttpStatusCodes from 'http-status-codes';
import { db } from '../db';
import { makeSound } from '../model/Sound';
import { buildFilePath } from '../util/buildFilePath';

/**
 * Upload Handler
 *
 * @param req
 * @param res
 * @param next
 */
export const uploadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.files || isEmpty(req.files)) {
      throw createHttpError(
        HttpStatusCodes.BAD_REQUEST,
        'No files were uploaded'
      );
    }

    const allFilesMove = await Promise.all(
      Object.values(req.files).map(async (file) => {
        try {
          const sound = await makeSound(file);
          const hashCheck = db.sounds.getByFileHash(sound.fileHash);

          if (hashCheck) {
            return {
              status: 'error',
              data: {
                filename: file.name,
                reason: `Sound already exists with sound name "${hashCheck.name}"`,
              },
            };
          }

          await db.sounds.add(sound);
          await file.mv(buildFilePath(sound));

          return {
            status: 'success',
            data: {
              id: sound.id,
              filename: file.name,
            },
          };
        } catch (error) {
          return {
            status: 'error',
            data: {
              filename: file.name,
              reason: error.message,
            },
          };
        }
      })
    );

    const failed = allFilesMove
      .filter((result) => result.status === 'error')
      .map((result) => result.data);

    const successful = allFilesMove
      .filter((result) => result.status === 'success')
      .map((result) => result.data);

    res.json({
      failed,
      successful,
    });
  } catch (err) {
    next(err);
  }
};