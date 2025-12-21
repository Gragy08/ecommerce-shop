import { Router } from "express";
import homeRoutes from "./home.route";
import articleRoutes from "./article.route";
import productRoutes from "./product.route";
import cartRoutes from "./cart.route";
import * as categoryMiddleware from "../../middlewares/client/category.middleware";
import * as attributeMiddleware from "../../middlewares/client/attribute.middleware";

const router = Router();

router.use(categoryMiddleware.getAllCategory);

router.use(attributeMiddleware.getAttributeProduct);

router.use('/', homeRoutes);

router.use('/article', articleRoutes);

router.use('/product', productRoutes);

router.use('/cart', cartRoutes);

export default router;
