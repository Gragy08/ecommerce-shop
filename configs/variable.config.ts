export const pathAdmin = "admin";

export const domainCDN = process.env.DOMAIN_CDN || "http://localhost:4000";

export const permissionList = [
  {
    id: "dashboard",
    name: "Trang tổng quan"
  },
  {
    id: "product-role",
    name: "Quản lý sản phẩm"
  },
  {
    id: "product-list",
    name: "Danh sách sản phẩm"
  },
  {
    id: "product-create",
    name: "Tạo sản phẩm"
  },
  {
    id: "product-edit",
    name: "Sửa sản phẩm"
  },
  {
    id: "product-delete",
    name: "Xóa sản phẩm"
  },
  {
    id: "product-purchase-price",
    name: "Xem giá vốn nhập hàng"
  },
  {
    id: "article-role",
    name: "Quản lý bài viết"
  },
  {
    id: "article-list",
    name: "Danh sách bài viết"
  },
  {
    id: "article-create",
    name: "Tạo bài viết"
  },
  {
    id: "article-edit",
    name: "Sửa bài viết"
  },
  {
    id: "article-delete",
    name: "Xóa bài viết"
  },
  {
    id: "article-trash",
    name: "Thùng rác bài viết"
  },
  {
    id: "article-category",
    name: "Danh mục bài viết"
  },
  {
    id: "article-category-create",
    name: "Tạo danh mục bài viết"
  },
  {
    id: "article-category-edit",
    name: "Sửa danh mục bài viết"
  },
  {
    id: "article-category-delete",
    name: "Xóa danh mục bài viết"
  },
  {
    id: "article-category-trash",
    name: "Thùng rác danh mục bài viết"
  },
  {
    id: "role-role",
    name: "Quản lý nhóm quyền"
  },
  {
    id: "role-list",
    name: "Danh sách nhóm quyền"
  },
  {
    id: "role-create",
    name: "Tạo nhóm quyền"
  },
  {
    id: "role-edit",
    name: "Sửa nhóm quyền"
  },
  {
    id: "role-delete",
    name: "Xóa nhóm quyền"
  },
  {
    id: "role-trash",
    name: "Thùng rác nhóm quyền"
  },
  {
    id: "account-admin-role",
    name: "Quản lý tài khoản quản trị"
  },
  {
    id: "account-admin-list",
    name: "Danh sách tài khoản quản trị"
  },
  {
    id: "account-admin-create",
    name: "Tạo tài khoản quản trị"
  },
  {
    id: "account-admin-edit",
    name: "Sửa tài khoản quản trị"
  },
  {
    id: "account-admin-change-password",
    name: "Đổi mật khẩu tài khoản quản trị"
  },
  {
    id: "account-admin-delete",
    name: "Xóa tài khoản quản trị"
  },
  {
    id: "log-activity-role",
    name: "Quản lý hoạt động quản trị"
  },
  {
    id: "coupon-role",
    name: "Quản lý mã giảm giá"
  },
  {
    id: "coupon-list",
    name: "Danh sách mã giảm giá"
  },
  {
    id: "coupon-create",
    name: "Tạo mã giảm giá"
  },
  {
    id: "coupon-edit",
    name: "Chỉnh sửa lý mã giảm giá"
  },
  {
    id: "coupon-delete",
    name: "Xóa mã giảm giá"
  },
  {
    id: "log-activity-list",
    name: "Danh sách hoạt động quản trị"
  },
  {
    id: "file-manager",
    name: "Quản lý file"
  },
  // Quản lý Nhà cung cấp
  {
    id: "supplier-role",
    name: "Quản lý nhà cung cấp"
  },
  {
    id: "supplier-list",
    name: "Danh sách nhà cung cấp"
  },
  {
    id: "supplier-create",
    name: "Tạo nhà cung cấp"
  },
  {
    id: "supplier-edit",
    name: "Sửa nhà cung cấp"
  },
  {
    id: "supplier-delete",
    name: "Xóa nhà cung cấp"
  },
  // Quản lý Kho hàng & Phiếu nhập (IMEI / Số lượng)
  {
    id: "inventory-role",
    name: "Quản lý kho hàng"
  },
  {
    id: "inventory-list",
    name: "Danh sách tồn kho"
  },
  {
    id: "inventory-tracker",
    name: "Tra cứu vòng đời IMEI"
  },
  {
    id: "stock-receipt-list",
    name: "Danh sách phiếu nhập kho"
  },
  {
    id: "stock-receipt-create",
    name: "Tạo phiếu nhập kho"
  },
  {
    id: "stock-receipt-edit",
    name: "Chi tiết / Sửa phiếu nhập"
  },
  {
    id: "stock-receipt-delete",
    name: "Hủy phiếu nhập kho"
  },
  // Bán hàng tại quầy (POS)
  {
    id: "order-pos",
    name: "Bán hàng tại quầy"
  },
  // Quản lý Khách hàng CRM
  {
    id: "customer-role",
    name: "Quản lý khách hàng"
  },
  {
    id: "customer-list",
    name: "Danh sách khách hàng"
  },
  {
    id: "customer-create",
    name: "Tạo khách hàng"
  },
  {
    id: "customer-edit",
    name: "Sửa hồ sơ khách hàng"
  },
  {
    id: "customer-delete",
    name: "Xóa khách hàng"
  },
  // Quản lý Bảo hành - Sửa chữa
  {
    id: "warranty-role",
    name: "Quản lý bảo hành - sửa chữa"
  },
  {
    id: "warranty-list",
    name: "Danh sách phiếu bảo hành"
  },
  {
    id: "warranty-create",
    name: "Tiếp nhận bảo hành"
  },
  {
    id: "warranty-edit",
    name: "Cập nhật tiến độ bảo hành"
  },
  {
    id: "warranty-delete",
    name: "Xóa phiếu bảo hành"
  }
];

export const pointConfig = {
  MONEY_PER_POINT: 10000, // 10.000đ = 1 điểm
  POINT_TO_MONEY: 100, // 1 điểm = 100đ
};
