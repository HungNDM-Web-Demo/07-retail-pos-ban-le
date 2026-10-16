using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.GoodsReceipts;
using Application.Interfaces.Services.GoodsReceipts;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.GoodsReceipts;

/// <summary>Nhà cung cấp (07 §2.9). Không xóa.</summary>
[Route("api/suppliers")]
public sealed class SuppliersController(ISupplierService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Suppliers.View)]
    public async Task<ActionResult<PaginatedResult<SupplierDto>>> GetPaged([FromQuery] PaginationQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Suppliers.View)]
    public async Task<ActionResult<SupplierDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Suppliers.Create)]
    public async Task<ActionResult<SupplierDto>> Create(SaveSupplierRequest request, CancellationToken ct)
    {
        var supplier = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Suppliers.Update)]
    public async Task<ActionResult<SupplierDto>> Update(Guid id, SaveSupplierRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));
}

/// <summary>Phiếu nhập, xác nhận nhập kho (UC-14, BR-23, BR-24, 07 §2.9).</summary>
[Route("api/goods-receipts")]
public sealed class GoodsReceiptsController(IGoodsReceiptService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.GoodsReceipts.View)]
    public async Task<ActionResult<PaginatedResult<GoodsReceiptListItem>>> GetPaged([FromQuery] GoodsReceiptQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.GoodsReceipts.View)]
    public async Task<ActionResult<GoodsReceiptDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.GoodsReceipts.Create)]
    public async Task<ActionResult<GoodsReceiptDto>> Create(SaveGoodsReceiptRequest request, CancellationToken ct)
    {
        var receipt = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = receipt.Id }, receipt);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.GoodsReceipts.Update)]
    public async Task<ActionResult<GoodsReceiptDto>> Update(Guid id, SaveGoodsReceiptRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.GoodsReceipts.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Xác nhận nhập kho (FR-35): giá vốn BR-23, tồn, sổ biến động; trả hàng có biên lãi dưới 5% sau nhập.</summary>
    [HttpPost("{id:guid}/confirm")]
    [AuthorizePermission(ProjectPermissions.GoodsReceipts.Confirm)]
    public async Task<ActionResult<ConfirmGoodsReceiptResult>> Confirm(Guid id, CancellationToken ct) => Ok(await service.ConfirmAsync(id, ct));
}
