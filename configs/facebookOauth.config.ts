import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import AccountUser from "../models/account-user.model.ts";
import slugify from "slugify";

// Hàm nhận passport để cấu hình
export const configureFacebookPassport = (passportInstance: typeof passport) => {
  // Thiết lập chiến lược đăng nhập bằng Facebook
  passportInstance.use(new FacebookStrategy(
    {
      clientID: `${process.env.FACEBOOK_APP_ID}`, // ID ứng dụng Dacebook
      clientSecret: `${process.env.FACEBOOK_APP_SECRET}`, // Secret key
      callbackURL: `${process.env.FACEBOOK_CALLBACK_URL}`, // URL gọi vào sau khi đăng nhập
      profileFields: ["id", "displayName", "emails"], // Lấy thêm các trường dữ liệu
    },
    // Hàm callback khi Facebook xác thực thành công
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Tìm user theo email trong database
        const existingUser = await AccountUser.findOne({ email: profile.emails?.[0].value });
        if (existingUser) {
          // Nếu tồn tại, trả về user này
          return done(null, existingUser);
        }
        
        // Nếu chưa có thì tạo user mới
        const fullName = profile.displayName;
        const email = profile.emails?.[0].value;
        const search = slugify(`${fullName} ${email}`, {
          replacement: ' ',
          lower: true, // Chữ thường
        })

        const newUser = new AccountUser({
          facebookId: profile.id,
          fullName: fullName,
          email: email,
          search: search,
        });
        await newUser.save();

        // Trả user mới tạo cho Passport
        done(null, newUser);
      } catch (error) {
        // Nếu lỗi, báo cho Passport
        done(error, undefined);
      }
    }
  ));

   // Lưu user.id vào session
  passportInstance.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Khi có session, lấy lại user từ database
  passportInstance.deserializeUser(async (id: string, done) => {
    try {
      const user = await AccountUser.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};