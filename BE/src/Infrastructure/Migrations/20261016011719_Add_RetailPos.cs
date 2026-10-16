using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_RetailPos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Crm_Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    OrderCount = table.Column<int>(type: "integer", nullable: false),
                    TotalSpent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LastOrderAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Crm_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_ProductGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_ProductGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pos_Shifts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CashierId = table.Column<Guid>(type: "uuid", nullable: false),
                    CashierName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OpeningCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderCount = table.Column<int>(type: "integer", nullable: false),
                    ReturnCount = table.Column<int>(type: "integer", nullable: false),
                    CashSales = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TransferSales = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CardSales = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OffsetSales = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SalesTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CashRefund = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TransferRefund = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OffsetRefund = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RefundTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpectedCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CountedCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CashCountJson = table.Column<string>(type: "text", nullable: true),
                    Difference = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReviewNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ReviewedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_Shifts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_Shifts_System_Users_CashierId",
                        column: x => x.CashierId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NameSearch = table.Column<string>(type: "character varying(221)", maxLength: 221, nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: false),
                    AvgCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinStock = table.Column<int>(type: "integer", nullable: false),
                    TrackExpiry = table.Column<bool>(type: "boolean", nullable: false),
                    Returnable = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OpeningStock = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_Products_Inventory_ProductGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Inventory_ProductGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_GoodsReceipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReceivedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConfirmedById = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_GoodsReceipts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceipts_Inventory_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Inventory_Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_Orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ShiftId = table.Column<Guid>(type: "uuid", nullable: false),
                    CashierId = table.Column<Guid>(type: "uuid", nullable: false),
                    CashierName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LineDiscountTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderDiscountType = table.Column<int>(type: "integer", nullable: true),
                    OrderDiscountValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    OrderDiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderDiscountReason = table.Column<int>(type: "integer", nullable: true),
                    OrderDiscountNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ApprovalReasons = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    PointsEarned = table.Column<int>(type: "integer", nullable: false),
                    ReturnStatus = table.Column<int>(type: "integer", nullable: false),
                    ExchangeForReturnId = table.Column<Guid>(type: "uuid", nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    QrContent = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_Orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_Orders_Crm_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Crm_Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Orders_Pos_Shifts_ShiftId",
                        column: x => x.ShiftId,
                        principalTable: "Pos_Shifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Orders_System_Users_CashierId",
                        column: x => x.CashierId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_ProductUnits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Barcode = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsBase = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    EverUsed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_ProductUnits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_ProductUnits_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StockMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    StockAfter = table.Column<int>(type: "integer", nullable: false),
                    CostAfter = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StockMovements_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_OrderPayments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CashReceived = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ChangeAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_OrderPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_OrderPayments_Pos_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Pos_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Pos_Returns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ShiftId = table.Column<Guid>(type: "uuid", nullable: false),
                    CashierId = table.Column<Guid>(type: "uuid", nullable: false),
                    CashierName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    RefundTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OffsetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PayoutAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RefundMethod = table.Column<int>(type: "integer", nullable: false),
                    ExchangeOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PointsDeducted = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_Returns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_Returns_Pos_Orders_ExchangeOrderId",
                        column: x => x.ExchangeOrderId,
                        principalTable: "Pos_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Returns_Pos_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Pos_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Returns_Pos_Shifts_ShiftId",
                        column: x => x.ShiftId,
                        principalTable: "Pos_Shifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Returns_System_Users_CashierId",
                        column: x => x.CashierId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_GoodsReceiptLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GoodsReceiptId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CostBefore = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CostAfter = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_GoodsReceiptLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceiptLines_Inventory_GoodsReceipts_GoodsRe~",
                        column: x => x.GoodsReceiptId,
                        principalTable: "Inventory_GoodsReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceiptLines_Inventory_ProductUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Inventory_ProductUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceiptLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_OrderLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    BaseQty = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountType = table.Column<int>(type: "integer", nullable: true),
                    DiscountValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    DiscountReason = table.Column<int>(type: "integer", nullable: true),
                    DiscountNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AllocatedDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Returnable = table.Column<bool>(type: "boolean", nullable: false),
                    ReturnedQty = table.Column<int>(type: "integer", nullable: false),
                    RefundedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_OrderLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_OrderLines_Inventory_ProductUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Inventory_ProductUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_OrderLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_OrderLines_Pos_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Pos_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StockAdjustments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    GoodsReceiptLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TotalValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StockAdjustments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StockAdjustments_Inventory_GoodsReceiptLines_Good~",
                        column: x => x.GoodsReceiptLineId,
                        principalTable: "Inventory_GoodsReceiptLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_ReturnLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReturnId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    BaseQty = table.Column<int>(type: "integer", nullable: false),
                    Condition = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RefundAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_ReturnLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_ReturnLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_ReturnLines_Pos_OrderLines_OrderLineId",
                        column: x => x.OrderLineId,
                        principalTable: "Pos_OrderLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_ReturnLines_Pos_Returns_ReturnId",
                        column: x => x.ReturnId,
                        principalTable: "Pos_Returns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StockAdjustmentLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StockAdjustmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    SystemQty = table.Column<int>(type: "integer", nullable: false),
                    ActualQty = table.Column<int>(type: "integer", nullable: false),
                    Difference = table.Column<int>(type: "integer", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StockAdjustmentLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StockAdjustmentLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_StockAdjustmentLines_Inventory_StockAdjustments_S~",
                        column: x => x.StockAdjustmentId,
                        principalTable: "Inventory_StockAdjustments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Crm_Customers_Phone",
                table: "Crm_Customers",
                column: "Phone",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceiptLines_GoodsReceiptId",
                table: "Inventory_GoodsReceiptLines",
                column: "GoodsReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceiptLines_ProductId_ExpiryDate",
                table: "Inventory_GoodsReceiptLines",
                columns: new[] { "ProductId", "ExpiryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceiptLines_UnitId",
                table: "Inventory_GoodsReceiptLines",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_Code",
                table: "Inventory_GoodsReceipts",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_Status_ReceivedDate",
                table: "Inventory_GoodsReceipts",
                columns: new[] { "Status", "ReceivedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_SupplierId",
                table: "Inventory_GoodsReceipts",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductGroups_Code",
                table: "Inventory_ProductGroups",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductGroups_Name",
                table: "Inventory_ProductGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Products_Code",
                table: "Inventory_Products",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Products_GroupId",
                table: "Inventory_Products",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Products_Status",
                table: "Inventory_Products",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductUnits_Barcode",
                table: "Inventory_ProductUnits",
                column: "Barcode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductUnits_ProductId_Name",
                table: "Inventory_ProductUnits",
                columns: new[] { "ProductId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockAdjustmentLines_ProductId",
                table: "Inventory_StockAdjustmentLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockAdjustmentLines_StockAdjustmentId",
                table: "Inventory_StockAdjustmentLines",
                column: "StockAdjustmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockAdjustments_Code",
                table: "Inventory_StockAdjustments",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockAdjustments_GoodsReceiptLineId",
                table: "Inventory_StockAdjustments",
                column: "GoodsReceiptLineId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockMovements_ProductId_OccurredAt",
                table: "Inventory_StockMovements",
                columns: new[] { "ProductId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Suppliers_Code",
                table: "Inventory_Suppliers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderLines_OrderId",
                table: "Pos_OrderLines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderLines_ProductId",
                table: "Pos_OrderLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderLines_UnitId",
                table: "Pos_OrderLines",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderPayments_OrderId",
                table: "Pos_OrderPayments",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_CashierId_PaidAt",
                table: "Pos_Orders",
                columns: new[] { "CashierId", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_ClientRequestId",
                table: "Pos_Orders",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_Code",
                table: "Pos_Orders",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_CustomerId",
                table: "Pos_Orders",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_ExchangeForReturnId",
                table: "Pos_Orders",
                column: "ExchangeForReturnId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_PaidAt",
                table: "Pos_Orders",
                column: "PaidAt");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_ShiftId",
                table: "Pos_Orders",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ReturnLines_OrderLineId",
                table: "Pos_ReturnLines",
                column: "OrderLineId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ReturnLines_ProductId",
                table: "Pos_ReturnLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ReturnLines_ReturnId",
                table: "Pos_ReturnLines",
                column: "ReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Returns_CashierId",
                table: "Pos_Returns",
                column: "CashierId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Returns_ClientRequestId",
                table: "Pos_Returns",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Returns_Code",
                table: "Pos_Returns",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Returns_ExchangeOrderId",
                table: "Pos_Returns",
                column: "ExchangeOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Returns_OrderId",
                table: "Pos_Returns",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Returns_ShiftId",
                table: "Pos_Returns",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Shifts_CashierId_Status",
                table: "Pos_Shifts",
                columns: new[] { "CashierId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Shifts_Code",
                table: "Pos_Shifts",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Shifts_OpenedAt",
                table: "Pos_Shifts",
                column: "OpenedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Inventory_StockAdjustmentLines");

            migrationBuilder.DropTable(
                name: "Inventory_StockMovements");

            migrationBuilder.DropTable(
                name: "Pos_OrderPayments");

            migrationBuilder.DropTable(
                name: "Pos_ReturnLines");

            migrationBuilder.DropTable(
                name: "Inventory_StockAdjustments");

            migrationBuilder.DropTable(
                name: "Pos_OrderLines");

            migrationBuilder.DropTable(
                name: "Pos_Returns");

            migrationBuilder.DropTable(
                name: "Inventory_GoodsReceiptLines");

            migrationBuilder.DropTable(
                name: "Pos_Orders");

            migrationBuilder.DropTable(
                name: "Inventory_GoodsReceipts");

            migrationBuilder.DropTable(
                name: "Inventory_ProductUnits");

            migrationBuilder.DropTable(
                name: "Crm_Customers");

            migrationBuilder.DropTable(
                name: "Pos_Shifts");

            migrationBuilder.DropTable(
                name: "Inventory_Suppliers");

            migrationBuilder.DropTable(
                name: "Inventory_Products");

            migrationBuilder.DropTable(
                name: "Inventory_ProductGroups");
        }
    }
}
