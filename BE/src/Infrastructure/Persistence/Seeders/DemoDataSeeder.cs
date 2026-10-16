using System.Globalization;
using System.Text.Json;
using Application.Common.Time;
using Domain.Base;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.StockAdjustments;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Inventory.StockAdjustments;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Returns;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nghiệp vụ mẫu của Bình An Mart (bảng <c>Inventory_*</c>, <c>Pos_*</c>, <c>Crm_*</c>), đọc từ
/// <c>FE/src/mock/seed/demo-data.json</c> (nguồn duy nhất, FE mock nạp cùng file). Suy ra trường đúng 06 §5.2–5.4:
/// tiền tính bằng <see cref="OrderPricing"/>, hóa đơn và ca hôm nay nạp theo giờ lúc nạp, tồn và sổ biến động chạy lại từ
/// tồn đầu kỳ; Id = <see cref="SeedIds.Stable"/> như FE. Số kết quả phải khớp 06 §5.5 (test <c>RetailSeedTests</c>).
/// </summary>
public sealed class DemoDataSeeder(AppDbContext db, TimeProvider timeProvider, ILogger<DemoDataSeeder> logger) : IDemoDataSeeder
{
    public const string SeedFileName = "demo-data.json";

    private const string ManagerUsername = "quanly";
    private static readonly TimeOnly MasterDataTime = new(8, 0);

    public async Task<bool> HasDataAsync(CancellationToken ct = default) =>
        await db.Set<ProductGroup>().AnyAsync(ct) || await db.Set<Order>().AnyAsync(ct);

    public async Task ClearAsync(CancellationToken ct = default)
    {
        // Bảng con trước, bảng cha sau; xóa cứng cả bản ghi đã xóa mềm.
        await db.Set<StockMovement>().ExecuteDeleteAsync(ct);
        await db.Set<ReturnLine>().ExecuteDeleteAsync(ct);
        await db.Set<Return>().ExecuteDeleteAsync(ct);
        await db.Set<OrderPayment>().ExecuteDeleteAsync(ct);
        await db.Set<OrderLine>().ExecuteDeleteAsync(ct);
        await db.Set<Order>().ExecuteDeleteAsync(ct);
        await db.Set<Shift>().ExecuteDeleteAsync(ct);
        await db.Set<StockAdjustmentLine>().ExecuteDeleteAsync(ct);
        await db.Set<StockAdjustment>().ExecuteDeleteAsync(ct);
        await db.Set<GoodsReceiptLine>().ExecuteDeleteAsync(ct);
        await db.Set<GoodsReceipt>().ExecuteDeleteAsync(ct);
        await db.Set<ProductUnit>().ExecuteDeleteAsync(ct);
        await db.Set<Product>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<ProductGroup>().ExecuteDeleteAsync(ct);
        await db.Set<Supplier>().ExecuteDeleteAsync(ct);
        await db.Set<Customer>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var root = SeedJson.Read<JsonElement>(SeedFileName, timeProvider);
        var users = await db.Set<User>().AsNoTracking()
            .ToDictionaryAsync(u => u.Username, u => (u.Id, u.FullName), StringComparer.OrdinalIgnoreCase, ct);
        if (!users.TryGetValue(ManagerUsername, out var manager))
            throw new InvalidOperationException($"Thiếu tài khoản demo '{ManagerUsername}' (FE/src/mock/seed/project.json).");

        var builder = new Builder(timeProvider, users, manager);
        builder.Build(root);

        var autoDetect = db.ChangeTracker.AutoDetectChangesEnabled;
        db.ChangeTracker.AutoDetectChangesEnabled = false;
        try
        {
            db.AddRange(builder.Entities);
            foreach (var (entity, createdAt) in builder.CreatedAtOverrides)
                db.Entry(entity).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = createdAt;
            db.ChangeTracker.DetectChanges();
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.ChangeTracker.AutoDetectChangesEnabled = autoDetect;
            db.ChangeTracker.Clear();
        }

        logger.LogInformation(
            "Đã nạp dữ liệu mẫu: {Products} hàng hóa, {Orders} hóa đơn ({Lines} dòng), {Returns} phiếu đổi trả, {Shifts} ca, {Receipts} phiếu nhập, {Movements} dòng biến động tồn.",
            builder.ProductCount, builder.OrderCount, builder.OrderLineCount, builder.ReturnCount, builder.ShiftCount, builder.ReceiptCount, builder.MovementCount);
    }

