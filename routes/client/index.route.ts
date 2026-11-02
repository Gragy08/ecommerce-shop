import { Router } from "express";
import homeRoutes from "./home.route";
import articleRoutes from "./article.route";
import productRoutes from "./product.route";
import cartRoutes from "./cart.route";
import compareRoutes from "./compare.route";
import wishlistRoutes from "./wishlist.route";
import authRoutes from "./auth.route";
import dashboardRoutes from "./dashboard.route";
import couponRoutes from "./coupon.route";
import checkoutRoutes from "./checkout.route";
import orderRoutes from "./order.route";
import * as categoryMiddleware from "../../middlewares/client/category.middleware";
import * as attributeMiddleware from "../../middlewares/client/attribute.middleware";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import * as seoMiddleware from "../../middlewares/client/seo.middleware";
import * as settingMiddleware from "../../middlewares/client/setting.middleware";

const router = Router();

router.use(categoryMiddleware.getAllCategory);

router.use(attributeMiddleware.getAttributeProduct);

router.use(authMiddleware.verifyToken);

router.use(seoMiddleware.canonical);

router.use(settingMiddleware.assetVersion);

router.use('/', homeRoutes);

router.use('/article', articleRoutes);

router.use('/product', productRoutes);

router.use('/cart', cartRoutes);

router.use('/compare', compareRoutes);

router.use('/wishlist', wishlistRoutes);

router.use('/auth', authRoutes);

router.use('/dashboard', authMiddleware.loggedIn, dashboardRoutes);

router.use('/coupon', couponRoutes);

router.use('/checkout', checkoutRoutes);

router.use('/order', orderRoutes);

export default router;
