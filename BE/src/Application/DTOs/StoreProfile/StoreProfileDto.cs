namespace Application.DTOs.StoreProfile;

/// <summary>Thông tin in hóa đơn, QR, cài đặt bán hàng (07 §2.11, đọc <c>Store.*</c>, <c>Pos.*</c>, <c>Brand.LogoUrl</c>).</summary>
public sealed record StoreProfileDto
{
    public string Name { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string? TaxCode { get; init; }
    public string ReceiptFooter { get; init; } = string.Empty;
    public string ReturnPolicy { get; init; } = string.Empty;

    /// <summary>"80" hoặc "58".</summary>
    public string PaperSize { get; init; } = "80";

    public string BankBin { get; init; } = string.Empty;
    public string BankAccount { get; init; } = string.Empty;
    public string BankAccountName { get; init; } = string.Empty;
    public bool AllowNegativeStock { get; init; }
    public decimal DefaultOpeningCash { get; init; }
    public string? LogoUrl { get; init; }
}
