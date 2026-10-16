using Application.Common.Models;
using Application.DTOs.Shifts;

namespace Application.Interfaces.Services.Shifts;

/// <summary>Ca thu ngân (UC-02, UC-09, UC-10, 07 §2.7).</summary>
public interface IShiftService
{
    /// <summary>Ca đang mở của người gọi, số tổng hợp tới lúc gọi; chưa có → null (API trả 204).</summary>
    Task<ShiftDto?> GetCurrentAsync(CancellationToken ct = default);

    Task<OpenShiftResult> OpenAsync(OpenShiftRequest request, CancellationToken ct = default);

    Task<ShiftDto> CloseCurrentAsync(CloseShiftRequest request, CancellationToken ct = default);

    Task<PaginatedResult<ShiftDto>> GetPagedAsync(ShiftQuery query, CancellationToken ct = default);

    /// <summary>Chi tiết: người có shifts.view hoặc chính thu ngân của ca.</summary>
    Task<ShiftDetail> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<ShiftDto> ReviewAsync(Guid id, ReviewShiftRequest request, CancellationToken ct = default);
}
