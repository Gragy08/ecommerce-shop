import { Router } from "express";
import * as couponController from "../../controllers/client/coupon.controller";
import * as couponValidate from "../../validates/client/coupon.validate";

const router = Router();

router.post('/check', couponValidate.checkPost, couponController.checkPost);

export default router;