using Application.Common.Time;
using Application.DTOs.Stock;
using Application.Interfaces.Repositories;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Pos;
using Domain.Enums.Inventory.GoodsReceipts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Stock;

/// <summary>
/// Lô theo hạn sử dụng (BR-27, 07 §3.8): lô là dòng phiếu đã nhập kho của hàng có HSD; số còn lại ước tính từ tồn hiện tại,
/// chia cho lô mới nhất trước.
/// </summary>
internal static class LotCalculator
{
    public static async Task<List<StockLotDto>> AllLotsAsync(
        IGenericRepository<Product> products,
        IGenericRepository<GoodsReceiptLine> receiptLines,
        DateOnly today,
        Guid? productId,
        CancellationToken ct)
    {
        var tracked = await products.QueryNoTracking().Include(p => p.Units)
            .Where(p => p.TrackExpiry && (productId == null || p.Id == productId))
            .ToListAsync(ct);
        var ids = tracked.Select(p => p.Id).ToList();
        var lines = await receiptLines.QueryNoTracking()
            .Where(l => ids.Contains(l.ProductId) && l.ExpiryDate != null && l.GoodsReceipt!.Status == GoodsReceiptStatus.DaNhapKho)
            .Select(l => new
            {
                l.Id,
                l.GoodsReceiptId,
                ReceiptCode = l.GoodsReceipt!.Code,
                l.GoodsReceipt.ReceivedDate,
                l.GoodsReceipt.ConfirmedAt,
                l.LineNo,
                l.ProductId,
                l.Quantity,
                l.Factor,
                l.ExpiryDate
            })
            .ToListAsync(ct);

        var result = new List<StockLotDto>();
        foreach (var product in tracked)
        {
            var own = lines.Where(l => l.ProductId == product.Id).ToList();
            if (own.Count == 0)
                continue;

            var estimates = StockMath.EstimateLots(
                product.Stock,
                own.Select(l => new LotInput(l.Id, l.ReceivedDate, l.ConfirmedAt, l.LineNo, l.Quantity * l.Factor, l.ExpiryDate!.Value)),
                today);
            foreach (var estimate in estimates)
            {
                var line = own.First(l => l.Id == estimate.Lot.Id);
                result.Add(new StockLotDto
                {
                    GoodsReceiptLineId = line.Id,
                    GoodsReceiptId = line.GoodsReceiptId,
                    GoodsReceiptCode = line.ReceiptCode,
                    ProductId = product.Id,
                    ProductCode = product.Code,
                    ProductName = product.Name,
                    BaseUnit = product.BaseUnit.Name,
                    ReceivedAt = line.ConfirmedAt ?? VietnamDates.StartOfDayUtc(line.ReceivedDate),
                    ExpiryDate = estimate.Lot.ExpiryDate,
                    DaysLeft = estimate.DaysLeft,
                    ReceivedQty = estimate.Lot.ReceivedQty,
                    RemainingQty = estimate.RemainingQty,
                    Status = estimate.Status
                });
            }
        }

        return result;
    }
}
