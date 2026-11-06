import { Router } from "express";
import * as locationController from "../../controllers/client/location.controller";

const router = Router();

router.get('/search', locationController.search);
router.get('/reverse', locationController.reverse);

export default router;
