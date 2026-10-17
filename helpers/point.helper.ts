import { pointConfig } from "../configs/variable.config";
import AccountUser from "../models/account-user.model";
import Order from "../models/order.model";

export const addPointAfterPayment = async (orderCode: string) => {
  const order: any = await Order.findOne({
    code: orderCode,
    deleted: false
  });
  if(order && order.userId) {
    const pointEarned = Math.floor(order.total / pointConfig.MONEY_PER_POINT); // Số điểm được tích
    if (pointEarned > 0) {
      await AccountUser.updateOne(
        {
          _id: order.userId,
          deleted: false,
          status: "active"
        },
        {
          $inc: {
            totalPoint: pointEarned
          }
        }
      );
    }
  }
}