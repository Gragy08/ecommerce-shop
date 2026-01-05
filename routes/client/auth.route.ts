import { Router } from "express";
import * as authController from "../../controllers/client/auth.controller";
import * as authValidate from "../../validates/client/auth.validate";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
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
}), authController.callbackGoogle);

router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email'],
}));

router.get('/facebook/callback', passport.authenticate('facebook', {
  failureRedirect: '/auth/login',
}), authController.callbackFacebook);

router.get('/forgot-password', authController.forgotPassword);

router.post(
  '/forgot-password', 
  authValidate.forgotPasswordPost, 
  authController.forgotPasswordPost
);

router.get('/otp-password', authController.otpPassword);

router.post(
  '/otp-password', 
  authValidate.otpPasswordPost, 
  authController.otpPasswordPost
);

router.get('/reset-password', authController.resetPassword);

router.post(
  '/reset-password', 
  authMiddleware.verifyToken,
  authValidate.resetPasswordPost, 
  authController.resetPasswordPost
);

export default router;