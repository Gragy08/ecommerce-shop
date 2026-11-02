import { Router } from "express";
import * as homeController from "../../controllers/client/home.controller";

const router = Router();

router.get('/', homeController.home);

router.get('/sitemap.xml', homeController.sitemap);

export default router;
