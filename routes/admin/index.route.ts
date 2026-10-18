import { Router } from "express";
import dashboardRoutes from "./dashboard.route";
import articleRoutes from "./article.route";
import helperRoutes from "./helper.route";
import fileManagerRoutes from "./file-manager.route";
import roleRoutes from "./role.route";
import accountAdminRoutes from "./account-admin.route";
import accountRoutes from "./account.route";
import adminLogRoutes from "./admin-log.route";
import productRoutes from "./product.route";
import couponRoutes from "./coupon.route";
import accountUserRoutes from "./account-user.route";
import settingRoutes from "./setting.route";
import orderRoutes from "./order.route";
import reviewRoutes from "./review.route";

import * as authMiddleware from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use('/dashboard', authMiddleware.verifyToken, dashboardRoutes);
router.use('/article', authMiddleware.verifyToken, articleRoutes);
router.use('/helper', authMiddleware.verifyToken, helperRoutes);
router.use('/file-manager', authMiddleware.verifyToken, fileManagerRoutes);
router.use('/role', authMiddleware.verifyToken, roleRoutes);
router.use('/account-admin', authMiddleware.verifyToken, accountAdminRoutes);
router.use('/admin-log', authMiddleware.verifyToken, adminLogRoutes);
router.use('/account', accountRoutes);
router.use('/product', authMiddleware.verifyToken, productRoutes);
router.use('/coupon', authMiddleware.verifyToken, couponRoutes);
router.use('/account-user', authMiddleware.verifyToken, accountUserRoutes);
router.use('/setting', authMiddleware.verifyToken, settingRoutes);
router.use('/order', authMiddleware.verifyToken, orderRoutes);
router.use('/review', authMiddleware.verifyToken, reviewRoutes);


export default router;