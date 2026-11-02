import { NextFunction, Request, Response } from "express";
import Setting from "../../models/setting.model";

export const assetVersion = async (req: Request, res: Response, next: NextFunction) => {
  const settingAssetVersion = await Setting.findOne({
    key: "assetVersion"
  })
  const assetVersion = settingAssetVersion ? settingAssetVersion.data.assetVersion : "";
  res.locals.assetVersion = assetVersion;
  next();
}