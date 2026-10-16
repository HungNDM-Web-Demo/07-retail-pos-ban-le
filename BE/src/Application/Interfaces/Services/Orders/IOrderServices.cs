using Application.Common.Models;
using Application.DTOs.Orders;
using Domain.Enums.Pos.Approvals;

namespace Application.Interfaces.Services.Orders;

/// <summary>Bán hàng, thanh toán, tra cứu hóa đơn (UC-03..UC-06, UC-08, 07 §2.4).</summary>
public interface IOrderService
{
    /// <summary>Tính tiền giỏ theo giá, giá vốn hiện tại; cho biết cần xác nhận không. Không lưu.</summary>
    Task<OrderQuote> QuoteAsync(CartInput request, CancellationToken ct = default);

    /// <summary>Thanh toán theo 9 bước 07 §2.4; trùng clientRequestId → hóa đơn cũ.</summary>
    Task<CheckoutResult> CheckoutAsync(CheckoutRequest request, CancellationToken ct = default);

    Task<PaginatedResult<OrderListItem>> GetPagedAsync(OrderQuery query, CancellationToken ct = default);

    Task<OrderDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<OrderDto> GetByCodeAsync(string code, CancellationToken ct = default);

    Task<NextCodeDto> GetNextCodeAsync(CancellationToken ct = default);
}

/// <summary>Chủ cửa hàng xác nhận ngay trên máy bán hàng (FR-16, FR-25, 07 §2.5).</summary>
public interface IApprovalService
{
    /// <summary>Sai tài khoản → 400 SaiTaiKhoanXacNhan; thiếu quyền xác nhận → 403 KhongCoQuyenXacNhan; đúng → token 15 phút.</summary>
    Task<ApprovalDto> ApproveAsync(ApprovalRequest request, CancellationToken ct = default);

    /// <summary>Xem token còn hợp lệ cho <paramref name="action"/> không, chưa tiêu (kiểm ở bước 6 trước khi ghi).</summary>
    (Guid Id, string Username)? Peek(string? token, ApprovalAction action);

    /// <summary>Dùng token một lần cho đúng <paramref name="action"/>; sai, hết hạn, đã dùng → null.</summary>
    (Guid Id, string Username)? Consume(string? token, ApprovalAction action);
}
