import express from 'express';
import path from 'path';
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { domainCDN, pathAdmin } from './configs/variable.config';
import dotenv from 'dotenv';
import { connectDB } from './configs/database.config';
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { configureGooglePassport } from './configs/googleOauth.config';

// Load biến môi trường từ file .env
dotenv.config();

const app = express();
const port = 3000;

// Kết nối đến cơ sở dữ liệu
connectDB();

// Cho phép gửi data lên dạng json
app.use(express.json());

// Middleware tắt cache (áp dụng cho tất cả GET request)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    // Tắt cache
    // - no-store: không lưu ở cache nào cả
    // - no-cache: luôn kiểm tra lại với server trước khi dùng cache
    // - must-revalidate: nếu cache hết hạn thì phải hỏi lại server
    // - private: chỉ cache trên trình duyệt cá nhân, không cho proxy/cache chung
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // Để tương thích với trình duyệt / proxy cũ
    res.set('Pragma', 'no-cache');

    // Đặt thời gian hết hạn của response là ngay lập tức (nghĩa là trình duyệt không được dùng lại mà không hỏi server)
    res.set('Expires', '0');
  }
  next();
});

// Thiết lập thư mục views và view engine Pug
app.set('views', path.join(__dirname, 'views')); // Thư mục chứa file Pug
app.set('view engine', 'pug'); // Thiết lập Pug làm view engine

// Thiết lập thư mục chứa file tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Tạo biến toàn cục trong file Pug
app.locals.pathAdmin = pathAdmin;
app.locals.domainCDN = domainCDN;

// Khởi tạo thư viện lấy cookie
app.use(cookieParser());


// Cấu hình session
app.use(session({
  secret: `${process.env.SESSION_SECRET}`,
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

configureGooglePassport(passport);


app.use(`/${pathAdmin}`, adminRoutes);
app.use("/", clientRoutes);

app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`);
});