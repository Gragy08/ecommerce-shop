import { Router } from "express";
import * as wishlistController from "../../controllers/client/wishlist.controller";

const router = Router();

router.get('/', wishlistController.wishlist);

export default router;
