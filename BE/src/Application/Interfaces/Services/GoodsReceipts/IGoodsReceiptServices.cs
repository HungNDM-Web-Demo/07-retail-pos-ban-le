using Application.Common.Models;
using Application.DTOs.GoodsReceipts;

namespace Application.Interfaces.Services.GoodsReceipts;

/// <summary>Nhà cung cấp (UC-14, 07 §2.9). Không xóa.</summary>
public interface ISupplierService
{
    Task<PaginatedResult<SupplierDto>> GetPagedAsync(PaginationQuery query, CancellationToken ct = default);

    Task<SupplierDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct = default);

    Task<SupplierDto> UpdateAsync(Guid id, SaveSupplierRequest request, CancellationToken ct = default);
}

/// <summary>Phiếu nhập, xác nhận nhập kho, giá vốn bình quân (UC-14, BR-23, BR-24, 07 §2.9).</summary>
public interface IGoodsReceiptService
{
    Task<PaginatedResult<GoodsReceiptListItem>> GetPagedAsync(GoodsReceiptQuery query, CancellationToken ct = default);

    Task<GoodsReceiptDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<GoodsReceiptDto> CreateAsync(SaveGoodsReceiptRequest request, CancellationToken ct = default);

    Task<GoodsReceiptDto> UpdateAsync(Guid id, SaveGoodsReceiptRequest request, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<ConfirmGoodsReceiptResult> ConfirmAsync(Guid id, CancellationToken ct = default);
}