    /// <summary>Dựng toàn bộ entity trong bộ nhớ theo 06 §5.2–5.4.</summary>
    private sealed class Builder(TimeProvider time, Dictionary<string, (Guid Id, string FullName)> users, (Guid Id, string FullName) manager)
    {
        private readonly DateOnly _today = VietnamDates.Today(time);
        private readonly int _nowMinutes = (int)VietnamDates.NowVietnam(time).TimeOfDay.TotalMinutes;

        private readonly Dictionary<string, ProductGroup> _groups = [];
        private readonly List<SeedProduct> _products = [];
        private readonly Dictionary<string, Supplier> _suppliers = [];
        private readonly Dictionary<string, Customer> _customers = [];
        private readonly Dictionary<(int D, int K), Shift> _shifts = [];
        private readonly Dictionary<(int D, int K), ShiftTotalsBuilder> _shiftTotals = [];
        private readonly Dictionary<int, SeedOrder> _orders = [];
        private readonly List<(int Index, SeedReturn Return)> _returns = [];
        private readonly List<SeedEvent> _events = [];

        public List<object> Entities { get; } = [];
        public List<(object Entity, DateTime CreatedAt)> CreatedAtOverrides { get; } = [];
        public int ProductCount => _products.Count;
        public int OrderCount => _orders.Count;
        public int OrderLineCount => _orders.Values.Sum(o => o.Entity.Lines.Count);
        public int ReturnCount => _returns.Count;
        public int ShiftCount => _shifts.Count;
        public int ReceiptCount { get; private set; }
        public int MovementCount { get; private set; }

        public void Build(JsonElement root)
        {
            var masterCreatedAt = At(-100, MasterDataTime);
            BuildGroups(root.GetProperty("productGroups"), masterCreatedAt);
            BuildProducts(root.GetProperty("products"), masterCreatedAt);
            BuildSuppliers(root.GetProperty("suppliers"), masterCreatedAt);
            BuildCustomers(root.GetProperty("customers"));
            BuildShifts(root.GetProperty("shifts"));
            var returnsJson = root.GetProperty("returns").EnumerateArray().ToList();
            BuildOrders(root.GetProperty("orders"));
            BuildReturns(returnsJson);
            AddOrderPayments(root.GetProperty("orders"));
            BuildReceipts(root.GetProperty("receipts"));
            BuildAdjustments(root.GetProperty("adjustments"));
            ApplyCustomerStats();
            CloseShifts(root.GetProperty("shifts"));
            ReplayStock();
        }

        // ------------------------------------------------------------------ Danh mục

        private void BuildGroups(JsonElement items, DateTime createdAt)
        {
            foreach (var g in items.EnumerateArray())
            {
                var code = g.GetProperty("code").GetString()!;
                var group = ProductGroup.Create(code, g.GetProperty("name").GetString()!, g.GetProperty("color").GetString()!, g.GetProperty("sortOrder").GetInt32(), SeedIds.Stable("group", code));
                _groups[code] = group;
                Add(group, createdAt);
            }
        }

