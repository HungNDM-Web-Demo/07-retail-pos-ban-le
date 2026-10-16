namespace Application.Constants;

/// <summary>
/// Mã quyền nghiệp vụ của POS Cửa hàng Bán lẻ (02-SRS §7, 07 §1). Tách khỏi <see cref="Permissions"/> (quyền nền) để không
/// sửa file nền. Mỗi mã phải có trong FE/src/mock/seed/project.json và FE src/config/permissions.ts
/// (test <c>ProjectPermissionConstantsTests</c>).
/// </summary>
public static class ProjectPermissions
{
    public static class Products
    {
        public const string View = "products.view";
        public const string Create = "products.create";
        public const string Update = "products.update";
        public const string Delete = "products.delete";

        /// <summary>Thiếu quyền này thì giá vốn, biên lãi trả null (07 §1).</summary>
        public const string ViewCost = "products.view-cost";
    }

    public static class Orders
    {
        public const string Create = "orders.create";

        /// <summary>Không có <see cref="Shifts.View"/> thì chỉ thấy hóa đơn trong ca của mình.</summary>
        public const string View = "orders.view";

        public const string Discount = "orders.discount";
        public const string DiscountOverride = "orders.discount-override";

        /// <summary>In lại (FE kiểm tra, không có endpoint riêng).</summary>
        public const string Reprint = "orders.reprint";
    }

    public static class Returns
    {
        public const string Create = "returns.create";
        public const string View = "returns.view";
        public const string Override = "returns.override";
    }

    public static class Shifts
    {
        public const string Operate = "shifts.operate";

        /// <summary>Xem mọi ca, mọi hóa đơn và phiếu đổi trả.</summary>
        public const string View = "shifts.view";

        public const string Review = "shifts.review";
    }

    public static class StockLevels
    {
        public const string View = "stock-levels.view";
    }

    public static class StockAdjustments
    {
        public const string Create = "stock-adjustments.create";
    }

    public static class Suppliers
    {
        public const string View = "suppliers.view";
        public const string Create = "suppliers.create";
        public const string Update = "suppliers.update";
    }

    public static class GoodsReceipts
    {
        public const string View = "goods-receipts.view";
        public const string Create = "goods-receipts.create";
        public const string Update = "goods-receipts.update";
        public const string Delete = "goods-receipts.delete";
        public const string Confirm = "goods-receipts.confirm";
    }

    public static class Reports
    {
        public const string View = "reports.view";
    }

    public static class Customers
    {
        public const string View = "customers.view";
        public const string Create = "customers.create";
    }
}
