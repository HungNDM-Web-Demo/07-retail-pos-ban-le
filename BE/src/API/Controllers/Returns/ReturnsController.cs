using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Returns;
using Application.Interfaces.Services.Returns;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Returns;

/// <summary>Đổi trả (UC-07, 07 §2.6).</summary>
[Route("api/returns")]
public sealed class ReturnsController(IReturnService service) : PosApiController
{
    /// <summary>Mở hóa đơn gốc bằng mã (FR-22); không giới hạn ca, chỉ 30 ngày.</summary>
    [HttpGet("source")]
    [AuthorizePermission(ProjectPermissions.Returns.Create)]
    public async Task<ActionResult<ReturnSourceOrder>> GetSource([FromQuery] string code, CancellationToken ct) =>
        Ok(await service.GetSourceAsync(code ?? string.Empty, ct));

    /// <summary>"Tìm hóa đơn" khi khách mất bill (UC-07 2a).</summary>
    [HttpGet("source-orders")]
    [AuthorizePermission(ProjectPermissions.Returns.Create)]
    public async Task<ActionResult<PaginatedResult<ReturnSourceListItem>>> GetSourceOrders([FromQuery] ReturnSourceQuery query, CancellationToken ct) =>
        Ok(await service.GetSourceOrdersAsync(query, ct));

    /// <summary>Lập phiếu (kèm hóa đơn đổi hàng nếu có): 201; cùng <c>clientRequestId</c> → 200 phiếu cũ.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Returns.Create)]
    [ProducesResponseType<ReturnDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ReturnDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ReturnDto>> Create(CreateReturnRequest request, CancellationToken ct)
    {
        var result = await service.CreateAsync(request, ct);
        return result.Created
            ? CreatedAtAction(nameof(GetById), new { id = result.Return.Id }, result.Return)
            : Ok(result.Return);
    }

    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Returns.View)]
    public async Task<ActionResult<PaginatedResult<ReturnListItem>>> GetPaged([FromQuery] ReturnQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Returns.View)]
    public async Task<ActionResult<ReturnDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));
}