        private void BuildProducts(JsonElement items, DateTime createdAt)
        {
            foreach (var p in items.EnumerateArray())
            {
                var code = p.GetProperty("code").GetString()!;
                var cost = p.GetProperty("cost").GetDecimal();
                var product = Product.Create(
                    code,
                    p.GetProperty("name").GetString()!,
                    _groups[p.GetProperty("group").GetString()!].Id,
                    p.GetProperty("minStock").GetInt32(),
                    p.GetProperty("trackExpiry").GetBoolean(),
                    p.GetProperty("returnable").GetBoolean(),
                    p.GetProperty("active").GetBoolean() ? ProductStatus.DangBan : ProductStatus.NgungBan,
                    p.TryGetProperty("image", out var image) && image.ValueKind == JsonValueKind.String ? $"/seed/products/{image.GetString()}.webp" : null,
                    p.GetProperty("color").GetString()!,
                    cost,
                    openingStock: p.GetProperty("openingStock").GetInt32(),
                    id: SeedIds.Stable("product", code));
                var units = new List<ProductUnit>
                {
                    product.AddUnit(p.GetProperty("unit").GetString()!, 1, NullableString(p, "barcode"), p.GetProperty("price").GetDecimal(), true, 0, SeedIds.Stable("unit", code, 0))
                };
                var k = 1;
                foreach (var u in p.GetProperty("units").EnumerateArray())
                {
                    units.Add(product.AddUnit(u.GetProperty("name").GetString()!, u.GetProperty("factor").GetInt32(), NullableString(u, "barcode"),
                        u.GetProperty("price").GetDecimal(), false, k, SeedIds.Stable("unit", code, k)));
                    k++;
                }

                _products.Add(new SeedProduct(product, units, cost, p.GetProperty("stock").GetInt32()));
                Add(product, createdAt);
                foreach (var unit in units)
                    CreatedAtOverrides.Add((unit, createdAt));
            }
        }

        private void BuildSuppliers(JsonElement items, DateTime createdAt)
        {
            foreach (var s in items.EnumerateArray())
            {
                var code = s.GetProperty("code").GetString()!;
                var supplier = Supplier.Create(code, s.GetProperty("name").GetString()!, NullableString(s, "phone"), NullableString(s, "address"), NullableString(s, "note"), SeedIds.Stable("supplier", code));
                _suppliers[code] = supplier;
                Add(supplier, createdAt);
            }
        }

        private void BuildCustomers(JsonElement items)
        {
            foreach (var c in items.EnumerateArray())
            {
                var phone = c.GetProperty("phone").GetString()!;
                var customer = Customer.Create(phone, c.GetProperty("name").GetString()!, At(-c.GetProperty("createdDaysAgo").GetInt32(), MasterDataTime), SeedIds.Stable("customer", phone));
                _customers[phone] = customer;
                Entities.Add(customer);
            }
        }

        // ------------------------------------------------------------------ Ca, hóa đơn, đổi trả

        private void BuildShifts(JsonElement items)
        {
            foreach (var s in items.EnumerateArray())
            {
                var d = s.GetProperty("d").GetInt32();
                var k = s.GetProperty("k").GetInt32();
                var open = Time(s.GetProperty("o").GetString()!);
                if (d == 0 && Minutes(open) > _nowMinutes)
                    continue;

                var cashier = User(s.GetProperty("c").GetString()!);
                var shift = Shift.Open(DocCode("CA", d, k, 2), cashier.Id, cashier.FullName, At(d, open), s.GetProperty("oc").GetDecimal(), SeedIds.Stable("shift", d, k));
                _shifts[(d, k)] = shift;
                _shiftTotals[(d, k)] = new ShiftTotalsBuilder();
                Entities.Add(shift);
            }
        }

