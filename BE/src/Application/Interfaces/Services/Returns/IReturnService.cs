using Application.Common.Models;
using Application.DTOs.Returns;

namespace Application.Interfaces.Services.Returns;

/// <summary>Đổi trả (UC-07, BR-17..BR-20, 07 §2.6).</summary>
public interface IReturnService
{
    /// <summary>Mở hóa đơn gốc theo mã (không giới hạn phạm vi ca, chỉ giới hạn 30 ngày).</summary>
    Task<ReturnSourceOrder> GetSourceAsync(string code, CancellationToken ct = default);

    /// <summary>"Tìm hóa đơn" khi khách mất bill: 30 ngày, chưa trả hết.</summary>
    Task<PaginatedResult<ReturnSourceListItem>> GetSourceOrdersAsync(ReturnSourceQuery query, CancellationToken ct = default);

    Task<CreateReturnResult> CreateAsync(CreateReturnRequest request, CancellationToken ct = default);

    Task<PaginatedResult<ReturnListItem>> GetPagedAsync(ReturnQuery query, CancellationToken ct = default);

    Task<ReturnDto> GetByIdAsync(Guid id, CancellationToken ct = default);
}
