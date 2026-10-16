using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Stock;
using Application.Interfaces.Services.Stock;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Stock;

/// <summary>Tồn kho, lô, sổ biến động (FR-30..FR-32, 07 §2.8).</summary>
[Route("api/stock")]
public sealed class StockController(IStockService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.StockLevels.View)]
    public async Task<ActionResult<PaginatedResult<StockItem>>> GetPaged([FromQuery] StockQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("summary")]
    [AuthorizePermission(ProjectPermissions.StockLevels.View)]
    public async Task<ActionResult<StockSummary>> GetSummary([FromQuery] StockSummaryQuery query, CancellationToken ct) =>
        Ok(await service.GetSummaryAsync(query, ct));

    /// <summary>Tab Sắp hết hạn: mặc định lô SapHetHan và DaHetHan, hạn gần nhất trước.</summary>
    [HttpGet("lots")]
    [AuthorizePermission(ProjectPermissions.StockLevels.View)]
    public async Task<ActionResult<IReadOnlyList<StockLotDto>>> GetLots([FromQuery] StockLotQuery query, CancellationToken ct) =>
        Ok(await service.GetLotsAsync(query, ct));

    [HttpGet("{productId:guid}/movements")]
    [AuthorizePermission(ProjectPermissions.StockLevels.View)]
    public async Task<ActionResult<PaginatedResult<StockMovementDto>>> GetMovements(Guid productId, [FromQuery] PaginationQuery query, CancellationToken ct) =>
        Ok(await service.GetMovementsAsync(productId, query, ct));
}

/// <summary>Phiếu điều chỉnh tồn (UC-13, BR-28).</summary>
[Route("api/stock-adjustments")]
public sealed class StockAdjustmentsController(IStockAdjustmentService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.StockLevels.View)]
    public async Task<ActionResult<PaginatedResult<StockAdjustmentListItem>>> GetPaged([FromQuery] StockAdjustmentQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.StockLevels.View)]
    public async Task<ActionResult<StockAdjustmentDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.StockAdjustments.Create)]
    public async Task<ActionResult<StockAdjustmentDto>> Create(CreateStockAdjustmentRequest request, CancellationToken ct)
    {
        var adjustment = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = adjustment.Id }, adjustment);
    }
}
