using Application.Common.Models;
using Application.DTOs.Products;

namespace Application.Interfaces.Services.Products;

/// <summary>Nhóm hàng (FR-03, 07 §2.1). Không có xóa, chỉ ẩn.</summary>
public interface IProductGroupService
{
    Task<IReadOnlyList<ProductGroupDto>> GetAllAsync(CancellationToken ct = default);

    Task<ProductGroupDto> CreateAsync(SaveProductGroupRequest request, CancellationToken ct = default);

    Task<ProductGroupDto> UpdateAsync(Guid id, SaveProductGroupRequest request, CancellationToken ct = default);

    Task SetVisibilityAsync(Guid id, bool isHidden, CancellationToken ct = default);

    /// <summary>Đánh lại thứ tự 10, 20, 30… theo danh sách đủ mọi nhóm.</summary>
    Task ReorderAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default);
}

/// <summary>Mặt hàng, đơn vị quy đổi, mã vạch (UC-01, FR-04..FR-07, 07 §2.2).</summary>
public interface IProductService
{
    Task<PaginatedResult<ProductDto>> GetPagedAsync(ProductQuery query, CancellationToken ct = default);

    Task<ProductDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Quét mã ở phiếu nhập, điều chỉnh; không thấy → 404 "Không tìm thấy mã vạch {mã}".</summary>
    Task<ProductLookupDto> LookupAsync(string barcode, CancellationToken ct = default);

    Task<ProductDto> CreateAsync(SaveProductRequest request, CancellationToken ct = default);

    Task<ProductDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken ct = default);

    Task SetStatusAsync(Guid id, ProductStatusRequest request, CancellationToken ct = default);

    Task<ProductDto> UpdatePricesAsync(Guid id, UpdateProductPricesRequest request, CancellationToken ct = default);

    /// <summary>Xóa mềm khi chưa có chứng từ (BR-29, TC-04).</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>Mã nội bộ kế tiếp (BR-03), không giữ chỗ.</summary>
    Task<InternalBarcodeDto> NextInternalBarcodeAsync(CancellationToken ct = default);
}

/// <summary>Danh mục cho máy bán hàng, không có giá vốn, có ETag (07 §2.3, NFR-02).</summary>
public interface IPosCatalogService
{
    /// <summary>Dấu phiên bản (ETag), không cần dựng cả danh mục.</summary>
    Task<string> GetVersionAsync(CancellationToken ct = default);

    Task<PosCatalog> GetAsync(CancellationToken ct = default);
}
