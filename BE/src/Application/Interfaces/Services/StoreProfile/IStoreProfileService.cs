using Application.DTOs.StoreProfile;

namespace Application.Interfaces.Services.StoreProfile;

/// <summary>Thông tin cửa hàng, cài đặt bán hàng đọc gộp từ <c>System_Settings</c> (06 §3).</summary>
public interface IStoreProfileService
{
    Task<StoreProfileDto> GetAsync(CancellationToken ct = default);
}
