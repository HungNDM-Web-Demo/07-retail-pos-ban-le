using System.Globalization;
using Application.DTOs.StoreProfile;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.StoreProfile;
using Domain.Entities.System.Settings;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.StoreProfile;

/// <summary>Đọc gộp <c>Store.*</c>, <c>Pos.*</c>, <c>Brand.LogoUrl</c> (06 §3, 07 §2.11).</summary>
public sealed class StoreProfileService(IGenericRepository<Setting> settings) : IStoreProfileService
{
    public async Task<StoreProfileDto> GetAsync(CancellationToken ct = default)
    {
        var values = await settings.QueryNoTracking()
            .Where(s => s.Key.StartsWith("Store.") || s.Key.StartsWith("Pos.") || s.Key == "Brand.LogoUrl")
            .ToDictionaryAsync(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase, ct);

        string Get(string key) => values.GetValueOrDefault(key)?.Trim() ?? string.Empty;

        var taxCode = Get("Store.TaxCode");
        var logo = Get("Brand.LogoUrl");
        return new StoreProfileDto
        {
            Name = Get("Store.Name"),
            Address = Get("Store.Address"),
            Phone = Get("Store.Phone"),
            TaxCode = taxCode.Length == 0 ? null : taxCode,
            ReceiptFooter = Get("Store.ReceiptFooter"),
            ReturnPolicy = Get("Pos.ReturnPolicy"),
            PaperSize = Get("Pos.ReceiptPaperSize") == "58" ? "58" : "80",
            BankBin = Get("Store.BankBin"),
            BankAccount = Get("Store.BankAccount"),
            BankAccountName = Get("Store.BankAccountName"),
            AllowNegativeStock = !string.Equals(Get("Pos.AllowNegativeStock"), "false", StringComparison.OrdinalIgnoreCase),
            DefaultOpeningCash = decimal.TryParse(Get("Pos.DefaultOpeningCash"), NumberStyles.None, CultureInfo.InvariantCulture, out var cash) ? cash : 500_000,
            LogoUrl = logo.Length == 0 ? null : logo
        };
    }
}