        private void BuildOrders(JsonElement items)
        {
            var sequence = new Dictionary<int, int>();
            var index = -1;
            foreach (var o in items.EnumerateArray())
            {
                index++;
                var d = o.GetProperty("d").GetInt32();
                var t = Time(o.GetProperty("t").GetString()!);
                if (d == 0 && Minutes(t) > _nowMinutes)
                    continue;

                var k = o.GetProperty("k").GetInt32();
                var shift = _shifts[(d, k)];
                var inputs = new List<PricingLineInput>();
                foreach (var line in o.GetProperty("it").EnumerateArray())
                {
                    var values = line.EnumerateArray().ToList();
                    var product = _products[values[0].GetInt32() - 1];
                    var unit = product.Units[values[1].GetInt32()];
                    unit.MarkUsed();
                    inputs.Add(new PricingLineInput(product.Entity.Id, product.Entity.Code, product.Entity.Name, product.Entity.GroupId, unit.Id, unit.Name,
                        unit.Factor, unit.Price, product.Cost, product.Entity.Returnable, values[2].GetInt32(),
                        values.Count > 3 && values[3].ValueKind == JsonValueKind.Object ? Discount(values[3]) : null));
                }

                var discount = o.TryGetProperty("dc", out var dc) ? Discount(dc) : null;
                var cart = OrderPricing.Price(inputs, discount, strict: false);
                var by = NullableString(o, "by");
                var approver = by is null ? ((Guid Id, string FullName)?)null : User(by);
                var customer = NullableString(o, "cu") is { } phone ? _customers[phone] : null;
                var seq = sequence[d] = sequence.GetValueOrDefault(d) + 1;
                var paidAt = At(d, t);
                var order = Order.Create(
                    new OrderHeader(
                        DocCode("HD", d, seq, 4), paidAt, shift.Id, shift.CashierId, shift.CashierName,
                        CustomerId: customer?.Id,
                        PointsEarned: customer is null ? 0 : PosRules.PointsFor(cart.Total),
                        ApprovedById: approver?.Id,
                        ApprovedByName: by,
                        ApprovalReasons: by is null ? null : string.Join("; ", cart.ApprovalReasons.Select(r => r.Text)),
                        Note: NullableString(o, "n"),
                        Id: SeedIds.Stable("order", index)),
                    cart);
                _orders[index] = new SeedOrder(order, d, k, customer);
                _shiftTotals[(d, k)].OrderCount++;
                _shiftTotals[(d, k)].SalesTotal += order.Total;
                Entities.Add(order);

                foreach (var line in order.Lines)
                    _events.Add(new SeedEvent(paidAt, 1, index, line.LineNo, line.ProductId, -line.BaseQty, MovementType.BanHang, order.Id, order.Code));
            }
        }

        private void BuildReturns(List<JsonElement> items)
        {
            var sequence = new Dictionary<int, int>();
            for (var index = 0; index < items.Count; index++)
            {
                var r = items[index];
                var d = r.GetProperty("d").GetInt32();
                var t = Time(r.GetProperty("t").GetString()!);
                var k = r.GetProperty("k").GetInt32();
                var source = _orders[r.GetProperty("o").GetInt32()];
                var shift = _shifts[(d, k)];
                var by = NullableString(r, "by");
                var note = NullableString(r, "n");
                var seq = sequence[d] = sequence.GetValueOrDefault(d) + 1;
                var createdAt = At(d, t);
                var entity = Return.Create(new ReturnHeader(
                    DocCode("TH", d, seq, 4), createdAt, shift.Id, shift.CashierId, shift.CashierName, source.Entity.Id,
                    Enum.Parse<RefundMethod>(r.GetProperty("rm").GetString()!),
                    Note: note,
                    ApprovedById: by is null ? null : User(by).Id,
                    ApprovedByName: by,
                    Id: SeedIds.Stable("return", index)));

                foreach (var line in r.GetProperty("li").EnumerateArray())
                {
                    var values = line.EnumerateArray().ToList();
                    var orderLine = source.Entity.Lines.Single(l => l.LineNo == values[0].GetInt32() + 1);
                    var quantity = values[1].GetInt32();
                    var condition = Enum.Parse<ReturnCondition>(values[2].GetString()!);
                    var reason = Enum.Parse<ReturnReason>(values[3].GetString()!);
                    var refund = OrderPricing.RefundForLine(orderLine.NetAmount, orderLine.RefundedAmount, orderLine.Quantity, orderLine.ReturnedQty, quantity);
                    var returnLine = entity.AddLine(orderLine, quantity, condition, reason, reason == ReturnReason.Khac ? note : null, refund);
                    source.Entity.RegisterReturn(orderLine.Id, quantity, refund);
                    if (condition == ReturnCondition.BanLaiDuoc)
                        _events.Add(new SeedEvent(createdAt, 2, index, orderLine.LineNo, orderLine.ProductId, returnLine.BaseQty, MovementType.TraHang, entity.Id, entity.Code));
                }

                if (r.TryGetProperty("x", out var x) && _orders.TryGetValue(x.GetInt32(), out var exchange))
                    entity.SetExchange(exchange.Entity.Id, exchange.Entity.Total);

                _returns.Add((index, new SeedReturn(entity, d, k, source)));
                var totals = _shiftTotals[(d, k)];
                totals.ReturnCount++;
                totals.RefundTotal += entity.RefundTotal;
                totals.OffsetRefund += entity.OffsetAmount;
                if (entity.RefundMethod == RefundMethod.TienMat)
                    totals.CashRefund += entity.PayoutAmount;
                else
                    totals.TransferRefund += entity.PayoutAmount;
                Entities.Add(entity);
            }
        }

