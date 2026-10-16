using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Orders;
using Application.DTOs.StoreProfile;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.StoreProfile;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Orders;

/// <summary>Bán hàng, thanh toán, tra cứu hóa đơn (UC-03..UC-06, UC-08, 07 §2.4).</summary>
[Route("api/orders")]
public sealed class OrdersController(IOrderService service) : PosApiController
{
    /// <summary>Tính tiền giỏ, cho biết cần xác nhận không (UC-05 bước 3). Không lưu.</summary>
    [HttpPost("quote")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    public async Task<ActionResult<OrderQuote>> Quote(CartInput request, CancellationToken ct)
    {
        if (await RequireDiscountPermissionAsync(request) is { } forbidden)
            return (ActionResult)forbidden;
        return Ok(await service.QuoteAsync(request, ct));
    }

    /// <summary>Thanh toán (UC-06): 201 hóa đơn mới; cùng <c>clientRequestId</c> gửi lại → 200 hóa đơn cũ (TC-29).</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderDto>> Checkout(CheckoutRequest request, CancellationToken ct)
    {
        if (await RequireDiscountPermissionAsync(request) is { } forbidden)
            return (ActionResult)forbidden;

        var result = await service.CheckoutAsync(request, ct);
        return result.Created
            ? CreatedAtAction(nameof(GetById), new { id = result.Order.Id }, result.Order)
            : Ok(result.Order);
    }

    /// <summary>FR-21. Người không có <c>shifts.view</c> chỉ thấy hóa đơn trong ca của mình.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<PaginatedResult<OrderListItem>>> GetPaged([FromQuery] OrderQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<OrderDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    /// <summary>Quét mã trên bill để mở hóa đơn; không thấy → 404 "Không tìm thấy hóa đơn {mã}".</summary>
    [HttpGet("by-code/{code}")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    public async Task<ActionResult<OrderDto>> GetByCode(string code, CancellationToken ct) => Ok(await service.GetByCodeAsync(code, ct));

    /// <summary>Mã hóa đơn dự kiến cho nội dung QR (UC-06 2a); mã thật gán lúc lưu.</summary>
    [HttpGet("next-code")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    public async Task<ActionResult<NextCodeDto>> GetNextCode(CancellationToken ct) => Ok(await service.GetNextCodeAsync(ct));

    /// <summary>Giỏ có giảm giá dòng hoặc hóa đơn cần <c>orders.discount</c>.</summary>
    private async Task<IActionResult?> RequireDiscountPermissionAsync(CartInput request) =>
        request.OrderDiscount is not null || request.Lines.Any(l => l.Discount is not null)
            ? await PermissionGuard.CheckAsync(HttpContext, [ProjectPermissions.Orders.Discount])
            : null;
}

/// <summary>Chủ cửa hàng xác nhận ngay trên máy bán hàng (FR-16, FR-25, 07 §2.5).</summary>
[Route("api/approvals")]
public sealed class ApprovalsController(IApprovalService service) : PosApiController
{
    /// <summary>Sai tài khoản → 400 SaiTaiKhoanXacNhan; thiếu quyền xác nhận → 403 KhongCoQuyenXacNhan (TC-24).</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Orders.Discount, ProjectPermissions.Returns.Create)]
    public async Task<ActionResult<ApprovalDto>> Approve(ApprovalRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.ApproveAsync(request, ct));
}

/// <summary>Thông tin cửa hàng, cài đặt bán hàng (07 §2.11).</summary>
[Route("api/store-profile")]
public sealed class StoreProfileController(IStoreProfileService service) : PosApiController
{
    [HttpGet]
    public async Task<ActionResult<StoreProfileDto>> Get(CancellationToken ct) => Ok(await service.GetAsync(ct));
}
