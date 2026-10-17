import { Request, Response } from 'express';
import { RequestAccount } from '../../interfaces/request.interface';
import Setting from '../../models/setting.model';

export const apiShipping = async (req: Request, res: Response) => {
  const key = "apiShipping";

  const record = await Setting.findOne({
    key: key
  });

  res.render("admin/pages/setting-api-shipping", {
    pageTitle: "API hãng vận chuyển",
    record: record
  });
}

export const apiShippingPatch = async (req: RequestAccount, res: Response) => {
  const { tokenGoShip } = req.body;

  const key = "apiShipping";

  const data = {
    tokenGoShip: tokenGoShip
  };

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: data,
      updatedBy: req.adminId
    },
    {
      upsert: true, // nếu không tìm thấy bản ghi sẽ tạo bản ghi mới.
    }
  );
  
  res.json({
    code: "success",
    message: "Cập nhật thành công!"
  })
}

export const apiPayment = async (req: Request, res: Response) => { 
  const key = "apiPayment";

  const record = await Setting.findOne({
    key: key
  });
  
  res.render("admin/pages/setting-api-payment", {
    pageTitle: "API cổng thanh toán",
    record: record
  });
}

export const apiPaymentPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiPayment";

  await Setting.findOneAndUpdate(
    {
      key: key
    },
    {
      key: key,
      data: req.body,
      updatedBy: req.adminId
    },
    {
      upsert: true, // nếu không tìm thấy bản ghi sẽ tạo bản ghi mới.
    }
  );
  
  res.json({
    code: "success",
    message: "Cập nhật thành công!"
  })
}