        /// <summary>Khoản thu: hóa đơn thường một dòng; hóa đơn đổi hàng bù trừ = min(tiền hoàn, tổng) + phần còn lại.</summary>
        private void AddOrderPayments(JsonElement items)
        {
            var index = -1;
            foreach (var o in items.EnumerateArray())
            {
                index++;
                if (!_orders.TryGetValue(index, out var seed))
                    continue;

                var order = seed.Entity;
                var remaining = order.Total;
                if (o.TryGetProperty("rx", out var rx))
                {
                    var ret = _returns.First(x => x.Index == rx.GetInt32()).Return.Entity;
                    order.SetExchangeFor(ret.Id);
                    var offset = Math.Min(ret.RefundTotal, order.Total);
                    if (offset > 0)
                        Pay(seed, PaymentMethod.BuTruDoiHang, offset, null);
                    remaining -= offset;
                }

                if (remaining > 0 || !o.TryGetProperty("rx", out _))
                {
                    var method = Enum.Parse<PaymentMethod>(NullableString(o, "pm") ?? nameof(PaymentMethod.TienMat));
                    decimal? cash = o.TryGetProperty("cash", out var c) ? c.GetDecimal() : null;
                    Pay(seed, method, remaining, cash);
                }
            }
        }

        private void Pay(SeedOrder seed, PaymentMethod method, decimal amount, decimal? cash)
        {
            seed.Entity.AddPayment(method, amount, cash);
            var totals = _shiftTotals[(seed.D, seed.K)];
            switch (method)
            {
                case PaymentMethod.TienMat: totals.CashSales += amount; break;
                case PaymentMethod.ChuyenKhoan: totals.TransferSales += amount; break;
                case PaymentMethod.The: totals.CardSales += amount; break;
                default: totals.OffsetSales += amount; break;
            }
        }

        // ------------------------------------------------------------------ Nhập hàng, điều chỉnh

        private void BuildReceipts(JsonElement items)
        {
            var sequence = new Dictionary<int, int>();
            var index = -1;
            foreach (var r in items.EnumerateArray())
            {
                index++;
                var d = r.GetProperty("d").GetInt32();
                var t = Time(r.GetProperty("t").GetString()!);
                var at = At(d, t);
                var seq = sequence[d] = sequence.GetValueOrDefault(d) + 1;
                var confirmed = r.GetProperty("st").GetString() == "DaNhapKho";
                var receipt = GoodsReceipt.Create(DocCode("PN", d, seq, 3), _suppliers[r.GetProperty("s").GetString()!].Id, _today.AddDays(d),
                    NullableString(r, "n"), manager.FullName, at, SeedIds.Stable("receipt", index));

                var lineIndex = 0;
                foreach (var line in r.GetProperty("li").EnumerateArray())
                {
                    var values = line.EnumerateArray().ToList();
                    var product = _products[values[0].GetInt32() - 1];
                    var unit = product.Units[values[1].GetInt32()];
                    unit.MarkUsed();
                    var price = values.Count > 3 && values[3].ValueKind == JsonValueKind.Number ? values[3].GetDecimal() : product.Cost * unit.Factor;
                    DateOnly? expiry = values.Count > 4 && values[4].ValueKind == JsonValueKind.Number ? _today.AddDays(values[4].GetInt32()) : null;
                    var receiptLine = receipt.AddLine(product.Entity.Id, unit.Id, unit.Name, unit.Factor, values[2].GetInt32(), price, expiry, SeedIds.Stable("receipt", index, lineIndex));
                    if (confirmed)
                    {
                        receiptLine.SetCosts(product.Cost, product.Cost);
                        _events.Add(new SeedEvent(at, 0, index, receiptLine.LineNo, product.Entity.Id, receiptLine.BaseQty, MovementType.NhapHang, receipt.Id, receipt.Code));
                    }

                    lineIndex++;
                }

                if (confirmed)
                    receipt.Confirm(manager.Id, at);
                Entities.Add(receipt);
                ReceiptCount++;
            }
        }

