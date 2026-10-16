using Application.Common.Exceptions;
using Application.DTOs.Products;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Products;
using Application.Mappings.Products;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Infrastructure.Implementations.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Products;

/// <summary>Nhóm hàng (FR-03, 07 §2.1): không xóa, chỉ ẩn; mã NH + 2 số; thứ tự 10, 20, 30…</summary>
public sealed class ProductGroupService(
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<Product> products,
    IUnitOfWork unitOfWork) : IProductGroupService
{
    public const string DuplicateNameMessage = "Tên nhóm hàng đã tồn tại";
    public const string IncompleteListMessage = "Danh sách nhóm không đầy đủ";

    public async Task<IReadOnlyList<ProductGroupDto>> GetAllAsync(CancellationToken ct = default)
    {
        var counts = await products.QueryNoTracking().IgnoreQueryFilters().Where(p => !p.IsDeleted)
            .GroupBy(p => p.GroupId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var list = await groups.QueryNoTracking().OrderBy(g => g.SortOrder).ThenBy(g => g.Code).ToListAsync(ct);
        return list.Select(g => g.ToDto(counts.GetValueOrDefault(g.Id))).ToList();
    }

    public async Task<ProductGroupDto> CreateAsync(SaveProductGroupRequest request, CancellationToken ct = default)
    {
        await EnsureUniqueNameAsync(request.Name, null, ct);
        var all = await groups.QueryNoTracking().Select(g => new { g.Code, g.SortOrder }).ToListAsync(ct);
        var group = ProductGroup.Create(
            DocCodes.NextSequential(all.Select(g => g.Code), "NH", 2),
            request.Name,
            request.Color,
            all.Count == 0 ? 10 : all.Max(g => g.SortOrder) + 10);
        await groups.AddAsync(group, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return group.ToDto(0);
    }

    public async Task<ProductGroupDto> UpdateAsync(Guid id, SaveProductGroupRequest request, CancellationToken ct = default)
    {
        var group = await groups.Query().FirstOrDefaultAsync(g => g.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm hàng");
        await EnsureUniqueNameAsync(request.Name, id, ct);
        group.Update(request.Name, request.Color);
        await unitOfWork.SaveChangesAsync(ct);
        var count = await products.QueryNoTracking().CountAsync(p => p.GroupId == id, ct);
        return group.ToDto(count);
    }

    public async Task SetVisibilityAsync(Guid id, bool isHidden, CancellationToken ct = default)
    {
        var group = await groups.Query().FirstOrDefaultAsync(g => g.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm hàng");
        group.SetHidden(isHidden);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task ReorderAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        var all = await groups.Query().ToListAsync(ct);
        if (ids.Count != all.Count || ids.Distinct().Count() != ids.Count || all.Any(g => !ids.Contains(g.Id)))
            throw Infrastructure.Extensions.FieldErrors.Single("ids", IncompleteListMessage);

        for (var i = 0; i < ids.Count; i++)
            all.First(g => g.Id == ids[i]).SetSortOrder((i + 1) * 10);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task EnsureUniqueNameAsync(string name, Guid? exceptId, CancellationToken ct)
    {
        // So theo normalizeVi: bỏ dấu, không phân biệt hoa thường ("Bánh kẹo" trùng "banh keo").
        var normalized = Domain.Common.VietnameseText.Normalize(name);
        var names = await groups.QueryNoTracking().Where(g => exceptId == null || g.Id != exceptId).Select(g => g.Name).ToListAsync(ct);
        if (names.Any(n => Domain.Common.VietnameseText.Normalize(n) == normalized))
            throw new ConflictException(DuplicateNameMessage, "name");
    }
}
