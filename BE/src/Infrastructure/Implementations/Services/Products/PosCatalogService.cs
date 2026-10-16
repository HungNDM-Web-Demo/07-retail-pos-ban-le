using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Application.DTOs.Products;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Products;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Products;

/// <summary>
/// Danh mục cho máy bán hàng (07 §2.3): mọi mặt hàng chưa xóa, kể cả ngừng bán (để báo "Hàng ngừng bán"), không có giá vốn.
/// <c>version</c> = băm của (lần sửa hàng hóa, đơn vị, nhóm mới nhất; Σ Version; số mặt hàng), đổi khi giá, tồn, hàng hóa đổi.
/// </summary>
public sealed class PosCatalogService(
    IGenericRepository<Product> products,
    IGenericRepository<ProductUnit> units,
    IGenericRepository<ProductGroup> groups,
    TimeProvider timeProvider) : IPosCatalogService
{
    public async Task<string> GetVersionAsync(CancellationToken ct = default)
    {
        var productStamps = await products.QueryNoTracking().IgnoreQueryFilters()
            .Select(p => new { p.Version, p.CreatedAt, p.UpdatedAt, p.IsDeleted })
            .ToListAsync(ct);
        var unitStamps = await units.QueryNoTracking().Select(u => new { u.CreatedAt, u.UpdatedAt, u.EverUsed }).ToListAsync(ct);
        var groupStamps = await groups.QueryNoTracking().Select(g => new { g.CreatedAt, g.UpdatedAt }).ToListAsync(ct);

        var latest = productStamps.Select(p => p.UpdatedAt ?? p.CreatedAt)
            .Concat(unitStamps.Select(u => u.UpdatedAt ?? u.CreatedAt))
            .Concat(groupStamps.Select(g => g.UpdatedAt ?? g.CreatedAt))
            .DefaultIfEmpty()
            .Max();
        var raw = string.Join('|',
            latest.Ticks.ToString(CultureInfo.InvariantCulture),
            productStamps.Sum(p => (long)p.Version).ToString(CultureInfo.InvariantCulture),
            productStamps.Count(p => !p.IsDeleted).ToString(CultureInfo.InvariantCulture),
            unitStamps.Count.ToString(CultureInfo.InvariantCulture),
            groupStamps.Count.ToString(CultureInfo.InvariantCulture));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16].ToLowerInvariant();
    }

    public async Task<PosCatalog> GetAsync(CancellationToken ct = default)
    {
        var groupList = await groups.QueryNoTracking().OrderBy(g => g.SortOrder).ToListAsync(ct);
        var items = await products.QueryNoTracking().Include(p => p.Units).OrderBy(p => p.Code).ToListAsync(ct);
        return new PosCatalog
        {
            Version = await GetVersionAsync(ct),
            GeneratedAt = timeProvider.GetUtcNow().UtcDateTime,
            Groups = groupList.Select(g => new PosCatalogGroup { Id = g.Id, Name = g.Name, Color = g.Color, SortOrder = g.SortOrder, IsHidden = g.IsHidden }).ToList(),
            Items = items.Select(p => new PosCatalogItem
            {
                ProductId = p.Id,
                Code = p.Code,
                Name = p.Name,
                SearchText = p.NameSearch,
                GroupId = p.GroupId,
                BaseUnit = p.BaseUnit.Name,
                Units = p.Units.OrderBy(u => u.SortOrder).Select(u => new PosCatalogUnit
                {
                    UnitId = u.Id,
                    Name = u.Name,
                    Factor = u.Factor,
                    Barcode = u.Barcode,
                    Price = u.Price
                }).ToList(),
                Stock = p.Stock,
                MinStock = p.MinStock,
                Status = p.Status,
                Returnable = p.Returnable,
                ImageUrl = p.ImageUrl,
                Color = p.Color
            }).ToList()
        };
    }
}