        private void BuildAdjustments(JsonElement items)
        {
            var sequence = new Dictionary<int, int>();
            var index = -1;
            foreach (var a in items.EnumerateArray())
            {
                index++;
                var d = a.GetProperty("d").GetInt32();
                var at = At(d, Time(a.GetProperty("t").GetString()!));
                var seq = sequence[d] = sequence.GetValueOrDefault(d) + 1;
                var adjustment = StockAdjustment.Create(DocCode("DC", d, seq, 3), Enum.Parse<AdjustmentReason>(a.GetProperty("r").GetString()!),
                    NullableString(a, "n"), null, manager.FullName, at, SeedIds.Stable("adjustment", index));
                var lineNo = 0;
                foreach (var line in a.GetProperty("li").EnumerateArray())
                {
                    var values = line.EnumerateArray().ToList();
                    var product = _products[values[0].GetInt32() - 1];
                    _events.Add(new SeedEvent(at, 3, index, ++lineNo, product.Entity.Id, values[1].GetInt32(), MovementType.DieuChinh, adjustment.Id, adjustment.Code)
                    {
                        Adjustment = adjustment
                    });
                }

                Entities.Add(adjustment);
            }
        }

        // ------------------------------------------------------------------ Khách, ca, tồn

        private void ApplyCustomerStats()
        {
            var events = _orders.Values.Where(o => o.Customer is not null)
                .Select(o => (At: o.Entity.PaidAt, Rank: 0, Action: (Action)(() => o.Customer!.RecordOrder(o.Entity.PointsEarned, o.Entity.Total, o.Entity.PaidAt))))
                .Concat(_returns.Where(r => r.Return.Source.Customer is not null)
                    .Select(r => (At: r.Return.Entity.CreatedAt, Rank: 1, Action: (Action)(() =>
                        r.Return.Entity.SetPointsDeducted(r.Return.Source.Customer!.DeductPoints(PosRules.PointsFor(r.Return.Entity.RefundTotal)))))))
                .OrderBy(e => e.At).ThenBy(e => e.Rank);
            foreach (var e in events)
                e.Action();
        }

        private void CloseShifts(JsonElement items)
        {
            foreach (var s in items.EnumerateArray())
            {
                var d = s.GetProperty("d").GetInt32();
                var k = s.GetProperty("k").GetInt32();
                if (!_shifts.TryGetValue((d, k), out var shift))
                    continue;

                var close = Time(s.GetProperty("x").GetString()!);
                if (d == 0 && Minutes(close) > _nowMinutes)
                    continue;

                var totals = _shiftTotals[(d, k)].Build();
                var counted = totals.ExpectedCash(shift.OpeningCash) + s.GetProperty("df").GetDecimal();
                shift.Close(totals, counted, null, NullableString(s, "n"), At(d, close));
                if (s.TryGetProperty("rv", out var rv))
                {
                    var by = rv.GetProperty("by").GetString()!;
                    shift.Review(rv.GetProperty("n").GetString()!, User(by).Id, by, At(d + 1, MasterDataTime));
                }
            }
        }

