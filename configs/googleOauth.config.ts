import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AccountUser from "../models/account-user.model.ts";
import slugify from "slugify";

export const configureGooglePassport = function (
  passportInstance: typeof passport
) {
  passportInstance.use(
    new GoogleStrategy(
      {
        clientID: `${process.env.GOOGLE_CLIENT_ID}`,
        clientSecret: `${process.env.GOOGLE_CLIENT_SECRET}`,
        callbackURL: `${process.env.GOOGLE_CALLBACK_URL}`,
      },
      // Hàm khi google xác thực thành công
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = (profile.emails as any)?.[0]?.value;
          
          const existingUser = await AccountUser.findOne({
            email: email
          });
          if (existingUser) {
            return done(null, existingUser);
          }

          const fullName = profile.displayName;
          const search = slugify(`${fullName} ${email}`, {
            replacement: " ",
            lower: true,
          });

          const newUser = new AccountUser({
            googleId: profile.id,
            fullName: fullName,
            email: email,
            avatar: (profile.photos as any)?.[0]?.value,
            search: search
          });
          await newUser.save();
          done(null, newUser);
        } catch (error) {
          done(error, undefined);
        }
      }
    )
  );

  passportInstance.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passportInstance.deserializeUser(async (id, done) => {
    try {
      const user = await AccountUser.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};