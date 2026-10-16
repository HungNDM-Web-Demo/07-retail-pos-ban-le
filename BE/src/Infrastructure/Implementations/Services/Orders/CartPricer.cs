using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Pos;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>Giỏ đã kiểm và tính tiền, kèm mặt hàng đã đọc (để kiểm tồn) và dòng vượt tồn.</summary>
internal sealed record PricedCartResult(PricedCart Cart, IReadOnlyDictionary<Guid, Product> Products, IReadOnlyList<OverStockLine> OverStock);

/// <summary>
/// Bước 3–5 của thanh toán (07 §2.4), dùng chung cho báo giá, thanh toán và hàng đổi: hàng tồn tại, đang bán, đơn vị thuộc
/// hàng, số lượng 1–9.999; tính tiền §3.1–3.3 theo giá, giá vốn hiện tại; dòng vượt tồn BR-10.
/// </summary>
internal sealed class CartPricer(IGenericRepository<Product> products)
{
    public async Task<PricedCartResult> PriceAsync(
        IReadOnlyList<CartLineInput> lines,
        DiscountInput? orderDiscount,
        CancellationToken ct,
        string fieldPrefix = "")
    {
        if (lines.Count == 0)
            throw PosErrors.Create(PosErrors.GioTrong, PosErrors.EmptyCartMessage, fieldPrefix + "lines");

        var ids = lines.Select(l => l.ProductId).Distinct().ToList();
        var map = await products.QueryNoTracking()
            .Include(p => p.Units)
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var inputs = new List<PricingLineInput>(lines.Count);
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!map.TryGetValue(line.ProductId, out var product))
                throw PosErrors.Create(PosErrors.DonViKhongHopLe, PosErrors.InvalidUnitMessage, $"{fieldPrefix}lines[{i}].productId");
            if (!product.IsActive)
                throw PosErrors.Create(PosErrors.HangNgungBan, PosErrors.ProductInactiveMessage(product.Name), $"{fieldPrefix}lines[{i}].productId");

            var unit = product.Units.FirstOrDefault(u => u.Id == line.UnitId)
                ?? throw PosErrors.Create(PosErrors.DonViKhongHopLe, PosErrors.InvalidUnitMessage, $"{fieldPrefix}lines[{i}].unitId");
            if (line.Quantity is < 1 or > PosRules.MaxLineQuantity)
                throw PosErrors.Create(PosErrors.SoLuongKhongHopLe, PosErrors.InvalidQuantityMessage, $"{fieldPrefix}lines[{i}].quantity");

            inputs.Add(new PricingLineInput(
                product.Id, product.Code, product.Name, product.GroupId, unit.Id, unit.Name, unit.Factor, unit.Price,
                product.AvgCost, product.Returnable, line.Quantity, ToSpec(line.Discount)));
        }

        var cart = OrderPricing.Price(inputs, ToSpec(orderDiscount));

        var overStock = cart.Lines
            .GroupBy(l => l.Input.ProductId)
            .Select(g =>
            {
                var product = map[g.Key];
                var shortage = g.Sum(l => l.BaseQty) - Math.Max(product.Stock, 0);
                return new OverStockLine { ProductId = product.Id, ProductName = product.Name, Shortage = shortage, BaseUnit = product.BaseUnit.Name };
            })
            .Where(o => o.Shortage > 0)
            .ToList();

        return new PricedCartResult(cart, map, overStock);
    }

    /// <summary>Bước 5: tắt bán âm kho mà có dòng vượt tồn → VuotTon.</summary>
    public static void EnsureStock(PricedCartResult priced, bool allowNegativeStock)
    {
        if (allowNegativeStock || priced.OverStock.Count == 0)
            return;

        var first = priced.OverStock[0];
        throw PosErrors.Create(
            PosErrors.VuotTon,
            PosErrors.OverStockMessage(first.Shortage, first.BaseUnit, first.ProductName),
            extra: new Dictionary<string, object?> { ["overStock"] = priced.OverStock });
    }

    private static DiscountSpec? ToSpec(DiscountInput? discount) =>
        discount is null ? null : new DiscountSpec(discount.Type, discount.Value, discount.Reason, discount.Note);
}
