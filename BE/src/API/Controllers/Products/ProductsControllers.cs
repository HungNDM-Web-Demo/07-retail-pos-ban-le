using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Products;
using Application.Interfaces.Services.Products;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Products;

/// <summary>Nhóm hàng (FR-03, 07 §2.1). Không có API xóa, chỉ ẩn.</summary>
[Route("api/product-groups")]
public sealed class ProductGroupsController(IProductGroupService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<IReadOnlyList<ProductGroupDto>>> GetAll(CancellationToken ct) => Ok(await service.GetAllAsync(ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Products.Create)]
    public async Task<ActionResult<ProductGroupDto>> Create(SaveProductGroupRequest request, CancellationToken ct)
    {
        var group = await service.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, group);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<ActionResult<ProductGroupDto>> Update(Guid id, SaveProductGroupRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/visibility")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<IActionResult> SetVisibility(Guid id, ProductGroupVisibilityRequest request, CancellationToken ct)
    {
        await service.SetVisibilityAsync(id, request.IsHidden, ct);
        return NoContent();
    }

    /// <summary>Kéo thả thứ tự (UC-01 1a): <c>ids</c> đủ mọi nhóm theo thứ tự mới.</summary>
    [HttpPut("order")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<IActionResult> Reorder(ReorderProductGroupsRequest request, CancellationToken ct)
    {
        await service.ReorderAsync(request.Ids, ct);
        return NoContent();
    }
}

/// <summary>Mặt hàng, đơn vị quy đổi, mã vạch (UC-01, 07 §2.2).</summary>
[Route("api/products")]
public sealed class ProductsController(IProductService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<PaginatedResult<ProductDto>>> GetPaged([FromQuery] ProductQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<ProductDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    /// <summary>Quét mã ở phiếu nhập, điều chỉnh; không thấy → 404 "Không tìm thấy mã vạch {mã}".</summary>
    [HttpGet("lookup")]
    [AuthorizePermission(ProjectPermissions.Products.View)]
    public async Task<ActionResult<ProductLookupDto>> Lookup([FromQuery] string barcode, CancellationToken ct) =>
        Ok(await service.LookupAsync(barcode ?? string.Empty, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Products.Create)]
    public async Task<ActionResult<ProductDto>> Create(SaveProductRequest request, CancellationToken ct)
    {
        var product = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<ActionResult<ProductDto>> Update(Guid id, SaveProductRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<IActionResult> SetStatus(Guid id, ProductStatusRequest request, CancellationToken ct)
    {
        await service.SetStatusAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Sửa nhanh giá sau nhập kho (UC-14 bước 6).</summary>
    [HttpPatch("{id:guid}/prices")]
    [AuthorizePermission(ProjectPermissions.Products.Update)]
    public async Task<ActionResult<ProductDto>> UpdatePrices(Guid id, UpdateProductPricesRequest request, CancellationToken ct) =>
        Ok(await service.UpdatePricesAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Products.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Cấp mã nội bộ kế tiếp (BR-03, FR-07); không giữ chỗ.</summary>
    [HttpPost("internal-barcode")]
    [AuthorizePermission(ProjectPermissions.Products.Create, ProjectPermissions.Products.Update)]
    public async Task<ActionResult<InternalBarcodeDto>> NextInternalBarcode(CancellationToken ct) => Ok(await service.NextInternalBarcodeAsync(ct));
}

/// <summary>Danh mục cho máy bán hàng (07 §2.3): ETag = version, <c>If-None-Match</c> trùng → 304.</summary>
[Route("api/pos/catalog")]
public sealed class PosCatalogController(IPosCatalogService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<PosCatalog>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    public async Task<ActionResult<PosCatalog>> Get(CancellationToken ct)
    {
        var version = await service.GetVersionAsync(ct);
        Response.Headers.ETag = $"\"{version}\"";
        var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
        if (ifNoneMatch.Length > 0 && ifNoneMatch.Split(',').Select(v => v.Trim().Replace("W/", string.Empty).Trim('"')).Contains(version))
            return StatusCode(StatusCodes.Status304NotModified);

        return Ok(await service.GetAsync(ct));
    }
}
