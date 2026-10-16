using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.GoodsReceipts;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.GoodsReceipts;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Suppliers;
using Domain.Enums.Inventory.GoodsReceipts;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.GoodsReceipts;

/// <summary>Nhà cung cấp (UC-14, 07 §2.9): mã NCC + 3 số, không xóa; số liệu nhập tính từ phiếu đã nhập kho.</summary>
public sealed class SupplierService(
    IGenericRepository<Supplier> suppliers,
    IGenericRepository<GoodsReceipt> receipts,
    IUnitOfWork unitOfWork) : ISupplierService
{
    public async Task<PaginatedResult<SupplierDto>> GetPagedAsync(PaginationQuery query, CancellationToken ct = default)
    {
        var source = suppliers.QueryNoTracking();
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(s => AppDbFunctions.Matches(s.Code, pattern) || AppDbFunctions.Matches(s.Name, pattern) || AppDbFunctions.Matches(s.Phone, pattern));
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
        {
            query.SortBy = nameof(Supplier.Code);
            query.SortDir ??= "asc";
        }

        // Cột số liệu nhập (số phiếu, tổng tiền, lần nhập cuối) không phải cột bảng: sắp trong bộ nhớ (ít NCC)
        var statSort = query.GetSortBy().ToLowerInvariant() switch
        {
            "receiptcount" => (Func<SupplierDto, object?>)(d => d.ReceiptCount),
            "totalpurchased" => d => d.TotalPurchased,
            "lastreceiptat" => d => d.LastReceiptAt,
            _ => null
        };
        if (statSort is not null)
        {
            var all = await source.ToListAsync(ct);
            var allStats = await StatsAsync(all.Select(s => s.Id).ToList(), ct);
            var dtos = all.Select(s => ToDto(s, allStats));
            var sorted = (query.IsDescending() ? dtos.OrderByDescending(statSort) : dtos.OrderBy(statSort)).ThenBy(d => d.Code).ToList();
            var (pageNo, size) = (query.GetPage(), query.GetPageSize());
            return new PaginatedResult<SupplierDto>
            {
                Items = sorted.Skip((pageNo - 1) * size).Take(size).ToList(),
                Page = pageNo,
                PageSize = size,
                TotalCount = sorted.Count
            };
        }

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var stats = await StatsAsync(page.Items.Select(s => s.Id).ToList(), ct);
        return page.Map(items => items.Select(s => ToDto(s, stats)).ToList());
    }

    public async Task<SupplierDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await suppliers.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhà cung cấp");
        return ToDto(supplier, await StatsAsync([id], ct));
    }

    public async Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct = default)
    {
        var codes = await suppliers.QueryNoTracking().Select(s => s.Code).ToListAsync(ct);
        var supplier = Supplier.Create(DocCodes.NextSequential(codes, "NCC", 3), request.Name, request.Phone, request.Address, request.Note);
        await suppliers.AddAsync(supplier, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(supplier, []);
    }

    public async Task<SupplierDto> UpdateAsync(Guid id, SaveSupplierRequest request, CancellationToken ct = default)
    {
        var supplier = await suppliers.Query().FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhà cung cấp");
        supplier.Update(request.Name, request.Phone, request.Address, request.Note);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(supplier, await StatsAsync([id], ct));
    }

    private async Task<Dictionary<Guid, (int Count, decimal Total, DateTime? Last)>> StatsAsync(List<Guid> ids, CancellationToken ct)
    {
        var rows = await receipts.QueryNoTracking()
            .Where(r => ids.Contains(r.SupplierId) && r.Status == GoodsReceiptStatus.DaNhapKho)
            .Select(r => new { r.SupplierId, r.TotalAmount, r.ConfirmedAt })
            .ToListAsync(ct);
        return rows.GroupBy(r => r.SupplierId)
            .ToDictionary(g => g.Key, g => (g.Count(), g.Sum(r => r.TotalAmount), g.Max(r => r.ConfirmedAt)));
    }

    private static SupplierDto ToDto(Supplier s, Dictionary<Guid, (int Count, decimal Total, DateTime? Last)> stats)
    {
        var stat = stats.GetValueOrDefault(s.Id);
        return new SupplierDto
        {
            Id = s.Id,
            Code = s.Code,
            Name = s.Name,
            Phone = s.Phone,
            Address = s.Address,
            Note = s.Note,
            ReceiptCount = stat.Count,
            TotalPurchased = stat.Total,
            LastReceiptAt = stat.Last,
            CreatedAt = s.CreatedAt
        };
    }
}
