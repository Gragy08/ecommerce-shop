import { Router } from "express";
import * as authController from "../../controllers/client/auth.controller";
import * as authValidate from "../../validates/client/auth.validate";
import passport from "passport";

const router = Router();

router.get('/register', authController.register);

router.post(
  '/register', 
  authValidate.registerPost, 
  authController.registerPost
);

router.get('/login', authController.login);

router.post(
  '/login', 
  authValidate.loginPost, 
  authController.loginPost
);

router.get('/logout', authController.logout);

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/auth/login',
}), (req, res) => {
  res.redirect('/');
});

export default router;