        /// <summary>06 §5.4: tồn đầu kỳ lúc 00:00 ngày −89, cộng dồn mọi sự kiện theo thời điểm, loại, chỉ số, thứ tự dòng.</summary>
        private void ReplayStock()
        {
            var stock = _products.ToDictionary(p => p.Entity.Id, p => p.Entity.OpeningStock);
            var cost = _products.ToDictionary(p => p.Entity.Id, p => p.Cost);
            long seq = 0;
            var openingAt = At(-89, TimeOnly.MinValue);
            foreach (var p in _products)
            {
                Entities.Add(StockMovement.Create(p.Entity.Id, openingAt, MovementType.TonDau, null, StockMovement.OpeningDocumentCode,
                    p.Entity.OpeningStock, p.Entity.OpeningStock, p.Cost, ++seq));
            }

            foreach (var e in _events.OrderBy(e => e.At).ThenBy(e => e.Rank).ThenBy(e => e.Index).ThenBy(e => e.LineNo))
            {
                if (e.Adjustment is { } adjustment)
                    adjustment.AddLine(e.ProductId, stock[e.ProductId], stock[e.ProductId] + e.Quantity, cost[e.ProductId]);

                stock[e.ProductId] += e.Quantity;
                Entities.Add(StockMovement.Create(e.ProductId, e.At, e.Type, e.DocumentId, e.DocumentCode, e.Quantity, stock[e.ProductId], cost[e.ProductId], ++seq));
            }

            MovementCount = (int)seq;
            foreach (var p in _products)
                p.Entity.SeedStock(stock[p.Entity.Id]);
        }

        // ------------------------------------------------------------------ Tiện ích

        private void Add(BaseEntity entity, DateTime createdAt)
        {
            Entities.Add(entity);
            CreatedAtOverrides.Add((entity, createdAt));
        }

        private (Guid Id, string FullName) User(string username) =>
            users.TryGetValue(username, out var user) ? user : throw new InvalidOperationException($"Thiếu tài khoản demo '{username}' để nạp dữ liệu mẫu.");

        private DateTime At(int dayOffset, TimeOnly timeOfDay) =>
            TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(_today.AddDays(dayOffset).ToDateTime(timeOfDay), DateTimeKind.Unspecified), VietnamTime.Zone);

        private string DocCode(string prefix, int dayOffset, int sequence, int digits) =>
            prefix + _today.AddDays(dayOffset).ToString("yyMMdd", CultureInfo.InvariantCulture) + sequence.ToString(new string('0', digits), CultureInfo.InvariantCulture);

        private static TimeOnly Time(string value) => TimeOnly.ParseExact(value, "HH:mm", CultureInfo.InvariantCulture);

        private static int Minutes(TimeOnly t) => t.Hour * 60 + t.Minute;

        private static DiscountSpec Discount(JsonElement dc) =>
            new(Enum.Parse<DiscountType>(dc.GetProperty("ty").GetString()!), dc.GetProperty("v").GetDecimal(),
                Enum.Parse<DiscountReason>(dc.GetProperty("r").GetString()!), NullableString(dc, "n"));

        private static string? NullableString(JsonElement element, string name) =>
            element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    }

    private sealed record SeedProduct(Product Entity, List<ProductUnit> Units, decimal Cost, int FileStock);

    private sealed record SeedOrder(Order Entity, int D, int K, Customer? Customer);

    private sealed record SeedReturn(Return Entity, int D, int K, SeedOrder Source);

    private sealed record SeedEvent(DateTime At, int Rank, int Index, int LineNo, Guid ProductId, int Quantity, MovementType Type, Guid DocumentId, string DocumentCode)
    {
        public StockAdjustment? Adjustment { get; init; }
    }

    private sealed class ShiftTotalsBuilder
    {
        public int OrderCount;
        public int ReturnCount;
        public decimal CashSales;
        public decimal TransferSales;
        public decimal CardSales;
        public decimal OffsetSales;
        public decimal SalesTotal;
        public decimal CashRefund;
        public decimal TransferRefund;
        public decimal OffsetRefund;
        public decimal RefundTotal;

        public ShiftTotals Build() => new(OrderCount, ReturnCount, CashSales, TransferSales, CardSales, OffsetSales, SalesTotal, CashRefund, TransferRefund, OffsetRefund, RefundTotal);
    }
}
