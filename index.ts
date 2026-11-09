import "dotenv/config";
import express from 'express';
import path from 'path';
import moment from 'moment';
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { domainCDN, pathAdmin } from './configs/variable.config';
import { connectDB } from './configs/database.config';
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { configureGooglePassport } from './configs/googleOauth.config';
import { configureFacebookPassport } from './configs/facebookOauth.config';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { initSocket } from './sockets/index.socket';
import { startJobs } from './jobs/index.job';

const app = express();
const port = Number(process.env.PORT) || 3000;
app.set("trust proxy", 1);

// Khởi tạo SocketIO bên Server
const server = createServer(app);
const io = new Server(server);

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
app.locals.moment = moment;

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

// Cấu hình các xác thực
configureGooglePassport(passport);
configureFacebookPassport(passport);

app.use(`/${pathAdmin}`, adminRoutes);
app.use("/", clientRoutes);

// Middleware xử lý lỗi tập trung tránh crash server
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Route Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  if (isJson) {
    res.status(500).json({
      code: "error",
      message: "Có lỗi máy chủ nội bộ xảy ra!"
    });
  } else {
    res.status(500).send("<div style='text-align:center;padding:50px;font-family:sans-serif;'><h2>500 - Có lỗi xảy ra</h2><p>Hệ thống đang được xử lý, vui lòng quay lại sau ít phút hoặc liên hệ quản trị viên.</p><a href='/'>Quay về trang chủ</a></div>");
  }
});

// Khởi tạo Socket bên Server
initSocket(io);

// Gọi job
startJobs();

// Bắt lỗi toàn cục tránh crash tiến trình
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Website đang chạy trên cổng ${port}`);
});